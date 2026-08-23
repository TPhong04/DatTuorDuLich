import { apiFetch } from '@/lib/api'

// ============== Types ==============

export type ChatRole = 'USER' | 'ASSISTANT' | 'STAFF' | 'SYSTEM'
export type ChatStatus = 'BOT' | 'ESCALATED' | 'CLOSED'
export type ChatSlaStatus = 'within_sla' | 'breached_pickup' | 'breached_reply' | 'unknown'
export type ChatClosedReason =
  | 'resolved_by_staff' | 'resolved_by_bot' | 'customer_idle_timeout'
  | 'staff_closed' | 'admin_closed' | 'auto_closed_24h' | 'unknown'

export interface ChatSession {
  id: string
  userId: string | null
  guestName: string | null
  guestEmail: string | null
  guestPhone: string | null
  status: ChatStatus
  assignedTo: string | null
  assignedAt: string | null
  assignedStaffName: string | null
  escalationReason: string | null
  escalatedAt: string | null
  escalatedByStaffId: string | null
  firstResponseAt: string | null
  firstResponseSeconds: number | null
  firstResponseHuman: string | null
  lastCustomerMessageAt: string | null
  lastStaffMessageAt: string | null
  ratingStars: number | null
  ratingComment: string | null
  ratedAt: string | null
  closedAt: string | null
  closedReason: ChatClosedReason | null
  closedByStaffId: string | null
  customerMessagesCount: number
  staffMessagesCount: number
  botMessagesCount: number
  slaStatus: ChatSlaStatus
  slaBreached: boolean
  slaLabel: string
  slaWaitSeconds: number | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ChatMessage {
  id: string
  sessionId: string
  role: ChatRole
  content: string
  createdAt: string | null
  toolCalls?: any
  toolResult?: any
}

export interface AdminChatListQuery {
  page?: number
  limit?: number
  status?: ChatStatus
  assignedTo?: string
  search?: string
  sortBy?: 'lastCustomerMessageAt' | 'escalatedAt' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  onlyUnassigned?: boolean
  slaBreachedOnly?: boolean
}

export interface ChatStats {
  pendingPickup: number
  inProgress: number
  todayClosed: number
  total: number
  breachedToday: number
  avgFirstResponseSeconds: number | null
  avgFirstResponseHuman: string
  avgRating: number | null
  ratedCount: number
  topStaff: Array<{ staffId: string; staffName: string | null; closed: number }>
  range: { from: string | null; to: string | null }
}

export interface StaffChatKpi {
  staffUserId: string
  range: { from: string | null; to: string | null }
  assignedCount: number
  closedCount: number
  avgFirstResponseSeconds: number | null
  avgFirstResponseHuman: string | null
  avgRating: number | null
  ratedCount: number
  breachedPickupCount: number
  breachedReplyCount: number
}

export type ListSessionsRes = { items: ChatSession[]; total: number; page: number; limit: number }
export type SessionDetailRes = { session: ChatSession; messages: ChatMessage[] }

// ============== Admin / Staff Endpoints ==============

export function adminListChatSessions(p: AdminChatListQuery = {}) {
  const params = new URLSearchParams()
  if (p.page) params.set('page', String(p.page))
  if (p.limit) params.set('limit', String(p.limit))
  if (p.status) params.set('status', p.status)
  if (p.assignedTo) params.set('assignedTo', p.assignedTo)
  if (p.search && p.search.trim()) params.set('search', p.search.trim())
  if (p.sortBy) params.set('sortBy', p.sortBy)
  if (p.sortOrder) params.set('sortOrder', p.sortOrder)
  if (p.onlyUnassigned) params.set('onlyUnassigned', '1')
  if (p.slaBreachedOnly) params.set('slaBreachedOnly', '1')
  const qs = params.toString()
  return apiFetch<ListSessionsRes>(`/admin/chat/sessions${qs ? `?${qs}` : ''}`)
}

export function adminGetChatSessionDetail(id: string, messageLimit = 300) {
  const qs = messageLimit ? `?messageLimit=${messageLimit}` : ''
  return apiFetch<SessionDetailRes>(`/admin/chat/sessions/${id}${qs}`)
}

export function adminClaimChatSession(sessionId: string) {
  return apiFetch<ChatSession>('/admin/chat/sessions/claim', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  })
}

