import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type BookingDocument = HydratedDocument<Booking>

export type BookingStatus =
  | 'pending'
  | 'new'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type BookingPaymentMethod = 'hold' | 'bank_transfer' | 'online'
export type BookingPaymentStatus = 'unpaid' | 'partial' | 'paid'
export type BookingPassengerType = 'NL' | 'TE' | 'EB'
export type BookingGender = 'male' | 'female' | 'other'

export type BookingPassenger = {
  fullName: string
  type: BookingPassengerType
  birthDate: Date | null
  gender: BookingGender | null
  idCard: string | null
  notes: string | null
}

export type BookingSurchargeLine = {
  label: string
  quantity: number
  unitPrice: number
  note: string | null
}

export type BookingTourSnapshot = {
  title: string
  slug: string
  code: string | null
  durationDays: number
  durationNights: number
  coverImageUrl: string | null
}

@Schema({ timestamps: true })
export class Booking {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  code!: string

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'Tour' })
  tourId!: Types.ObjectId

  @Prop({ type: Object, required: true })
  tourSnapshot!: BookingTourSnapshot

  @Prop({ type: Types.ObjectId, required: true, index: true })
  departureId!: Types.ObjectId

  @Prop({ type: Date, required: true })
  departureDate!: Date

  @Prop({ type: String, default: null, trim: true })
  departureStandardText!: string | null

  @Prop({ type: Number, required: true, min: 0, default: 1 })
  adultCount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  childCount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  infantCount!: number

  @Prop({ type: Number, required: true, min: 0 })
  priceAdultSnapshot!: number

  @Prop({ type: Number, default: null })
  priceChildSnapshot!: number | null

  @Prop({ type: Number, default: null })
  priceInfantSnapshot!: number | null

  @Prop({
    type: Object,
    required: true,
    default: { name: '', phone: '', email: null, address: null },
  })
  contact!: { name: string; phone: string; email: string | null; address: string | null }

  @Prop({ type: [Object], required: true, default: [] })
  passengers!: BookingPassenger[]

  @Prop({ type: String, default: null, trim: true })
  notes!: string | null

  @Prop({ type: [Object], default: [] })
  surcharges!: BookingSurchargeLine[]

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  subtotalAmount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  surchargeAmount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  vatAmount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  totalAmount!: number

  @Prop({ type: String, required: true, default: 'VND', enum: ['VND'] })
  currency!: 'VND'

  @Prop({
    type: String,
    required: true,
    enum: ['hold', 'bank_transfer', 'online'],
    default: 'hold',
  })
  paymentMethod!: BookingPaymentMethod

  @Prop({
    type: String,
    required: true,
    enum: ['unpaid', 'partial', 'paid'],
    default: 'unpaid',
  })
  paymentStatus!: BookingPaymentStatus

  @Prop({ type: String, default: null, trim: true })
  adminNote!: string | null

  @Prop({ type: Types.ObjectId, default: null, index: true, ref: 'User' })
  createdBy!: Types.ObjectId | null

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'new', 'confirmed', 'in_progress', 'completed', 'cancelled'],
    default: 'new',
    index: true,
  })
  status!: BookingStatus

  @Prop({ type: Date, default: null })
  holdsUntil!: Date | null

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null

  @Prop({ type: Date, default: null })
  confirmedAt!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const BookingSchema = SchemaFactory.createForClass(Booking)
BookingSchema.index({ tourId: 1, departureDate: 1 })
BookingSchema.index({ status: 1, createdAt: -1 })
BookingSchema.index({ createdBy: 1, createdAt: -1 })
BookingSchema.index({ 'contact.phone': 1 })
