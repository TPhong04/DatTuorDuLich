import { apiFetch } from '@/lib/api'

export type NotificationType =
  | 'gtr_created'
  | 'gtr_assigned_staff'
  | 'gtr_contacted'
  | 'gtr_quoting'
  | 'gtr_negotiating'
  | 'gtr_won'
  | 'gtr_lost'
  | 'gtr_booking_created'
  | 'booking_deposit_paid'
  | 'booking_confirmed'
  | 'booking_cancelled'
  | 'booking_eticket_ready'
  | 'booking_deposit_overdue'
  | 'booking_trip_reminder_48h'
  | 'booking_trip_completed'
  | 'booking_daily_report'
  | 'booking_risk_overbook'
  | 'staff_followup_due'
  | 'staff_kpi_summary'
  | 'staff_quote_not_won'
  | 'admin_new_gtr'
  | 'admin_gtr_won_large'
  | 'admin_gtr_lost_large'
  | 'admin_staff_created'
  | 'admin_staff_reassign'
  | 'admin_server_error'
  | 'user_login_new_device'
  | 'survey_nps'
  | 'system_info'

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'zalo'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'
export type RecipientRole = 'customer' | 'staff' | 'admin'

export interface NotificationRow {
  _id: string
  recipientId: string
  recipientRole: RecipientRole
  type: NotificationType
  title: string
  body: string
  channels: NotificationChannel[]
  sentVia: NotificationChannel[]
  failedVia: NotificationChannel[]
  isRead: boolean
  readAt: string | null
  payload: unknown
  entityType: string | null
  entityId: string | null
  actionUrl: string | null
  priority: NotificationPriority
  senderUserId: string | null
  retryCount: number
  lastErrorAt: string | null
  lastErrorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface NotificationSettingRow {
  _id: string
  userId: string
  muted: Record<string, boolean>
  channelsPerType: Record<string, NotificationChannel[]>
  enableEmail: boolean
  enableSms: boolean
  enableInApp: boolean
  enableZalo: boolean
  quietHours: string[]
  createdAt?: string
  updatedAt?: string
}

export interface NotificationsListResponse {
  items: NotificationRow[]
  total: number
  page: number
  pageSize: number
}

export type NotificationBaseQuery = {
  page?: number
  pageSize?: number
  isRead?: boolean
  type?: NotificationType | NotificationType[]
  search?: string
}

export async function fetchMyNotifications(q?: NotificationBaseQuery) {
  const params = new URLSearchParams()
  if (q?.page) params.set('page', String(q.page))
  if (q?.pageSize) params.set('pageSize', String(q.pageSize))
  if (q?.isRead === true) params.set('isRead', 'true')
  if (q?.isRead === false) params.set('isRead', 'false')
  if (q?.type) (Array.isArray(q.type) ? q.type : [q.type]).forEach((t) => params.append('type', t))
  if (q?.search) params.set('search', q.search)
  const query = params.toString()
  return apiFetch<NotificationsListResponse>(`/me/notifications${query ? '?' + query : ''}`)
}

export async function fetchStaffNotifications(q?: NotificationBaseQuery) {
  const params = new URLSearchParams()
  if (q?.page) params.set('page', String(q.page))
  if (q?.pageSize) params.set('pageSize', String(q.pageSize))
  if (q?.isRead === true) params.set('isRead', 'true')
  if (q?.isRead === false) params.set('isRead', 'false')
  if (q?.type) (Array.isArray(q.type) ? q.type : [q.type]).forEach((t) => params.append('type', t))
  if (q?.search) params.set('search', q.search)
  const query = params.toString()
  return apiFetch<NotificationsListResponse>(`/staff/notifications${query ? '?' + query : ''}`)
}

export async function fetchAdminNotifications(q?: NotificationBaseQuery & { recipientRole?: RecipientRole | RecipientRole[] }) {
  const params = new URLSearchParams()
  if (q?.page) params.set('page', String(q.page))
  if (q?.pageSize) params.set('pageSize', String(q.pageSize))
  if (q?.isRead === true) params.set('isRead', 'true')
  if (q?.isRead === false) params.set('isRead', 'false')
  if (q?.type) (Array.isArray(q.type) ? q.type : [q.type]).forEach((t) => params.append('type', t))
  if (q?.search) params.set('search', q.search)
  if (q?.recipientRole) (Array.isArray(q.recipientRole) ? q.recipientRole : [q.recipientRole]).forEach((r) => params.append('recipientRole', r))
  const query = params.toString()
  return apiFetch<NotificationsListResponse>(`/admin/notifications${query ? '?' + query : ''}`)
}

export async function fetchMyNotificationsBadge() {
  return apiFetch<{ unreadCount: number }>('/me/notifications/badge', { method: 'GET' })
}

export async function fetchStaffNotificationsBadge() {
  return apiFetch<{ unreadCount: number }>('/staff/notifications/badge', { method: 'GET' })
}

export async function fetchAdminNotificationsBadge() {
  return apiFetch<{ unreadCount: number }>('/admin/notifications/badge', { method: 'GET' })
}

export async function markMeNotificationRead(id: string) {
  return apiFetch<{ ok: boolean; row?: NotificationRow }>(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export async function markStaffNotificationRead(id: string) {
  return apiFetch<{ ok: boolean; row?: NotificationRow }>(`/staff/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export async function markAdminNotificationRead(id: string) {
  return apiFetch<{ ok: boolean; row?: NotificationRow }>(`/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' })
}

export async function markMeAllNotificationsRead() {
  return apiFetch<{ ok: true; unreadCount: 0 }>('/me/notifications/read-all', { method: 'PATCH' })
}

export async function markStaffAllNotificationsRead() {
  return apiFetch<{ ok: true; unreadCount: 0 }>('/staff/notifications/read-all', { method: 'PATCH' })
}

export async function markAdminAllNotificationsRead() {
  return apiFetch<{ ok: true; unreadCount: 0 }>('/admin/notifications/read-all', { method: 'PATCH' })
}

export async function deleteMeNotification(id: string) {
  return apiFetch<{ ok: boolean }>(`/me/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteStaffNotification(id: string) {
  return apiFetch<{ ok: boolean }>(`/staff/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function deleteAdminNotification(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/notifications/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function fetchMeNotificationSettings() {
  return apiFetch<NotificationSettingRow>('/me/notifications/settings', { method: 'GET' })
}

export async function fetchStaffNotificationSettings() {
  return apiFetch<NotificationSettingRow>('/staff/notifications/settings', { method: 'GET' })
}

export async function fetchAdminNotificationSettings() {
  return apiFetch<NotificationSettingRow>('/admin/notifications/settings', { method: 'GET' })
}

export async function updateMeNotificationSettings(patch: Partial<Omit<NotificationSettingRow, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  return apiFetch<NotificationSettingRow>('/me/notifications/settings', { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function updateStaffNotificationSettings(patch: Partial<Omit<NotificationSettingRow, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  return apiFetch<NotificationSettingRow>('/staff/notifications/settings', { method: 'PATCH', body: JSON.stringify(patch) })
}

export async function updateAdminNotificationSettings(patch: Partial<Omit<NotificationSettingRow, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>) {
  return apiFetch<NotificationSettingRow>('/admin/notifications/settings', { method: 'PATCH', body: JSON.stringify(patch) })
}
