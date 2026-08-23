import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ChatStatus = 'BOT' | 'ESCALATED' | 'CLOSED'

export type ChatSlaStatus = 'within_sla' | 'breached_pickup' | 'breached_reply' | 'unknown'

export type ChatClosedReason =
  | 'resolved_by_staff'
  | 'resolved_by_bot'
  | 'customer_idle_timeout'
  | 'staff_closed'
  | 'admin_closed'
  | 'auto_closed_24h'
  | 'unknown'

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId | string | null // null nếu khách chưa đăng nhập (guest)

  @Prop({ type: String, trim: true, maxlength: 100, default: null })
  guestName?: string | null

  @Prop({ type: String, trim: true, maxlength: 150, default: null })
  guestEmail?: string | null

  @Prop({ type: String, trim: true, maxlength: 20, default: null })
  guestPhone?: string | null

  @Prop({ enum: ['BOT', 'ESCALATED', 'CLOSED'], default: 'BOT', index: true })
  status!: ChatStatus

  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  assignedTo?: Types.ObjectId | string | null // id của staff/admin xử lý khi escalated

  @Prop({ type: Date, default: null })
  assignedAt?: Date | null

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  escalationReason?: string | null

  @Prop({ type: Date, default: null })
  escalatedAt?: Date | null

  @Prop({ type: Date, default: null })
  firstResponseAt?: Date | null // Staff trả lời lần đầu sau khi escalate

  @Prop({ type: Number, default: null })
  firstResponseSeconds?: number | null // metric SLA: thời gian staff reply lần đầu (tính từ escalatedAt)

  @Prop({ type: Date, default: null, index: true })
  lastCustomerMessageAt?: Date | null

  @Prop({ type: Date, default: null })
  lastStaffMessageAt?: Date | null

  @Prop({ type: Number, default: null, min: 1, max: 5 })
  ratingStars?: number | null

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  ratingComment?: string | null

  @Prop({ type: Date, default: null })
  ratedAt?: Date | null

  @Prop({ type: Date, default: null })
  closedAt?: Date | null

  @Prop({
    type: String,
    enum: ['resolved_by_staff', 'resolved_by_bot', 'customer_idle_timeout', 'staff_closed', 'admin_closed', 'auto_closed_24h', 'unknown'],
    default: null,
  })
  closedReason?: ChatClosedReason | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  closedByStaffId?: Types.ObjectId | string | null

  @Prop({ type: Number, default: 0, min: 0 })
  customerMessagesCount?: number

  @Prop({ type: Number, default: 0, min: 0 })
  staffMessagesCount?: number

  @Prop({ type: Number, default: 0, min: 0 })
  botMessagesCount?: number

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  escalatedByStaffId?: Types.ObjectId | string | null // nếu admin/staff tự escalate một session BOT
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession)
ChatSessionSchema.index({ status: 1 })
ChatSessionSchema.index({ userId: 1 })
ChatSessionSchema.index({ assignedTo: 1, status: 1 })
ChatSessionSchema.index({ escalatedAt: -1 })
ChatSessionSchema.index({ updatedAt: -1 })
ChatSessionSchema.index({ lastCustomerMessageAt: -1 })
