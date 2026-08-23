import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  adminAssignChatSession,
  adminClaimChatSession,
  adminCloseIdleSessions,
  adminListChatSessions,
  adminSendThankYouVouchers,
  adminTransferChatSession,
  adminUpdateChatSessionStatus,
  ChatSession,
  ChatStatus,
  AdminChatListQuery,
} from '@/features/chat/chat'
import { adminListUsers } from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth.hooks'

function Badge({ tone, children, title }: { tone?: string; children: React.ReactNode; title?: string }) {
  const t = tone || 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span
      title={title}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', t)}
    >
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
function TableWrap({ loading, empty, colSpan, children }: { loading?: boolean; empty?: boolean; colSpan: number; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        {children}
      </table>
      {loading && (
        <div className="py-10 text-center text-sm text-slate-500">Đang tải...</div>
      )}
      {!loading && empty && (
        <div className="py-10 text-center text-sm text-slate-500 border-t">
          Không có dữ liệu
        </div>
      )}
    </div>
  )
}
const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <th className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 whitespace-nowrap', className)}>{children}</th>
)
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('px-3 py-2 align-top', className)}>{children}</td>
)

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

export default function AdminChatListPage() {
  const toast = useToast()
  const nav = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [items, setItems] = useState<ChatSession[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ChatStatus | ''>('ESCALATED')
  const [onlyUnassigned, setOnlyUnassigned] = useState(true)
  const [slaBreachedOnly, setSlaBreachedOnly] = useState(false)

  // Assign modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignSession, setAssignSession] = useState<ChatSession | null>(null)
  const [assignStaffId, setAssignStaffId] = useState('')
  const [assignNote, setAssignNote] = useState('')
  const [staffList, setStaffList] = useState<any[]>([])
  const [staffLoading, setStaffLoading] = useState(false)

  // Transfer modal
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferSession, setTransferSession] = useState<ChatSession | null>(null)
  const [transferStaffId, setTransferStaffId] = useState('')
  const [transferReason, setTransferReason] = useState('')

  const query = useMemo<AdminChatListQuery>(() => {
    const o: AdminChatListQuery = { page, limit }
    if (q.trim()) o.search = q.trim()
    if (status) o.status = status
    if (onlyUnassigned) o.onlyUnassigned = true
    if (slaBreachedOnly) o.slaBreachedOnly = true
    return o
  }, [page, limit, q, status, onlyUnassigned, slaBreachedOnly])

  const load = async () => {
    setLoading(true)
    try {
      const r = await adminListChatSessions(query)
      setItems(r.items || [])
      setTotal(r.total || 0)
    } catch (e: any) {
      toast.error(e?.message || 'Không thể tải danh sách chat')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [query])

  const loadStaff = async () => {
    setStaffLoading(true)
    try {
      const r = await adminListUsers({ page: 1, limit: 200, role: 'staff' })
      const a = await adminListUsers({ page: 1, limit: 200, role: 'admin' })
      const all = [...(r.items || []), ...(a.items || [])].filter((x) => (x as any).active !== false)
      setStaffList(all)
    } catch (e: any) {
      toast.error(e?.message || 'Không thể tải danh sách nhân viên')
    } finally {
      setStaffLoading(false)
    }
  }

  const openAssignModal = async (s: ChatSession) => {
    setAssignSession(s)
    setAssignStaffId(s.assignedTo || '')
    setAssignNote('')
    if (!staffList.length) await loadStaff()
    setAssignOpen(true)
  }

  const openTransferModal = async (s: ChatSession) => {
    setTransferSession(s)
    setTransferStaffId('')
    setTransferReason('')
    if (!staffList.length) await loadStaff()
    setTransferOpen(true)
  }

  const doClaim = async (s: ChatSession) => {
    if (!confirm('Nhận chat này để phụ trách?')) return
    try {
      await adminClaimChatSession(s.id)
      toast.success('Đã nhận chat')
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Thao tác lỗi')
    }
  }

  const doAssign = async (e: FormEvent) => {
    e.preventDefault()
    if (!assignSession || !assignStaffId) return
    try {
      await adminAssignChatSession(assignSession.id, assignStaffId, assignNote)
      toast.success('Đã giao nhân viên phụ trách')
      setAssignOpen(false)
      setAssignSession(null)
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Giao nhân viên lỗi')
    }
  }

  const doTransfer = async (e: FormEvent) => {
    e.preventDefault()
    if (!transferSession || !transferStaffId) return
    try {
      await adminTransferChatSession(transferSession.id, transferStaffId, transferReason)
      toast.success('Đã chuyển giao chat')
      setTransferOpen(false)
      setTransferSession(null)
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Chuyển giao lỗi')
    }
  }

  const doClose = async (s: ChatSession) => {
    if (!confirm(`Đóng chat này? (${s.guestName || s.guestEmail || 'Khách vãng lai'})`)) return
    try {
      await adminUpdateChatSessionStatus(s.id, 'CLOSED', isAdmin ? 'admin_closed' : 'staff_closed')
      toast.success('Đã đóng chat')
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi đóng chat')
    }
  }

  const doRunCloseIdle = async () => {
    if (!confirm('Chạy job đóng các chat không hoạt động >24h?')) return
    try {
      const r = await adminCloseIdleSessions()
      toast.success(`Đã quét ${r.totalScanned} session, đóng ${r.closed} chat`)
      void load()
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi job')
    }
  }
  const doRunThankYou = async () => {
    if (!confirm('Gửi email cảm ơn + mã giảm giá 5% (VNEX-CS5P17) cho chat đã đóng trong 24h qua?')) return
    try {
      const r = await adminSendThankYouVouchers()
      toast.success(`Eligible ${r.eligible}, đã gửi ${r.sent} email (code: ${r.voucherCode})`)
    } catch (e: any) {
      toast.error(e?.message || 'Lỗi gửi email')
    }
  }

  const slaTone = (s: ChatSession) => {
    if (s.status === 'CLOSED') return 'bg-slate-100 text-slate-600 ring-slate-200'
    if (s.slaBreached) return 'bg-rose-50 text-rose-700 ring-rose-200'
    if (!s.slaWaitSeconds && s.status === 'ESCALATED' && !s.assignedStaffName) return 'bg-amber-50 text-amber-700 ring-amber-200'
    return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-4">
      <PageHeader
        title="💬 Hỗ trợ khách hàng"
        subtitle="Danh sách các phiên chat với khách hàng (Tùy chọn: chỉ hiện chat chờ nhân viên)"
        right={
          <div className="flex flex-wrap gap-2">
            {isAdmin && <FlowBtn tone="bg-slate-100 hover:bg-slate-200 text-slate-800 ring-slate-200" onClick={doRunCloseIdle}>🧹 Đóng chat rảnh hơn 24 giờ</FlowBtn>}
            {isAdmin && <FlowBtn tone="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 ring-indigo-200" onClick={doRunThankYou}>📨 Gửi voucher 5% (CS5P17)</FlowBtn>}
            <FlowBtn tone="bg-emerald-600 hover:bg-emerald-700 text-white ring-emerald-700" onClick={load}>↻ Tải lại</FlowBtn>
          </div>
        }
      />

      <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-600 mb-1">Tìm kiếm (Tên / SĐT / Email)</label>
          <input
            className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-teal-600"
            value={q}
            placeholder="ví dụ: 0902..."
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Trạng thái</label>
          <select
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            value={status}
            onChange={(e) => { setStatus(e.target.value as any); setPage(1) }}
          >
            <option value="">Tất cả</option>
            <option value="BOT">Trợ lý ảo</option>
            <option value="ESCALATED">Chờ nhân viên</option>
            <option value="CLOSED">Đã đóng</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={onlyUnassigned} onChange={(e) => { setOnlyUnassigned(e.target.checked); setPage(1) }} />
          Chỉ hiện chưa phân công
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={slaBreachedOnly} onChange={(e) => { setSlaBreachedOnly(e.target.checked); setPage(1) }} />
          SLA quá hạn (đỏ)
        </label>
      </div>

      <TableWrap loading={loading} empty={items.length === 0} colSpan={8}>
        <thead className="bg-slate-50 text-slate-700">
          <tr>
            <Th>Khách hàng</Th>
            <Th>Lý do / Nội dung gần nhất</Th>
            <Th>Trạng thái</Th>
            <Th>Nhân viên</Th>
            <Th>SLA</Th>
            <Th>Tin cuối</Th>
            <Th className="text-right">Thao tác</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((s) => (
            <tr key={s.id} className="hover:bg-slate-50">
              <Td>
                <div className="font-medium text-slate-800">{s.guestName || 'Khách vãng lai'}</div>
                {s.guestPhone && <div className="text-xs text-slate-500">📞 {s.guestPhone}</div>}
                {s.guestEmail && <div className="text-xs text-slate-500">✉ {s.guestEmail}</div>}
                {s.customerMessagesCount != null && (
                  <div className="text-[11px] text-slate-400 mt-1">Tin KH: {s.customerMessagesCount} · Staff: {s.staffMessagesCount} · BOT: {s.botMessagesCount}</div>
                )}
              </Td>
              <Td>
                {s.escalationReason ? (
                  <Badge tone="bg-orange-50 text-orange-700 ring-orange-200">🔔 {s.escalationReason}</Badge>
                ) : (
                  <span className="text-xs text-slate-500">—</span>
                )}
              </Td>
              <Td><Badge tone={STATUS_TONES[s.status]}>{STATUS_LABEL[s.status]}</Badge></Td>
              <Td>
                {s.assignedStaffName ? (
                  <div className="text-sm">
                    <div className="font-medium text-emerald-700">👤 {s.assignedStaffName}</div>
                    {s.assignedAt && <div className="text-[11px] text-slate-400">{new Date(s.assignedAt).toLocaleString('vi-VN')}</div>}
                  </div>
                ) : <span className="text-xs text-slate-400">Chưa phân công</span>}
              </Td>
              <Td>
                <Badge tone={slaTone(s)} title={s.slaLabel ?? ''}>
                  {s.status === 'CLOSED'
                    ? '—'
                    : (s.slaBreached ? `⚠ ${s.slaLabel || 'Quá hạn'}` : (s.slaLabel || 'Trong SLA'))}
                </Badge>
              </Td>
              <Td>
                {s.lastCustomerMessageAt ? (
                  <div className="text-xs">
                    <div className="text-slate-700">KH {new Date(s.lastCustomerMessageAt).toLocaleString('vi-VN')}</div>
                    {s.lastStaffMessageAt && <div className="text-slate-500">NV {new Date(s.lastStaffMessageAt).toLocaleString('vi-VN')}</div>}
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}
              </Td>
              <Td className="text-right whitespace-nowrap">
                <div className="flex justify-end gap-1 flex-wrap">
                  <FlowBtn tone="bg-teal-50 hover:bg-teal-100 text-teal-800 ring-teal-200" onClick={() => nav(`/admin/customer-chat/${s.id}`)}>💬 Xem</FlowBtn>
                  {!s.assignedTo && s.status !== 'CLOSED' && (
                    <FlowBtn tone="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 ring-indigo-200" onClick={() => doClaim(s)}>📩 Nhận</FlowBtn>
                  )}
                  {isAdmin && s.status !== 'CLOSED' && (
                    <FlowBtn tone="bg-amber-50 hover:bg-amber-100 text-amber-800 ring-amber-200" onClick={() => openAssignModal(s)}>🔗 Giao</FlowBtn>
                  )}
                  {s.assignedTo && s.status !== 'CLOSED' && (isAdmin || s.assignedTo === user?.id) && (
                    <FlowBtn tone="bg-sky-50 hover:bg-sky-100 text-sky-800 ring-sky-200" onClick={() => openTransferModal(s)} title="Chuyển giao cho nhân viên khác">🔄 Chuyển</FlowBtn>
                  )}
                  {s.status !== 'CLOSED' && (
                    <FlowBtn tone="bg-rose-50 hover:bg-rose-100 text-rose-700 ring-rose-200" onClick={() => doClose(s)}>✅ Đóng</FlowBtn>
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <div>Tổng: <b>{total}</b> phiên (trang {page} / {totalPages})</div>
        <div className="flex gap-2">
          <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>← Trước</button>
          <button className="rounded border px-3 py-1 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Sau →</button>
        </div>
      </div>

      {/* Assign Modal */}
      {assignOpen && assignSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignOpen(false)}>
          <form onSubmit={doAssign} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800 mb-1">Giao nhân viên phụ trách</div>
            <div className="text-xs text-slate-500 mb-3">Khách: {assignSession.guestName || assignSession.guestEmail || 'Khách vãng lai'} · SĐT: {assignSession.guestPhone || '—'}</div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú (không bắt buộc)</label>
              <textarea rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={assignNote} onChange={(e) => setAssignNote(e.target.value)} placeholder="ví dụ: Ưu tiên xử lý tour đoàn 45 khách" />
            </div>
            <div className="flex justify-end gap-2">
              <FlowBtn tone="bg-slate-100 hover:bg-slate-200 text-slate-700 ring-slate-200" onClick={() => setAssignOpen(false)}>Hủy</FlowBtn>
              <button type="submit" className="rounded-md bg-teal-700 hover:bg-teal-800 px-4 py-2 text-sm font-semibold text-white">Giao nhân viên</button>
            </div>
          </form>
        </div>
      )}

      {/* Transfer Modal */}
      {transferOpen && transferSession && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setTransferOpen(false)}>
          <form onSubmit={doTransfer} className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="font-semibold text-slate-800 mb-1">Chuyển giao chat cho nhân viên khác</div>
            <div className="text-xs text-slate-500 mb-3">Khách: {transferSession.guestName || transferSession.guestEmail || 'Khách vãng lai'} · Nhân viên hiện tại: {transferSession.assignedStaffName || '—'}</div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhân viên mới</label>
              <select required className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={transferStaffId} onChange={(e) => setTransferStaffId(e.target.value)} disabled={staffLoading}>
                <option value="">-- Chọn nhân viên --</option>
                {staffList.map((u) => u.id !== transferSession.assignedTo && (
                  <option key={u.id} value={u.id}>{u.fullName || u.email} ({u.role})</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Lý do chuyển (không bắt buộc)</label>
              <textarea rows={2} className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={transferReason} onChange={(e) => setTransferReason(e.target.value)} placeholder="ví dụ: Chuyên viên tour đoàn hỗ trợ phù hợp hơn" />
            </div>
            <div className="flex justify-end gap-2">
              <FlowBtn tone="bg-slate-100 hover:bg-slate-200 text-slate-700 ring-slate-200" onClick={() => setTransferOpen(false)}>Hủy</FlowBtn>
              <button type="submit" className="rounded-md bg-sky-700 hover:bg-sky-800 px-4 py-2 text-sm font-semibold text-white">Chuyển giao</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
