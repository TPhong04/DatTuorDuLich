import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type TransactionType = 'sale' | 'refund' | 'deposit_hold' | 'partial_payment' | 'release_hold' | 'settlement'
export type TransactionProvider = 'internal' | 'manual' | 'bank_transfer' | 'vnpay' | 'momo' | 'stripe'
export type TransactionStatus = 'pending' | 'success' | 'failed' | 'reversed'

@Schema({ collection: 'transactions', timestamps: true, autoIndex: true })
export class Transaction {
  _id!: Types.ObjectId

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Booking' })
  bookingId!: Types.ObjectId

  @Prop({ type: String, required: true, index: true })
  bookingCode!: string

  @Prop({ type: Types.ObjectId, required: false, index: true, ref: 'User' })
  createdById?: Types.ObjectId | null

  @Prop({
    type: String,
    required: true,
    enum: ['sale', 'refund', 'deposit_hold', 'partial_payment', 'release_hold', 'settlement'],
    index: true,
  })
  type!: TransactionType

  @Prop({
    type: String,
    required: true,
    enum: ['internal', 'manual', 'bank_transfer', 'vnpay', 'momo', 'stripe'],
    default: 'internal',
    index: true,
  })
  provider!: TransactionProvider

  @Prop({ type: String, required: false, default: null, index: true })
  providerTransactionId?: string | null

  @Prop({ type: String, required: false, default: null, index: true })
  providerOrderId?: string | null

  @Prop({ type: Number, required: true, min: 0 })
  amountVnd!: number

  @Prop({ type: String, required: true, enum: ['VND', 'USD', 'EUR'], default: 'VND' })
  currency!: string

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'success', 'failed', 'reversed'],
    default: 'success',
    index: true,
  })
  status!: TransactionStatus

  @Prop({ type: String, required: false, default: null, maxlength: 500 })
  narration?: string | null

  @Prop({ type: Object, required: false, default: null })
  metadata?: Record<string, any> | null

  createdAt!: Date
  updatedAt!: Date
}

export type TransactionDocument = Transaction & Document
export const TransactionSchema = SchemaFactory.createForClass(Transaction)

TransactionSchema.index({ bookingId: 1, type: 1, status: 1 })
TransactionSchema.index({ provider: 1, providerTransactionId: 1 }, { unique: false, sparse: true })
TransactionSchema.index({ createdAt: -1, type: 1, status: 1 })
