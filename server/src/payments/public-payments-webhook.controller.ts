import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Post, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { PaymentsService } from './payments.service'

@Controller('payments/webhooks')
export class PublicPaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('vnpay')
  async vnpayReturn(@Query() query: any, @Res() res: Response) {
    const ok = this.payments.verifyVnpaySignature(query)
    if (!ok) this.payments.throwForbiddenSignature('vnpay')
    const orderCode = this.payments.mapVnpayToBookingCode(query?.vnp_OrderInfo, query?.vnp_TxnRef, query?.vnp_BillNo)
    const isSuccess = this.payments.isSuccessVnpay(query?.vnp_ResponseCode, query?.vnp_TransactionStatus)
    const amount = Math.max(0, Math.round(Number(query?.vnp_Amount || 0) / 100))
    if (isSuccess) {
      await this.payments.applySuccessfulPayment({
        bookingCodeOrId: orderCode,
        amountVnd: amount,
        provider: 'vnpay',
        providerTransactionId: String(query?.vnp_TransactionNo || query?.vnp_BankTranNo || ''),
        providerOrderId: String(query?.vnp_TxnRef || ''),
        status: amount > 0 ? 'paid' : 'paid',
        narration: `VNPay Return vnp_ResponseCode=${query?.vnp_ResponseCode} | vnp_Command=${query?.vnp_Command}`,
        metadata: { vnpayQuery: { ...(query || {}) } },
      })
    }
    const redirect = String(process.env.VNPAY_RETURN_REDIRECT_URL || process.env.WEBAPP_URL || '/account/bookings')
    const sep = redirect.includes('?') ? '&' : '?'
    return res.redirect(`${redirect}${sep}payment=vnpay&status=${isSuccess ? 'success' : 'fail'}&code=${encodeURIComponent(orderCode || '')}&amount=${amount}`)
  }

  @Post('vnpay/ipn')
  async vnpayIpn(@Query() query: any, @Res() res: Response) {
    const ok = this.payments.verifyVnpaySignature(query)
    if (!ok) return res.status(200).json({ RspCode: '97', Message: 'Fail checksum' })
    const orderCode = this.payments.mapVnpayToBookingCode(query?.vnp_OrderInfo, query?.vnp_TxnRef, query?.vnp_BillNo)
    const isSuccess = this.payments.isSuccessVnpay(query?.vnp_ResponseCode, query?.vnp_TransactionStatus)
    const amount = Math.max(0, Math.round(Number(query?.vnp_Amount || 0) / 100))
    if (isSuccess) {
      try {
        await this.payments.applySuccessfulPayment({
          bookingCodeOrId: orderCode,
          amountVnd: amount,
          provider: 'vnpay',
          providerTransactionId: String(query?.vnp_TransactionNo || query?.vnp_BankTranNo || ''),
          providerOrderId: String(query?.vnp_TxnRef || ''),
          status: 'paid',
          narration: `VNPay IPN status=${query?.vnp_TransactionStatus} bank=${query?.vnp_BankCode} pay=${query?.vnp_PayDate}`,
          metadata: { vnpayIpn: { ...(query || {}) } },
        })
        return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' })
      } catch (e: any) {
        return res.status(200).json({ RspCode: String(e?.status || '99'), Message: String(e?.message || 'Error') })
      }
    }
    return res.status(200).json({ RspCode: query?.vnp_ResponseCode || '01', Message: 'Not success' })
  }

  @Post('momo')
  async momo(@Body() body: any, @Res() res: Response) {
    const ok = this.payments.verifyMomoSignature(body)
    if (!ok) this.payments.throwForbiddenSignature('momo')
    const orderCode = this.payments.mapMomoToBookingCode(body?.orderId, body?.orderInfo, body?.extraData)
    const isSuccess = this.payments.isSuccessMomo(body?.resultCode)
    const amount = Math.max(0, Math.round(Number(body?.amount || 0)))
    if (isSuccess) {
      await this.payments.applySuccessfulPayment({
        bookingCodeOrId: orderCode,
        amountVnd: amount,
        provider: 'momo',
        providerTransactionId: String(body?.transId || body?.requestId || ''),
        providerOrderId: String(body?.orderId || ''),
        status: 'paid',
        narration: `MoMo Webhook resultCode=${body?.resultCode} orderType=${body?.orderType}`,
        metadata: { momoBody: { ...(body || {}) } },
      })
    }
    return res.status(200).json({ status: 200, message: 'OK' })
  }

  @Post('stripe')
  async stripe(
    @Headers('stripe-signature') signature: string | undefined,
    @Headers('content-type') contentType: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    let rawBuf: Buffer
    try {
      rawBuf = Buffer.isBuffer((req as any).rawBody)
        ? (req as any).rawBody
        : Buffer.from(JSON.stringify(req.body ?? {}), 'utf8')
    } catch {
      rawBuf = Buffer.from('{}', 'utf8')
    }
    const ok = this.payments.verifyStripeWebhookSignature(rawBuf, signature || null)
    if (!ok) this.payments.throwForbiddenSignature('stripe')
    let event: any = null
    try { event = JSON.parse(rawBuf.toString('utf8')) } catch { event = req.body ?? {} }
    const type = String(event?.type || '')
    const obj: any = event?.data?.object ?? null
    if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded' || type === 'charge.succeeded') {
      const metadata: Record<string, any> = (obj?.metadata) || (obj?.charges?.data?.[0]?.metadata) || (obj?.payment_intent?.metadata) || null
      const description: string = obj?.description || obj?.charges?.data?.[0]?.description || ''
      const charge = type === 'charge.succeeded' ? obj : (obj?.charges?.data?.[0] ?? obj?.latest_charge ?? null)
      const amount = charge ? Number(charge.amount ?? 0) : (Number(obj?.amount_total ?? obj?.amount ?? 0))
      const currency: string = String(charge?.currency ?? obj?.currency ?? 'vnd')
      const amountVnd = this.payments.stripeChargeAmountToVnd(amount, currency)
      const bookingCode = this.payments.mapStripeToBookingCode(metadata, description)
      if (!bookingCode) {
        return res.status(200).json({ received: true, note: 'No booking code in event metadata/description; ignored.' })
      }
      try {
        await this.payments.applySuccessfulPayment({
          bookingCodeOrId: bookingCode,
          amountVnd,
          provider: 'stripe',
          providerTransactionId: String(obj?.id || charge?.id || ''),
          providerOrderId: String(obj?.payment_intent || ''),
          status: 'paid',
          narration: `Stripe ${type} event=${String(obj?.id || '')} currency=${currency}`,
          metadata: { stripeEvent: { type, id: String(event?.id || ''), object: obj ? { id: obj.id, amount, currency } : null } },
        })
      } catch (e: any) {
        if (e instanceof BadRequestException || e instanceof ForbiddenException) throw e
        return res.status(200).json({ received: true, note: `Apply payment failed: ${String(e?.message || String(e) || '')}` })
      }
    }
    return res.status(200).json({ received: true })
  }
}
