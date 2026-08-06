import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose'

import { UserRole } from '../users/user-role'

export type AuditLogDocument = HydratedDocument<AuditLog>

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: String, required: true })
  actorUserId!: string

  @Prop({ type: String, required: true })
  actorEmail!: string

  @Prop({ type: String, required: true, enum: ['customer', 'staff', 'admin'] })
  actorRole!: UserRole

  @Prop({ type: String, required: true })
  action!: string

  @Prop({ type: String, default: null })
  entityType!: string | null

  @Prop({ type: String, default: null })
  entityId!: string | null

  @Prop({ type: MongooseSchema.Types.Mixed, default: null })
  meta!: unknown
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog)

