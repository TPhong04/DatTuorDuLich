import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

export type ChatStatus = 'BOT' | 'ESCALATED' | 'CLOSED'

@Schema({ timestamps: true })
export class ChatSession extends Document {
  @Prop()
  userId?: string // để trống nếu khách chưa đăng nhập (guest)

  @Prop()
  guestName?: string

  @Prop()
  guestEmail?: string

  @Prop({ enum: ['BOT', 'ESCALATED', 'CLOSED'], default: 'BOT' })
  status!: ChatStatus

  @Prop()
  assignedTo?: string // id của staff/admin xử lý khi escalated
}

export const ChatSessionSchema = SchemaFactory.createForClass(ChatSession)
ChatSessionSchema.index({ status: 1 })
ChatSessionSchema.index({ userId: 1 })