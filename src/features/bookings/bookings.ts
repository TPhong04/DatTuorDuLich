import { apiFetch } from '@/lib/api'

export type BookingStatus =
  | 'pending'
  | 'new'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type BookingPaymentMethod = 'hold' | 'bank_transfer' | 'online'
export type BookingPaymentStatus = 'unpaid' | 'partial' | 'paid'
export type BookingPassengerType = 'NL' | 'TE' | 'EB'
export type BookingGender = 'male' | 'female' | 'other'

export type BookingPassenger = {
  fullName: string
  type: BookingPassengerType
  birthDate: string | null
  gender: BookingGender | null
  idCard: string | null
  notes: string | null
}

export type BookingSurchargeLine = {
  label: string
  quantity: number
  unitPrice: number
  note: string | null
}

export type BookingTourSnapshot = {
  title: string
  slug: string
  code: string | null
  coverImageUrl: string | null
  durationDays: number | null
  durationNights: number | null
}

export type Booking = {
  id: string
  code: string
  status: BookingStatus
  tour: BookingTourSnapshot
  tourId?: string
  departureId?: string
  departureDate: string | null
  departureStandardText: string | null
  adultCount: number
  childCount: number
  infantCount: number
  priceAdultSnapshot?: number | null
  priceChildSnapshot?: number | null
  priceInfantSnapshot?: number | null
  contact: { name: string; phone: string; email: string | null; address: string | null }
  passengers: BookingPassenger[]
  notes: string | null
  surcharges: BookingSurchargeLine[]
  subtotalAmount: number
  surchargeAmount: number
  vatAmount: number
  totalAmount: number
  currency: 'VND'
  paymentMethod: BookingPaymentMethod
  paymentStatus: BookingPaymentStatus
  adminNote?: string | null
  createdBy?: string | null
  holdsUntil: string | null
  cancelledAt?: string | null
  confirmedAt?: string | null
  createdAt: string | null
  updatedAt?: string | null
}

export type BookingSummary = {
  id: string
  code: string
  status: BookingStatus
  tour: BookingTourSnapshot
  departureDate: string | null
  departureStandardText: string | null
  adultCount: number
  childCount: number
  infantCount: number
  totalAmount: number
  paymentMethod: BookingPaymentMethod
  paymentStatus: BookingPaymentStatus
  createdAt: string | null
}

export type BookingListResponse<T = BookingSummary> = {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type CreateBookingSurchargeInput = {
  label: string
  quantity: number
  unitPrice: number
  note?: string | null
}

export type CreateBookingPassengerInput = {
  fullName: string
  type: BookingPassengerType
  birthDate?: string | null
  gender?: BookingGender | null
  idCard?: string | null
  notes?: string | null
}

export type CreateBookingPayload = {
  departureId: string
  adultCount: number
  childCount: number
  infantCount: number
  contact: { name: string; phone: string; email?: string | null; address?: string | null }
  passengers: CreateBookingPassengerInput[]
  notes?: string | null
  surcharges: CreateBookingSurchargeInput[]
  paymentMethod: BookingPaymentMethod
  agreeTerms: boolean
}

export async function createPublicBooking(tourSlug: string, body: CreateBookingPayload) {
  return apiFetch<Booking>(`/tours/${encodeURIComponent(tourSlug)}/bookings`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listMyBookings(params?: {
  status?: BookingStatus
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}) {
  const usp = new URLSearchParams()
  if (params?.status) usp.set('status', params.status)
  if (params?.from) usp.set('from', params.from)
  if (params?.to) usp.set('to', params.to)
  if (params?.q) usp.set('q', params.q)
  if (params?.page) usp.set('page', String(params.page))
  if (params?.limit) usp.set('limit', String(params.limit))
  const q = usp.toString()
  return apiFetch<BookingListResponse<BookingSummary>>(`/me/bookings${q ? `?${q}` : ''}`)
}

export async function adminListBookings(params?: {
  status?: BookingStatus
  from?: string
  to?: string
  q?: string
  page?: number
  limit?: number
}) {
  const usp = new URLSearchParams()
  if (params?.status) usp.set('status', params.status)
  if (params?.from) usp.set('from', params.from)
  if (params?.to) usp.set('to', params.to)
  if (params?.q) usp.set('q', params.q)
  if (params?.page) usp.set('page', String(params.page))
  if (params?.limit) usp.set('limit', String(params.limit))
  const q = usp.toString()
  return apiFetch<BookingListResponse<Booking>>(`/admin/bookings${q ? `?${q}` : ''}`)
}

export async function adminGetBooking(idOrCode: string) {
  return apiFetch<Booking>(`/admin/bookings/${encodeURIComponent(idOrCode)}`)
}

export async function adminUpdateBookingStatus(idOrCode: string, body: {
  status: BookingStatus
  adminNote?: string | null
  sendBackSeatsOnCancel?: boolean
}) {
  return apiFetch<Booking>(`/admin/bookings/${encodeURIComponent(idOrCode)}/status`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
