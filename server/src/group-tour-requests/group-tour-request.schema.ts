import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'

export type GroupTourRequestDocument = HydratedDocument<GroupTourRequest>

export type GroupTourRequestStatus =
  | 'new'
  | 'contacted'
  | 'quoting'
  | 'negotiating'
  | 'won'
  | 'converted_booking'
  | 'lost'
  | 'archived'

export type GroupTourRequestPriority = 'low' | 'normal' | 'high' | 'urgent'

export type GroupTourServicePreference = {
  needVisa: boolean
  needFlight: boolean
  needBus: boolean
  needHotel: boolean
  needMeals: boolean
  needGuide: boolean
}

@Schema({ timestamps: true })
export class GroupTourRequest {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  code!: string

  @Prop({ type: String, required: true, enum: ['new', 'contacted', 'quoting', 'negotiating', 'won', 'converted_booking', 'lost', 'archived'], default: 'new', index: true })
  status!: GroupTourRequestStatus

  @Prop({ type: String, required: true, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal', index: true })
  priority!: GroupTourRequestPriority

  @Prop({ type: String, required: true, trim: true })
  contactName!: string

  @Prop({ type: String, required: true, trim: true, index: true })
  contactPhone!: string

  @Prop({ type: String, default: null, trim: true })
  contactEmail!: string | null

  @Prop({ type: String, default: null, trim: true })
  contactRole!: string | null

  @Prop({ type: String, required: true, trim: true })
  companyOrGroupName!: string

  @Prop({ type: String, default: null, trim: true })
  companyTaxCode!: string | null

  @Prop({ type: Number, required: true, min: 1, default: 1 })
  adultCount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  childCount!: number

  @Prop({ type: Number, required: true, min: 0, default: 0 })
  infantCount!: number

  @Prop({ type: String, default: null, trim: true })
  departureCity!: string | null

  @Prop({ type: String, required: true, trim: true })
  destination!: string

  @Prop({ type: String, default: null, trim: true })
  approximateDurationText!: string | null

  @Prop({ type: Date, default: null })
  preferredStartDate!: Date | null

  @Prop({ type: Date, default: null })
  preferredEndDate!: Date | null

  @Prop({ type: String, default: null, trim: true })
  hotelClassRequested!: string | null

  @Prop({ type: Object, required: true, default: { needVisa: false, needFlight: false, needBus: false, needHotel: true, needMeals: true, needGuide: true } })
  servicesPreference!: GroupTourServicePreference

  @Prop({ type: String, default: null, trim: true })
  transportRequestedNotes!: string | null

  @Prop({ type: Number, default: null })
  budgetPerPersonVnd!: number | null

  @Prop({ type: Number, default: null })
  totalBudgetVnd!: number | null

  @Prop({ type: String, default: null, trim: true })
  specialRequirements!: string | null

  @Prop({ type: Number, default: 0 })
  quoteCount!: number

  @Prop({ type: String, default: null, trim: true })
  lastQuoteSummary!: string | null

  @Prop({ type: Date, default: null })
  followUpAt!: Date | null

  @Prop({ type: Date, default: null })
  lastContactedAt!: Date | null

  @Prop({ type: Date, default: null })
  wonAt!: Date | null

  @Prop({ type: Types.ObjectId, default: null, index: true, ref: 'User' })
  assignedStaffId!: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, default: null, index: true, ref: 'Booking' })
  convertedBookingId!: Types.ObjectId | null

  @Prop({ type: String, default: null, trim: true })
  lostReason!: string | null

  @Prop({ type: String, default: null, trim: true })
  internalStaffNote!: string | null

  @Prop({ type: Types.ObjectId, default: null, index: true, ref: 'User' })
  createdByUserId!: Types.ObjectId | null

  @Prop({ type: String, default: null, trim: true })
  sourceChannel!: string | null

  @Prop({ type: String, default: null, trim: true })
  ipAddress!: string | null

  createdAt!: Date
  updatedAt!: Date
}

export const GroupTourRequestSchema = SchemaFactory.createForClass(GroupTourRequest)
GroupTourRequestSchema.index({ status: 1, createdAt: -1 })
GroupTourRequestSchema.index({ priority: 1, status: 1 })
GroupTourRequestSchema.index({ assignedStaffId: 1, status: 1 })
GroupTourRequestSchema.index({ contactPhone: 1 })
GroupTourRequestSchema.index({ preferredStartDate: 1 })
