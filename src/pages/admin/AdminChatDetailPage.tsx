import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  adminAssignChatSession,
  adminEscalateChatSession,
  adminGetChatSessionDetail,
  adminStaffChatKpi,
  adminStaffReplyChatSession,
  adminTransferChatSession,
  adminUpdateChatSessionStatus,
  ChatMessage,
  ChatRole,
  ChatSession,
  ChatStatus,
} from '@/features/chat/chat'
import { adminListBookings } from '@/features/bookings/bookings'
import { adminListInquiries } from '@/features/rentals/rentals'
import { adminListUsers } from '@/features/admin/admin'
import { getStoredAccessToken } from '@/features/auth/auth.storage'
import { useAuth } from '@/features/auth/auth.hooks'
import { cn } from '@/lib/utils'

function Badge({ tone, children, title }: { tone?: string; children: React.ReactNode; title?: string }) {
  const t = tone || 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span title={title} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', t)}>
      {children}
    </span>
  )
}
function FlowBtn({ tone, onClick, disabled, children, title }: { tone?: string; onClick?: () => void; disabled?: boolean; children: React.ReactNode; title?: string }) {
  const t = tone || 'bg-slate-100 hover:bg-slate-200 text-slate-800 ring-slate-200'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset transition disabled:opacity-50 disabled:cursor-not-allowed',
        t
      )}
    >
      {children}
    </button>
  )
}

const STATUS_TONES: Record<ChatStatus, string> = {
  BOT: 'bg-sky-50 text-sky-700 ring-sky-200',
  ESCALATED: 'bg-amber-50 text-amber-800 ring-amber-200',
  CLOSED: 'bg-slate-100 text-slate-600 ring-slate-200',
}
const STATUS_LABEL: Record<ChatStatus, string> = {
  BOT: 'Trợ lý ảo',
  ESCALATED: 'Chờ nhân viên',
  CLOSED: 'Đã đóng',
}

