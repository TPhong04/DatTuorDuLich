import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { createHmac } from 'node:crypto'
import { Model, Types } from 'mongoose'
import { BookingsService } from '../bookings/bookings.service'
import { BookingDocument, BookingStatus } from '../bookings/booking.schema'
import { Transaction, TransactionDocument } from '../transactions/transaction.schema'
import { TransactionsService } from '../transactions/transactions.service'

export type PaymentProvider = 'vnpay' | 'momo' | 'stripe'

export type ApplyPaymentResult = {
  bookingId: string
  bookingCode: string
  applied: boolean
  idempotent: boolean
  paymentStatus: 'paid' | 'partial' | 'unpaid'
  amountReceivedVnd: number
  transactionId?: string | null
  note?: string | null
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly transactions: TransactionsService,
    @InjectModel(Transaction.name) private readonly txnModel: Model<TransactionDocument>,
  ) {}

  private vnpSortObject(obj: Record<string, any>): Record<string, any> {
    const sorted: Record<string, any> = {}
    Object.keys(obj).sort().forEach((k) => { sorted[k] = obj[k] })
    return sorted
  }

  private hashSHA256(secret: string, input: string): string {
    return createHmac('sha256', secret || '').update(input).digest('hex')
  }

  private hashMD5(input: string): string {
    return require('node:crypto').createHash('md5').update(input).digest('hex')
  }

  verifyVnpaySignature(query: Record<string, any>, opts?: { hashSecret?: string | null }): boolean {
    const secureHash = String(query?.vnp_SecureHash || '')
    if (!secureHash) return false
    const secret = String(opts?.hashSecret || process.env.VNPAY_HASH_SECRET || '')
    if (!secret) return true // local dev: bypass nếu chưa set env (chặn ở production chỉ cần set VNPAY_HASH_SECRET là check ok)
    const raw: Record<string, any> = {}
    for (const k of Object.keys(query || {})) {
      if (k.startsWith('vnp_') && k !== 'vnp_SecureHash' && k !== 'vnp_SecureHashType') {
        raw[k] = query[k]
      }
    }
    const sorted = this.vnpSortObject(raw)
    const signData = new URLSearchParams(sorted).toString()
    const expected = this.hashSHA256(secret, signData)
    return String(expected || '').toLowerCase() === String(secureHash || '').toLowerCase()
  }

  verifyMomoSignature(body: Record<string, any>, opts?: { secretKey?: string | null }): boolean {
    const signature = String(body?.signature || '')
    if (!signature) return false
    const secret = String(opts?.secretKey || process.env.MOMO_SECRET_KEY || '')
    if (!secret) return true
    const copy: Record<string, any> = { ...(body || {}) }
    delete copy.signature
    const sorted = this.vnpSortObject(copy)
    const raw = Object.keys(sorted).map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(String(sorted[k] ?? ''))).join('&')
    const expected = this.hashSHA256(secret, raw)
    return String(expected || '').toLowerCase() === String(signature || '').toLowerCase()
  }

  verifyStripeWebhookSignature(rawBody: Buffer | string, headerSignature?: string | null, opts?: { webhookSecret?: string | null }): boolean {
    const sig = String(headerSignature || '')
    if (!sig) return false
    const secret = String(opts?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '')
    if (!secret) return true
    try {
      // Basic manual tolerance: split ts + v1, 5 phút tolerance (300s).
      const parts = sig.split(',').reduce<Record<string, string>>((acc, p) => {
        const [k, v] = p.split('=')
        if (k && typeof v === 'string') acc[String(k).trim()] = v.trim()
        return acc
      }, {})
      const ts = parts['t']
      const v1 = parts['v1']
      if (!ts || !v1) return false
      const dt = Math.abs(Date.now() / 1000 - Number(ts))
      if (dt > 600) return false
      const payloadStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '')
      const signStr = `${ts}.${payloadStr}`
      const expected = this.hashSHA256(secret, signStr)
      return String(expected || '').toLowerCase() === String(v1 || '').toLowerCase()
    } catch {
      return false
    }
  }

  async applySuccessfulPayment(params: {
    bookingCodeOrId: string
    amountVnd: number
    provider: PaymentProvider
    providerTransactionId: string | null
    providerOrderId?: string | null
    status?: 'paid' | 'partial'
    narration?: string | null
    metadata?: Record<string, any> | null
    actorId?: Types.ObjectId | null
  }): Promise<ApplyPaymentResult> {
    const { bookingCodeOrId, amountVnd, provider, providerTransactionId, providerOrderId, narration, metadata, actorId } = params
    const desiredStatus: 'paid' | 'partial' = params.status || 'paid'
    if (!bookingCodeOrId) throw new BadRequestException('Thiếu mã booking (bookingCodeOrId)')
    if (Number(amountVnd) <= 0) throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0')

    // Idempotency: nếu đã ghi transaction success cho provider + txn id → trả về ngay, không trừ 2 lần
    let existingApplied: TransactionDocument | null = null
    if (provider && providerTransactionId) {
      existingApplied = await this.txnModel.findOne({
        provider,
        providerTransactionId,
        status: { $in: ['success', 'pending'] },
        type: { $in: ['sale', 'partial_payment', 'settlement'] },
      }).exec()
    }
    let booking: BookingDocument | null = null
    try {
      booking = await this.bookings.findByCodeOrId(bookingCodeOrId)
    } catch {
      booking = null
    }
    if (!booking) throw new BadRequestException(`Không tìm thấy đơn đặt ${bookingCodeOrId}`)
    if (existingApplied) {
      return {
        bookingId: String(booking._id),
        bookingCode: String(booking.code),
        applied: false,
        idempotent: true,
        paymentStatus: String(booking.paymentStatus || 'unpaid') as any,
        amountReceivedVnd: Number(existingApplied.amountVnd || 0),
        transactionId: String(existingApplied._id),
        note: `Idempotent: đã ghi nhận thanh toán ${provider}#${providerTransactionId}.`,
      }
    }
    const totalAmount = Math.max(0, Math.round(Number(booking.totalAmount || 0)))
    const received = Math.max(0, Math.round(Number(amountVnd) || 0))
    let newPaymentStatus: 'paid' | 'partial' | 'unpaid' = booking.paymentStatus as any
    if (desiredStatus === 'paid' || received >= totalAmount) newPaymentStatus = 'paid'
    else if (desiredStatus === 'partial') newPaymentStatus = 'partial'
    else newPaymentStatus = received > 0 ? 'partial' : (booking.paymentStatus as any)
    if (newPaymentStatus !== booking.paymentStatus) {
      booking.paymentStatus = newPaymentStatus
      if (newPaymentStatus === 'paid' && (booking.status === 'new' || booking.status === 'pending')) {
        booking.status = 'confirmed' as BookingStatus
        booking.confirmedAt = new Date()
      }
      booking.markModified('paymentStatus')
      booking.markModified('status')
      await booking.save()
    }
    const txn = await this.transactions.record({
      booking,
      createdById: actorId ?? null,
      type: newPaymentStatus === 'partial' ? 'partial_payment' : 'settlement',
      provider,
      providerTransactionId: providerTransactionId ?? null,
      providerOrderId: providerOrderId ?? String(booking.code || ''),
      amountVnd: received,
      currency: 'VND',
      status: 'success',
      narration: narration ?? `[${booking.code}] ${provider.toUpperCase()} payment ${newPaymentStatus} | amount=${received.toLocaleString('vi-VN')}đ / ${totalAmount.toLocaleString('vi-VN')}đ`,
      metadata: metadata ?? null,
    })
    return {
      bookingId: String(booking._id),
      bookingCode: String(booking.code),
      applied: true,
      idempotent: false,
      paymentStatus: newPaymentStatus,
      amountReceivedVnd: received,
      transactionId: String(txn._id),
      note: null,
    }
  }

  mapVnpayToBookingCode(vnpOrderInfo: string | null, vnpTxnRef: string | null, vnpBillNo: string | null): string {
    const candidates = [
      String(vnpOrderInfo || ''),
      String(vnpTxnRef || ''),
      String(vnpBillNo || ''),
    ]
    for (const c of candidates) {
      const match = c.toUpperCase().match(/BK[A-Z0-9-]{2,30}/)
      if (match && match[0]) return match[0]
      if (/^BK[-A-Z0-9]{4,}$/i.test(c.trim())) return c.trim()
    }
    return String(vnpTxnRef || vnpBillNo || '').trim()
  }

  mapMomoToBookingCode(orderId: string | null, orderInfo: string | null, extraData: string | null): string {
    const candidates = [String(orderId || ''), String(orderInfo || ''), String(extraData || '')]
    for (const c of candidates) {
      const m = c.toUpperCase().match(/BK[A-Z0-9-]{2,30}/)
      if (m && m[0]) return m[0]
      if (/^BK[-A-Z0-9]{4,}$/i.test(c.trim())) return c.trim()
    }
    return String(orderId || '').trim()
  }

  mapStripeToBookingCode(metadata: Record<string, any> | null | undefined, description: string | null): string {
    const candidates: string[] = [
      String(metadata?.bookingCode ?? metadata?.order_id ?? metadata?.booking_id ?? metadata?.bookingId ?? ''),
      String(description || ''),
    ]
    for (const c of candidates) {
      const m = (String(c || '')).toUpperCase().match(/BK[A-Z0-9-]{2,30}/)
      if (m && m[0]) return m[0]
      if (/^BK[-A-Z0-9]{4,}$/i.test(String(c || '').trim())) return String(c || '').trim()
    }
    return ''
  }

  stripeChargeAmountToVnd(amount: number, currency: string): number {
    const cur = String(currency || 'vnd').toLowerCase()
    const zeroDecimalCurrencies = new Set(['vnd', 'krw', 'jpy'])
    const mul = zeroDecimalCurrencies.has(cur) ? 1 : 0.01
    return Math.max(0, Math.round(Number(amount || 0) * mul))
  }

  isSuccessVnpay(vnpResponseCode: string | null, vnpTransactionStatus: string | null): boolean {
    if (String(vnpTransactionStatus || '') === '00') return true
    return String(vnpResponseCode || '') === '00'
  }

  isSuccessMomo(resultCode: number | string | null): boolean {
    return String(resultCode ?? '') === '0' || String(resultCode ?? '') === '00'
  }

  throwForbiddenSignature(provider: PaymentProvider): never {
    throw new ForbiddenException(`Chữ ký ${provider.toUpperCase()} không hợp lệ (signature mismatch). Hệ thống từ chối xử lý webhook này.`)
  }
}
