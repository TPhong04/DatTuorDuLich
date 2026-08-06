import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument } from 'mongoose'

import { UserRole } from './user-role'

export type UserDocument = HydratedDocument<User>

export type UserAddress = {
  province: string | null
  district: string | null
  ward: string | null
  line1: string | null
}

export type UserEmergencyContact = {
  name: string | null
  phone: string | null
  relation: string | null
}

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, required: true, trim: true })
  name!: string

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email!: string

  @Prop({ type: String, default: null, trim: true })
  phone!: string | null

  @Prop({ type: String, enum: ['male', 'female', 'other'], default: null })
  gender!: 'male' | 'female' | 'other' | null

  @Prop({ type: String, default: null })
  avatarUrl!: string | null

  @Prop({ type: String, default: null, trim: true })
  dateOfBirth!: string | null

  @Prop({ type: Object, default: null })
  address!: UserAddress | null

  @Prop({ type: Object, default: null })
  emergencyContact!: UserEmergencyContact | null

  @Prop({ type: String, default: null, trim: true })
  citizenId!: string | null

  @Prop({ type: String, default: null, trim: true })
  passportNumber!: string | null

  @Prop({ type: String, default: null, trim: true })
  dietary!: string | null

  @Prop({ type: String, default: null, trim: true })
  medicalNotes!: string | null

  @Prop({ type: Boolean, required: true, default: true })
  isActive!: boolean

  @Prop({ type: String, required: true })
  passwordHash!: string

  @Prop({ type: String, required: true, enum: ['customer', 'staff', 'admin'], default: 'customer' })
  role!: UserRole

  @Prop({ type: String, default: null })
  refreshTokenHash!: string | null

  @Prop({ type: Date, default: null })
  passwordResetAt!: Date | null
}

export const UserSchema = SchemaFactory.createForClass(User)
