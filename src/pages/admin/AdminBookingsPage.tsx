import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import {
  Booking,
  BookingStatus,
  adminGetBooking,
  adminListBookings,
  adminUpdateBookingStatus,
} from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate, formatDateTime, toInputDate } from '@/utils/date'

function formatMoney(n: number | null | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

function statusBadge(s: BookingStatus): { label: string; cls: string; dot: string } {
  switch (s) {
    case 'pending':
      return { label: 'Giữ chỗ', cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200', dot: 'bg-slate-500' }
    case 'new':
      return { label: 'Chờ XN', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', dot: 'bg-orange-500' }
    case 'confirmed':
      return { label: 'Đã XN', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500' }
    case 'in_progress':
      return { label: 'Đang đi', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200', dot: 'bg-indigo-500' }
    case 'completed':
      return { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' }
    case 'cancelled':
      return { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200', dot: 'bg-rose-500' }
    default:
      return { label: s, cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', dot: 'bg-slate-400' }
  }
}
function payLabel(m: string) {
  switch (m) {
    case 'hold': return '💳 Giữ chỗ'
    case 'bank_transfer': return '🏦 CK NH'
    case 'online': return '🌐 Online'
    default: return m
  }
}
function payStatus(s: string): { t: string; c: string } {
  switch (s) {
    case 'unpaid': return { t: 'Chưa TT', c: 'text-rose-600' }
    case 'partial': return { t: 'Cọc 1 phần', c: 'text-orange-600' }
    case 'paid': return { t: 'Đã TT', c: 'text-emerald-600' }
    default: return { t: s, c: 'text-slate-600' }
  }
}
function passengerTypeColor(t: string) {
  switch (t) {
    case 'NL': return 'bg-blue-50 text-blue-700'
    case 'TE': return 'bg-violet-50 text-violet-700'
    case 'EB': return 'bg-pink-50 text-pink-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

export default function AdminBookingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)

  const [fStatus, setFStatus] = useState<BookingStatus | ''>('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fQ, setFQ] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Booking | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [adminNote, setAdminNote] = useState('')
  const [sendingAction, setSendingAction] = useState<null | 'confirm' | 'cancel' | 'note'>(null)

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {}
    for (const b of items) byStatus[b.status] = (byStatus[b.status] || 0) + 1
    const rev = items.reduce((s, b) => s + (b.status !== 'cancelled' ? Number(b.totalAmount || 0) : 0), 0)
    const pax = items.reduce((s, b) => s + Number(b.adultCount || 0) + Number(b.childCount || 0) + Number(b.infantCount || 0), 0)
    return { ...byStatus, rev, pax, all: total }
  }, [items, total])

  const refresh = () => {
    setLoading(true)
    adminListBookings({ status: fStatus || undefined, from: fFrom || undefined, to: fTo || undefined, q: fQ || undefined, page, limit })
      .then((r) => { setItems(r.items || []); setTotal(r.total || 0); setTotalPages(r.totalPages || 1) })
      .catch((e) => toast.error((e as Error)?.message || 'Không tải được danh sách bookings.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { setPage(1) }, [fStatus, fFrom, fTo, fQ])
  useEffect(() => { refresh() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDetail = async (id: string) => {
    setSelectedId(id)
    setModalOpen(true)
    setDetailLoading(true)
    try {
      const d = await adminGetBooking(id)
      setDetail(d)
      setAdminNote(d.adminNote || '')
    } catch (e) {
      toast.error((e as Error)?.message || 'Không tải được chi tiết booking.')
      setDetail(null)
    } finally { setDetailLoading(false) }
  }

  const patchStatus = async (next: BookingStatus, sendBackSeatsOnCancel = true) => {
    if (!selectedId) return
    try {
      setSendingAction(next === 'confirmed' ? 'confirm' : 'cancel')
      await adminUpdateBookingStatus(selectedId, { status: next, adminNote: adminNote || null, sendBackSeatsOnCancel })
      toast.success(next === 'confirmed' ? 'Đã xác nhận đơn đặt thành công.' : 'Đã hủy đơn đặt và trả lại chỗ cho tour.')
      const d = await adminGetBooking(selectedId)
      setDetail(d)
      setAdminNote(d.adminNote || '')
      refresh()
    } catch (e) {
      toast.error((e as Error)?.message || 'Cập nhật trạng thái thất bại.')
    } finally { setSendingAction(null) }
  }

  const canConfirm = (b?: Booking | null) => b && (b.status === 'new' || b.status === 'pending')
  const canCancel = (b?: Booking | null) => b && b.status !== 'cancelled' && b.status !== 'completed'

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Quản lý toàn bộ đơn đặt tour: xác nhận, hủy, trả chỗ, ghi chú nội bộ, theo dõi trạng thái thanh toán."
        title="Quản lý Đơn đặt"
        right={
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-4 text-xs font-extrabold uppercase text-slate-700 shadow-sm hover:bg-slate-50">⟳ Tải lại</button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng đơn', val: stats.all, sub: 'toàn hệ thống', bg: 'from-slate-800 to-slate-950', num: 'text-white', subCls: 'text-slate-300', icon: '📋' },
          { label: 'Chờ xác nhận', val: ((stats as any).new || 0) + ((stats as any).pending || 0), sub: 'cần xử lý', bg: 'from-orange-500 to-orange-600', num: 'text-white', subCls: 'text-orange-100', icon: '⏳' },
          { label: 'Khách / Tour', val: stats.pax, sub: 'tổng hành khách', bg: 'from-blue-600 to-blue-800', num: 'text-white', subCls: 'text-blue-100', icon: '👥' },
          { label: 'Doanh thu', val: formatMoney(stats.rev), sub: 'chưa tính đơn hủy', bg: 'from-emerald-600 to-emerald-800', num: 'text-white', subCls: 'text-emerald-100', icon: '💰' },
        ].map((c, i) => (
          <div key={i} className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-blue-900/5 bg-gradient-to-br ${c.bg} ring-1 ring-black/5`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{c.label}</div>
                <div className={cn('mt-2 text-2xl font-black', c.num)}>{c.val}</div>
                <div className={cn('mt-0.5 text-xs', c.subCls)}>{c.sub}</div>
              </div>
              <div className="text-3xl opacity-80">{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100 md:p-5">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-100 focus:border-orange-400 focus:ring-4">
              <option value="">Tất cả</option>
              <option value="new">Chờ xác nhận</option>
              <option value="pending">Đang giữ chỗ</option>
              <option value="confirmed">Đã xác nhận</option>
              <option value="in_progress">Đang đi</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Từ ngày</label>
            <input type="date" value={fFrom} max={fTo || undefined} onChange={(e) => setFFrom(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-100 focus:border-orange-400 focus:ring-4" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Đến ngày</label>
            <input type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFTo(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-100 focus:border-orange-400 focus:ring-4" />
          </div>
          <div className="md:col-span-5 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tìm kiếm</label>
              <input value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="Mã / Tour / Tên KH / SĐT / Email" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-100 focus:border-orange-400 focus:ring-4" />
            </div>
            <button type="button" onClick={refresh} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-orange-500 px-5 text-sm font-extrabold uppercase text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600">Tìm</button>
            <button type="button" onClick={() => { setFStatus(''); setFFrom(''); setFTo(''); setFQ(''); setPage(1) }} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold uppercase text-slate-700 hover:bg-slate-50">Reset</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>Hiển thị <b className="text-slate-800">{items.length}</b> / tổng <b className="text-slate-800">{total}</b> đơn đặt.</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-xs uppercase tracking-wide text-white">
                <th className="px-5 py-4 font-black">Mã đặt</th>
                <th className="px-5 py-4 font-black">Tour / Ngày đi</th>
                <th className="px-5 py-4 font-black">Khách</th>
                <th className="px-5 py-4 font-black">Liên hệ</th>
                <th className="px-5 py-4 font-black">TT</th>
                <th className="px-5 py-4 font-black">Tổng tiền</th>
                <th className="px-5 py-4 font-black">Tạo lúc</th>
                <th className="px-5 py-4 font-black text-right pr-5">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && !items.length ? (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">Đang tải danh sách bookings...</td></tr>
              ) : !items.length ? (
                <tr><td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">Chưa có booking nào khớp với điều kiện lọc.</td></tr>
              ) : (
                items.map((b, idx) => {
                  const st = statusBadge(b.status)
                  const ps = payStatus(b.paymentStatus)
                  return (
                    <tr key={b.id} className={cn(idx % 2 ? 'bg-slate-50/40' : 'bg-white', 'hover:bg-blue-50/40 border-t border-slate-100 transition')}>
                      <td className="px-5 py-4 align-middle">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={cn('h-2 w-2 rounded-full', st.dot)} />
                            <span className="font-mono text-sm font-black text-slate-900">{b.code}</span>
                          </div>
                          <span className={cn('inline-flex self-start rounded-full px-2.5 py-0.5 text-[11px] font-bold', st.cls)}>{st.label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        {b.tour?.slug ? (
                          <Link target="_blank" to={`/tours/${b.tour.slug}`} className="line-clamp-1 font-bold text-slate-900 hover:text-orange-600">{b.tour.title}</Link>
                        ) : <div className="line-clamp-1 font-bold text-slate-900">{b.tour?.title || '-'}</div>}
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span>📅 {formatDate(b.departureDate) || '-'}</span>
                          {b.departureStandardText ? <span className="line-clamp-1">⭐ {b.departureStandardText}</span> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="text-xs font-semibold text-slate-700">
                          {b.adultCount ? <span className="inline-flex items-center gap-1"><span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-blue-50 px-1.5 font-bold text-blue-700">NL {b.adultCount}</span></span> : ''}
                          {b.childCount ? <span className="ml-1.5 inline-flex items-center gap-1"><span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-violet-50 px-1.5 font-bold text-violet-700">TE {b.childCount}</span></span> : ''}
                          {b.infantCount ? <span className="ml-1.5 inline-flex items-center gap-1"><span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-pink-50 px-1.5 font-bold text-pink-700">EB {b.infantCount}</span></span> : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="font-bold text-slate-900">{b.contact?.name || '-'}</div>
                        <div className="text-xs text-slate-600">📞 {b.contact?.phone || '-'}</div>
                        {b.contact?.email ? <div className="text-xs text-slate-500">✉ {b.contact.email}</div> : null}
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="text-xs font-bold text-slate-700">{payLabel(b.paymentMethod)}</div>
                        <div className={cn('text-xs font-semibold', ps.c)}>{ps.t}</div>
                      </td>
                      <td className="px-5 py-4 align-middle">
                        <div className="text-lg font-black text-orange-600">{formatMoney(b.totalAmount)}</div>
                      </td>
                      <td className="px-5 py-4 align-middle text-xs text-slate-600">
                        {formatDateTime(b.createdAt) || '-'}
                      </td>
                      <td className="px-5 py-4 align-middle text-right pr-5">
                        <div className="inline-flex items-center gap-2">
                          {canConfirm(b) ? (
                            <button type="button" onClick={async () => { try { setSendingAction('confirm'); await adminUpdateBookingStatus(b.id, { status: 'confirmed', adminNote: null }); toast.success(`Đã xác nhận đơn ${b.code}.`); refresh() } catch (e) { toast.error((e as Error)?.message || 'Lỗi') } finally { setSendingAction(null) } }} className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-3.5 text-xs font-extrabold uppercase text-white shadow-sm shadow-emerald-700/20 hover:bg-emerald-700">✓ XN</button>
                          ) : null}
                          {canCancel(b) ? (
                            <button type="button" onClick={async () => { try { setSendingAction('cancel'); await adminUpdateBookingStatus(b.id, { status: 'cancelled', adminNote: 'Hủy từ list admin', sendBackSeatsOnCancel: true }); toast.success(`Đã hủy đơn ${b.code} & trả chỗ.`); refresh() } catch (e) { toast.error((e as Error)?.message || 'Lỗi') } finally { setSendingAction(null) } }} className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-rose-600 px-3.5 text-xs font-extrabold uppercase text-white shadow-sm shadow-rose-700/20 hover:bg-rose-700">✕ Hủy</button>
                          ) : null}
                          <button type="button" onClick={() => openDetail(b.id)} className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-extrabold uppercase text-slate-700 hover:bg-slate-50">Chi tiết</button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4">
            <div className="text-xs text-slate-500">Trang <b className="text-slate-800">{page}</b> / {totalPages} · tổng {total} đơn.</div>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">‹</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pn = i + 1
                if (totalPages > 5) {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                  pn = start + i
                }
                return (
                  <button key={pn} onClick={() => setPage(pn)} className={cn('inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold', page === pn ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{pn}</button>
                )
              })}
              <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">›</button>
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-800 px-6 py-5 text-white">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">Chi tiết đơn đặt</div>
                {detail ? (
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <span className="font-mono text-2xl font-black">{detail.code}</span>
                    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1 ring-inset ring-white/30', statusBadge(detail.status).cls.replace('bg-', 'bg-white/15 text-white ring-white/30 ').replace('ring-1 ring-inset ', ''))}>
                      <span className={cn('h-2 w-2 rounded-full', statusBadge(detail.status).dot)} />
                      {statusBadge(detail.status).label}
                    </span>
                  </div>
                ) : <div className="mt-1 text-lg">Đang tải...</div>}
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition hover:bg-white/20">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {detailLoading || !detail ? (
                <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">Đang tải chi tiết đơn đặt...</div>
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Thông tin tour</div>
                      {detail.tour?.slug ? (
                        <Link target="_blank" to={`/tours/${detail.tour.slug}`} className="line-clamp-2 text-base font-extrabold text-slate-900 hover:text-orange-600">{detail.tour.title}</Link>
                      ) : <div className="line-clamp-2 text-base font-extrabold text-slate-900">{detail.tour?.title || '-'}</div>}
                      <div className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                        <div className="text-slate-500">Ngày đi:</div><div className="font-bold text-slate-800">{formatDate(detail.departureDate) || '-'}</div>
                        <div className="text-slate-500">Tiêu chuẩn:</div><div className="font-bold text-slate-800 line-clamp-1">{detail.departureStandardText || '-'}</div>
                        {detail.tour?.durationDays ? (<><div className="text-slate-500">Thời gian:</div><div className="font-bold text-slate-800">{detail.tour.durationDays}N{detail.tour.durationNights || 0}Đ</div></>) : null}
                        <div className="text-slate-500">PT thanh toán:</div><div className="font-bold text-slate-800">{payLabel(detail.paymentMethod)} · <span className={payStatus(detail.paymentStatus).c}>{payStatus(detail.paymentStatus).t}</span></div>
                        {detail.confirmedAt ? (<><div className="text-slate-500">Xác nhận lúc:</div><div className="font-bold text-blue-700">{formatDateTime(detail.confirmedAt) || '-'}</div></>) : null}
                        {detail.cancelledAt ? (<><div className="text-slate-500">Hủy lúc:</div><div className="font-bold text-rose-700">{formatDateTime(detail.cancelledAt) || '-'}</div></>) : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Thông tin liên hệ</div>
                      <div className="text-lg font-extrabold text-slate-900">{detail.contact?.name || '-'}</div>
                      <div className="mt-3 grid grid-cols-2 gap-y-1.5 gap-x-3 text-xs">
                        <div className="text-slate-500">SĐT:</div><div className="font-bold text-slate-800">{detail.contact?.phone || '-'}</div>
                        <div className="text-slate-500">Email:</div><div className="font-bold text-slate-800">{detail.contact?.email || '-'}</div>
                        <div className="text-slate-500">Địa chỉ:</div><div className="font-bold text-slate-800 line-clamp-1">{detail.contact?.address || '-'}</div>
                        <div className="text-slate-500">Tạo lúc:</div><div className="font-bold text-slate-800">{formatDateTime(detail.createdAt) || '-'}</div>
                        {detail.createdBy ? (<><div className="text-slate-500">Tạo bởi:</div><div className="font-bold text-blue-700">User #{detail.createdBy}</div></>) : null}
                      </div>
                      {detail.notes ? (
                        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-amber-200">
                          <div className="font-bold">💬 Ghi chú khách hàng:</div>
                          <div className="mt-1 whitespace-pre-line leading-5">{detail.notes}</div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Danh sách hành khách · {detail.adultCount + detail.childCount + detail.infantCount} người
                        <span className="ml-2 text-[10px] font-normal text-slate-400">(NL {detail.adultCount} · TE {detail.childCount} · EB {detail.infantCount})</span>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">STT</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Loại</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Họ tên</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Ngày sinh</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Giới tính</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">CCCD / HC</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Yêu cầu riêng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(detail.passengers || []).map((p, i) => (
                            <tr key={i} className="odd:bg-white even:bg-slate-50/40">
                              <td className="border-b border-slate-100 px-3 py-2 font-bold text-slate-700">{i + 1}</td>
                              <td className="border-b border-slate-100 px-3 py-2"><span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold', passengerTypeColor(p.type))}>{p.type}</span></td>
                              <td className="border-b border-slate-100 px-3 py-2 font-bold text-slate-900">{p.fullName || '-'}</td>
                              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{formatDate(p.birthDate) || '-'}</td>
                              <td className="border-b border-slate-100 px-3 py-2 text-slate-700">{p.gender === 'male' ? 'Nam' : p.gender === 'female' ? 'Nữ' : p.gender === 'other' ? 'Khác' : '-'}</td>
                              <td className="border-b border-slate-100 px-3 py-2 text-slate-700 font-mono">{p.idCard || '-'}</td>
                              <td className="border-b border-slate-100 px-3 py-2 text-slate-600 line-clamp-1">{p.notes || '-'}</td>
                            </tr>
                          ))}
                          {!(detail.passengers || []).length ? (
                            <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Không có hành khách.</td></tr>
                          ) : null}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Bảng giá chi tiết</div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600">
                            <th className="border-b border-slate-200 px-3 py-2.5 text-left font-bold">Nội dung</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold w-20">SL</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold w-28">Đơn giá</th>
                            <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold w-28">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.adultCount > 0 ? (
                            <tr><td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-800">Người lớn (NL)</td><td className="border-b border-slate-100 px-3 py-2 text-right font-bold">{detail.adultCount}</td><td className="border-b border-slate-100 px-3 py-2 text-right">{formatMoney(detail.priceAdultSnapshot ?? null)}</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold">{formatMoney((detail.priceAdultSnapshot || 0) * detail.adultCount)}</td></tr>
                          ) : null}
                          {detail.childCount > 0 ? (
                            <tr><td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-800">Trẻ em (TE)</td><td className="border-b border-slate-100 px-3 py-2 text-right font-bold">{detail.childCount}</td><td className="border-b border-slate-100 px-3 py-2 text-right">{formatMoney(detail.priceChildSnapshot ?? null)}</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold">{formatMoney((detail.priceChildSnapshot || 0) * detail.childCount)}</td></tr>
                          ) : null}
                          {detail.infantCount > 0 ? (
                            <tr><td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-800">Em bé (EB)</td><td className="border-b border-slate-100 px-3 py-2 text-right font-bold">{detail.infantCount}</td><td className="border-b border-slate-100 px-3 py-2 text-right">{formatMoney(detail.priceInfantSnapshot ?? null)}</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold">{formatMoney((detail.priceInfantSnapshot || 0) * detail.infantCount)}</td></tr>
                          ) : null}
                          {(detail.surcharges || []).filter((s) => (s.quantity || 0) > 0).map((l, idx) => (
                            <tr key={idx}><td className="border-b border-slate-100 px-3 py-2 font-semibold text-slate-700">◆ {l.label}{l.note ? <span className="ml-1 text-[10px] font-normal text-slate-400">({l.note})</span> : null}</td><td className="border-b border-slate-100 px-3 py-2 text-right font-bold">{l.quantity}</td><td className="border-b border-slate-100 px-3 py-2 text-right">{formatMoney(l.unitPrice)}</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold">{formatMoney((l.quantity || 0) * (l.unitPrice || 0))}</td></tr>
                          ))}
                          <tr className="bg-slate-50/50"><td colSpan={3} className="border-b border-slate-100 px-3 py-2 font-bold text-slate-700">Tạm tính</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold text-slate-900">{formatMoney(detail.subtotalAmount)}</td></tr>
                          {detail.surchargeAmount ? (
                            <tr className="bg-slate-50/50"><td colSpan={3} className="border-b border-slate-100 px-3 py-2 font-bold text-slate-700">Phụ thu</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold text-slate-900">{formatMoney(detail.surchargeAmount)}</td></tr>
                          ) : null}
                          <tr className="bg-slate-50/50"><td colSpan={3} className="border-b border-slate-100 px-3 py-2 font-bold text-slate-700">VAT</td><td className="border-b border-slate-100 px-3 py-2 text-right font-extrabold text-slate-900">{formatMoney(detail.vatAmount)}</td></tr>
                          <tr className="bg-orange-50/70"><td colSpan={3} className="px-3 py-3 text-sm font-black uppercase tracking-wide text-orange-700">TỔNG CỘNG THÀNH TIỀN</td><td className="px-3 py-3 text-right text-xl font-black text-orange-600">{formatMoney(detail.totalAmount)}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Ghi chú nội bộ (Admin / Staff)</div>
                      <div className="text-[10px] italic text-slate-400">Ghi chú này KHÔNG hiển thị cho khách hàng.</div>
                    </div>
                    <textarea rows={3} value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Nhập ghi chú nội bộ (ví dụ: KH cần phòng tầng thấp, ăn chay, số CMND gửi qua Zalo 123...)" className="w-full resize-y rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <div className="text-xs text-slate-500">
                {sendingAction ? <span className="inline-flex items-center gap-2 text-blue-700 font-bold"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></span>Đang xử lý...</span> : 'Đơn vị VNĐ, giá đã bao gồm VAT theo quy định.'}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-5 text-xs font-extrabold uppercase text-slate-700 hover:bg-slate-50">Đóng</button>
                {detail && canCancel(detail) ? (
                  <button type="button" disabled={!!sendingAction} onClick={() => patchStatus('cancelled', true)} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-rose-600 px-5 text-xs font-extrabold uppercase text-white shadow-sm shadow-rose-700/20 hover:bg-rose-700 disabled:opacity-60">✕ Hủy đơn (trả chỗ)</button>
                ) : null}
                {detail && canConfirm(detail) ? (
                  <button type="button" disabled={!!sendingAction} onClick={() => patchStatus('confirmed')} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-emerald-700 px-5 text-xs font-extrabold uppercase text-white shadow-sm shadow-emerald-800/20 hover:bg-emerald-800 disabled:opacity-60">✓ Xác nhận đơn</button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="hidden"><span>{toInputDate(new Date())}</span></div>
    </div>
  )
}
