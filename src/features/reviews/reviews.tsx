import type { JSX } from 'react'
import { apiFetch } from '@/lib/api'

export type ReviewStatus = 'published' | 'hidden' | 'deleted'
export type ReviewRating = 1 | 2 | 3 | 4 | 5
export type ReviewState = 'pending' | 'reviewed' | 'not_started' | 'expired' | 'not_eligible'
export type ReviewSortMode = 'newest' | 'oldest' | 'rating_desc' | 'rating_asc' | 'most_liked' | 'most_reported'
export type ReportReviewReason = 'spam' | 'offensive' | 'misleading' | 'not_real' | 'other'

export type PublicReview = {
  id: string
  tourId: string
  bookingId: string
  customerId: string
  customerName: string
  customerAvatarUrl: string | null
  rating: ReviewRating
  title: string | null
  content: string
  images: string[]
  tripDate: string | null
  likeCount: number
  isVerified: boolean
  status: ReviewStatus
  isReported: boolean
  reportCount: number
  adminReply: string | null
  adminReplyAt: string | null
  staffReply: string | null
  staffReplyAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type AdminReview = PublicReview & {
  requireStaffRemoval: boolean
  canStaffDelete: boolean
  canStaffEdit: boolean
  adminReplyBy: string | null
  staffReplyBy: string | null
  removedByStaffId: string | null
  removedAt: string | null
  removedBy: string | null
  editableUntil: string | null
  tourTitleSnapshot?: string | null
  reports: {
    reportedByUserId: string | null
    reportedByGuestIp: string | null
    reporterUserId?: string | null
    reporterIp?: string | null
    reason: string
    detail: string | null
    createdAt: string | null
  }[]
}

export type ReviewSummary = {
  tourId: string | null
  avgRating: number | null
  totalReviews: number
  ratingDistribution: Record<'1' | '2' | '3' | '4' | '5', number>
}

export type PendingBookingReviewRow = {
  bookingId: string
  bookingCode: string
  tourId: string
  tourTitle: string
  tourSlug: string | null
  tourCover: string | null
  departureDate: string | null
  tripEndDate: string | null
  reviewWindowEnd: string | null
  windowExpiresAt: string | null
  bookingStatus: string
  reviewState: ReviewState
  state: ReviewState
  canReview: boolean
}

export type PendingReviewBookingsResponse = {
  rows: PendingBookingReviewRow[]
  pendingCount: number
  totalRows: number
}

export type PublicReviewListResponse = {
  rows: PublicReview[]
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
}

export type AdminReviewListResponse = {
  rows: AdminReview[]
  page: number
  pageSize: number
  totalPages: number
  totalRows: number
  reportedPendingCount: number
  assignedStaffCount: number
  reportedCount: number
  staffAssignedCount: number
}

export type CreateReviewPayload = {
  bookingId: string
  rating: ReviewRating
  title?: string | null
  content: string
  images?: string[]
}
export type UpdateReviewPayload = {
  rating?: ReviewRating
  title?: string | null
  content?: string
  images?: string[]
}
export type SetReviewStatusPayload = { status: ReviewStatus }
export type PatchReviewPermissionsPayload = {
  requireStaffRemoval?: boolean
  canStaffDelete?: boolean
  canStaffEdit?: boolean
}
export type ReportReviewPayload = { reason: string; detail?: string | null }
export type ReplyReviewPayload = { content: string }
export type BulkReviewAction = 'hide' | 'publish' | 'delete' | 'assign_staff' | 'unassign_staff'
export type BulkReviewPayload = { ids: string[]; action: BulkReviewAction }

export const REVIEW_STATUS_META: Record<ReviewStatus, { label: string; chip: string; icon: string }> = {
  published: { label: 'Công khai', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: '✅' },
  hidden:    { label: 'Đã ẩn',   chip: 'bg-amber-50 text-amber-800 ring-amber-200',       icon: '🙈' },
  deleted:   { label: 'Đã xóa',   chip: 'bg-rose-50 text-rose-700 ring-rose-200',           icon: '🗑' },
}

export const REVIEW_STATE_META: Record<ReviewState, { label: string; chip: string; icon: string }> = {
  pending:      { label: '⭐ Chờ đánh giá',        chip: 'bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 text-white shadow-orange-200 shadow-sm', icon: '⭐' },
  reviewed:     { label: '✅ Đã đánh giá',         chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: '✅' },
  not_started:  { label: '⏳ Sắp diễn ra',         chip: 'bg-sky-50 text-sky-700 ring-sky-200', icon: '⏳' },
  expired:      { label: '⏰ Đã hết hạn đánh giá', chip: 'bg-slate-100 text-slate-600 ring-slate-200', icon: '⏰' },
  not_eligible: { label: '🚫 Không đủ điều kiện',  chip: 'bg-rose-50 text-rose-600 ring-rose-200', icon: '🚫' },
}

export const REVIEW_RATING_LABELS: { value: ReviewRating; label: string }[] = [
  { value: 5, label: '5 sao - Rất hài lòng' },
  { value: 4, label: '4 sao - Hài lòng' },
  { value: 3, label: '3 sao - Bình thường' },
  { value: 2, label: '2 sao - Không hài lòng' },
  { value: 1, label: '1 sao - Rất không hài lòng' },
]

export function starRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-emerald-500'
  if (rating >= 4.0) return 'text-green-500'
  if (rating >= 3.0) return 'text-amber-500'
  if (rating >= 2.0) return 'text-orange-500'
  return 'text-rose-500'
}

