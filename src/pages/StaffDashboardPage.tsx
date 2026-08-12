import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  ClipboardList,
  ListChecks,
  PhoneCall,
  RefreshCcw,
  Sparkles,
  Users2,
  Wallet,
  Wrench,
} from 'lucide-react'

import { RevenueLineChart } from '@/components/dashboard/DashboardCharts'
import {
  ActivityTimeline,
  Card,
  KpiCard,
  MiniCalendar,
  RecentBookingsTable,
  SectionTitle,
} from '@/components/dashboard/DashboardWidgets'
import {
  Booking,
  DashboardRecentBooking,
  DashboardSummary,
  fetchStaffDashboardSummary,
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

export default function StaffDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DashboardSummary | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    fetchStaffDashboardSummary()
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

  const list = useMemo(() => (data?.recentBookings.length ? mapRecentToBooking(data.recentBookings) : ([] as Booking[])), [data])

  const stats = useMemo(() => {
    const pending = list.filter((b) => b.status === 'new' || b.status === 'pending').length
    const confirmed = list.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length
    const pax = list.reduce((s, b) => s + b.adultCount + b.childCount + b.infantCount, 0)
    const rev = list.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.totalAmount, 0)
    return { pending, confirmed, pax, rev }
  }, [list])

  const lineData = data?.line7Days?.length ? data.line7Days : EMPTY_LINE_7
  const calendarEvents = data?.calendarEvents ?? []
  const calendar = data?.calendar ?? { year: today.getFullYear(), month: today.getMonth(), today: today.getDate() }

  return (
    <div className="mx-auto w-full max-w-none space-y-7 px-6 sm:px-8 xl:px-12 2xl:space-y-8 2xl:px-16">
      <Card className="!p-6 2xl:!p-8">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-blue-600 text-white shadow-lg shadow-orange-500/20 ring-4 ring-orange-50 2xl:h-16 2xl:w-16">
              <Wrench className="h-7 w-7 2xl:h-8 2xl:w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-50 to-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest ring-1 ring-inset ring-orange-200/60 text-orange-700">
                  <Sparkles className="h-3.5 w-3.5" /> VẬN HÀNH · Staff Panel
                </span>
                {error ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-rose-200 text-rose-700">
                    {error}
                  </span>
                ) : loading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-blue-200 text-blue-700">
                    <RefreshCcw className="h-3.5 w-3.5 animate-spin" /> Đồng bộ dữ liệu staff từ DB...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ring-emerald-200 text-emerald-700">
                    ✅ Đơn bạn phụ trách từ DB
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl 2xl:text-4xl">
                DASHBOARD VẬN HÀNH BOOKING
              </h1>
              <div className="mt-2 text-sm 2xl:text-base text-slate-500">
                Khoảng ngày {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())} ·{' '}
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,.2)]" /> Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden h-11 items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs shadow-sm 2xl:h-12 md:inline-flex">
              <CalendarDays className="h-4 w-5 text-slate-400" />
              <span className="font-semibold text-slate-700 2xl:text-sm">
                {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())}
              </span>
            </div>
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-4.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 2xl:h-12"
              to="/staff/bookings"
            >
              <ListChecks className="h-4 w-5" />
              Mở Bookings
            </Link>
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
          label="Đơn chờ xử lý (HOT)"
          value={formatInt(stats.pending)}
          sub="Ưu tiên gọi xác nhận ngay"
          tone="rose"
          icon={<PhoneCall className="h-6 w-6" />}
          onClick={() => (window.location.href = '/staff/bookings?status=pending')}
        />
        <KpiCard
          label="Đã xác nhận"
          value={formatInt(stats.confirmed)}
          sub="Chuẩn bị tài liệu / thông báo"
          tone="blue"
          trend="up"
          trendPct={0}
          icon={<BookOpenCheck className="h-6 w-6" />}
        />
        <KpiCard
          label="Hành khách phụ trách"
          value={formatInt(stats.pax)}
          sub={`${list.length} đơn trong danh sách gần nhất`}
          tone="emerald"
          trend="up"
          trendPct={0}
          icon={<Users2 className="h-6 w-6" />}
        />
        <KpiCard
          label="Doanh thu phụ trách"
          value={formatMoney(stats.rev)}
          sub={`Tổng ${formatVNDShort(stats.rev)} chưa tính đơn hủy`}
          tone="orange"
          trend="up"
          trendPct={0}
          icon={<Wallet className="h-6 w-6" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 2xl:gap-7 xl:grid-cols-12">
        <Card className="!p-0 xl:col-span-8 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-5 2xl:p-8">
            <div>
              <SectionTitle
                title={<>Đơn đặt Tour phụ trách của bạn</>}
                subtitle={`${list.length} đơn gần nhất · Click 🔍 Chi tiết ở trang Bookings để xử lý từng đơn ${loading ? '(đang đồng bộ DB)' : list.length === 0 ? '(chưa có đơn nào phân công cho bạn)' : '(từ DB thực tế)'}`}
                action={
                  <Link
                    className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-4.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-blue-800 2xl:h-11"
                    to="/staff/bookings"
                  >
                    <ClipboardList className="h-4 w-5" />
                    Xem đầy đủ
                  </Link>
                }
              />
            </div>
          </div>
          {list.length > 0 ? (
            <RecentBookingsTable items={list} />
          ) : (
            <div className="px-6 pb-10 pt-6 text-center text-sm text-slate-500 2xl:px-8">Chưa có đơn phụ trách</div>
          )}
        </Card>

        <div className="space-y-6 2xl:space-y-7 xl:col-span-4">
          <Card className="!p-6 2xl:!p-8">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2 text-base">
                  <CalendarDays className="h-5 w-5 text-orange-600" />
                  Lịch tuần · Tháng {String(calendar.month + 1).padStart(2, '0')}/{calendar.year}
                </span>
              }
              subtitle="Các mốc thời gian quan trọng cần nhớ"
            />
            <div className="mt-5">
              <MiniCalendar events={calendarEvents} month={calendar.month} today={calendar.today} year={calendar.year} />
            </div>
          </Card>

          <Card className="!p-6 2xl:!p-8">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2 text-base">
                  <PhoneCall className="h-5 w-5 text-rose-600" />
                  Công việc hôm nay
                </span>
              }
              subtitle="Checklist theo ca vận hành sáng / chiều"
            />
            <div className="mt-5">
              <ActivityTimeline items={[]} emptyText="Chưa có công việc - hãy vào trang Bookings xử lý đơn HOT" />
            </div>
          </Card>
        </div>
      </div>

      <Card className="!p-6 2xl:!p-8">
        <SectionTitle
          title={
            <span className="inline-flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-blue-600" />
              Lượng khách bạn xử lý 7 ngày
            </span>
          }
          subtitle="Tổng số hành khách theo các đơn bạn phụ trách"
        />
        <div className="mt-5 w-full">
          <RevenueLineChart currencySuffix=" khách" data={lineData} height={300} />
        </div>
      </Card>
    </div>
  )
}
