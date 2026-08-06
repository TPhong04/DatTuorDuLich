import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type BannerDocument = HydratedDocument<Banner>

export type BannerTargetType = 'none' | 'internal' | 'external'

@Schema({ timestamps: true })
export class Banner {
  @Prop({ type: String, required: true })
  imageUrl!: string

  @Prop({ type: String, default: null, trim: true })
  title!: string | null

  @Prop({ type: String, required: true, enum: ['none', 'internal', 'external'], default: 'none' })
  targetType!: BannerTargetType

  @Prop({ type: String, default: null, trim: true })
  targetValue!: string | null

  @Prop({ type: Boolean, required: true, default: false })
  openInNewTab!: boolean

  @Prop({ type: Number, required: true, default: 0 })
  order!: number

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean

  @Prop({ type: Date, default: null })
  startAt!: Date | null

  @Prop({ type: Date, default: null })
  endAt!: Date | null
}

export const BannerSchema = SchemaFactory.createForClass(Banner)

