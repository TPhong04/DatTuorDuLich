import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type ReviewDocument = HydratedDocument<Review>

export type ReviewStatus = 'published' | 'hidden' | 'deleted'
export const REVIEW_STATUSES: ReviewStatus[] = ['published', 'hidden', 'deleted']

export type ReviewRating = 1 | 2 | 3 | 4 | 5

@Schema({ timestamps: true, collection: 'reviews' })
export class Review {
  _id!: Types.ObjectId

  @Prop({ type: Types.ObjectId, required: true, ref: 'Tour', index: true })
  tourId!: Types.ObjectId

  @Prop({ type: String, required: true, trim: true, default: '' })
  tourTitleSnapshot!: string

  @Prop({ type: Types.ObjectId, required: true, ref: 'Booking', index: true })
  bookingId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  customerId!: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  customerName!: string

  @Prop({ type: String, required: false, default: null, trim: true })
  customerAvatarUrl!: string | null

  @Prop({ type: Number, required: true, enum: [1, 2, 3, 4, 5], index: true })
  rating!: ReviewRating

  @Prop({ type: String, required: false, default: null, trim: true })
  title!: string | null

  @Prop({ type: String, required: true, trim: true })
  content!: string

  @Prop({ type: [String], required: true, default: [] })
  images!: string[]

  @Prop({ type: Date, required: true, index: true })
  tripDate!: Date

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  likeCount!: number

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User', required: true }],
    default: [],
  })
  likedByUserIds!: Types.ObjectId[]

  @Prop({
    type: String,
    required: true,
    enum: REVIEW_STATUSES,
    default: 'published',
    index: true,
  })
  status!: ReviewStatus

  @Prop({ type: Boolean, required: true, default: true, index: true })
  isVerified!: boolean

  @Prop({ type: Boolean, required: true, default: false, index: true })
  isReported!: boolean

  @Prop({ type: Number, required: true, default: 0, min: 0, index: true })
  reportCount!: number

  @Prop({
    type: [
      {
        reportedByUserId: { type: Types.ObjectId, ref: 'User', default: null },
        reportedByGuestIp: { type: String, default: null, trim: true },
        reason: { type: String, required: true, trim: true },
        detail: { type: String, default: null, trim: true },
        createdAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
    default: [],
  })
  reports!: {
    reportedByUserId: Types.ObjectId | null
    reportedByGuestIp: string | null
    reason: string
    detail: string | null
    createdAt: Date
  }[]

  @Prop({ type: Boolean, required: true, default: false, index: true })
  requireStaffRemoval!: boolean

  @Prop({ type: Boolean, required: true, default: false })
  canStaffDelete!: boolean

  @Prop({ type: Boolean, required: true, default: false })
  canStaffEdit!: boolean

  @Prop({ type: String, required: false, default: null, trim: true })
  adminReply!: string | null

  @Prop({ type: Types.ObjectId, required: false, default: null, ref: 'User' })
  adminReplyBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  adminReplyAt!: Date | null

  @Prop({ type: String, required: false, default: null, trim: true })
  staffReply!: string | null

  @Prop({ type: Types.ObjectId, required: false, default: null, ref: 'User' })
  staffReplyBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  staffReplyAt!: Date | null

  @Prop({ type: Types.ObjectId, required: false, default: null, ref: 'User' })
  removedByStaffId!: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  removedAt!: Date | null

  @Prop({ type: Types.ObjectId, required: false, default: null, ref: 'User' })
  removedBy!: Types.ObjectId | null

  @Prop({ type: Date, default: null, index: true })
  editableUntil!: Date | null

  createdAt!: Date
  updatedAt!: Date
}

export const ReviewSchema = SchemaFactory.createForClass(Review)
ReviewSchema.index({ tourId: 1, status: 1, rating: -1, createdAt: -1 })
ReviewSchema.index({ customerId: 1, tourId: 1 }, { unique: true })
ReviewSchema.index({ requireStaffRemoval: 1, isReported: 1, reportCount: -1 })
ReviewSchema.index({ customerId: 1, createdAt: -1 })
