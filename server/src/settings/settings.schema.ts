import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

export type SettingsDocument = HydratedDocument<Settings>

@Schema({ timestamps: true, collection: 'settings' })
export class Settings {
  @Prop({ type: String, required: true, unique: true, default: 'default' })
  key!: string

  @Prop({ type: Object, default: {} })
  company!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  branding!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  home!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  booking!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  payment!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  notifications!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  security!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  integrations!: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  masterData!: Record<string, unknown>
}

export const SettingsSchema = SchemaFactory.createForClass(Settings)
SettingsSchema.index({ key: 1 }, { unique: true })
