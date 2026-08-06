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

export type DonutSlice = { label: string; value: number; color: string }

export type LinePoint = { label: string; value: number }

export type TopSeller = {
  rank: number
  tourId: string | null
  title: string
  tourCode: string | null
  sold: number
  revenue: number
  tone: string
}

export type CalendarEvent = { day: number; tone: 'blue' | 'orange' | 'rose' | 'emerald'; label: string }

export type DashboardKpis = {
  bookingCount: number
  bookingRevenueTotal: number
  passengerTotal: number
  pendingCount: number
}

export type DashboardRecentBooking = {
  id: string
  code: string
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  totalAmount: number
  adultCount: number
  childCount: number
  infantCount: number
  departureDate: string
  departureStandardText: string | null
  createdAt: string
  tour: { title: string; slug: string; code: string | null; durationDays: number; durationNights: number; coverImageUrl: string | null }
  contact: { name: string; phone: string; email: string | null }
}

export type DashboardSummary = {
  kpis: DashboardKpis
  statusSlices: DonutSlice[]
  tourTypeSlices: DonutSlice[]
  line7Days: LinePoint[]
  topSellers: TopSeller[]
  recentBookings: DashboardRecentBooking[]
  calendarEvents: CalendarEvent[]
  calendar: { year: number; month: number; today: number }
}

export async function fetchAdminDashboardSummary(): Promise<DashboardSummary> {
  const r = await apiFetch<DashboardSummary>('/admin/dashboard/summary', { method: 'GET' })
  return r as DashboardSummary
}

export async function fetchStaffDashboardSummary(): Promise<DashboardSummary> {
  const r = await apiFetch<DashboardSummary>('/staff/dashboard/summary', { method: 'GET' })
  return r as DashboardSummary
}

export type FinancialReportPeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export type FinancialKpis = {
  bookingCountAll: number
  bookingCountCompleted: number
  bookingCountCancelled: number
  grossRevenue: number
  discountTotalEstimated: number
  netRevenue: number
  paidTotal: number
  unpaidTotal: number
  partialPaidTotal: number
  outstandingTotal: number
  passengerTotal: number
  passengerAdult: number
  passengerChild: number
  passengerInfant: number
  aovCompleted: number
  cancellationRate: number
  topTour: { tourId: string | null; title: string; tourCode: string | null; revenue: number } | null
  overdueOutstandingTotal: number
  overdueCount: number
  paymentCompletionRate: number
}

export type FinancialReportSlice = { label: string; value: number; color: string }
export type FinancialReportPoint = { label: string; value: number; key: string }
export type FinancialReportBar = { label: string; value: number; color: string; valueSecondary?: number }

export type MonthlyAggRow = {
  key: string
  label: string
  bookingCount: number
  completedCount: number
  cancelledCount: number
  revenue: number
  passengerTotal: number
  aov: number
  cancellationRate: number
}

export type OutstandingRow = {
  id: string
  code: string
  customer: { name: string; phone: string; email: string | null }
  tour: { title: string; code: string | null }
  departureDate: string
  createdAt: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  holdsUntil: string | null
  overdueDays: number
}

export type FinancialReport = {
  period: { fromISO: string; toISO: string; preset: FinancialReportPeriodPreset }
  kpis: FinancialKpis
  revenueLine: FinancialReportPoint[]
  tourTypeSlices: FinancialReportSlice[]
  paymentMethodSlices: FinancialReportSlice[]
  regionRevenueBars: FinancialReportBar[]
  monthly: MonthlyAggRow[]
  outstanding: OutstandingRow[]
}

export async function fetchAdminFinancialReport(params?: {
  preset?: FinancialReportPeriodPreset
  from?: string
  to?: string
  tourTypeCategory?: string
  createdBy?: string
  channel?: string
}): Promise<FinancialReport> {
  const usp = new URLSearchParams()
  if (params?.preset) usp.set('preset', params.preset)
  if (params?.from) usp.set('from', params.from)
  if (params?.to) usp.set('to', params.to)
  if (params?.tourTypeCategory) usp.set('tourTypeCategory', params.tourTypeCategory)
  if (params?.createdBy) usp.set('createdBy', params.createdBy)
  if (params?.channel) usp.set('channel', params.channel)
  const q = usp.toString()
  return apiFetch<FinancialReport>(`/admin/reports/financial${q ? `?${q}` : ''}`, { method: 'GET' })
}

