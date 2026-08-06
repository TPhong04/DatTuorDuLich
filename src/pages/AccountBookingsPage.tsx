import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { BookingStatus, BookingSummary, listMyBookings } from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate, toInputDate } from '@/utils/date'

function formatMoney(n: number | null | undefined) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

function statusBadge(s: BookingStatus): { label: string; cls: string } {
  switch (s) {
    case 'pending':
      return { label: 'Đang giữ chỗ', cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' }
    case 'new':
      return { label: 'Chờ xác nhận', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200' }
    case 'confirmed':
      return { label: 'Đã xác nhận', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' }
    case 'in_progress':
      return { label: 'Đang đi', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' }
    case 'completed':
      return { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' }
    case 'cancelled':
      return { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' }
    default:
      return { label: s, cls: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' }
  }
}

function payLabel(m: string) {
  switch (m) {
    case 'hold':
      return '💳 Giữ chỗ'
    case 'bank_transfer':
      return '🏦 Chuyển khoản'
    case 'online':
      return '🌐 Online'
    default:
      return m
  }
}
function payStatusLabel(s: string) {
  switch (s) {
    case 'unpaid':
      return { t: 'Chưa thanh toán', c: 'text-rose-600' }
    case 'partial':
      return { t: 'Cọc một phần', c: 'text-orange-600' }
    case 'paid':
      return { t: 'Đã thanh toán', c: 'text-emerald-600' }
    default:
      return { t: s, c: 'text-slate-600' }
  }
}

export default function AccountBookingsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<BookingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  const [totalPages, setTotalPages] = useState(1)

  const [fStatus, setFStatus] = useState<BookingStatus | ''>('')
  const [fFrom, setFFrom] = useState('')
  const [fTo, setFTo] = useState('')
  const [fQ, setFQ] = useState('')

  const refresh = () => {
    setLoading(true)
    listMyBookings({
      status: fStatus || undefined,
      from: fFrom || undefined,
      to: fTo || undefined,
      q: fQ || undefined,
      page,
      limit,
    })
      .then((r) => {
        setItems(r.items || [])
        setTotal(r.total || 0)
        setTotalPages(r.totalPages || 1)
      })
      .catch((e) => toast.error((e as Error)?.message || 'Không tải được danh sách đơn đặt.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setPage(1)
  }, [fStatus, fFrom, fTo, fQ])

  useEffect(() => { refresh() }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Danh sách các đơn đặt tour bạn đã tạo, bao gồm các đơn giữ chỗ, đã xác nhận và lịch sử."
        title="Đơn đặt của tôi"
      />

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</label>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4">
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
            <input type="date" value={fFrom} max={fTo || undefined} onChange={(e) => setFFrom(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Đến ngày</label>
            <input type="date" value={fTo} min={fFrom || undefined} onChange={(e) => setFTo(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
          </div>
          <div className="md:col-span-5 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tìm kiếm</label>
              <input value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="Mã đặt chỗ / Tên tour / SĐT" className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={refresh} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-orange-500 px-5 text-sm font-extrabold uppercase text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600">Tìm</button>
              <button type="button" onClick={() => { setFStatus(''); setFFrom(''); setFTo(''); setFQ(''); setPage(1) }} className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-5 text-sm font-extrabold uppercase text-slate-700 hover:bg-slate-50">Reset</button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <div>Hiển thị <b className="text-slate-800">{items.length}</b> / tổng <b className="text-slate-800">{total}</b> đơn đặt.</div>
          <div className="italic text-slate-400">Mặc định hiển thị 10 đơn / trang, mới nhất trên cùng.</div>
        </div>
      </div>

      <div className="space-y-4">
        {loading && !items.length ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400 shadow-sm">Đang tải danh sách đơn đặt...</div>
        ) : !items.length ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="text-sm font-bold text-slate-700">Bạn chưa có đơn đặt nào.</div>
            <p className="mt-1 text-xs text-slate-500">Khám phá các tour hot và đặt tour ngay để nhận ưu đãi sớm.</p>
            <Link to="/tours" className="mt-4 inline-flex h-10 items-center justify-center whitespace-nowrap rounded-xl bg-orange-500 px-6 text-sm font-extrabold uppercase text-white shadow-sm shadow-orange-500/20 hover:bg-orange-600">Khám phá tour</Link>
          </div>
        ) : (
          items.map((b) => {
            const st = statusBadge(b.status)
            const ps = payStatusLabel(b.paymentStatus)
            return (
              <div key={b.id} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <div className="grid gap-0 md:grid-cols-[180px_minmax(0,1fr)]">
                  <Link to={b.tour.slug ? `/tours/${b.tour.slug}` : '/tours'} className="relative block aspect-[4/3] w-full bg-slate-100 md:aspect-auto">
                    {b.tour.coverImageUrl ? <img alt={b.tour.title} src={b.tour.coverImageUrl} className="h-full w-full object-cover transition group-hover:scale-[1.02]" /> : null}
                  </Link>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold tracking-wide text-slate-500">{b.code}</span>
                          <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold', st.cls)}>{st.label}</span>
                        </div>
                        <Link to={b.tour.slug ? `/tours/${b.tour.slug}` : '/tours'} className="mt-1.5 line-clamp-2 text-base font-extrabold text-slate-900 hover:text-orange-600">{b.tour.title}</Link>
                        <div className="mt-1 text-xs text-slate-500">Ngày đặt: <span className="font-semibold text-slate-700">{formatDate(b.createdAt) || '-'}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Tổng tiền</div>
                        <div className="mt-1 text-2xl font-black text-orange-600">{formatMoney(b.totalAmount)}</div>
                      </div>
                    </div>
                    <div className="grid gap-x-6 gap-y-1.5 border-t border-slate-100 pt-3 text-xs md:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0 w-20">Ngày đi</span>
                        <span className="font-semibold text-slate-800">{formatDate(b.departureDate) || '-'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0 w-20">Tiêu chuẩn</span>
                        <span className="font-semibold text-slate-800 line-clamp-1">{b.departureStandardText || '-'}</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0 w-20">Hành khách</span>
                        <span className="font-semibold text-slate-800">
                          {b.adultCount ? `NL ${b.adultCount}` : ''}
                          {b.adultCount && (b.childCount || b.infantCount) ? ' · ' : ''}
                          {b.childCount ? `TE ${b.childCount}` : ''}
                          {b.childCount && b.infantCount ? ' · ' : ''}
                          {b.infantCount ? `EB ${b.infantCount}` : ''}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-slate-400 shrink-0 w-20">Thanh toán</span>
                        <span className="font-semibold text-slate-800">{payLabel(b.paymentMethod)} · <span className={ps.c}>{ps.t}</span></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="text-[11px] italic text-slate-400">
                        {b.status === 'new' || b.status === 'pending' ? '💡 Nhân viên sẽ gọi xác nhận đơn đặt của bạn trong 30 phút.' : ''}
                        {b.status === 'confirmed' ? '🎉 Đơn đã được xác nhận. Vui lòng hoàn tất thanh toán trước ngày khởi hành.' : ''}
                        {b.status === 'in_progress' ? '🚌 Tour đang diễn ra, chúc quý khách có chuyến đi vui vẻ!' : ''}
                        {b.status === 'completed' ? '✅ Tour đã hoàn thành. Cảm ơn bạn đã đồng hành!' : ''}
                        {b.status === 'cancelled' ? '❌ Đơn đã được hủy. Nếu có câu hỏi vui lòng liên hệ tổng đài.' : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        {b.tour.slug ? (
                          <Link to={`/tours/${b.tour.slug}`} className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold uppercase text-slate-700 hover:bg-slate-50">Xem tour</Link>
                        ) : null}
                        <button type="button" className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-xl bg-slate-900 px-4 text-xs font-extrabold uppercase text-white shadow-sm hover:bg-slate-800">Chi tiết đơn</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
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
                <button key={pn} onClick={() => setPage(pn)} className={cn('inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold', page === pn ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>
                  {pn}
                </button>
              )
            })}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">›</button>
          </div>
        </div>
      ) : null}

      <div className="rounded-3xl border border-blue-100 bg-blue-50/40 p-4 text-xs leading-6 text-blue-800 shadow-sm">
        <b>Gợi ý:</b> Đặt tour càng sớm bạn càng nhận được nhiều ưu đãi ( giảm giá, quà tặng, chọn phòng tốt hơn ). Nếu cần hỗ trợ, vui lòng gọi Hotline <b className="text-blue-900">1900-xxxx</b> (8h00-21h00).
      </div>
      <div className="hidden">
        <span>{toInputDate(new Date())}</span>
      </div>
    </div>
  )
}
