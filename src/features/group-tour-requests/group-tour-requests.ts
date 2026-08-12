import { apiFetch } from '@/lib/api'

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

export type GroupTourRequest = {
  _id: string
  id: string
  code: string
  status: GroupTourRequestStatus
  priority: GroupTourRequestPriority
  contactName: string
  contactPhone: string
  contactEmail: string | null
  contactRole: string | null
  companyOrGroupName: string
  companyTaxCode: string | null
  adultCount: number
  childCount: number
  infantCount: number
  departureCity: string | null
  destination: string
  approximateDurationText: string | null
  preferredStartDate: string | null
  preferredEndDate: string | null
  hotelClassRequested: string | null
  servicesPreference: GroupTourServicePreference
  transportRequestedNotes: string | null
  budgetPerPersonVnd: number | null
  totalBudgetVnd: number | null
  specialRequirements: string | null
  quoteCount: number
  lastQuoteSummary: string | null
  followUpAt: string | null
  lastContactedAt: string | null
  wonAt: string | null
  lostAt: string | null
  assignedStaffId: string | null
  convertedBookingId: string | null
  lostReason: string | null
  internalStaffNote: string | null
  createdByUserId: string | null
  updatedByStaffId: string | null
  sourceChannel: string | null
  ipAddress: string | null
  createdAt: string
  updatedAt: string
}

export const GROUP_TOUR_STATUS_META: Record<GroupTourRequestStatus, { label: string; chip: string; dot: string }> = {
  new: { label: 'Mới tạo', chip: 'bg-blue-50 text-blue-700 border border-blue-100', dot: 'bg-blue-500' },
  contacted: { label: 'Đã liên hệ', chip: 'bg-sky-50 text-sky-700 border border-sky-100', dot: 'bg-sky-500' },
  quoting: { label: 'Đang báo giá', chip: 'bg-amber-50 text-amber-700 border border-amber-100', dot: 'bg-amber-500' },
  negotiating: { label: 'Đàm phán', chip: 'bg-violet-50 text-violet-700 border border-violet-100', dot: 'bg-violet-500' },
  won: { label: 'Đã chốt', chip: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500' },
  converted_booking: { label: '→ Booking', chip: 'bg-teal-50 text-teal-700 border border-teal-100', dot: 'bg-teal-500' },
  lost: { label: 'Thua đơn', chip: 'bg-rose-50 text-rose-700 border border-rose-100', dot: 'bg-rose-500' },
  archived: { label: 'Đã lưu trữ', chip: 'bg-slate-100 text-slate-600 border border-slate-200', dot: 'bg-slate-400' },
}

export const GROUP_TOUR_PRIORITY_META: Record<GroupTourRequestPriority, { label: string; chip: string; icon: string }> = {
  low: { label: 'Thấp', chip: 'bg-slate-100 text-slate-600', icon: '🟦' },
  normal: { label: 'Bình thường', chip: 'bg-blue-100 text-blue-700', icon: '🔵' },
  high: { label: 'Cao', chip: 'bg-orange-100 text-orange-700', icon: '🟠' },
  urgent: { label: 'Khẩn cấp', chip: 'bg-rose-100 text-rose-700', icon: '🔴' },
}

export type CreateGroupTourRequestPayload = {
  contactName: string
  contactPhone: string
  contactEmail?: string | null
  contactRole?: string | null
  companyOrGroupName: string
  companyTaxCode?: string | null
  adultCount: number
  childCount?: number
  infantCount?: number
  departureCity?: string | null
  destination: string
  approximateDurationText?: string | null
  preferredStartDate?: string | null
  preferredEndDate?: string | null
  hotelClassRequested?: string | null
  servicesPreference?: GroupTourServicePreference
  transportRequestedNotes?: string | null
  budgetPerPersonVnd?: number | null
  totalBudgetVnd?: number | null
  specialRequirements?: string | null
  sourceChannel?: string
}

export type AdminPatchGroupTourRequestPayload = {
  status?: GroupTourRequestStatus
  priority?: GroupTourRequestPriority
  assignedStaffId?: string | null
  internalStaffNote?: string | null
  lastQuoteSummary?: string | null
  followUpAt?: string | null
  lostReason?: string | null
  convertedBookingId?: string | null
  quoteCount?: number
  lastContactedAt?: string | null
  wonAt?: string | null
}

export type GroupTourRequestListQuery = {
  status?: GroupTourRequestStatus
  priority?: GroupTourRequestPriority
  assignedStaffId?: string
  mine?: boolean | string
  onlyMine?: boolean | string
  search?: string
  page?: number | string
  pageSize?: number | string
  sort?: 'newest' | 'oldest' | 'priority' | 'follow_up'
  all?: string
}

function qs(q: Record<string, unknown>) {
  const out = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null || v === '') continue
    out.append(k, String(v))
  }
  const s = out.toString()
  return s ? '?' + s : ''
}

