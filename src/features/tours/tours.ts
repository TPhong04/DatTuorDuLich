import { apiFetch } from '@/lib/api'

export type PublicTourCard = {
  id: string
  title: string
  slug: string
  code: string | null
  type: 'retail' | 'group'
  region: string | null
  categories: string[]
  themes: string[]
  durationDays: number
  durationNights: number
  departureFrom: string | null
  transportText: string | null
  hotelText: string | null
  coverImageUrl: string | null
  highlights: string[]
  tags: string[]
  totalBookings: number
  avgRating: number | null
  reviewCount: number
  priceFrom: number | null
  originalPriceFrom: number | null
  discountFrom: number | null
  nextDepartureDate: string | null
  nextDepartureStandardText: string | null
  nextDeparturePriceAdult: number | null
  nextDepartureOriginalPriceAdult: number | null
  nextDepartureDiscountPercent: number | null
  seatsAvailable: number | null
  isPublished: boolean
}

export type PublicTourPriceRow = { label: string; amount: number }

export type PublicTourItineraryDay = {
  label: string
  title: string
  meals: string[]
  content: string
  attractions: string[]
  accommodationText: string | null
}

export type PublicTourDepartureStatus = 'open' | 'closed' | 'cancelled' | 'soldout'
export type PublicTourDeparture = {
  id: string | null
  departureDate: string | null
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
  status: PublicTourDepartureStatus
}
export type PublicTourFaq = { question: string; answer: string }
export type PublicTourSeo = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageUrl: string | null
}

export type PublicTourReview = {
  name: string
  rating: number
  content: string
  imageUrls: string[]
  createdAt: string | null
}

export type PublicTourDetail = PublicTourCard & {
  galleryImageUrls: string[]
  summary: string | null
  minGuests: number | null
  maxGuests: number | null
  videoUrl: string | null
  itinerary: PublicTourItineraryDay[]
  priceTable: PublicTourPriceRow[]
  surcharges: PublicTourPriceRow[]
  departures: PublicTourDeparture[]
  faq: PublicTourFaq[]
  seo: PublicTourSeo
  includedText: string | null
  excludedText: string | null
  childPolicyText: string | null
  cancelPolicyText: string | null
  noteText: string | null
  pickupPoints: { address: string; time: string | null; note: string | null }[]
  reviews: PublicTourReview[]
}

export async function getPublicTours(params?: { q?: string; region?: string; tag?: string }) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.region) qs.set('region', params.region)
  if (params?.tag) qs.set('tag', params.tag)
  const qStr = qs.toString()
  return apiFetch<{ items: PublicTourCard[] }>(qStr ? `/tours?${qStr}` : '/tours')
}

export async function getPublicTour(slug: string) {
  const payload = await apiFetch<{ tour: PublicTourDetail; related: PublicTourCard[] }>(`/tours/${encodeURIComponent(slug)}`)
  return payload
}

export type PublicCreateReviewPayload = {
  name: string
  email?: string
  phone?: string
  rating: number
  content: string
  imageUrls?: string[]
}

export async function postPublicTourReview(slug: string, body: PublicCreateReviewPayload) {
  const res = await apiFetch<{ ok: boolean; message: string; approvedCount: number; avgRating: number | null }>(
    `/tours/${encodeURIComponent(slug)}/reviews`,
    { method: 'POST', body: JSON.stringify(body) },
  )
  return res
}

