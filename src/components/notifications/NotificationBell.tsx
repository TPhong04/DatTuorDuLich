import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  NotificationRow,
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

type PanelRole = 'customer' | 'staff' | 'admin'

function useClientListApi(role: PanelRole, query: { isRead?: boolean; page?: number; pageSize?: number }) {
  const [state, setState] = useState<{ loading: boolean; items: NotificationRow[]; total: number; page: number; pageSize: number; stale: number }>({
    loading: true, items: [], total: 0, page: 1, pageSize: 20, stale: 0,
  })
  const setStale = () => setState((s) => ({ ...s, stale: s.stale + 1 }))
  const prepend = (row: NotificationRow) => setState((s) => {
    if (s.items.some(i => String(i._id) === String(row._id))) return s
    const tabAllowsRow = query.isRead === false ? !row.isRead : true
    if (!tabAllowsRow) return { ...s, total: s.total + 1 }
    const next = [row, ...s.items]
    if (next.length > Math.max(60, s.pageSize * 3)) next.length = Math.max(60, s.pageSize * 3)
    return { ...s, items: next, loading: false, total: s.total + 1 }
  })

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    const t0 = performance.now()
    // #region debug-point H3:bell-client-list-fetch-start
    fetch('http://127.0.0.1:7788/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'notifications-push-slow-missing',runId:'post-fix',hypothesisId:'H3',location:'NotificationBell.tsx:28',msg:'[DEBUG] bell list fetch start',data:{role,tab:query.isRead === false ? 'unread' : 'all',page:query.page,pageSize:query.pageSize,willUsePrependOnNew:true},ts:Date.now()})}).catch(()=>{});
    // #endregion
    ;(async () => {
      try {
        const res =
          role === 'admin' ? await fetchAdminNotifications(query) :
          role === 'staff' ? await fetchStaffNotifications(query) :
          await fetchMyNotifications(query)
        const duration = performance.now() - t0
        // #region debug-point H3:bell-client-list-fetch-end
        fetch('http://127.0.0.1:7788/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'notifications-push-slow-missing',runId:'post-fix',hypothesisId:'H3',location:'NotificationBell.tsx:37',msg:'[DEBUG] bell list fetch end',data:{role,durationMs:Math.round(duration),count:res.items?.length||0,total:res.total||0,stale:state.stale},ts:Date.now()})}).catch(()=>{});
        // #endregion
        if (!cancelled) setState({ loading: false, items: res.items as any, total: res.total, page: res.page, pageSize: res.pageSize, stale: state.stale })
      } catch (err: any) {
        const duration = performance.now() - t0
        // #region debug-point H3:bell-client-list-fetch-error
        fetch('http://127.0.0.1:7788/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'notifications-push-slow-missing',runId:'post-fix',hypothesisId:'H3',location:'NotificationBell.tsx:39',msg:'[DEBUG] bell list fetch error',data:{role,durationMs:Math.round(duration),err:String(err?.message||err)},ts:Date.now()})}).catch(()=>{});
        // #endregion
        if (!cancelled) setState((s) => ({ ...s, loading: false, items: [], total: 0 }))
      }
    })()
    return () => { cancelled = true }
  }, [role, query.isRead, query.page, query.pageSize, state.stale])

  return { ...state, setStale, prepend }
}

export default function NotificationBell() {
  const user = getStoredUser()
  const role: PanelRole = user?.role === 'admin' ? 'admin' : user?.role === 'staff' ? 'staff' : user?.role === 'customer' ? 'customer' : 'customer'
  const navigate = useNavigate()
  const location = useLocation()
  const socket = useNotificationSocket()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'unread' | 'all'>('unread')
  const [page, setPage] = useState(1)
  const closeRef = useRef<HTMLDivElement | null>(null)

  const query = useMemo(() => ({ isRead: tab === 'unread' ? false : undefined, page, pageSize: tab === 'unread' ? 30 : 20 }), [tab, page])
  const list = useClientListApi(role, query)
  const autoMarkedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const off = socket.on('notification.new', (row: NotificationRow) => {
      list.prepend(row)
    })
    return () => { if (typeof off === 'function') { try { off() } catch {} } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket])

  useEffect(() => {
    if (!open || tab !== 'unread') return
    const toMark = list.items.slice(0, 5).filter((i) => !i.isRead && !autoMarkedRef.current.has(i._id)).map((i) => i._id)
    if (!toMark.length) return
    ;(async () => {
      for (const id of toMark) {
        try {
          autoMarkedRef.current.add(id)
          if (role === 'admin') await markAdminNotificationRead(id)
          else if (role === 'staff') await markStaffNotificationRead(id)
          else await markMeNotificationRead(id)
          socket.setUnread(Math.max(0, socket.state.unreadCount - 1))
        } catch {}
      }
      list.setStale()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, list.items?.length || 0])

  const unreadCount = Math.max(0, socket.state.unreadCount)

  const onMarkAll = async () => {
    try {
      if (role === 'admin') await markAdminAllNotificationsRead()
      else if (role === 'staff') await markStaffAllNotificationsRead()
      else await markMeAllNotificationsRead()
      socket.setUnread(0)
      list.setStale()
    } catch {}
  }

  const root =
    role === 'admin' ? '/admin' :
    role === 'staff' ? '/staff' :
    '/account'
  const resolveActionUrl = (row: NotificationRow) => {
    const roleNow: PanelRole = role
    let url = (row.actionUrl ?? '').toString().trim()
    const type = (row.type ?? '').toString()
    const expectedPrefix =
      roleNow === 'admin' ? '/admin' :
      roleNow === 'staff' ? '/staff' :
      '/account'
    const forceRewritePrefix = () => {
      if (!url) return
      const m = url.match(/^\/(admin|staff|account)([?#\/].*)?$/)
      if (!m) return
      const actual = m[1]
      const roleOfActual: PanelRole = actual === 'admin' ? 'admin' : actual === 'staff' ? 'staff' : 'customer'
      if (roleOfActual === roleNow) return
      const rest = m[2] ?? ''
      url = `${expectedPrefix}${rest.startsWith('/') ? '' : rest.length ? '/' : ''}${rest}`
    }
    forceRewritePrefix()
    const tryExtractId = (pathSeg: string, base: string) => {
      const m = url.match(new RegExp(`^${pathSeg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/([^?]+)`))
      if (m) {
        const q = url.includes('?') ? url.slice(url.indexOf('?')) : ''
        return `${base}?id=${m[1]}${q ? '&' + q.slice(1) : ''}`
      }
      return url
    }
    const isGtr = type.includes('group_tour_request') || type.startsWith('gtr_') || type.startsWith('admin_gtr') || type.startsWith('staff_gtr')
    if (isGtr) {
      if (roleNow === 'admin') {
        url = tryExtractId('/account/group-tour-requests', '/admin/group-tour-requests')
        url = tryExtractId('/staff/group-tour-requests', '/admin/group-tour-requests')
      } else if (roleNow === 'staff') {
        url = tryExtractId('/account/group-tour-requests', '/staff/group-tour-requests')
        url = tryExtractId('/admin/group-tour-requests', '/staff/group-tour-requests')
      } else {
        url = tryExtractId('/staff/group-tour-requests', '/account/group-tour-requests')
        url = tryExtractId('/admin/group-tour-requests', '/account/group-tour-requests')
      }
    } else {
      if (roleNow === 'admin') {
        url = tryExtractId('/account/bookings', '/admin/bookings')
        url = tryExtractId('/staff/bookings', '/admin/bookings')
      } else if (roleNow === 'staff') {
        url = tryExtractId('/account/bookings', '/staff/bookings')
        url = tryExtractId('/admin/bookings', '/staff/bookings')
      } else {
        url = tryExtractId('/admin/bookings', '/account/bookings')
        url = tryExtractId('/staff/bookings', '/account/bookings')
      }
    }
    forceRewritePrefix()
    if (!url) return `${root}/notifications`
    return url
  }
  const openRow = (row: NotificationRow) => {
    const url = resolveActionUrl(row)
    navigate(url, { replace: true })
    setOpen(false)
  }

  return (
    <div className="relative" ref={closeRef}>
      <button
        className={cn(
          'relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50',
          unreadCount > 0 && 'ring-2 ring-orange-400/40',
        )}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-label="Thông báo"
      >
        {socket.state.connecting && !socket.state.connected ? (
          <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {unreadCount > 0 && (
          <span className="pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(92vw,420px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-slate-900">Thông báo</div>
              <div className="text-xs text-slate-500">
                {socket.state.connected ? `● Online · ${unreadCount} chưa đọc` : socket.state.connecting ? '●●● Đang kết nối...' : `● Offline · ${socket.state.error || 'Lỗi kết nối'}`}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                onClick={onMarkAll}
                type="button"
                title="Đánh dấu tất cả đã đọc"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Tất cả đã đọc
              </button>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100"
                onClick={() => setOpen(false)}
                type="button"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex border-b border-slate-100 bg-white px-2">
            {(['unread', 'all'] as const).map((t) => (
              <button
                key={t}
                className={cn(
                  'relative flex-1 px-3 py-2.5 text-xs font-semibold transition',
                  tab === t ? 'text-orange-600' : 'text-slate-500 hover:text-slate-700',
                )}
                onClick={() => { setTab(t); setPage(1) }}
                type="button"
              >
                {t === 'unread' ? 'Chưa đọc' : 'Tất cả'}
                {tab === t && <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-orange-500" />}
              </button>
            ))}
          </div>
          <div className="max-h-[56vh] overflow-y-auto">
            {list.loading && (
              <div className="flex items-center justify-center py-12 text-xs text-slate-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải danh sách thông báo...
              </div>
            )}
            {!list.loading && list.items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <Bell className="h-10 w-10 text-slate-300" />
                <div className="mt-3 text-sm font-semibold text-slate-700">{tab === 'unread' ? 'Không còn thông báo chưa đọc' : 'Chưa có thông báo'}</div>
                <div className="mt-1 text-xs text-slate-500">{tab === 'unread' ? 'Tuyệt vời! Bạn đã theo dõi sát sao mọi cập nhật.' : 'Các thông báo mới sẽ xuất hiện tại đây.'}</div>
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {list.items.map((row) => (
                <li
                  key={row._id}
                  className={cn(
                    'group cursor-pointer px-4 py-3 transition',
                    !row.isRead ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'bg-white hover:bg-slate-50',
                  )}
                  onClick={() => openRow(row)}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      !row.isRead ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500',
                    )}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="truncate text-sm font-semibold leading-tight text-slate-900">{row.title}</div>
                        <span className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                          row.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                          row.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                          row.priority === 'low' ? 'bg-slate-100 text-slate-600' :
                          'bg-blue-50 text-blue-700',
                        )}>
                          {row.priority === 'urgent' ? 'Khẩn cấp' : row.priority === 'high' ? 'Quan trọng' : row.priority === 'low' ? 'Thường' : 'Trung bình'}
                        </span>
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{row.body}</div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                        <span>{new Date(row.createdAt).toLocaleString('vi-VN')}</span>
                        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                          <span className="rounded-full bg-slate-100 px-2 py-0.5">{row.type.replace(/_/g, ' ')}</span>
                          {row.sentVia?.includes('email') && <span title="Email đã gửi">📧</span>}
                          {row.sentVia?.includes('sms') && <span title="SMS đã gửi">📱</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {list.items.length > 0 && list.total > list.page * list.pageSize && (
              <div className="border-t border-slate-100 bg-slate-50/80 p-3 text-center">
                <button
                  className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  onClick={() => setPage((p) => p + 1)}
                  type="button"
                >
                  Xem thêm ({list.total - list.page * list.pageSize} thông báo còn lại)
                </button>
              </div>
            )}
          </div>
          <Link
            className="block border-t border-slate-100 bg-slate-50/80 px-4 py-3 text-center text-xs font-semibold text-orange-700 transition hover:bg-orange-50"
            onClick={() => setOpen(false)}
            to={`${root}/notifications`}
          >
            Xem tất cả thông báo →
          </Link>
        </div>
      )}
    </div>
  )
}
