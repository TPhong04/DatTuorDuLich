import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'
import { UserRole } from '../users/user-role'

export type NotificationDocument = HydratedDocument<Notification>
export type NotificationSettingDocument = HydratedDocument<NotificationSetting>

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'zalo'
export type NotificationType =
  | 'gtr_created'
  | 'gtr_assigned_staff'
  | 'gtr_contacted'
  | 'gtr_quoting'
  | 'gtr_negotiating'
  | 'gtr_won'
  | 'gtr_lost'
  | 'gtr_booking_created'
  | 'booking_deposit_paid'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_eticket_ready'
  | 'booking_deposit_overdue'
  | 'booking_trip_reminder_48h'
  | 'booking_trip_completed'
  | 'booking_daily_report'
  | 'booking_risk_overbook'
  | 'staff_followup_due'
  | 'staff_kpi_summary'
  | 'staff_quote_not_won'
  | 'admin_new_gtr'
  | 'admin_gtr_won_large'
  | 'admin_gtr_lost_large'
  | 'admin_staff_created'
  | 'admin_staff_reassign'
  | 'admin_server_error'
  | 'user_login_new_device'
  | 'survey_nps'
  | 'system_info'
  | 'rental_inquiry_confirmed'
  | 'admin_rental_inquiry_confirmed'

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, index: true })
  recipientId!: Types.ObjectId

  @Prop({ type: String, required: true, enum: ['customer', 'staff', 'admin'] })
  recipientRole!: UserRole

  @Prop({ type: String, required: true, index: true })
  type!: NotificationType

  @Prop({ type: String, required: true })
  title!: string

  @Prop({ type: String, required: true })
  body!: string

  @Prop({ type: [String], default: [], enum: ['in_app', 'email', 'sms', 'zalo'] })
  channels!: NotificationChannel[]

  @Prop({ type: [String], default: [], enum: ['in_app', 'email', 'sms', 'zalo'] })
  sentVia!: NotificationChannel[]

  @Prop({ type: [String], default: [], enum: ['in_app', 'email', 'sms', 'zalo'] })
  failedVia!: NotificationChannel[]

  @Prop({ type: Boolean, default: false, index: true })
  isRead!: boolean

  @Prop({ type: Date, default: null })
  readAt!: Date | null

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  payload!: unknown

  @Prop({ type: String, default: null })
  entityType!: string | null

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  entityId!: Types.ObjectId | null

  @Prop({ type: String, default: null })
  actionUrl!: string | null

  @Prop({ type: String, default: 'medium', enum: ['low', 'medium', 'high', 'urgent'] })
  priority!: 'low' | 'medium' | 'high' | 'urgent'

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  senderUserId!: Types.ObjectId | null

  @Prop({ type: Number, default: 0 })
  retryCount!: number

  @Prop({ type: Date, default: null })
  lastErrorAt!: Date | null

  @Prop({ type: String, default: null })
  lastErrorMessage!: string | null
}

export const NotificationSchema = SchemaFactory.createForClass(Notification)
NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 })
NotificationSchema.index({ recipientId: 1, createdAt: -1 })
NotificationSchema.index({ type: 1, createdAt: -1 })
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 })

@Schema({ timestamps: true, collection: 'notification_settings' })
export class NotificationSetting {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId!: Types.ObjectId

  @Prop({ type: Object, default: {} })
  muted!: Record<string, boolean>

  @Prop({ type: Object, default: {} })
  channelsPerType!: Record<string, NotificationChannel[]>

  @Prop({ type: Boolean, default: true })
  enableEmail!: boolean

  @Prop({ type: Boolean, default: true })
  enableSms!: boolean

  @Prop({ type: Boolean, default: true })
  enableInApp!: boolean

  @Prop({ type: Boolean, default: false })
  enableZalo!: boolean

  @Prop({ type: [String], default: [] })
  quietHours!: string[]
}

export const NotificationSettingSchema = SchemaFactory.createForClass(NotificationSetting)
