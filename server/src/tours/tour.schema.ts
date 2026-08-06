import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose'

export type TourDocument = HydratedDocument<Tour>

export type TourType = 'retail' | 'group'

export type TourTargetType = 'none' | 'internal' | 'external'

export type TourPriceRow = {
  label: string
  amount: number
}

export type TourItineraryDay = {
  label: string
  title: string
  meals: string[]
  content: string
  attractions: string[]
  accommodationText: string | null
}

export type TourDepartureStatus = 'open' | 'closed' | 'cancelled' | 'soldout'

export type TourDeparture = {
  departureDate: Date
  standardText: string | null
  priceAdult: number
  priceChild: number | null
  priceInfant: number | null
  originalPriceAdult: number | null
  originalPriceChild: number | null
  originalPriceInfant: number | null
  discountPercent: number | null
  seatsTotal: number
  seatsAvailable: number
  status: TourDepartureStatus
}

export type TourPickupPoint = {
  address: string
  time: string | null
  note: string | null
}

export type TourFaqItem = {
  question: string
  answer: string
}

export type TourSeo = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageUrl: string | null
}

export type TourReview = {
  name: string
  email: string | null
  phone: string | null
  rating: number
  content: string
  imageUrls: string[]
  approved: boolean
  createdAt: Date
}

@Schema({ timestamps: true })
export class Tour {
  @Prop({ type: String, required: true, trim: true })
  title!: string

  @Prop({ type: String, required: true, trim: true, unique: true, index: true })
  slug!: string

  @Prop({ type: String, default: null, trim: true })
  code!: string | null

  @Prop({ type: String, required: true, enum: ['retail', 'group'], default: 'retail' })
  type!: TourType

  @Prop({ type: String, default: null, trim: true })
  departureFrom!: string | null

  @Prop({ type: Number, required: true, default: 1 })
  durationDays!: number

  @Prop({ type: Number, required: true, default: 0 })
  durationNights!: number

  @Prop({ type: String, default: null, trim: true })
  transportText!: string | null

  @Prop({ type: String, default: null, trim: true })
  hotelText!: string | null

  @Prop({ type: String, default: null, trim: true })
  region!: string | null

  @Prop({ type: [String], default: [] })
  categories!: string[]

  @Prop({ type: [String], default: [] })
  themes!: string[]

  @Prop({ type: Number, default: null })
  minGuests!: number | null

  @Prop({ type: Number, default: null })
  maxGuests!: number | null

  @Prop({ type: String, default: null, trim: true })
  videoUrl!: string | null

  @Prop({ type: String, default: null, trim: true })
  coverImageUrl!: string | null

  @Prop({ type: [String], default: [] })
  galleryImageUrls!: string[]

  @Prop({ type: [String], default: [] })
  highlights!: string[]

  @Prop({ type: String, default: null, trim: true })
  summary!: string | null

  @Prop({ type: Number, default: 0 })
  totalBookings!: number

  @Prop({ type: Number, default: null })
  avgRating!: number | null

  @Prop({ type: Number, default: 0 })
  reviewCount!: number

  @Prop({ type: Boolean, required: true, default: false })
  isPublished!: boolean

  @Prop({
    type: [
      {
        name: { type: String, required: true, trim: true },
        email: { type: String, default: null, trim: true },
        phone: { type: String, default: null, trim: true },
        rating: { type: Number, required: true, min: 1, max: 5 },
        content: { type: String, required: true },
        imageUrls: { type: [String], default: [] },
        approved: { type: Boolean, default: false },
        createdAt: { type: Date, required: true, default: () => new Date() },
      },
    ],
    default: [],
  })
  reviews!: TourReview[]

  @Prop({ type: [String], default: [] })
  tags!: string[]

  @Prop({ type: [Object], default: [] })
  itinerary!: TourItineraryDay[]

  @Prop({ type: [Object], default: [] })
  priceTable!: TourPriceRow[]

  @Prop({ type: [Object], default: [] })
  surcharges!: TourPriceRow[]

  @Prop({ type: [{ type: MongooseSchema.Types.Mixed, _id: true }], default: [] })
  departures!: (TourDeparture & { _id: Types.ObjectId })[]

  @Prop({ type: [Object], default: [] })
  faq!: TourFaqItem[]

  @Prop({ type: Object, default: {} })
  seo!: TourSeo

  @Prop({ type: String, default: null, trim: true })
  includedText!: string | null

  @Prop({ type: String, default: null, trim: true })
  excludedText!: string | null

  @Prop({ type: String, default: null, trim: true })
  childPolicyText!: string | null

  @Prop({ type: String, default: null, trim: true })
  cancelPolicyText!: string | null

  @Prop({ type: String, default: null, trim: true })
  noteText!: string | null

  @Prop({ type: [Object], default: [] })
  pickupPoints!: TourPickupPoint[]
}

export const TourSchema = SchemaFactory.createForClass(Tour)

