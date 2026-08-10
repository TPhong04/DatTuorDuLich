import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type PostDocument = HydratedDocument<Post>

export type PostCategory = 'promotion' | 'experience' | 'tour_launch' | 'company' | 'culture' | 'guide'
export const POST_CATEGORIES: PostCategory[] = ['promotion', 'experience', 'tour_launch', 'company', 'culture', 'guide']

export type PostStatus = 'draft' | 'pending' | 'published' | 'scheduled'
export const POST_STATUSES: PostStatus[] = ['draft', 'pending', 'published', 'scheduled']

@Schema({ timestamps: true, collection: 'posts' })
export class Post {
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, trim: true })
  title!: string

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  slug!: string

  @Prop({ type: String, required: true, enum: POST_CATEGORIES, default: 'experience', index: true })
  category!: PostCategory

  @Prop({ type: [String], required: true, default: [] })
  tags!: string[]

  @Prop({ type: [Types.ObjectId], required: true, default: [], ref: 'Tour' })
  relatedTourIds!: Types.ObjectId[]

  @Prop({ type: String, required: false, default: null, trim: true })
  excerpt!: string | null

  @Prop({ type: String, required: false, default: null })
  content!: string | null

  @Prop({ type: String, required: false, default: null, trim: true })
  coverImageUrl!: string | null

  @Prop({ type: String, required: true, enum: POST_STATUSES, default: 'draft', index: true })
  status!: PostStatus

  @Prop({ type: Date, default: null, index: true })
  scheduledAt!: Date | null

  @Prop({ type: Date, default: null, index: true })
  publishedAt!: Date | null

  @Prop({ type: Types.ObjectId, required: true, ref: 'User', index: true })
  authorId!: Types.ObjectId

  @Prop({ type: String, required: false, default: null, trim: true })
  seoTitle!: string | null

  @Prop({ type: String, required: false, default: null, trim: true })
  seoDescription!: string | null

  @Prop({ type: Number, required: true, default: 0, min: 0, index: true })
  viewCount!: number

  @Prop({ type: Boolean, required: true, default: false, index: true })
  isPinned!: boolean

  @Prop({ type: String, required: false, default: null, trim: true })
  sourceUrl!: string | null

  @Prop({ type: String, required: false, default: null, trim: true })
  sourceName!: string | null

  @Prop({ type: Boolean, required: true, default: false })
  canStaffEdit!: boolean

  @Prop({ type: Boolean, required: true, default: false })
  canStaffDelete!: boolean

  @Prop({ type: Types.ObjectId, required: false, default: null, ref: 'User' })
  approvedBy!: Types.ObjectId | null

  createdAt!: Date
  updatedAt!: Date
}

export const PostSchema = SchemaFactory.createForClass(Post)
PostSchema.index({ category: 1, status: 1, publishedAt: -1 })
PostSchema.index({ title: 'text', excerpt: 'text', tags: 'text', content: 'text' })