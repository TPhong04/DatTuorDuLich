import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2, Mail, Search, Settings2, Trash2, X } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import {
  NotificationRow,
  deleteAdminNotification,
  deleteMeNotification,
  deleteStaffNotification,
  fetchAdminNotifications,
  fetchMyNotifications,
  fetchStaffNotifications,
  markAdminAllNotificationsRead,
  markAdminNotificationRead,
  markMeAllNotificationsRead,
  markMeNotificationRead,
  markStaffAllNotificationsRead,
  markStaffNotificationRead,
} from '@/features/notifications/notifications'
import { getStoredUser } from '@/features/auth/auth'
import { useNotificationSocket } from '@/features/notifications/useNotificationSocket'
import { cn } from '@/lib/utils'

type Scope = 'customer' | 'staff' | 'admin'

export default function NotificationsListPage({ scope }: { scope: Scope }) {
  const user = getStoredUser()
  const location = useLocation()
  const navigate = useNavigate()
  const socket = useNotificationSocket()
  const [tab, setTab] = useState<'unread' | 'all' | 'read'>('unread')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [type, setType] = useState<string | null>(null)
  const [search, setSearch] = useState<string>('')
  const [stale, setStale] = useState(0)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [marking, setMarking] = useState<Record<string, boolean>>({})

  const query = useMemo(() => {
    const q: { page: number; pageSize: number; isRead?: boolean; type?: any; search?: string } = { page, pageSize }
    if (tab === 'unread') q.isRead = false
    if (tab === 'read') q.isRead = true
    if (type) q.type = type
    if (search.trim()) q.search = search.trim()
    return q
  }, [tab, page, pageSize, type, search])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res =
          scope === 'admin' ? await fetchAdminNotifications(query as any) :
          scope === 'staff' ? await fetchStaffNotifications(query as any) :
          await fetchMyNotifications(query as any)
        if (cancelled) return
        setItems(res.items)
        setTotal(res.total)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [scope, query, stale])

  const unread = Math.max(0, socket.state.unreadCount)

  const scopePrefix =
    scope === 'admin' ? '/admin' :
    scope === 'staff' ? '/staff' : ''

  const settingsPath =
    scope === 'admin' ? '/admin/settings/notifications' :
    scope === 'staff' ? '/staff/notifications' : '/account'

  const markRead = async (row: NotificationRow) => {
    if (marking[row._id] || row.isRead) return
    setMarking((m) => ({ ...m, [row._id]: true }))
    try {
      if (scope === 'admin') await markAdminNotificationRead(row._id)
      else if (scope === 'staff') await markStaffNotificationRead(row._id)
      else await markMeNotificationRead(row._id)
      socket.setUnread(Math.max(0, unread - 1))
      setStale((s) => s + 1)
    } finally {
      setMarking((m) => ({ ...m, [row._id]: false }))
    }
  }

  const remove = async (row: NotificationRow) => {
    if (!window.confirm(`Xoá thông báo "${row.title}"?`)) return
    setDeleting((d) => ({ ...d, [row._id]: true }))
    try {
      if (scope === 'admin') await deleteAdminNotification(row._id)
      else if (scope === 'staff') await deleteStaffNotification(row._id)
      else await deleteMeNotification(row._id)
      socket.setUnread(Math.max(0, row.isRead ? unread : Math.max(0, unread - 1)))
      setStale((s) => s + 1)
    } finally {
      setDeleting((d) => ({ ...d, [row._id]: false }))
    }
  }

  const markAll = async () => {
    try {
      if (scope === 'admin') await markAdminAllNotificationsRead()
      else if (scope === 'staff') await markStaffAllNotificationsRead()
      else await markMeAllNotificationsRead()
      socket.setUnread(0)
      setStale((s) => s + 1)
    } catch {}
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 pb-16 lg:px-5">
      <PageHeader
        title="Thông báo"
        subtitle={
          scope === 'admin' ? 'Thông báo hệ thống toàn cục, các sự kiện nghiệp vụ quản trị' :
          scope === 'staff' ? 'Thông báo nghiệp vụ được giao, báo giá, chốt đơn, nhắc lịch gọi' :
          `Cập nhật về đơn đặt, tour đoàn của ${user?.name || 'bạn'}`
        }
        right={
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
              onClick={markAll}
              type="button"
            >
              <CheckCheck className="h-4 w-4" /> Đánh dấu tất cả đã đọc
            </button>
            <Link
              className="inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              to={settingsPath}
            >
              <Settings2 className="h-4 w-4" /> Cấu hình
            </Link>
          </div>
        }
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chưa đọc</div>
          <div className="mt-1 text-2xl font-black text-orange-600">{unread}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tổng</div>
          <div className="mt-1 text-2xl font-black text-blue-700">{total}</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{socket.state.connected ? 'Trạng thái' : 'Kết nối'}</div>
          <div className={cn(
            'mt-1 flex items-center gap-1.5 text-lg font-black',
            socket.state.connected ? 'text-emerald-600' : (socket.state.connecting ? 'text-amber-600' : 'text-red-600'),
          )}>
            {socket.state.connected ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : socket.state.connecting ? <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" /> : <span className="h-2 w-2 rounded-full bg-red-500" />}
            {socket.state.connected ? 'Real-time' : socket.state.connecting ? 'Kết nối...' : 'Mất kết nối'}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:p-4">
        <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
          {(['unread', 'all', 'read'] as const).map((t) => (
            <button
              key={t}
              className={cn(
                'rounded-xl px-4 py-2 text-xs font-semibold transition',
                tab === t ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900',
              )}
              onClick={() => { setTab(t); setPage(1) }}
              type="button"
            >
              {t === 'unread' ? 'Chưa đọc' : t === 'read' ? 'Đã đọc' : 'Tất cả'}
              {t === 'unread' && unread > 0 && <span className="ml-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-orange-400/30 transition focus:ring-4 lg:w-72"
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="Tìm tiêu đề / nội dung..."
              value={search}
            />
          </div>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-400/30 transition focus:ring-4"
            onChange={(e) => { setType(e.target.value || null); setPage(1) }}
            value={type || ''}
          >
            <option value="">Tất cả loại</option>
            {[
              ['gtr_created','Yêu cầu Tour đoàn mới'],
              ['gtr_assigned_staff','Admin giao đơn'],
              ['gtr_contacted','Đã liên hệ'],
              ['gtr_quoting','Báo giá mới'],
              ['gtr_negotiating','Đang đàm phán'],
              ['gtr_won','Chốt đơn'],
              ['gtr_lost','Thua đơn'],
              ['gtr_booking_created','Booking tạo thành công'],
              ['booking_deposit_paid','Nhận cọc'],
              ['booking_confirmed','Xác nhận booking'],
              ['booking_cancelled','Hủy booking'],
              ['booking_trip_reminder_48h','Nhắc 48h khởi hành'],
              ['booking_deposit_overdue','Cọc quá hạn'],
              ['staff_followup_due','Đến hạn gọi'],
              ['admin_new_gtr','Admin: Yêu cầu mới'],
              ['admin_gtr_won_large','Admin: Chốt đơn lớn'],
              ['admin_gtr_lost_large','Admin: Thua đơn lớn'],
            ].map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {loading && (
          <div className="flex items-center justify-center py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải danh sách thông báo...
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <Mail className="h-7 w-7 text-slate-400" />
            </div>
            <div className="mt-4 text-lg font-bold text-slate-800">
              {tab === 'unread' ? 'Không còn thông báo chưa đọc 🎉' : 'Chưa có thông báo nào'}
            </div>
            <div className="mt-1 max-w-md text-sm text-slate-500">
              {tab === 'unread' ? 'Bạn đã cập nhật kịp thời mọi sự kiện nghiệp vụ. Tuyệt vời!' : 'Các thông báo mới sẽ xuất hiện tại đây ngay khi có sự kiện (giao đơn, báo giá, chốt đơn, nhắc lịch...).'}
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {items.map((row) => (
            <li
              key={row._id}
              className={cn(
                'group relative px-4 py-3.5 transition lg:px-6',
                !row.isRead ? 'bg-orange-50/30 hover:bg-orange-50/60' : 'bg-white hover:bg-slate-50',
              )}
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  'mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                  row.priority === 'urgent' ? 'bg-red-100 text-red-600' :
                  row.priority === 'high' ? 'bg-orange-100 text-orange-600' :
                  row.priority === 'low' ? 'bg-slate-100 text-slate-500' :
                  'bg-blue-50 text-blue-600',
                )}>
                  <Bell className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={cn('truncate text-[15px] font-semibold leading-tight', !row.isRead ? 'text-slate-900' : 'text-slate-700')}>{row.title}</div>
                        {!row.isRead && (
                          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-orange-500" title="Chưa đọc" />
                        )}
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          row.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          row.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          row.priority === 'low' ? 'bg-slate-100 text-slate-600' :
                          'bg-blue-50 text-blue-700',
                        )}>
                          {row.priority === 'urgent' ? 'Khẩn cấp' : row.priority === 'high' ? 'Quan trọng' : row.priority === 'low' ? 'Thường' : 'Trung bình'}
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{row.type.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600">{row.body}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>{new Date(row.createdAt).toLocaleString('vi-VN')}</span>
                        {row.sentVia?.includes('email') && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700" title="Đã gửi Email">📧 Email OK</span>}
                        {row.sentVia?.includes('sms') && <span className="rounded-full bg-sky-50 px-2 py-0.5 font-semibold text-sky-700" title="Đã gửi SMS">📱 SMS OK</span>}
                        {row.sentVia?.includes('in_app') && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">🔔 Push OK</span>}
                        {row.failedVia?.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">⚠️ Gửi lỗi: {row.failedVia.join(', ')}</span>}
                        {row.entityType && row.entityId && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-500">
                            {row.entityType.replace(/_/g, ' ')} · {String(row.entityId).slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      {!row.isRead && (
                        <button
                          className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:bg-white hover:text-slate-800 disabled:opacity-50"
                          disabled={!!marking[row._id]}
                          onClick={() => markRead(row)}
                          title="Đánh dấu đã đọc"
                          type="button"
                        >
                          {marking[row._id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                        </button>
                      )}
                      {row.actionUrl && (
                        <button
                          className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-orange-500 px-3.5 text-xs font-semibold text-white transition hover:bg-orange-600"
                          onClick={() => navigate(row.actionUrl!)}
                          type="button"
                        >
                          Xem chi tiết →
                        </button>
                      )}
                      <button
                        className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-500 ring-1 ring-inset ring-slate-200 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        disabled={!!deleting[row._id]}
                        onClick={() => remove(row)}
                        title="Xoá thông báo"
                        type="button"
                      >
                        {deleting[row._id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {items.length > 0 && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-4 py-4 lg:px-6">
            <div className="text-xs text-slate-500">
              Hiển thị {(page - 1) * pageSize + 1} - {Math.min(total, page * pageSize)} / {total} thông báo
            </div>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >← Trước</button>
              <span className="px-2 text-xs font-semibold text-slate-600">Trang {page} / {totalPages}</span>
              <button
                className="inline-flex h-9 items-center rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >Sau →</button>
            </div>
          </div>
        )}
      </div>

      {location.pathname === '/account/notifications' && (
        <div className="text-xs text-slate-400">
          <Link className="text-slate-500 underline-offset-4 hover:underline" to="/account">← Về trang tài khoản</Link>
        </div>
      )}
      {scopePrefix && (
        <div className="hidden">{/* placeholder */}<X /></div>
      )}
    </div>
  )
}
