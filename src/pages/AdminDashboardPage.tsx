import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  CircleDot,
  ClipboardList,
  Flag,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingUp,
  Users2,
  Wallet,
} from 'lucide-react'

import { DonutChart, RevenueLineChart } from '@/components/dashboard/DashboardCharts'
import {
  ActivityTimeline,
  Card,
  KpiCard,
  MiniCalendar,
  RecentBookingsTable,
  SectionTitle,
  TopSellers,
} from '@/components/dashboard/DashboardWidgets'
import {
  Booking,
  DashboardRecentBooking,
  DashboardSummary,
  fetchAdminDashboardSummary,
} from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'
import { formatInt, formatMoney, formatVNDShort } from '@/utils/format'

function mapRecentToBooking(items: DashboardRecentBooking[]): Booking[] {
  return items.map((b): Booking => ({
    id: b.id,
    code: b.code,
    status: b.status,
    paymentStatus: b.paymentStatus,
    totalAmount: b.totalAmount,
    adultCount: b.adultCount,
    childCount: b.childCount,
    infantCount: b.infantCount,
    departureDate: b.departureDate,
    departureStandardText: b.departureStandardText,
    contact: { ...b.contact, address: null },
    tour: { ...b.tour, durationDays: b.tour.durationDays ?? 0, durationNights: b.tour.durationNights ?? 0 },
    passengers: [],
    surcharges: [],
    subtotalAmount: 0,
    surchargeAmount: 0,
    vatAmount: 0,
    currency: 'VND',
    paymentMethod: 'hold',
    holdsUntil: null,
    notes: null,
    createdAt: b.createdAt,
  }))
}

const EMPTY_LINE_7 = [
  { label: 'Thứ 2', value: 0 }, { label: 'Thứ 3', value: 0 }, { label: 'Thứ 4', value: 0 },
  { label: 'Thứ 5', value: 0 }, { label: 'Thứ 6', value: 0 }, { label: 'Thứ 7', value: 0 }, { label: 'Chủ nhật', value: 0 },
]

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSummary | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchAdminDashboardSummary()
      .then((r) => setData(r))
      .catch((e) => {
        setError(e?.message || 'Không thể tải dashboard')
        setData(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
  }, [])

  const today = new Date()
  const rangeFrom = new Date(today)
  rangeFrom.setDate(today.getDate() - 6)

  const kpis = useMemo(() => {
    const rev = data?.kpis.bookingRevenueTotal ?? 0
    const pax = data?.kpis.passengerTotal ?? 0
    const bookingCount = data?.kpis.bookingCount ?? 0
    const pending = data?.kpis.pendingCount ?? 0
    return { bookingCount, rev, pax, pending }
  }, [data])

  const tourTypeSlices = data?.tourTypeSlices && data.tourTypeSlices.length ? data.tourTypeSlices : [{ label: 'Chưa có dữ liệu', value: 0, color: '#94a3b8' }]
  const statusSlices = data?.statusSlices && data.statusSlices.length ? data.statusSlices : [{ label: 'Chưa có dữ liệu', value: 0, color: '#94a3b8' }]
  const lineData = data?.line7Days && data.line7Days.length ? data.line7Days : EMPTY_LINE_7
  const topSellers = data?.topSellers ?? []
  const calendarEvents = data?.calendarEvents ?? []
  const calendar = data?.calendar ?? { year: today.getFullYear(), month: today.getMonth(), today: today.getDate() }

  const bookingsRecent = data && data.recentBookings.length > 0
    ? mapRecentToBooking(data.recentBookings).slice(0, 8)
    : ([] as Booking[])

  return (
    <div className="mx-auto w-full max-w-none space-y-7 px-6 sm:px-8 xl:px-12 2xl:space-y-8 2xl:px-16">
      <Card className="!p-6 2xl:!p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-orange-500 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 2xl:h-16 2xl:w-16">
              <Sparkles className="h-7 w-7 2xl:h-8 2xl:w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-50 to-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest ring-1 ring-inset ring-amber-200/60 text-amber-700">
                  <CircleDot className="h-3.5 w-3.5" /> CRM · VietNamExplorer
                </span>
                {error ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-rose-200 text-rose-700">
                    {error}
                  </span>
                ) : loading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-blue-200 text-blue-700">
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Đang đồng bộ database...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-emerald-200 text-emerald-700">
                    ✅ Dữ liệu thực tế từ DB
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl 2xl:text-4xl">
                TỔNG QUAN HỆ THỐNG TOUR DU LỊCH
              </h1>
              <div className="mt-2 text-sm 2xl:text-base text-slate-500">
                Data từ {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())} · Server:{' '}
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.2)]" /> Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-5 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full min-w-[260px] max-w-[520px] rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-blue-50 focus:border-blue-400 focus:ring-4 2xl:h-12"
                placeholder="Tìm booking, khách hàng, mã tour..."
                type="text"
              />
            </div>
            <div className="hidden h-11 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs shadow-sm 2xl:h-12 md:inline-flex">
              <CalendarDays className="h-4 w-5 text-slate-400" />
              <span className="font-semibold text-slate-700 2xl:text-sm">
                {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())}
              </span>
            </div>
            <button
              className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] 2xl:h-12"
              onClick={refresh}
              type="button"
            >
              <RefreshCcw className={cn('h-4 w-5 text-blue-600', loading && 'animate-spin')} />
              Làm mới
            </button>
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm 2xl:h-12 2xl:w-12">
              <Bell className="h-5 w-5" />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:gap-7 xl:grid-cols-4">
        <KpiCard
          label="Tổng Bookings"
          value={formatInt(kpis.bookingCount)}
          sub={`${formatInt(kpis.bookingCount)} đơn trong DB · ${loading ? 'đang cập nhật' : 'thực tế'}`}
          tone="blue"
          trend="up"
          trendPct={0}
          icon={<ClipboardList className="h-6 w-6" />}
          onClick={() => (window.location.href = '/admin/bookings')}
        />
        <KpiCard
          label="Doanh thu"
          value={`${formatVNDShort(kpis.rev)}đ`}
          sub={`${formatMoney(kpis.rev)} tổng từ booking đã xác nhận`}
          tone="orange"
          trend="up"
          trendPct={0}
          icon={<Wallet className="h-6 w-6" />}
          onClick={() => (window.location.href = '/admin/reports')}
        />
        <KpiCard
          label="Lượt khách"
          value={formatInt(kpis.pax)}
          sub={`Tổng ${formatInt(kpis.pax)} hành khách trong hệ thống`}
          tone="emerald"
          trend="up"
          trendPct={0}
          icon={<Users2 className="h-6 w-6" />}
          onClick={() => (window.location.href = '/admin/users')}
        />
        <KpiCard
          label="Đơn chờ xử lý"
          value={formatInt(kpis.pending)}
          sub="Cần gọi xác nhận / thu tiền"
          tone="rose"
          trend="down"
          trendPct={0}
          icon={<TrendingUp className="h-6 w-6" />}
          onClick={() => (window.location.href = '/admin/bookings?status=pending')}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:gap-7 xl:grid-cols-12">
        <Card className="xl:col-span-6 !p-6 2xl:!p-8">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <SectionTitle
                title={<>Lượng hành khách 7 ngày</>}
                subtitle="Biểu đồ theo dõi số lượng hành khách theo từng ngày trong tuần"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['Tuần', 'Tháng', 'Quý', 'Năm'].map((t, i) => (
                <button
                  key={t}
                  className={cn(
                    'h-9 rounded-xl px-4 text-[12px] font-bold ring-1 ring-inset transition',
                    i === 0
                      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm ring-blue-500/20'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                  type="button"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <RevenueLineChart currencySuffix=" khách" data={lineData} height={300} />
        </Card>

        <Card className="xl:col-span-3 !p-6 2xl:!p-8">
          <SectionTitle title="Doanh thu theo Loại Tour" subtitle="Phân chia tỷ lệ theo nhóm sản phẩm tour" />
          <div className="mt-5">
            <DonutChart
              centerLabel="tổng loại"
              centerSub="đơn đã tạo"
              centerValue={formatVNDShort(kpis.rev)}
              data={tourTypeSlices}
            />
          </div>
        </Card>

        <Card className="xl:col-span-3 !p-6 2xl:!p-8">
          <SectionTitle title="Tình trạng đơn Tour" subtitle="Tỷ lệ phân bổ trạng thái trong tháng" />
          <div className="mt-5">
            <DonutChart
              centerLabel="Tổng đơn"
              centerSub="tổng trong tháng"
              centerValue={formatInt(kpis.bookingCount)}
              data={statusSlices}
            />
          </div>
        </Card>

        <Card className="xl:col-span-12 !p-6 2xl:!p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-50 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-widest ring-1 ring-inset ring-orange-200/60 text-orange-700">
                <Sparkles className="h-4 w-4" /> Bảng xếp hạng
              </div>
              <h3 className="mt-2 text-base font-black uppercase tracking-wide text-slate-800 2xl:text-lg">TOP 5 TOUR BÁN CHẠY NHẤT</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 'revenue', l: 'Doanh thu', active: true },
                { k: 'sales', l: 'Hành khách' },
              ].map((tab) => (
                <button
                  key={tab.k}
                  className={cn(
                    'h-9 rounded-xl px-4 text-[12px] font-bold ring-1 ring-inset transition',
                    tab.active
                      ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white ring-orange-500/20 shadow-sm'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                  type="button"
                >
                  {tab.l}
                </button>
              ))}
            </div>
          </div>
          {topSellers.length > 0 ? (
            <TopSellers data={topSellers} />
          ) : (
            <div className="py-16 text-center text-sm text-slate-500">Chưa có dữ liệu top tour bán chạy</div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:gap-7 xl:grid-cols-12">
        <Card className="!p-0 xl:col-span-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-5 2xl:p-8">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2 text-base">
                  <BookOpenCheck className="h-5 w-5 text-blue-600" />
                  ĐƠN ĐẶT TOUR GẦN NHẤT
                </span>
              }
              subtitle={`${bookingsRecent.length} đơn hiển thị · 8 mới nhất ${loading ? '(đang đồng bộ DB)' : bookingsRecent.length === 0 ? '(chưa có đơn đặt trong hệ thống)' : '(từ DB thực tế)'}`}
              action={
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-4.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-blue-800 2xl:h-11"
                  to="/admin/bookings"
                >
                  <ClipboardList className="h-4 w-5" />
                  Quản lý Bookings
                </Link>
              }
            />
          </div>
          {bookingsRecent.length > 0 ? (
            <RecentBookingsTable items={bookingsRecent} />
          ) : (
            <div className="px-6 pb-10 pt-6 text-center text-sm text-slate-500 2xl:px-8">Chưa có đơn đặt gần nhất</div>
          )}
        </Card>

        <div className="space-y-6 2xl:space-y-7 xl:col-span-4">
          <Card className="!p-6 2xl:!p-8">
            <div className="mb-4 flex items-center justify-between">
              <SectionTitle
                title={
                  <span className="inline-flex items-center gap-2 text-base">
                    <CalendarDays className="h-5 w-5 text-orange-600" />
                    Lịch theo dõi · Tháng {String(calendar.month + 1).padStart(2, '0')}/{calendar.year}
                  </span>
                }
              />
            </div>
            <MiniCalendar events={calendarEvents} month={calendar.month} today={calendar.today} year={calendar.year} />
            <div className="mt-5 space-y-2.5 border-t border-dashed border-slate-200 pt-4 text-xs 2xl:text-sm">
              {calendarEvents.slice(0, 8).map((e, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono font-bold text-slate-700">
                    {String(e.day).padStart(2, '0')}/{String(calendar.month + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', e.tone === 'blue' ? 'bg-blue-500' : e.tone === 'orange' ? 'bg-orange-500' : (e.tone === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'))} />
                  <span className="truncate text-slate-600">{e.label}</span>
                </div>
              ))}
              {calendarEvents.length === 0 && <div className="text-slate-400">Chưa có sự kiện lịch trong tháng</div>}
            </div>
          </Card>

          <Card className="!p-6 2xl:!p-8">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2 text-base">
                  <CircleDot className="h-5 w-5 text-blue-600" />
                  Hoạt động gần đây
                </span>
              }
              subtitle="Sự kiện từ lịch sử đơn đặt tour trong 24h"
            />
            <div className="mt-5">
              <ActivityTimeline items={[]} emptyText="Chưa có hoạt động gần đây" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
