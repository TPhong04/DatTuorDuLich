import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { BookingDocument } from '../bookings/booking.schema'
import {
  Transaction,
  TransactionDocument,
  TransactionProvider,
  TransactionStatus,
  TransactionType,
} from './transaction.schema'

export type CreateTransactionInput = {
  booking: BookingDocument
  createdById?: Types.ObjectId | null
  type: TransactionType
  provider?: TransactionProvider
  providerTransactionId?: string | null
  providerOrderId?: string | null
  amountVnd: number
  currency?: 'VND' | 'USD' | 'EUR'
  status?: TransactionStatus
  narration?: string | null
  metadata?: Record<string, any> | null
}

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly model: Model<TransactionDocument>,
  ) {}

  async listByBookingId(bookingId: Types.ObjectId | string) {
    const oid = typeof bookingId === 'string' ? new Types.ObjectId(bookingId) : bookingId
    return this.model.find({ bookingId: oid }).sort({ createdAt: -1 }).lean().exec()
  }

  async record(input: CreateTransactionInput): Promise<TransactionDocument> {
    const {
      booking,
      createdById,
      type,
      provider = 'internal',
      providerTransactionId,
      providerOrderId,
      amountVnd,
      currency = 'VND',
      status = 'success',
      narration,
      metadata,
    } = input
    const doc = await this.model.create({
      bookingId: booking._id instanceof Types.ObjectId ? booking._id : new Types.ObjectId(String((booking as any)._id || booking.id)),
      bookingCode: String(booking.code || ''),
      createdById: createdById && Types.ObjectId.isValid(String(createdById)) ? new Types.ObjectId(String(createdById)) : null,
      type,
      provider,
      providerTransactionId: providerTransactionId ?? null,
      providerOrderId: providerOrderId ?? null,
      amountVnd: Math.max(0, Math.round(Number(amountVnd) || 0)),
      currency,
      status,
      narration: narration ?? null,
      metadata: metadata ?? null,
    })
    return doc.save()
  }

  async recordSaleFromBooking(booking: BookingDocument, opts: { createdById?: Types.ObjectId | null; narration?: string | null } = {}): Promise<TransactionDocument | null> {
    const total = Math.round(Number(booking.totalAmount || 0))
    if (total <= 0) return null
    const provider: TransactionProvider =
      booking.paymentMethod === 'bank_transfer'
        ? 'bank_transfer'
        : booking.paymentMethod === 'online'
        ? 'manual'
        : 'internal'
    return this.record({
      booking,
      createdById: opts.createdById ?? (booking as any).createdBy ?? null,
      type: 'sale',
      provider,
      providerOrderId: String(booking.code || ''),
      amountVnd: total,
      currency: 'VND',
      status: booking.paymentStatus === 'paid' ? 'success' : booking.paymentStatus === 'partial' ? 'success' : 'pending',
      narration: opts.narration ?? `[${booking.code}] Sale ${booking.paymentMethod ?? 'hold'} | paymentStatus=${booking.paymentStatus ?? 'unpaid'}`,
      metadata: {
        subtotal: Number(booking.subtotalAmount || 0),
        surcharge: Number(booking.surchargeAmount || 0),
        vat: Number(booking.vatAmount || 0),
        pax: {
          NL: Number(booking.adultCount || 0),
          TE: Number(booking.childCount || 0),
          EB: Number(booking.infantCount || 0),
        },
        holdUntil: booking.holdsUntil ? new Date(booking.holdsUntil).toISOString() : null,
      },
    })
  }

  async recordRefundFromCancelledBooking(
    booking: BookingDocument,
    opts: { createdById?: Types.ObjectId | null; narration?: string | null; refundRatio?: number } = {},
  ): Promise<TransactionDocument | null> {
    const total = Math.round(Number(booking.totalAmount || 0))
    if (total <= 0) return null
    const paidAmount =
      booking.paymentStatus === 'paid'
        ? total
        : booking.paymentStatus === 'partial'
        ? Math.round(total * 0.5)
        : 0
    if (paidAmount <= 0) return null
    const ratio = typeof opts.refundRatio === 'number' && !Number.isNaN(opts.refundRatio) ? Math.min(1, Math.max(0, opts.refundRatio)) : 1
    const refundVnd = Math.max(0, Math.round(paidAmount * ratio))
    if (refundVnd <= 0) return null
    const provider: TransactionProvider =
      booking.paymentMethod === 'bank_transfer' ? 'bank_transfer' : booking.paymentMethod === 'online' ? 'manual' : 'internal'
    return this.record({
      booking,
      createdById: opts.createdById ?? null,
      type: 'refund',
      provider,
      providerOrderId: String(booking.code || ''),
      amountVnd: refundVnd,
      currency: 'VND',
      status: 'success',
      narration:
        opts.narration ??
        `[${booking.code}] Refund do hủy đơn (cancelledAt=${new Date().toLocaleString('vi-VN')} · refundRatio=${Math.round(ratio * 100)}%)`,
      metadata: {
        totalAmount: total,
        paidAmount,
        refundRatio: ratio,
        cancelledNote: String(booking.adminNote || '').slice(0, 200),
      },
    })
  }

  async recordReleaseHold(booking: BookingDocument, opts: { createdById?: Types.ObjectId | null; narration?: string | null } = {}): Promise<TransactionDocument | null> {
    const total = Math.round(Number(booking.totalAmount || 0))
    if (total <= 0) return null
    return this.record({
      booking,
      createdById: opts.createdById ?? null,
      type: 'release_hold',
      provider: 'internal',
      providerOrderId: String(booking.code || ''),
      amountVnd: total,
      currency: 'VND',
      status: 'reversed',
      narration: opts.narration ?? `[${booking.code}] Release hold (expired holdsUntil)`,
      metadata: { holdsUntil: booking.holdsUntil ? new Date(booking.holdsUntil).toISOString() : null, status: booking.status },
    })
  }
}