type BaseEnvelope<T> = { ok: boolean; total?: number; page?: number; pageSize?: number; totalPages?: number; rows?: T; forcedScope?: string; code?: string; id?: string; message?: string; row?: any }

export type StaffBrief = {
  id: string
  name: string
  email: string
  phone: string | null
  avatarUrl: string | null
}

export async function fetchAdminStaffList(signal?: AbortSignal) {
  const res = await apiFetch<BaseEnvelope<StaffBrief[]>>(`/admin/group-tour-requests/staff/list`, { signal } as any)
  return { total: Number(res.total || 0), rows: (res.rows || []) as StaffBrief[] }
}

export async function adminSeedSamples() {
  const res = await apiFetch<{ ok: boolean; created: number; total: number; staffCount: number; skipped?: boolean; message?: string }>(
    '/admin/group-tour-requests/_dev/seed-samples',
    { method: 'POST' } as any,
  )
  return res as any
}

export async function createPublicGroupTourRequest(payload: CreateGroupTourRequestPayload) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>('/group-tour-requests', { method: 'POST', body: JSON.stringify(payload) })
  return { code: res.code as string, id: res.id as string, message: res.message as string }
}

export async function fetchAdminGroupTourRequests(q: GroupTourRequestListQuery, signal?: AbortSignal) {
  const query: Record<string, unknown> = { ...q }
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests${qs(query)}`, { signal } as any)
  return { total: Number(res.total || 0), page: Number(res.page || 1), pageSize: Number(res.pageSize || 25), totalPages: Number(res.totalPages || 1), rows: (res.rows || []) as GroupTourRequest[] }
}

export async function fetchStaffGroupTourRequests(q: GroupTourRequestListQuery, signal?: AbortSignal) {
  const query: Record<string, unknown> = { ...q }
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests${qs(query)}`, { signal } as any)
  return { total: Number(res.total || 0), page: Number(res.page || 1), pageSize: Number(res.pageSize || 25), totalPages: Number(res.totalPages || 1), rows: (res.rows || []) as GroupTourRequest[] }
}

export async function fetchAdminGroupTourRequestDetail(id: string) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}`)
  return res.row as GroupTourRequest
}

export async function patchAdminGroupTourRequest(id: string, payload: AdminPatchGroupTourRequestPayload) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
  return res.row as GroupTourRequest
}

export async function markAdminGroupTourRequestContacted(id: string) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}/mark-contacted`, { method: 'PATCH' })
  return res.row as GroupTourRequest
}

export async function patchStaffGroupTourRequest(id: string, payload: AdminPatchGroupTourRequestPayload) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) })
  return res.row as GroupTourRequest
}

export async function markStaffGroupTourRequestContacted(id: string) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}/mark-contacted`, { method: 'PATCH' })
  return res.row as GroupTourRequest
}

export async function markStaffGroupTourRequestQuoting(id: string, payload?: { summary?: string; followUpDays?: number }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}/mark-quoting`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markStaffGroupTourRequestNegotiating(id: string, payload?: { note?: string; followUpDays?: number }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}/mark-negotiating`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markStaffGroupTourRequestWon(id: string, payload?: { note?: string }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}/mark-won`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markStaffGroupTourRequestLost(id: string, payload: { reason: string }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/staff/group-tour-requests/${encodeURIComponent(id)}/mark-lost`, { method: 'PATCH', body: JSON.stringify(payload) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markAdminGroupTourRequestQuoting(id: string, payload?: { summary?: string; followUpDays?: number }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}/mark-quoting`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markAdminGroupTourRequestNegotiating(id: string, payload?: { note?: string; followUpDays?: number }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}/mark-negotiating`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markAdminGroupTourRequestWon(id: string, payload?: { note?: string }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}/mark-won`, { method: 'PATCH', body: JSON.stringify(payload || {}) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export async function markAdminGroupTourRequestLost(id: string, payload: { reason: string }) {
  const res = await apiFetch<BaseEnvelope<GroupTourRequest[]>>(`/admin/group-tour-requests/${encodeURIComponent(id)}/mark-lost`, { method: 'PATCH', body: JSON.stringify(payload) })
  return { row: res.row as GroupTourRequest, message: res.message as string | undefined }
}

export function totalGroupTourGuests(r: Pick<GroupTourRequest, 'adultCount' | 'childCount' | 'infantCount'>) {
  return (r.adultCount || 0) + (r.childCount || 0) + (r.infantCount || 0)
}
