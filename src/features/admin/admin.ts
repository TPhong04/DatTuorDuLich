import { apiFetch } from '@/lib/api'
import { clearStoredAuthRaw, getStoredAccessToken, setStoredAccessToken, setStoredUserRaw } from '@/features/auth/auth.storage'

export type AdminUserRole = 'customer' | 'staff' | 'admin'
export type AdminGender = 'male' | 'female' | 'other' | null

export type AdminUser = {
  id: string
  name: string
  email: string
  phone: string | null
  gender: AdminGender
  avatarUrl: string | null
  role: AdminUserRole
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export type AuditLog = {
  id: string
  actorUserId: string
  actorEmail: string
  actorRole: AdminUserRole
  action: string
  entityType: string | null
  entityId: string | null
  meta: unknown
  createdAt?: string
}

export type AdminSettings = {
  id: string
  company: Record<string, unknown>
  branding: Record<string, unknown>
  home: Record<string, unknown>
  booking: Record<string, unknown>
  payment: Record<string, unknown>
  notifications: Record<string, unknown>
  security: Record<string, unknown>
  integrations: Record<string, unknown>
  masterData: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

export type AdminBannerTargetType = 'none' | 'internal' | 'external'

export type AdminBanner = {
  id: string
  title: string | null
  imageUrl: string
  targetType: AdminBannerTargetType
  targetValue: string | null
  openInNewTab: boolean
  order: number
  isActive: boolean
  startAt: string | null
  endAt: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type AdminTourPriceRow = { label: string; value: string; amount: number | null }
export type AdminTourItineraryDay = {
  label: string
  title: string
  meals: string[]
  content: string
  attractions: string[]
  accommodationText: string | null
}
export type AdminTourDepartureStatus = 'open' | 'closed' | 'cancelled' | 'soldout'
export type AdminTourDeparture = {
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
  status: AdminTourDepartureStatus
  meals: string[]
  attractions: string[]
}
export type AdminTourFaq = { question: string; answer: string }
export type AdminTourReview = {
  name: string
  email: string | null
  phone: string | null
  rating: number
  content: string
  imageUrls: string[]
  approved: boolean
  createdAt: string | null
}
export type AdminTourSeo = {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogImageUrl: string | null
}

export type AdminTour = {
  id: string
  title: string
  slug: string
  code: string | null
  type: 'retail' | 'group'
  departureFrom: string | null
  durationDays: number
  durationNights: number
  transportText: string | null
  hotelText: string | null
  region: string | null
  categories: string[]
  themes: string[]
  minGuests: number | null
  maxGuests: number | null
  videoUrl: string | null
  coverImageUrl: string | null
  galleryImageUrls: string[]
  highlights: string[]
  summary: string | null
  totalBookings: number
  avgRating: number | null
  reviewCount: number
  isPublished: boolean
  tags: string[]
  itinerary: AdminTourItineraryDay[]
  priceTable: AdminTourPriceRow[]
  surcharges: AdminTourPriceRow[]
  departures: AdminTourDeparture[]
  faq: AdminTourFaq[]
  seo: AdminTourSeo
  includedText: string | null
  excludedText: string | null
  childPolicyText: string | null
  cancelPolicyText: string | null
  noteText: string | null
  pickupPoints: { address: string; time: string | null; note: string | null }[]
  reviews: AdminTourReview[]
  createdAt?: string | null
  updatedAt?: string | null
}

export async function adminListUsers(input: {
  search?: string
  role?: AdminUserRole
  isActive?: boolean
  page?: number
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input.search) params.set('search', input.search)
  if (input.role) params.set('role', input.role)
  if (typeof input.isActive === 'boolean') params.set('isActive', String(input.isActive))
  if (input.page) params.set('page', String(input.page))
  if (input.limit) params.set('limit', String(input.limit))

  const qs = params.toString()
  return apiFetch<{ items: AdminUser[]; total: number; page: number; limit: number }>(`/admin/users${qs ? `?${qs}` : ''}`)
}

export async function adminCreateUser(input: { name: string; email: string; password: string; role: AdminUserRole; phone?: string }) {
  return apiFetch<AdminUser>('/admin/users', { method: 'POST', body: JSON.stringify(input) })
}

export async function adminUpdateUser(id: string, input: { role?: AdminUserRole; isActive?: boolean }) {
  return apiFetch<AdminUser>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function adminListAuditLogs(input: {
  actorEmail?: string
  action?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}) {
  const params = new URLSearchParams()
  if (input.actorEmail) params.set('actorEmail', input.actorEmail)
  if (input.action) params.set('action', input.action)
  if (input.from) params.set('from', input.from)
  if (input.to) params.set('to', input.to)
  if (input.page) params.set('page', String(input.page))
  if (input.limit) params.set('limit', String(input.limit))

  const qs = params.toString()
  return apiFetch<{ items: AuditLog[]; total: number; page: number; limit: number }>(
    `/admin/audit-logs${qs ? `?${qs}` : ''}`,
  )
}

export async function adminGetSettings() {
  return apiFetch<AdminSettings>('/admin/settings')
}

export async function adminUpdateSettingsSection(section: string, patch: unknown) {
  return apiFetch<AdminSettings>(`/admin/settings/${section}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function adminListBanners() {
  return apiFetch<{ items: AdminBanner[] }>('/admin/banners')
}

export async function adminCreateBanner(input: {
  title?: string | null
  imageUrl: string
  targetType: AdminBannerTargetType
  targetValue?: string | null
  openInNewTab?: boolean
  order?: number
  isActive?: boolean
  startAt?: string | null
  endAt?: string | null
}) {
  return apiFetch<AdminBanner>('/admin/banners', { method: 'POST', body: JSON.stringify(input) })
}

export async function adminUpdateBanner(
  id: string,
  patch: Partial<{
    title: string | null
    imageUrl: string
    targetType: AdminBannerTargetType
    targetValue: string | null
    openInNewTab: boolean
    order: number
    isActive: boolean
    startAt: string | null
    endAt: string | null
  }>,
) {
  return apiFetch<AdminBanner>(`/admin/banners/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function adminDeleteBanner(id: string) {
  return apiFetch<{ ok: true }>(`/admin/banners/${id}`, { method: 'DELETE' })
}

export async function adminReorderBanners(ids: string[]) {
  return apiFetch<{ ok: true }>(`/admin/banners/reorder`, { method: 'PATCH', body: JSON.stringify({ ids }) })
}

export async function adminListTours() {
  return apiFetch<{ items: AdminTour[] }>('/admin/tours')
}

export async function adminGetTour(id: string) {
  return apiFetch<AdminTour>(`/admin/tours/${id}`)
}

export async function adminCreateTour(input: Omit<AdminTour, 'id' | 'createdAt' | 'updatedAt'>) {
  return apiFetch<AdminTour>('/admin/tours', { method: 'POST', body: JSON.stringify(input) })
}

export async function adminUpdateTour(id: string, patch: Partial<Omit<AdminTour, 'id' | 'createdAt' | 'updatedAt'>>) {
  return apiFetch<AdminTour>(`/admin/tours/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function adminDeleteTour(id: string) {
  return apiFetch<{ ok: true }>(`/admin/tours/${id}`, { method: 'DELETE' })
}

async function refreshAccessToken() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json()) as { accessToken: string; user: unknown }
  setStoredAccessToken(data.accessToken)
  setStoredUserRaw(JSON.stringify(data.user))
  return data.accessToken
}

export async function adminUploadImage(input: { file: File; category: string }) {
  const form = new FormData()
  form.set('file', input.file)

  const doFetch = async (canRetry: boolean) => {
    const accessToken = getStoredAccessToken()
    const res = await fetch(`/api/admin/uploads/image?category=${encodeURIComponent(input.category)}`, {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

    if (res.status === 401 && canRetry) {
      const next = await refreshAccessToken()
      if (!next) {
        clearStoredAuthRaw()
        throw { status: 401, message: 'Unauthorized' }
      }
      return doFetch(false)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw { status: res.status, message: text || res.statusText }
    }

    return (await res.json()) as { url: string }
  }

  return doFetch(true)
}
