import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document, Types } from 'mongoose'

export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'
export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TodoCategory = 'hotel' | 'flight' | 'visa' | 'guide' | 'transport' | 'other'

@Schema({ collection: 'todos', timestamps: true, autoIndex: true })
export class Todo {
  _id!: Types.ObjectId

  @Prop({ type: Types.ObjectId, required: false, index: true, ref: 'GroupTourRequest' })
  groupTourRequestId?: Types.ObjectId | null

  @Prop({ type: String, required: false, index: true })
  groupTourRequestCode?: string | null

  @Prop({ type: Types.ObjectId, required: false, index: true, ref: 'Booking' })
  bookingId?: Types.ObjectId | null

  @Prop({ type: String, required: false, index: true })
  bookingCode?: string | null

  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'User' })
  assigneeId!: Types.ObjectId

  @Prop({
    type: String,
    required: true,
    enum: ['hotel', 'flight', 'visa', 'guide', 'transport', 'other'],
    index: true,
    default: 'other',
  })
  category!: TodoCategory

  @Prop({ type: String, required: true, maxlength: 200 })
  title!: string

  @Prop({ type: String, required: false, maxlength: 2000, default: null })
  description?: string | null

  @Prop({ type: Number, required: true, index: true, default: 0 })
  order!: number

  @Prop({
    type: String,
    required: true,
    enum: ['todo', 'in_progress', 'done', 'cancelled'],
    index: true,
    default: 'todo',
  })
  status!: TodoStatus

  @Prop({
    type: String,
    required: true,
    enum: ['low', 'normal', 'high', 'urgent'],
    index: true,
    default: 'normal',
  })
  priority!: TodoPriority

  @Prop({ type: Date, required: false, index: true })
  dueAt?: Date | null

  @Prop({ type: Date, required: false, index: true })
  doneAt?: Date | null

  @Prop({ type: Types.ObjectId, required: false, index: true, ref: 'User' })
  doneById?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, required: false, index: true, ref: 'User' })
  createdById?: Types.ObjectId | null

  @Prop({ type: Object, required: false, default: null })
  metadata?: Record<string, any> | null

  createdAt!: Date
  updatedAt!: Date
}

export type TodoDocument = Todo & Document
export const TodoSchema = SchemaFactory.createForClass(Todo)

TodoSchema.index({ groupTourRequestId: 1, order: 1 })
TodoSchema.index({ assigneeId: 1, status: 1, dueAt: 1 })
TodoSchema.index({ category: 1, status: 1, dueAt: -1 })
