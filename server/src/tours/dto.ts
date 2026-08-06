import { z } from 'zod'

const nonEmptyString = z.string().trim().min(1)
const optionalTrim = z.string().trim().optional()

const priceRowDto = z.object({
  label: nonEmptyString,
  amount: z.number().finite().nonnegative(),
})

const itineraryDayDto = z.object({
  label: nonEmptyString,
  title: nonEmptyString,
  meals: z.array(nonEmptyString).default([]),
  content: z.string().default(''),
  attractions: z.array(nonEmptyString).default([]),
  accommodationText: z.string().trim().nullable().optional(),
})

const departureDto = z.object({
  departureDate: z.string().trim().min(1),
  standardText: z.string().trim().nullable().optional(),
  priceAdult: z.number().finite().nonnegative(),
  priceChild: z.number().finite().nonnegative().nullable().optional(),
  priceInfant: z.number().finite().nonnegative().nullable().optional(),
  originalPriceAdult: z.number().finite().nonnegative().nullable().optional(),
  originalPriceChild: z.number().finite().nonnegative().nullable().optional(),
  originalPriceInfant: z.number().finite().nonnegative().nullable().optional(),
  discountPercent: z.number().finite().nonnegative().nullable().optional(),
  seatsTotal: z.number().int().min(0),
  seatsAvailable: z.number().int().min(0),
  status: z.enum(['open', 'closed', 'cancelled', 'soldout']).default('open'),
})

const pickupPointDto = z.object({
  address: nonEmptyString,
  time: z.string().trim().nullable().optional(),
  note: z.string().trim().nullable().optional(),
})

const faqDto = z.object({
  question: nonEmptyString,
  answer: nonEmptyString,
})

const seoDto = z.object({
  metaTitle: z.string().trim().nullable().optional(),
  metaDescription: z.string().trim().nullable().optional(),
  canonicalUrl: z.string().trim().nullable().optional(),
  ogImageUrl: z.string().trim().nullable().optional(),
})

export const createTourDto = z.object({
  title: nonEmptyString,
  slug: nonEmptyString,
  code: optionalTrim.nullable().optional(),
  type: z.enum(['retail', 'group']).default('retail'),
  departureFrom: optionalTrim.nullable().optional(),
  durationDays: z.number().int().min(1).default(1),
  durationNights: z.number().int().min(0).default(0),
  transportText: optionalTrim.nullable().optional(),
  hotelText: optionalTrim.nullable().optional(),
  region: optionalTrim.nullable().optional(),
  categories: z.array(nonEmptyString).default([]),
  themes: z.array(nonEmptyString).default([]),
  minGuests: z.number().int().nonnegative().nullable().optional(),
  maxGuests: z.number().int().nonnegative().nullable().optional(),
  videoUrl: optionalTrim.nullable().optional(),
  coverImageUrl: optionalTrim.nullable().optional(),
  galleryImageUrls: z.array(nonEmptyString).default([]),
  highlights: z.array(nonEmptyString).default([]),
  summary: z.string().trim().nullable().optional(),
  totalBookings: z.number().int().nonnegative().default(0),
  avgRating: z.number().finite().nonnegative().nullable().optional(),
  reviewCount: z.number().int().nonnegative().default(0),
  isPublished: z.boolean().default(false),
  tags: z.array(nonEmptyString).default([]),
  itinerary: z.array(itineraryDayDto).default([]),
  priceTable: z.array(priceRowDto).default([]),
  surcharges: z.array(priceRowDto).default([]),
  departures: z.array(departureDto).default([]),
  faq: z.array(faqDto).default([]),
  seo: seoDto.default({}),
  includedText: z.string().trim().nullable().optional(),
  excludedText: z.string().trim().nullable().optional(),
  childPolicyText: z.string().trim().nullable().optional(),
  cancelPolicyText: z.string().trim().nullable().optional(),
  noteText: z.string().trim().nullable().optional(),
  pickupPoints: z.array(pickupPointDto).default([]),
})

export const updateTourDto = createTourDto.partial()

export const createTourReviewDto = z.object({
  name: nonEmptyString.max(120),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().nullable().optional(),
  rating: z.number().int().min(1).max(5),
  content: z.string().min(80, 'Nội dung đánh giá tối thiểu 80 ký tự'),
  imageUrls: z.array(nonEmptyString).default([]),
})

