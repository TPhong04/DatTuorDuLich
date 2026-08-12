import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type ChatRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'STAFF'

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ChatSession', required: true, index: true })
  sessionId!: Types.ObjectId

  @Prop({ enum: ['USER', 'ASSISTANT', 'SYSTEM', 'STAFF'], required: true })
  role!: ChatRole

  @Prop({ required: true })
  content!: string

  @Prop({ type: Object })
  toolCalls?: Record<string, any> // lưu args nếu Gemini gọi function

  @Prop({ type: Object })
  toolResult?: Record<string, any> // kết quả trả về từ tool
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage)