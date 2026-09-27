import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, Loader2, Search, SlidersHorizontal, PencilLine, Users, X, Check, AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import PageHeader from '@/components/ui/PageHeader'
import {
  AdminDepartureRow,
  DepartureTab,
  adminListDepartures,
  adminPatchDeparture,
} from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/utils/format'

type AdminDepartureStatus = 'open' | 'closed' | 'cancelled' | 'soldout'
type DepartureUIStatus = AdminDepartureStatus | 'low_stock'

const STATUS_LABELS: Record<DepartureUIStatus, { label: string; className: string }> = {
  open:      { label: '🟢 Open',      className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  low_stock: { label: '🟡 Sắp hết',   className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  soldout:   { label: '🔴 Sold-out',  className: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  closed:    { label: '⚪ Đã đóng',    className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200' },
  cancelled: { label: '❌ Đã hủy',     className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 line-through' },
}

function formatDateVN(iso?: string | null) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function toInputMonth(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function getEffectiveStatus(r: AdminDepartureRow): DepartureUIStatus {
  if (r.status === 'soldout') return 'soldout'
  if (r.status === 'closed') return 'closed'
  if (r.status === 'cancelled') return 'cancelled'
  if (r.seatsTotal > 0 && r.fillRatePct >= 85 && r.status === 'open') return 'low_stock'
  return 'open'
}

export default function AdminDeparturesPage() {
  const nav = useNavigate()
  const [tab, setTab] = useState<DepartureTab>('month')
  const [monthISO, setMonthISO] = useState<string>(toInputMonth())
  const [q, setQ] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 30

  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<AdminDepartureRow[]>([])
  const [total, setTotal] = useState(0)
  const [loadErr, setLoadErr] = useState<string | null>(null)

  const [editing, setEditing] = useState<{
    row: AdminDepartureRow
    priceAdult: string
    priceChild: string
    seatsAvailable: string
    seatsTotal: string
    standardText: string
    status: AdminDepartureStatus
    departureDate: string
    submitting: boolean
    error: string | null
  } | null>(null)

  const load = async (nextPage = page) => {
    setLoading(true)
    setLoadErr(null)
    try {
      const skip = Math.max(0, (nextPage - 1) * pageSize)
      const res = await adminListDepartures({
        tab,
        month: tab === 'month' ? monthISO : undefined,
        q: q.trim() || undefined,
        skip,
        limit: pageSize,
      })
      setRows(res.items || [])
      setTotal(Number(res.total) || 0)
    } catch (e: any) {
      setLoadErr(String(e?.message || e || 'Lỗi tải dữ liệu lịch khởi hành'))
    } finally {
      setLoading(false)
    }
  }

  // Thay đổi tab/month/search → reset về trang 1
  useEffect(() => {
    setPage(1)
  }, [tab, monthISO, q])

  useEffect(() => {
    void load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, monthISO, q, page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const stats = useMemo(() => {
    const s = rows
    const total = s.length
    const sold = s.filter((r) => r.status === 'soldout' || r.seatsAvailable <= 0).length
    const lowStock = s.filter((r) => getEffectiveStatus(r) === 'low_stock').length
    const within24h = s.filter((r) => r.badgeWithin24h).length
    const today = s.filter((r) => r.badgeIsToday).length
    const past = s.filter((r) => r.badgePast).length
    const sumSeatsBooked = s.reduce((acc, r) => acc + r.seatsBooked, 0)
    const sumSeatsTotal = s.reduce((acc, r) => acc + r.seatsTotal, 0)
    return { total, sold, lowStock, within24h, today, past, sumSeatsBooked, sumSeatsTotal }
  }, [rows])

  const applyEdit = async () => {
    if (!editing) return
    setEditing({ ...editing, submitting: true, error: null })
    const patch: Parameters<typeof adminPatchDeparture>[1] = {}
    if (editing.priceAdult !== '') patch.priceAdult = Number(editing.priceAdult) || 0
    if (editing.priceChild !== '') patch.priceChild = editing.priceChild === 'null' ? null : Number(editing.priceChild) || 0
    if (editing.seatsTotal !== '') patch.seatsTotal = Math.max(0, Number(editing.seatsTotal) || 0)
    if (editing.seatsAvailable !== '') patch.seatsAvailable = Math.max(0, Number(editing.seatsAvailable) || 0)
    if (editing.standardText !== editing.row.standardText) patch.standardText = editing.standardText
    if (editing.status !== editing.row.status) patch.status = editing.status
    // YYYY-MM-DD
    if (editing.departureDate && editing.departureDate !== formatDateVN(editing.row.departureDateISO)) {
      // convert to proper ISO via yyyy-mm-dd input (editing.departureDate format is from input type=date)
      patch.departureDate = editing.departureDate
    }
    try {
      await adminPatchDeparture(editing.row.id, patch)
      setEditing(null)
      await load(page)
    } catch (e: any) {
      setEditing({ ...editing, submitting: false, error: String(e?.message || e || 'Lỗi cập nhật') })
    }
  }

  const tabs: { id: DepartureTab; label: string; hint: string }[] = [
    { id: 'month',    label: '📅 Tháng này',  hint: 'Tất cả lịch tháng đang xem' },
    { id: 'week',     label: '🗓️ Tuần này',   hint: 'Thứ 2 → Chủ Nhật' },
    { id: 'soon_24h', label: '⏱️ 24h tới',    hint: 'Chuẩn bị xe + HDV' },
    { id: 'all',      label: '📚 Tất cả',     hint: 'Tất cả lịch mọi tháng' },
    { id: 'low_stock',label: '🟡 Sắp hết chỗ', hint: 'Còn ≤15% tổng chỗ (đẩy bán)' },
    { id: 'soldout',  label: '🔴 Hết chỗ',    hint: 'Đã bán hết / Đã sold-out' },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Lịch khởi hành"
        subtitle="Dashboard vận hành — lọc, tìm, inline sửa giá / chỗ / trạng thái tour mà không cần mở Edit Tour."
        right={
          <Link
            to="/admin/tours"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <SlidersHorizontal className="h-4 w-4" /> Quản lý tours
          </Link>
        }
      />

      {/* ============ STATS CARDS ============ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        <StatCard title="Lịch trong view" value={stats.total} sub={`Tổng ${total} toàn bộ`} tone="blue" />
        <StatCard title="Trong 24h tới" value={stats.within24h} sub="Chuẩn bị xe / HDV" tone="indigo" badge={stats.within24h > 0} />
        <StatCard title="Hôm nay" value={stats.today} sub="Lịch khởi hành hôm nay" tone="cyan" badge={stats.today > 0} />
        <StatCard title="Sắp hết chỗ" value={stats.lowStock} sub="Còn ≤ 15% chỗ" tone="amber" badge={stats.lowStock > 0} />
        <StatCard title="Hết chỗ" value={stats.sold} sub="Sold-out / Đã 0 chỗ" tone="rose" badge={stats.sold > 0} />
        <StatCard title="Khách đã đặt" value={stats.sumSeatsBooked} sub={`trên ${stats.sumSeatsTotal.toLocaleString('vi-VN')} tổng chỗ`} tone="emerald" />
        <StatCard title="Đã khởi hành" value={stats.past} sub="Ngày đi đã qua" tone="slate" />
      </div>

      {/* ============ FILTER BAR ============ */}
      <div className="rounded-3xl bg-white p-4 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                title={t.hint}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
                  tab === t.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 ring-2 ring-blue-200'
                    : 'bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Bộ điều khiển còn lại */}
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'month' && (
              <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200">
                <label className="text-xs font-semibold text-slate-700">Tháng:</label>
                <input
                  type="month"
                  value={monthISO}
                  onChange={(e) => setMonthISO(e.target.value)}
                  className="rounded-lg border-0 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}
            <div className="relative flex-1 md:w-80 md:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setQ(searchInput) }}
                onBlur={() => setQ(searchInput)}
                placeholder="Tìm theo tên tour / mã / slug / miền..."
                className="h-10 w-full rounded-xl border-0 bg-slate-50 pl-10 pr-28 text-sm outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-300"
              />
              {q || searchInput ? (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setQ('') }}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setQ(searchInput)}
                className="absolute right-11 top-1/2 -translate-y-1/2 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700"
              >
                Tìm
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div>
            {loading ? (
              <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tải lịch khởi hành…</span>
            ) : loadErr ? (
              <span className="inline-flex items-center gap-1.5 text-rose-600"><AlertTriangle className="h-3.5 w-3.5" /> {loadErr}</span>
            ) : total === 0 ? (
              <span className="inline-flex items-center gap-1.5">Không tìm thấy lịch khởi hành phù hợp bộ lọc.</span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                Hiển thị <b className="text-slate-800">{rows.length}</b> / tổng <b className="text-slate-800">{total}</b> lịch
                {tab === 'month' ? ` · Tháng ${monthISO}` : ''}
                {q ? ` · Từ khóa: "${q}"` : ''}
              </span>
            )}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {/* ============ MAIN TABLE ============ */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1300px] text-left text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-blue-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Tour</th>
                <th className="px-3 py-3">Ngày đi</th>
                <th className="px-3 py-3">Tiêu chuẩn</th>
                <th className="px-3 py-3 text-right">Giá NL / TE</th>
                <th className="px-3 py-3">Tình trạng chỗ</th>
                <th className="px-3 py-3 w-36">Trạng thái</th>
                <th className="px-3 py-3 text-center w-44">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-500"><Loader2 className="inline h-5 w-5 animate-spin" /> <span className="ml-2">Đang tải lịch khởi hành…</span></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-20 text-center">
                  <div className="mx-auto max-w-md space-y-3">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                      <CalendarDays className="h-7 w-7 text-slate-400" />
                    </div>
                    <div className="text-sm font-semibold text-slate-800">Chưa có lịch khởi hành</div>
                    <div className="text-xs text-slate-500">
                      {q ? 'Thử thay đổi từ khóa tìm kiếm.' : tab === 'low_stock' || tab === 'soldout' ? 'Hiện tại không có lịch nào ở trạng thái này.' : tab === 'soon_24h' ? 'Không có tour nào khởi hành trong 24 giờ tới.' : tab === 'month' ? `Tháng ${monthISO} chưa có lịch — tạo lịch khởi hành trong mục Quản lý Tours.` : 'Thử chuyển tab Tất cả hoặc chọn tháng khác.'}
                    </div>
                    <Link
                      to="/admin/tours"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" /> Quản lý tours / Thêm lịch
                    </Link>
                  </div>
                </td></tr>
              ) : rows.map((r) => {
                const eff = getEffectiveStatus(r)
                const meta = STATUS_LABELS[eff] ?? STATUS_LABELS.open
                return (
                  <tr key={r.id} className={cn('transition hover:bg-blue-50/30', r.badgePast ? 'bg-slate-50/70 text-slate-500' : '')}>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-3">
                        {r.coverImageUrl ? (
                          <img src={r.coverImageUrl} alt="" className="h-12 w-16 flex-none rounded-lg object-cover ring-1 ring-slate-200" loading="lazy" />
                        ) : (
                          <div className="h-12 w-16 flex-none rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 ring-1 ring-slate-200" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {!r.isTourPublished && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">📴 Nháp</span>
                            )}
                            {r.badgeIsToday && (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-bold text-cyan-700 ring-1 ring-cyan-200">HÔM NAY</span>
                            )}
                            {r.badgeWithin24h && !r.badgeIsToday && (
                              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 ring-1 ring-indigo-200">⏱️ 24H TỚI</span>
                            )}
                            {r.badgePast && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Đã đi</span>
                            )}
                            {r.tourRegion && (
                              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100">{r.tourRegion}</span>
                            )}
                          </div>
                          <Link
                            to={`/admin/tours/${r.tourId}/edit`}
                            className="truncate text-sm font-bold text-slate-900 hover:text-blue-700 hover:underline"
                          >
                            {r.tourTitle}
                          </Link>
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {r.tourCode && <span className="font-mono">#{r.tourCode}</span>}
                            {r.durationDays > 0 && <span>📏 {r.durationDays}N{r.durationNights > 0 ? `${r.durationNights}Đ` : ''}</span>}
                            {r.departureFrom && <span>🚩 {r.departureFrom}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-sm font-semibold text-slate-900">{formatDateVN(r.departureDateISO)}</div>
                    </td>
                    <td className="px-3 py-3 align-top max-w-[220px]">
                      {r.standardText ? (
                        <div className="rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
                          {r.standardText}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      <div className="text-sm font-bold text-slate-900">{formatMoney(r.priceAdult)}</div>
                      {typeof r.priceChild === 'number' && r.priceChild > 0 && (
                        <div className="mt-0.5 text-[11px] text-slate-500">Trẻ em {formatMoney(r.priceChild)}</div>
                      )}
                      {typeof r.discountPercent === 'number' && r.discountPercent > 0 && r.originalPriceAdult && r.originalPriceAdult > 0 ? (
                        <div className="mt-0.5 text-[11px] font-semibold text-rose-600 line-through">
                          Giá gốc {formatMoney(r.originalPriceAdult)} · -{r.discountPercent}%
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top min-w-[200px]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          <span>Đã đặt <b className="text-slate-900">{r.seatsBooked}</b> / {r.seatsTotal}</span>
                        </span>
                        <span className="text-slate-500">{r.fillRatePct}%</span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            eff === 'soldout' ? 'bg-rose-500' :
                            eff === 'low_stock' ? 'bg-amber-500' :
                            r.badgePast ? 'bg-slate-400' : 'bg-emerald-500',
                          )}
                          style={{ width: `${Math.min(100, r.fillRatePct)}%` }}
                        />
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Còn <b className="text-emerald-700">{r.seatsAvailable}</b> chỗ trống
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold', meta.className)}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex flex-col items-stretch justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing({
                            row: r,
                            priceAdult: String(r.priceAdult),
                            priceChild: typeof r.priceChild === 'number' ? String(r.priceChild) : '',
                            seatsAvailable: String(r.seatsAvailable),
                            seatsTotal: String(r.seatsTotal),
                            standardText: r.standardText || '',
                            status: r.status,
                            departureDate: (() => {
                              const d = new Date(r.departureDateISO)
                              if (Number.isNaN(d.getTime())) return ''
                              const pad = (n: number) => String(n).padStart(2, '0')
                              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
                            })(),
                            submitting: false,
                            error: null,
                          })}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-slate-800"
                        >
                          <PencilLine className="h-3.5 w-3.5" /> Sửa nhanh
                        </button>
                        <button
                          type="button"
                          onClick={() => nav(`/admin/bookings?departureId=${encodeURIComponent(r.id)}`)}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
                        >
                          👥 Danh sách booking
                        </button>
                        <Link
                          to={`/admin/tours/${r.tourId}/edit#departures`}
                          className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                        >
                          📝 Edit Tour đầy đủ
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3 text-xs text-slate-500">
          <span>{rows.length > 0 ? `Trang ${page} / ${totalPages}` : ''}</span>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      {/* ============ MODAL SỬA NHANH ============ */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg space-y-4 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Sửa nhanh lịch khởi hành</div>
                <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{editing.row.tourTitle} · Ngày đi {formatDateVN(editing.row.departureDateISO)}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-700">Ngày khởi hành</label>
                <input
                  type="date"
                  value={editing.departureDate}
                  onChange={(e) => setEditing({ ...editing, departureDate: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block font-semibold text-slate-700">Giá người lớn (VND)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={editing.priceAdult}
                  onChange={(e) => setEditing({ ...editing, priceAdult: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block font-semibold text-slate-700">Giá trẻ em (VND, trống = không có)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  placeholder="trống / số"
                  value={editing.priceChild}
                  onChange={(e) => setEditing({ ...editing, priceChild: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block font-semibold text-slate-700">Tổng chỗ</label>
                <input
                  type="number"
                  min={0}
                  value={editing.seatsTotal}
                  onChange={(e) => setEditing({ ...editing, seatsTotal: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-1">
                <label className="mb-1 block font-semibold text-slate-700">Chỗ trống</label>
                <input
                  type="number"
                  min={0}
                  value={editing.seatsAvailable}
                  onChange={(e) => setEditing({ ...editing, seatsAvailable: e.target.value })}
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-700">Tiêu chuẩn / Ghi chú gặp mặt</label>
                <input
                  type="text"
                  value={editing.standardText}
                  onChange={(e) => setEditing({ ...editing, standardText: e.target.value })}
                  placeholder="VD: Thứ 7 Chủ Nhật hàng tuần / Gặp mặt 5h30 cột A2 sân bay"
                  className="w-full rounded-xl bg-slate-50 px-3 py-2 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block font-semibold text-slate-700">Trạng thái</label>
                <div className="grid grid-cols-5 gap-2">
                  {(['open' as const, 'low_stock' as const, 'soldout' as const, 'closed' as const, 'cancelled' as const]).map((s) => {
                    const uiStatus: DepartureUIStatus = s
                    const isCurrent = editing.status === uiStatus || (uiStatus === 'low_stock' && getEffectiveStatus(editing.row) === 'low_stock')
                    const lbl = STATUS_LABELS[uiStatus] ?? STATUS_LABELS.open
                    const disabledForUI = uiStatus === 'low_stock' // low_stock = derived; không set trực tiếp
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabledForUI}
                        onClick={() => setEditing({ ...editing, status: uiStatus === 'low_stock' ? editing.status : (uiStatus as AdminDepartureStatus) })}
                        className={cn(
                          'rounded-xl px-2 py-1.5 text-[11px] font-bold transition',
                          disabledForUI
                            ? 'bg-slate-50 text-slate-400 ring-1 ring-slate-200 opacity-60'
                            : isCurrent
                              ? lbl.className + ' ring-2 ring-offset-1'
                              : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                        )}
                      >
                        {lbl.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {editing.error && (
              <div className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                ⚠️ {editing.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void applyEdit()}
                disabled={editing.submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 disabled:opacity-60"
              >
                {editing.submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard(props: {
  title: string
  value: number | string
  sub?: string
  tone: 'blue' | 'indigo' | 'cyan' | 'amber' | 'rose' | 'emerald' | 'slate'
  badge?: boolean
}) {
  const tones: Record<typeof props.tone, string> = {
    blue:    'from-blue-50 to-blue-100/40 text-blue-800 ring-blue-200',
    indigo:  'from-indigo-50 to-indigo-100/40 text-indigo-800 ring-indigo-200',
    cyan:    'from-cyan-50 to-cyan-100/40 text-cyan-800 ring-cyan-200',
    amber:   'from-amber-50 to-amber-100/40 text-amber-800 ring-amber-200',
    rose:    'from-rose-50 to-rose-100/40 text-rose-800 ring-rose-200',
    emerald: 'from-emerald-50 to-emerald-100/40 text-emerald-800 ring-emerald-200',
    slate:   'from-slate-50 to-slate-100/40 text-slate-700 ring-slate-200',
  }
  return (
    <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 shadow-sm ring-1', tones[props.tone])}>
      {props.badge && (
        <span className="absolute right-2 top-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-current opacity-80" />
      )}
      <div className="text-[11px] font-bold uppercase tracking-wider opacity-80">{props.title}</div>
      <div className="mt-1 text-2xl font-black leading-none">
        {typeof props.value === 'number' ? props.value.toLocaleString('vi-VN') : props.value}
      </div>
      {props.sub && <div className="mt-1.5 text-[11px] font-semibold opacity-80">{props.sub}</div>}
    </div>
  )
}

function Pagination(props: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const { page, totalPages, onChange } = props
  return (
    <div className="inline-flex items-center gap-1 rounded-xl bg-white ring-1 ring-slate-200">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        aria-label="Trang trước"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="px-2 text-xs font-bold text-slate-700">
        Trang {page} / {totalPages}
      </div>
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        aria-label="Trang sau"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}