function Bubble({ m, customerLabel }: { m: ChatMessage; customerLabel: string }) {
  const map = (r: ChatRole | string) => {
    switch (r) {
      case 'USER':
        return { label: customerLabel || 'Khách', role: 'user' as const }
      case 'STAFF':
        return { label: 'Nhân viên', role: 'staff' as const }
      case 'SYSTEM':
        return { label: 'Hệ thống', role: 'system' as const }
      default:
        return { label: 'Hỗ trợ ảo', role: 'bot' as const }
    }
  }
  const { label, role } = map(m.role)

  if (role === 'system') {
    return (
      <div className="text-center text-xs italic text-slate-500 py-1">
        {label}: {m.content}
      </div>
    )
  }

  const userCls = role === 'user'
    ? 'ml-auto bg-[#0f5c66] text-white border-b-r-md rounded-t-2xl rounded-l-2xl rounded-br-sm'
    : role === 'staff'
    ? 'mr-auto bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-b-l-md rounded-t-2xl rounded-r-2xl'
    : 'mr-auto bg-white text-slate-700 border border-slate-200 rounded-b-l-md rounded-t-2xl rounded-r-2xl'

  return (
    <div className={cn('flex flex-col max-w-[82%] my-1.5', userCls.includes('ml-auto') ? 'items-end' : 'items-start')}>
      <div className={cn('text-[11px] uppercase tracking-wide mb-0.5', role === 'user' ? 'text-white/70' : role === 'staff' ? 'text-emerald-700' : 'text-slate-400')}>
        {label} · {m.createdAt ? new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
      </div>
      <div className={cn('px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words', userCls)}>
        {m.content}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  const t = tone || 'bg-white ring-slate-200 text-slate-700'
  return (
    <div className={cn('rounded-lg ring-1 ring-inset px-3 py-2 text-sm', t)}>
      <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="font-semibold text-lg leading-snug">{value ?? '—'}</div>
      {sub && <div className="text-[11px] opacity-80 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AdminChatDetailPage() {
  const toast = useToast()
  const nav = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const socketRef = useRef<Socket | null>(null)

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [staffTyping, setStaffTyping] = useState(false)
  const [customerTyping, setCustomerTyping] = useState(false)

  // Related docs
  const [relBookings, setRelBookings] = useState<any[]>([])
  const [relRentals, setRelRentals] = useState<any[]>([])
  const [relatedLoading, setRelatedLoading] = useState(false)

  // KPI Staff assigned
  const [staffKpi, setStaffKpi] = useState<any>(null)

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignStaffId, setAssignStaffId] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [staffList, setStaffList] = useState<any[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  // Transfer modal
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferStaffId, setTransferStaffId] = useState('')
  const [transferReason, setTransferReason] = useState('')

  const sessionId = id || ''

  const slaTone = (s: ChatSession) => {
    if (s.status === 'CLOSED') return 'bg-slate-100 text-slate-600 ring-slate-200'
    if (s.slaBreached) return 'bg-rose-50 text-rose-700 ring-rose-200'
    if (!s.slaWaitSeconds && s.status === 'ESCALATED' && !s.assignedStaffName) return 'bg-amber-50 text-amber-700 ring-amber-200'
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  const load = async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const r = await adminGetChatSessionDetail(sessionId)
      setSession(r.session)
      setMessages(r.messages || [])
      setAssignStaffId(r.session.assignedTo || '')
    } catch (e: any) {
      toast.error(e?.message || 'Không thể tải chi tiết chat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [sessionId])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, sessionId])

  // Load Related Bookings & Rentals when guestPhone or guestEmail exists
  useEffect(() => {
    if (!session) return
    if (!session.guestPhone && !session.guestEmail) return
    setRelatedLoading(true)
    const q = session.guestPhone || session.guestEmail || ''
    Promise.all([
      adminListBookings({ q, page: 1, limit: 5 }).then((r) => (r as any).items || []).catch(() => [] as any[]),
      adminListInquiries({ q, page: 1, limit: 5 }).then((r) => (r as any).items || []).catch(() => [] as any[]),
    ])
      .then(([b, r]) => {
        setRelBookings(b)
        setRelRentals(r)
      })
      .finally(() => setRelatedLoading(false))
  }, [session?.guestPhone, session?.guestEmail])

  // Load staff KPI assigned
  useEffect(() => {
    if (!session?.assignedTo) {
      setStaffKpi(null)
      return
    }
    adminStaffChatKpi(session.assignedTo, undefined, undefined)
      .then((r) => setStaffKpi(r))
      .catch(() => setStaffKpi(null))
  }, [session?.assignedTo])

  // WS live connect
  useEffect(() => {
    if (!sessionId) return
    const token = getStoredAccessToken() || undefined
    const socket = io('/chat', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: token ? { token } : undefined,
    })
    socketRef.current = socket
    socket.on('connect', () => {
      socket.emit('chat:join-room', { sessionId })
    })
    socket.on('chat:new-message', (payload: any) => {
      if (!payload?.message) return
      const m: ChatMessage = payload.message
      if (m.sessionId !== sessionId) return
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    })
    socket.on('chat:session-updated', (payload: any) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return
      const patch: any = payload.patch || payload || {}
      setSession((prev) => (prev ? { ...prev, ...patch } : prev))
    })
    socket.on('chat:staff-typing', (p: any) => {
      if (p?.sessionId === sessionId) {
        setStaffTyping(true)
        setTimeout(() => setStaffTyping(false), 2200)
      }
    })
    socket.on('chat:customer-typing', (p: any) => {
      if (p?.sessionId === sessionId) {
        setCustomerTyping(true)
        setTimeout(() => setCustomerTyping(false), 2200)
      }
    })
    return () => {
      socket.off('chat:new-message')
      socket.off('chat:session-updated')
      socket.off('chat:staff-typing')
      socket.off('chat:customer-typing')
      socket.disconnect()
      socketRef.current = null
    }
  }, [sessionId])

  // Emit typing
  const onInputChange = (v: string) => {
    setInput(v)
    socketRef.current?.emit('chat:staff-typing', { sessionId })
  }

  const doSend = async (e: FormEvent) => {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || sending || !sessionId || session?.status === 'CLOSED') return
    setSending(true)
    try {
      const me = session?.assignedTo || user?.id
      if (!session?.assignedTo && me) {
        try {
          const dto = await (await import('@/features/chat/chat')).adminClaimChatSession(sessionId)
          setSession((prev) => (prev ? { ...prev, ...(dto as any || {}) } : prev))
        } catch {
          // ignore
        }
      }
      await adminStaffReplyChatSession(sessionId, msg)
      setInput('')
    } catch (e: any) {
      toast.error(e?.message || 'Không gửi được tin')
    } finally {
      setSending(false)
    }
  }

  const doClose = async () => {
    if (!session || !confirm(`Đóng chat này? (${session.guestName || session.guestEmail || 'Khách vãng lai'})`)) return
    try {
      const r = await adminUpdateChatSessionStatus(session.id, 'CLOSED', isAdmin ? 'admin_closed' : 'staff_closed')
      setSession(r as any)
      toast.success('Đã đóng chat')
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi đóng chat')
    }
  }

  const doEscalate = async () => {
    if (!session) return
    const reason = prompt('Lý do chuyển lên đội ngũ?', session.escalationReason || 'Cần can thiệp thủ công')
    if (reason == null) return
    try {
      const r = await adminEscalateChatSession(session.id, reason || 'Cần can thiệp thủ công')
      setSession(r as any)
      toast.success('Đã chuyển giao, thông báo đã gửi đến nhân viên')
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi escalate')
    }
  }

  const loadStaff = async () => {
    setStaffLoading(true)
    try {
      const [s, a] = await Promise.all([adminListUsers({ page: 1, limit: 200, role: 'staff' }), adminListUsers({ page: 1, limit: 200, role: 'admin' })])
      setStaffList([...((s as any).items || []), ...((a as any).items || [])].filter((x) => x.active !== false))
    } finally {
      setStaffLoading(false)
    }
  }

  const openAssign = async () => {
    if (!staffList.length) await loadStaff()
    setAssignOpen(true)
  }

  const openTransfer = async () => {
    if (!staffList.length) await loadStaff()
    setTransferStaffId('')
    setTransferReason('')
    setTransferOpen(true)
  }

  const doAssign = async (e: FormEvent) => {
    e.preventDefault()
    if (!session || !assignStaffId) return
    try {
      const r = await adminAssignChatSession(session.id, assignStaffId, assignNote)
      setSession(r as any)
      toast.success('Đã giao nhân viên')
      setAssignOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi giao nhân viên')
    }
  }

  const doTransfer = async (e: FormEvent) => {
    e.preventDefault()
    if (!session || !transferStaffId) return
    try {
      const r = await adminTransferChatSession(session.id, transferStaffId, transferReason)
      setSession(r as any)
      toast.success('Đã chuyển giao')
      setTransferOpen(false)
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi chuyển giao')
    }
  }

  const customerLabel = useMemo(() => (session?.guestName || session?.guestEmail || session?.guestPhone || 'Khách vãng lai'), [session])

  if (loading && !session) {
    return (
      <div className="space-y-3">
        <PageHeader title="💬 Hỗ trợ khách hàng" subtitle="Đang tải..." right={<FlowBtn onClick={() => nav('/admin/customer-chat')}>← Danh sách</FlowBtn>} />
        <div className="p-10 text-center text-sm text-slate-500">Đang tải chi tiết chat...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="space-y-3">
        <PageHeader title="💬 Hỗ trợ khách hàng" right={<FlowBtn onClick={() => nav('/admin/customer-chat')}>← Danh sách</FlowBtn>} />
        <div className="p-10 text-center text-sm text-rose-500">Không tìm thấy phiên chat này</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <PageHeader
        title={`💬 ${customerLabel}${session.guestPhone ? ` · ${session.guestPhone}` : ''}`}
        subtitle={
          <span className="text-xs flex flex-wrap gap-2 items-center">
            <Badge tone={STATUS_TONES[session.status]}>{STATUS_LABEL[session.status]}</Badge>
            {session.assignedStaffName ? (
              <Badge tone="bg-emerald-50 text-emerald-800 ring-emerald-200">👤 {session.assignedStaffName}</Badge>
            ) : <Badge tone="bg-slate-100 text-slate-600 ring-slate-200">Chưa phân công nhân viên</Badge>}
            <Badge tone={slaTone(session)} title={session.slaLabel || ''}>
              SLA: {session.status === 'CLOSED' ? 'Đã kết thúc' : (session.slaLabel || 'Trong hạn')}
            </Badge>
            {session.ratingStars != null && (
              <Badge tone="bg-amber-50 text-amber-800 ring-amber-200">⭐ {session.ratingStars}/5</Badge>
            )}
          </span>
        }
        right={
          <div className="flex flex-wrap gap-2">
            <FlowBtn onClick={() => nav('/admin/customer-chat')}>← Danh sách</FlowBtn>
            {!session.assignedTo && session.status !== 'CLOSED' && (
              <FlowBtn tone="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 ring-indigo-200" onClick={async () => {
                try {
                  const r = await (await import('@/features/chat/chat')).adminClaimChatSession(session.id)
                  setSession(r as any)
                  toast.success('Đã nhận chat này')
                } catch (e: any) {
                  toast.error(e?.message || 'Lỗi')
                }
              }}>📩 Nhận xử lý</FlowBtn>
            )}
            {isAdmin && session.status !== 'CLOSED' && (
              <FlowBtn tone="bg-amber-50 hover:bg-amber-100 text-amber-800 ring-amber-200" onClick={openAssign}>🔗 Giao nhân viên</FlowBtn>
            )}
            {session.assignedTo && session.status !== 'CLOSED' && (isAdmin || session.assignedTo === user?.id) && (
              <FlowBtn tone="bg-sky-50 hover:bg-sky-100 text-sky-800 ring-sky-200" onClick={openTransfer}>🔄 Chuyển giao</FlowBtn>
            )}
            {session.status === 'BOT' && (
              <FlowBtn tone="bg-orange-50 hover:bg-orange-100 text-orange-800 ring-orange-200" onClick={doEscalate}>⚠ Escalate (đẩy lên team CS)</FlowBtn>
            )}
            {session.status !== 'CLOSED' && (
              <FlowBtn tone="bg-rose-50 hover:bg-rose-100 text-rose-700 ring-rose-200" onClick={doClose}>✅ Đóng chat</FlowBtn>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-3">
        {/* LEFT: Summary Box */}
        <div className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
            <div className="font-semibold text-slate-800">👥 Thông tin khách</div>
            <div className="grid grid-cols-[100px_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
              <div className="text-slate-500">Họ tên</div><div className="font-medium text-slate-800">{session.guestName || '—'}</div>
              <div className="text-slate-500">SĐT</div><div className="font-medium text-slate-800">{session.guestPhone || '—'}</div>
              <div className="text-slate-500">Email</div><div className="font-medium text-slate-800">{session.guestEmail || '—'}</div>
              <div className="text-slate-500">Khách đăng ký</div><div className="font-medium text-slate-800">{session.userId ? 'Có tài khoản' : 'Vãng lai'}</div>
              <div className="text-slate-500">Lý do hỗ trợ</div><div className="font-medium text-amber-800">{session.escalationReason || '—'}</div>
              <div className="text-slate-500">Tạo lúc</div><div>{session.createdAt ? new Date(session.createdAt).toLocaleString('vi-VN') : '—'}</div>
              <div className="text-slate-500">Nhận lúc</div><div>{session.escalatedAt ? new Date(session.escalatedAt).toLocaleString('vi-VN') : '—'}</div>
              <div className="text-slate-500">Gán lúc</div><div>{session.assignedAt ? new Date(session.assignedAt).toLocaleString('vi-VN') : '—'}</div>
              <div className="text-slate-500">Đóng lúc</div><div>{session.closedAt ? new Date(session.closedAt).toLocaleString('vi-VN') : '—'}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Trả lời đầu" value={session.firstResponseHuman || '—'} tone="bg-indigo-50 ring-indigo-200 text-indigo-800" sub={session.firstResponseSeconds != null ? `${session.firstResponseSeconds}s` : ''} />
            <StatCard label="Tin KH / NV / BOT" value={`${session.customerMessagesCount ?? 0} / ${session.staffMessagesCount ?? 0} / ${session.botMessagesCount ?? 0}`} tone="bg-sky-50 ring-sky-200 text-sky-800" />
            <StatCard label="Last KH" value={session.lastCustomerMessageAt ? new Date(session.lastCustomerMessageAt).toLocaleString('vi-VN') : '—'} tone="bg-white ring-slate-200 text-slate-700" />
            <StatCard label="Last NV" value={session.lastStaffMessageAt ? new Date(session.lastStaffMessageAt).toLocaleString('vi-VN') : '—'} tone="bg-white ring-slate-200 text-slate-700" />
          </div>

          {staffKpi && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-1 text-xs">
              <div className="font-semibold text-slate-800 text-sm mb-1">📊 KPI nhân viên hiện tại</div>
              <div className="flex justify-between"><span className="text-slate-500">Đã giao</span><b>{staffKpi.assignedCount}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Đã đóng</span><b>{staffKpi.closedCount}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Phản hồi đầu TB</span><b>{staffKpi.avgFirstResponseHuman || '—'}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">Rating TB</span><b>{staffKpi.avgRating != null ? `${staffKpi.avgRating}⭐ (${staffKpi.ratedCount || 0})` : '—'}</b></div>
              <div className="flex justify-between"><span className="text-slate-500">SLA breached</span><b className="text-rose-700">{staffKpi.breachedPickupCount + staffKpi.breachedReplyCount}</b></div>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 text-sm">
            <div className="font-semibold text-slate-800">📒 Booking & Thuê xe liên quan</div>
            {relatedLoading && <div className="text-xs text-slate-500 italic">Đang tìm kiếm theo SĐT/Email...</div>}
            {!relatedLoading && relBookings.length === 0 && relRentals.length === 0 && (
              <div className="text-xs text-slate-500 italic">
                Không tìm thấy đơn đặt tour/thuê xe theo SĐT/Email "{session.guestPhone || session.guestEmail || ''}".{' '}
                <Link to="/admin/bookings" className="text-teal-700 underline">Xem tất cả Booking</Link> / <Link to="/admin/rentals" className="text-teal-700 underline">Thuê xe</Link>
              </div>
            )}
            {relBookings.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-600">🎟️ Tour đã đặt ({relBookings.length})</div>
                {relBookings.map((b) => (
                  <Link key={b.id || b.code} to={`/admin/bookings`} className="block rounded border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50">
                    <div className="font-medium text-slate-800">🔗 {b.code || b.id?.slice(0, 10)}</div>
                    <div className="text-slate-500">{b.tourName || b.destination || ''} · {b.bookingDate ? new Date(b.bookingDate).toLocaleDateString('vi-VN') : ''} · {b.people || ''} người</div>
                  </Link>
                ))}
                <div className="text-right"><Link to={`/admin/bookings?q=${encodeURIComponent(session.guestPhone || session.guestEmail || '')}`} className="text-xs text-teal-700 underline">Tất cả đơn →</Link></div>
              </div>
            )}
            {relRentals.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-semibold text-slate-600">🚐 Yêu cầu thuê xe ({relRentals.length})</div>
                {relRentals.map((r) => (
                  <Link key={r.id || r.code} to={`/admin/rentals`} className="block rounded border border-slate-200 px-2 py-1.5 text-xs hover:bg-slate-50">
                    <div className="font-medium text-slate-800">🔗 {r.code || r.id?.slice(0, 10)}</div>
                    <div className="text-slate-500">{r.route || r.vehicleType || ''} · {r.pickupDate ? new Date(r.pickupDate).toLocaleDateString('vi-VN') : ''}</div>
                  </Link>
                ))}
                <div className="text-right"><Link to={`/admin/rentals?q=${encodeURIComponent(session.guestPhone || session.guestEmail || '')}`} className="text-xs text-teal-700 underline">Tất cả thuê xe →</Link></div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Chat panel */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 flex flex-col h-[calc(100vh-140px)] min-h-[560px]">
          <div className="p-3 border-b border-slate-200 bg-white text-xs text-slate-500 flex items-center justify-between">
            <div>
              {customerTyping && <span className="text-emerald-600 font-medium animate-pulse">✍ Khách đang gõ...</span>}
              {!customerTyping && <span className="text-slate-400">Khách đang trực tuyến</span>}
            </div>
            <div className="text-right">
              {staffTyping && <span className="text-indigo-600 font-medium animate-pulse">👤 Nhân viên đang gõ...</span>}
            </div>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
            {messages.length === 0 && <div className="m-auto text-center text-sm text-slate-500 italic">Chưa có tin nhắn. Gửi tin đầu tiên ở ô dưới.</div>}
            {messages.map((m) => <Bubble key={m.id} m={m} customerLabel={customerLabel} />)}
          </div>
          <form onSubmit={doSend} className="p-3 border-t border-slate-200 bg-white flex gap-2">
            <textarea
              rows={2}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 resize-none"
              value={input}
              disabled={sending || session.status === 'CLOSED'}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={session.status === 'CLOSED' ? 'Chat đã đóng - không thể gửi tin mới' : 'Nhập tin nhắn cho khách (Enter xuống dòng, Ctrl+Enter gửi)'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void doSend(e as any)
                }
              }}
            />
            <button
              type="submit"
              className="self-end rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              disabled={!input.trim() || sending || session.status === 'CLOSED'}
            >
              {sending ? 'Gửi...' : 'Gửi (Ctrl+Enter)'}
            </button>
          </form>
        </div>
      </div>

      {/* Assign Modal */}
      {assignOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignOpen(false)}>
          <form onSubmit={doAssign} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800 mb-2">Giao nhân viên phụ trách</div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhân viên</label>
              <select required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)} disabled={staffLoading}>
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map((u) => (
                  <option key={u.id} value={u.id}>{u.fullName || u.email} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú</label>
              <textarea rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="Ghi chú chuyển giao" />
            </div>
            <div className="flex justify-end gap-2">
              <FlowBtn onClick={() => setAssignOpen(false)}>Hủy</FlowBtn>
              <button type="submit" className="rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-sm font-semibold">Giao</button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setTransferOpen(false)}>
          <form onSubmit={doTransfer} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800 mb-2">Chuyển giao nhân viên khác</div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhân viên mới</label>
              <select required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={transferStaffId} onChange={(e) => setTransferStaffId(e.target.value)} disabled={staffLoading}>
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map((u) => u.id !== session.assignedTo && (
                  <option key={u.id} value={u.id}>{u.fullName || u.email} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Lý do chuyển</label>
              <textarea rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="Lý do chuyển cho nhân viên khác" />
            </div>
            <div className="flex justify-end gap-2">
              <FlowBtn onClick={() => setTransferOpen(false)}>Hủy</FlowBtn>
              <button type="submit" className="rounded-md bg-sky-700 hover:bg-sky-800 text-white px-4 py-2 text-sm font-semibold">Chuyển giao</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