export type ReportBookingsPeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
export type ReportBookingsGroupKey =
  | 'none'
  | 'month_created'
  | 'staff_created'
  | 'tour_type'
  | 'region'
  | 'status'
  | 'payment_status'
export type ReportBookingsSortKey =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'totalAmount_desc'
  | 'totalAmount_asc'
  | 'departureDate_desc'
  | 'departureDate_asc'

export type ReportBookingsRow = {
  id: string
  code: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  passengerCount: number
  passengerAdult: number
  passengerChild: number
  passengerInfant: number
  tourId: string | null
  tourCode: string | null
  tourTitle: string
  tourTypeCategory: string
  region: string
  departureDateISO: string
  createdAtISO: string
  createdByStaffId: string | null
  createdByStaffName: string | null
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  paymentMethod: BookingPaymentMethod
  subtotalAmount: number
  surchargeAmount: number
  vatAmount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  holdsUntilISO: string | null
  overdueDays: number
  notes: string | null
}

export type ReportBookingsGroupRow = {
  key: string
  label: string
  bookingCount: number
  passengerTotal: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  aov: number
  completedCount: number
  cancelledCount: number
}

export type ReportBookingsSummary = {
  bookingCountAll: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
  completedCount: number
  cancelledCount: number
  passengerTotal: number
}

export type ReportBookingsResponse = {
  period: { fromISO: string; toISO: string; preset: ReportBookingsPeriodPreset }
  summary: ReportBookingsSummary
  groupRows: ReportBookingsGroupRow[]
  groupKey: ReportBookingsGroupKey
  rows: ReportBookingsRow[]
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  sort: ReportBookingsSortKey
}

export async function fetchAdminReportBookings(params?: {
  preset?: ReportBookingsPeriodPreset
  from?: string
  to?: string
  statuses?: Array<BookingStatus>
  paymentStatuses?: Array<BookingPaymentStatus>
  passengerTypes?: Array<'NL' | 'TE' | 'EB'>
  paymentMethods?: Array<BookingPaymentMethod>
  tourTypeCategory?: string
  tourIds?: string[]
  departureFrom?: string
  departureTo?: string
  createdBy?: string[]
  minAmount?: number
  maxAmount?: number
  search?: string
  channels?: string[]
  groupBy?: ReportBookingsGroupKey
  sort?: ReportBookingsSortKey
  page?: number
  pageSize?: number
}): Promise<ReportBookingsResponse> {
  const usp = new URLSearchParams()
  if (params?.preset) usp.set('preset', params.preset)
  if (params?.from) usp.set('from', params.from)
  if (params?.to) usp.set('to', params.to)
  if (params?.statuses && params.statuses.length > 0) usp.set('statuses', params.statuses.join(','))
  if (params?.paymentStatuses && params.paymentStatuses.length > 0) usp.set('paymentStatuses', params.paymentStatuses.join(','))
  if (params?.passengerTypes && params.passengerTypes.length > 0) usp.set('passengerTypes', params.passengerTypes.join(','))
  if (params?.paymentMethods && params.paymentMethods.length > 0) usp.set('paymentMethods', params.paymentMethods.join(','))
  if (params?.tourTypeCategory) usp.set('tourTypeCategory', params.tourTypeCategory)
  if (params?.tourIds && params.tourIds.length > 0) usp.set('tourIds', params.tourIds.join(','))
  if (params?.departureFrom) usp.set('departureFrom', params.departureFrom)
  if (params?.departureTo) usp.set('departureTo', params.departureTo)
  if (params?.createdBy && params.createdBy.length > 0) usp.set('createdBy', params.createdBy.join(','))
  if (typeof params?.minAmount === 'number') usp.set('minAmount', String(params.minAmount))
  if (typeof params?.maxAmount === 'number') usp.set('maxAmount', String(params.maxAmount))
  if (params?.search) usp.set('search', params.search)
  if (params?.channels && params.channels.length > 0) usp.set('channels', params.channels.join(','))
  if (params?.groupBy) usp.set('groupBy', params.groupBy)
  if (params?.sort) usp.set('sort', params.sort)
  if (typeof params?.page === 'number') usp.set('page', String(params.page))
  if (typeof params?.pageSize === 'number') usp.set('pageSize', String(params.pageSize))
  const q = usp.toString()
  return apiFetch<ReportBookingsResponse>(`/admin/reports/bookings${q ? `?${q}` : ''}`, { method: 'GET' })
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