export function adminAssignChatSession(sessionId: string, staffUserId: string, transferNote?: string) {
  return apiFetch<ChatSession>('/admin/chat/sessions/assign', {
    method: 'POST',
    body: JSON.stringify({ sessionId, staffUserId, transferNote: transferNote?.trim() || undefined }),
  })
}

export function adminTransferChatSession(sessionId: string, toStaffUserId: string, reason?: string) {
  return apiFetch<ChatSession>('/admin/chat/sessions/transfer', {
    method: 'POST',
    body: JSON.stringify({ sessionId, toStaffUserId, reason: reason?.trim() || undefined }),
  })
}

export function adminUpdateChatSessionStatus(
  sessionId: string,
  status: ChatStatus,
  closedReason?: ChatClosedReason
) {
  return apiFetch<ChatSession>('/admin/chat/sessions/status', {
    method: 'PATCH',
    body: JSON.stringify({ sessionId, status, closedReason: closedReason || undefined }),
  })
}

export function adminEscalateChatSession(sessionId: string, reason: string) {
  return apiFetch<ChatSession>('/admin/chat/sessions/escalate', {
    method: 'POST',
    body: JSON.stringify({ sessionId, reason: reason?.trim() || 'Yêu cầu hỗ trợ thủ công' }),
  })
}

export function adminStaffReplyChatSession(sessionId: string, message: string) {
  return apiFetch<{ sessionId: string; reply: string }>(`/admin/chat/sessions/${sessionId}/staff-reply`, {
    method: 'POST',
    body: JSON.stringify({ message: message.trim() }),
  })
}

export function adminChatDashboardStats(fromDate?: string, toDate?: string) {
  const qs = new URLSearchParams()
  if (fromDate) qs.set('fromDate', fromDate)
  if (toDate) qs.set('toDate', toDate)
  const s = qs.toString()
  return apiFetch<ChatStats>(`/admin/chat/stats/dashboard${s ? `?${s}` : ''}`)
}

export function adminStaffChatKpi(staffUserId: string, fromDate?: string, toDate?: string) {
  const qs = new URLSearchParams()
  if (fromDate) qs.set('fromDate', fromDate)
  if (toDate) qs.set('toDate', toDate)
  const s = qs.toString()
  return apiFetch<StaffChatKpi>(`/admin/chat/stats/staff/${staffUserId}${s ? `?${s}` : ''}`)
}

// ============== PHASE 3 (Thiếu Admin Actions tách riêng) ==============

export function adminCloseIdleSessions() {
  return apiFetch<{ closed: number; totalScanned: number }>('/admin/chat/sessions/close-idle', { method: 'POST' })
}

export function adminSendThankYouVouchers() {
  return apiFetch<{ sent: number; eligible: number; voucherCode: string }>(
    '/admin/chat/sessions/send-thankyou-voucher',
    { method: 'POST' }
  )
}

// ============== Customer Public Endpoints (Widget) ==============

export function customerChatSendMessage(input: {
  sessionId?: string
  message: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  userId?: string
}) {
  return apiFetch<{
    sessionId: string
    status: ChatStatus
    reply: string
    assignedStaffName?: string | null
  }>('/chat/message', { method: 'POST', body: JSON.stringify(input) })
}

export function customerGetChatSessionInfo(sessionId: string) {
  return apiFetch<SessionDetailRes>(`/chat/sessions/${sessionId}`)
}

export function customerSubmitChatRating(input: {
  sessionId: string
  ratingStars: number
  ratingComment?: string
  guestEmail?: string
}) {
  return apiFetch<{ ok: true; ratingStars: number }>('/chat/rating', { method: 'POST', body: JSON.stringify(input) })
}