export function canUserEditReview(
  role: string | undefined,
  userId: string | undefined,
  review: { customerId: string; canStaffEdit?: boolean; editableUntil?: string | null },
): boolean {
  if (role === 'admin') return true
  if (role === 'staff') return Boolean(review.canStaffEdit)
  if (role !== 'customer') return false
  if (userId && review.customerId !== userId) return false
  if (!review.editableUntil) return false
  return new Date(review.editableUntil).getTime() > Date.now()
}
export function canUserDeleteReview(
  role: string | undefined,
  userId: string | undefined,
  review: { customerId: string; canStaffDelete?: boolean; requireStaffRemoval?: boolean; editableUntil?: string | null },
): boolean {
  if (role === 'admin') return true
  if (role === 'staff') return Boolean(review.requireStaffRemoval || review.canStaffDelete)
  if (role !== 'customer') return false
  if (userId && review.customerId !== userId) return false
  if (!review.editableUntil) return false
  return new Date(review.editableUntil).getTime() > Date.now()
}
export function canUserChangeReviewStatus(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserSetReviewPermissions(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserReplyAsStaff(role: string | undefined): boolean {
  return role === 'admin' || role === 'staff'
}
export function canUserReplyAsAdmin(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserCreateReview(role: string | undefined): boolean {
  return role === 'customer'
}
export function canUserBulkAssignStaff(role: string | undefined): boolean {
  return role === 'admin'
}
export function canUserViewStaffAssignedQueue(role: string | undefined): boolean {
  return role === 'staff' || role === 'admin'
}

function qs(p: Record<string, unknown>): string {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) {
      if (v.length > 0) s.set(k, v.map((x) => String(x)).join(','))
    } else s.set(k, String(v))
  }
  const r = s.toString()
  return r ? `?${r}` : ''
}

// ---------- Public APIs ----------

export function fetchPublicReviews(params: {
  tourId?: string
  tourSlug?: string
  rating?: ReviewRating
  sort?: ReviewSortMode
  search?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<PublicReviewListResponse> {
  return apiFetch<PublicReviewListResponse>(
    `/reviews${qs({
      tourId: params.tourId,
      tourSlug: params.tourSlug,
      rating: params.rating,
      sort: params.sort,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 10,
    })}`,
    undefined,
    { signal: params.signal },
  )
}

export function fetchReviewSummary(params: {
  tourId?: string
  tourSlug?: string
  signal?: AbortSignal
}): Promise<ReviewSummary> {
  return apiFetch<ReviewSummary>(
    `/reviews/summary${qs({ tourId: params.tourId, tourSlug: params.tourSlug })}`,
    undefined,
    { signal: params.signal },
  )
}

export function fetchMyPendingReviewBookings(params?: {
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<PendingReviewBookingsResponse> {
  return apiFetch<PendingReviewBookingsResponse>(
    `/reviews/me/pending-bookings${qs({ page: params?.page ?? 1, pageSize: params?.pageSize ?? 200 })}`,
    undefined,
    { signal: params?.signal },
  )
}

export function fetchMyReviewState(opts?: { signal?: AbortSignal }) {
  return apiFetch<{ pendingReviewBookings: PendingBookingReviewRow[]; pendingCount: number }>(
    `/reviews/me/state`,
    undefined,
    { signal: opts?.signal },
  )
}

export function createCustomerReview(payload: CreateReviewPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/reviews`, { method: 'POST', body: JSON.stringify(payload) })
}
export function updateCustomerReview(id: string, payload: UpdateReviewPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function reportReview(id: string, payload: ReportReviewPayload): Promise<{ success: boolean; reportCount: number; isReported: boolean }> {
  return apiFetch<{ success: boolean; reportCount: number; isReported: boolean }>(
    `/reviews/${encodeURIComponent(id)}/report`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}
export function likeReviewToggle(id: string): Promise<{ success: boolean; liked: boolean; likeCount: number }> {
  return apiFetch<{ success: boolean; liked: boolean; likeCount: number }>(`/reviews/${encodeURIComponent(id)}/like`, { method: 'POST' })
}
export function deleteMyReview(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

// ---------- Admin APIs ----------

export function fetchAdminReviews(params: {
  tourId?: string
  tourSlug?: string
  rating?: ReviewRating | 'all'
  status?: ReviewStatus | ReviewStatus[] | 'all'
  customerId?: string | 'all'
  isReported?: boolean | 'all'
  requireStaffRemoval?: boolean | 'all'
  onlyMine?: boolean
  sort?: ReviewSortMode
  search?: string | null
  ids?: string[]
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<AdminReviewListResponse> {
  return apiFetch<AdminReviewListResponse>(
    `/admin/reviews${qs({
      tourId: params.tourId,
      tourSlug: params.tourSlug,
      rating: params.rating === 'all' ? undefined : params.rating,
      status: params.status === 'all' ? undefined : params.status,
      customerId: params.customerId === 'all' ? undefined : params.customerId,
      isReported: params.isReported === 'all' ? undefined : params.isReported,
      requireStaffRemoval: params.requireStaffRemoval === 'all' ? undefined : params.requireStaffRemoval,
      onlyMine: params.onlyMine === true ? 'true' : undefined,
      sort: params.sort,
      search: params.search,
      ids: params.ids,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    undefined,
    { signal: params.signal },
  )
}

export function adminUpdateReview(id: string, payload: UpdateReviewPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/admin/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function adminSetReviewStatus(id: string, payload: SetReviewStatusPayload): Promise<AdminReview & { beforeStatus: ReviewStatus }> {
  return apiFetch<AdminReview & { beforeStatus: ReviewStatus }>(
    `/admin/reviews/${encodeURIComponent(id)}/status`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
}
export function adminPatchReviewPermissions(id: string, payload: PatchReviewPermissionsPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(
    `/admin/reviews/${encodeURIComponent(id)}/permissions`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
}
export function adminDeleteReview(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/admin/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function adminReplyReview(id: string, payload: ReplyReviewPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/admin/reviews/${encodeURIComponent(id)}/admin-reply`, { method: 'POST', body: JSON.stringify(payload) })
}
export function adminBulkReviews(payload: BulkReviewPayload): Promise<{ success: boolean; action: BulkReviewAction; processed: number }> {
  return apiFetch<{ success: boolean; action: BulkReviewAction; processed: number }>(
    `/admin/reviews/bulk`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

// ---------- Staff APIs ----------

export function fetchStaffReviews(params: {
  tourId?: string
  rating?: ReviewRating | 'all'
  status?: ReviewStatus | ReviewStatus[] | 'all'
  isReported?: boolean | 'all'
  requireStaffRemoval?: boolean | 'all'
  onlyMine?: boolean
  sort?: ReviewSortMode
  search?: string | null
  page?: number
  pageSize?: number
  signal?: AbortSignal
}): Promise<AdminReviewListResponse> {
  return apiFetch<AdminReviewListResponse>(
    `/staff/reviews${qs({
      tourId: params.tourId,
      rating: params.rating === 'all' ? undefined : params.rating,
      status: params.status === 'all' ? undefined : params.status,
      isReported: params.isReported === 'all' ? undefined : params.isReported,
      requireStaffRemoval: params.requireStaffRemoval === 'all' ? undefined : params.requireStaffRemoval,
      onlyMine: params.onlyMine === true ? 'true' : undefined,
      sort: params.sort,
      search: params.search,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    })}`,
    undefined,
    { signal: params.signal },
  )
}

export function staffReplyReview(id: string, payload: ReplyReviewPayload): Promise<AdminReview> {
  return apiFetch<AdminReview>(`/staff/reviews/${encodeURIComponent(id)}/staff-reply`, { method: 'POST', body: JSON.stringify(payload) })
}
export function staffDeleteReview(id: string): Promise<{ success: boolean; id: string }> {
  return apiFetch<{ success: boolean; id: string }>(`/staff/reviews/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
export function staffBulkReviews(payload: BulkReviewPayload): Promise<{ success: boolean; action: BulkReviewAction; processed: number }> {
  return apiFetch<{ success: boolean; action: BulkReviewAction; processed: number }>(
    `/staff/reviews/bulk`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

// ---------- Utilities ----------

export function renderStars(rating: number, size = 16): JSX.Element {
  const full = Math.floor(rating)
  const half = rating - full >= 0.25 && rating - full < 0.75
  const halfIfEnd = rating - full >= 0.75 ? 1 : 0
  const totalFull = Math.min(5, full + halfIfEnd)
  const stars: JSX.Element[] = []
  for (let i = 0; i < 5; i++) {
    const isFull = i < totalFull
    const isHalf = !isFull && half && i === full
    const cls = `inline-block align-middle ${isFull ? 'text-amber-400' : isHalf ? 'text-amber-400/60' : 'text-slate-200'}`
    stars.push(
      <svg key={i} width={size} height={size} viewBox="0 0 24 24" className={cls} fill="currentColor" aria-hidden="true">
        <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
      </svg>,
    )
  }
  return <span className="inline-flex items-center gap-[2px]">{stars}</span>
}

export function formatReviewDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yy} · ${hh}:${mi}`
}

export function canUserBulkActionReview(
  role: string | undefined,
  _action?: BulkReviewAction | string,
  _review?: AdminReview | null,
): boolean {
  return canUserBulkAssignStaff(role)
}
export const canUserReplyReviewAsAdmin = canUserReplyAsAdmin
export const canUserReplyReviewAsStaff = canUserReplyAsStaff

export const deleteAdminReview = adminDeleteReview
export const updateAdminReview = adminUpdateReview
export const patchAdminReviewPermissions = adminPatchReviewPermissions
export const postAdminReviewReply = adminReplyReview
export const setAdminReviewStatus = adminSetReviewStatus
export const reviewBulkAction = adminBulkReviews

export const deleteStaffReview = staffDeleteReview
export const postStaffReviewReply = staffReplyReview

export function ratingFromMinMax(rating: ReviewRating | 'all' | number | undefined, min: number | undefined, max: number | undefined): ReviewRating | 'all' | undefined {
  if (rating === 'all' || rating === undefined) {
    if (min !== undefined && min === max) return min as ReviewRating
    return 'all' as const
  }
  return rating as ReviewRating | 'all'
}
