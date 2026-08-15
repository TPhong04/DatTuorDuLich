import { apiFetch } from '@/lib/api'

export type TodoCategory = 'hotel' | 'flight' | 'visa' | 'guide' | 'transport' | 'other'
export type TodoPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TodoStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export type TodoRow = {
  _id: string
  id: string
  groupTourRequestId?: string | null
  groupTourRequestCode?: string | null
  bookingId?: string | null
  bookingCode?: string | null
  assigneeId: string
  category: TodoCategory
  title: string
  description?: string | null
  order: number
  status: TodoStatus
  priority: TodoPriority
  dueAt?: string | null
  doneAt?: string | null
  doneById?: string | null
  createdById?: string | null
  metadata?: Record<string, any> | null
  createdAt: string
  updatedAt: string
}

export type TodoListEnvelope<T = TodoRow[]> = {
  ok: boolean
  items?: T
  total?: number
  page?: number
  pageSize?: number
  totalPages?: number
  totals?: {
    todo?: number
    in_progress?: number
    done?: number
    overdue?: number
    today?: number
  }
  today?: TodoRow[]
  summary?: {
    total: number
    done: number
    in_progress: number
    todo: number
    progressPct: number
  }
}

export const TODO_CATEGORY_META: Record<TodoCategory, { label: string; icon: string; badge: string; dot: string }> = {
  hotel: { label: 'Khách sạn', icon: '🏨', badge: 'bg-orange-50 text-orange-700 border border-orange-100', dot: 'bg-orange-500' },
  flight: { label: 'Vé máy bay', icon: '✈️', badge: 'bg-sky-50 text-sky-700 border border-sky-100', dot: 'bg-sky-500' },
  visa: { label: 'Visa & Giấy tờ', icon: '🛂', badge: 'bg-violet-50 text-violet-700 border border-violet-100', dot: 'bg-violet-500' },
  guide: { label: 'Hướng dẫn viên', icon: '🧑‍✈️', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-100', dot: 'bg-emerald-500' },
  transport: { label: 'Xe du lịch', icon: '🚗', badge: 'bg-amber-50 text-amber-700 border border-amber-100', dot: 'bg-amber-500' },
  other: { label: 'Công việc khác', icon: '📌', badge: 'bg-slate-100 text-slate-700 border border-slate-200', dot: 'bg-slate-500' },
}

export const TODO_PRIORITY_META: Record<TodoPriority, { label: string; chip: string; dot: string; color: string }> = {
  low: { label: 'Thấp', chip: 'bg-slate-100 text-slate-600', dot: 'bg-slate-400', color: 'text-slate-500' },
  normal: { label: 'Bình thường', chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500', color: 'text-blue-600' },
  high: { label: 'Cao', chip: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', color: 'text-orange-600' },
  urgent: { label: 'Khẩn cấp', chip: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', color: 'text-rose-600' },
}

export const TODO_STATUS_META: Record<TodoStatus, { label: string; chip: string; dot: string }> = {
  todo: { label: 'Chưa làm', chip: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  in_progress: { label: 'Đang làm', chip: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  done: { label: 'Hoàn thành', chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  cancelled: { label: 'Hủy', chip: 'bg-rose-100 text-rose-600', dot: 'bg-rose-400' },
}

export function todoTimeLeftText(dueAt: string | null | undefined, status: TodoStatus): { text: string; isOverdue: boolean; isSoon: boolean; cls: string } {
  if (!dueAt || status === 'done' || status === 'cancelled') {
    return { text: '—', isOverdue: false, isSoon: false, cls: 'text-slate-400' }
  }
  const now = Date.now()
  const due = new Date(dueAt).getTime()
  const diffMs = due - now
  if (diffMs <= 0) {
    const absMins = Math.max(0, Math.round(-diffMs / 60000))
    if (absMins < 60) return { text: `Quá hạn ${absMins} phút`, isOverdue: true, isSoon: true, cls: 'text-rose-600 font-semibold' }
    const hours = Math.floor(absMins / 60)
    if (hours < 24) return { text: `Quá hạn ${hours}h`, isOverdue: true, isSoon: true, cls: 'text-rose-600 font-semibold' }
    const days = Math.floor(hours / 24)
    return { text: `Quá hạn ${days} ngày`, isOverdue: true, isSoon: true, cls: 'text-rose-600 font-semibold' }
  }
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins <= 10) return { text: `Còn ${mins} phút`, isOverdue: false, isSoon: true, cls: 'text-orange-600 font-semibold' }
  if (mins < 60) return { text: `Còn ${mins} phút`, isOverdue: false, isSoon: true, cls: 'text-orange-500 font-semibold' }
  const hours = Math.floor(mins / 60)
  if (hours < 24) return { text: `Còn ${hours} giờ`, isOverdue: false, isSoon: hours < 1, cls: hours < 1 ? 'text-orange-500 font-semibold' : 'text-amber-600' }
  const days = Math.floor(hours / 24)
  return { text: `Còn ${days} ngày`, isOverdue: false, isSoon: days <= 1, cls: days <= 1 ? 'text-amber-600' : 'text-slate-500' }
}

export async function fetchStaffTodosMine(params?: { status?: TodoStatus; onlyOverdue?: boolean; page?: number; pageSize?: number }) {
  const q = new URLSearchParams()
  if (params?.status) q.append('status', String(params.status))
  if (params?.onlyOverdue) q.append('onlyOverdue', '1')
  if (params?.page) q.append('page', String(params.page))
  if (params?.pageSize) q.append('pageSize', String(params.pageSize))
  const res = await apiFetch<TodoListEnvelope>(`/staff/todos/me${q.toString() ? '?' + q.toString() : ''}`)
  return res
}

export async function fetchStaffTodosOverview() {
  const res = await apiFetch<TodoListEnvelope>(`/staff/todos/me/overview`)
  return res
}

export async function fetchStaffGtrTodos(gtrId: string) {
  const res = await apiFetch<TodoListEnvelope>(`/staff/group-tour-requests/${encodeURIComponent(gtrId)}/todos`)
  return res
}

export async function fetchAdminGtrTodos(gtrId: string) {
  const res = await apiFetch<TodoListEnvelope>(`/admin/group-tour-requests/${encodeURIComponent(gtrId)}/todos`)
  return res
}

export async function patchTodoStatus(id: string, status: TodoStatus, role: 'staff' | 'admin' = 'staff') {
  const res = await apiFetch<{ ok: boolean; row: TodoRow }>(`/${role}/todos/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  return res.row
}
