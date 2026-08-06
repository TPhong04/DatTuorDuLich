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
  CalendarEvent,
  DashboardRecentBooking,
  DashboardSummary,
  fetchStaffDashboardSummary,
} from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'
import { formatInt, formatMoney, formatVNDShort } from '@/utils/format'

const demoStaffBookings: DashboardRecentBooking[] = [
  {
    id: 'bk-s1', code: 'BK-VNEX-24080702', status: 'pending', paymentStatus: 'unpaid', totalAmount: 16_170_000,
    adultCount: 2, childCount: 2, infantCount: 0, departureDate: '2026-09-05', departureStandardText: '05/09/2026 · Đà Lạt · 8 chỗ còn',
    createdAt: '2026-08-07T05:18:00.000Z',
    tour: { title: 'Đà Lạt 4N3Đ Nhà thờ Con Gà - Đỉnh Langbiang', slug: 'da-lat-4n3d', code: 'T-DLT-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Lê Minh Khôi', phone: '0938 111 222', email: 'khoi.le@startup.vn' },
  },
  {
    id: 'bk-s2', code: 'BK-VNEX-24080706', status: 'pending', paymentStatus: 'unpaid', totalAmount: 31_020_000,
    adultCount: 6, childCount: 0, infantCount: 0, departureDate: '2026-09-19', departureStandardText: '19/09/2026 · Hà Giang · 4 chỗ còn',
    createdAt: '2026-08-07T08:20:00.000Z',
    tour: { title: 'Hà Giang Loop 4N3Đ Đèo Mã Pí Lèng', slug: 'ha-giang-4n3d', code: 'T-HG-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Đoàn Khánh Linh', phone: '0977 200 800', email: 'linh.doan@design.vn' },
  },
  {
    id: 'bk-s3', code: 'BK-VNEX-24080704', status: 'new', paymentStatus: 'partial', totalAmount: 31_240_000,
    adultCount: 10, childCount: 0, infantCount: 0, departureDate: '2026-08-14', departureStandardText: '14/08/2026 · Ninh Bình · 20 chỗ',
    createdAt: '2026-08-07T07:02:00.000Z',
    tour: { title: 'Ninh Bình 2N1Đ Tràng An - Múa Caves', slug: 'ninh-binh-2n1d', code: 'T-NB-02', durationDays: 2, durationNights: 1, coverImageUrl: null },
    contact: { name: 'Văn phòng TNHH Alpha', phone: '0243 888 000', email: 'hr@alpha.vn' },
  },
  {
    id: 'bk-s4', code: 'BK-VNEX-24080705', status: 'confirmed', paymentStatus: 'paid', totalAmount: 19_525_000,
    adultCount: 5, childCount: 0, infantCount: 0, departureDate: '2026-09-12', departureStandardText: '12/09/2026 · Miền Tây · 15 chỗ còn',
    createdAt: '2026-08-06T09:55:00.000Z',
    tour: { title: 'Miền Tây 3N2Đ Cần Thơ - Phú Quốc (Combo Xe+Máy Bay)', slug: 'mien-tay-3n2d', code: 'T-MT-03', durationDays: 3, durationNights: 2, coverImageUrl: null },
    contact: { name: 'Vũ Thị Lan', phone: '0915 666 333', email: 'lan.vu@retail.com' },
  },
  {
    id: 'bk-s5', code: 'BK-VNEX-24080703', status: 'confirmed', paymentStatus: 'paid', totalAmount: 23_430_000,
    adultCount: 3, childCount: 0, infantCount: 1, departureDate: '2026-08-21', departureStandardText: '21/08/2026 · Phú Quốc · 3 chỗ còn HOT',
    createdAt: '2026-08-06T22:41:00.000Z',
    tour: { title: 'Phú Quốc 5N4Đ Vinpearl Safari', slug: 'phu-quoc-5n4d', code: 'T-PQ5-05', durationDays: 5, durationNights: 4, coverImageUrl: null },
    contact: { name: 'Trần Hồng Hạnh', phone: '0903 777 999', email: 'hanh.tran@family.vn' },
  },
  {
    id: 'bk-s6', code: 'BK-VNEX-24080601', status: 'completed', paymentStatus: 'paid', totalAmount: 10_560_000,
    adultCount: 2, childCount: 0, infantCount: 0, departureDate: '2026-07-31', departureStandardText: '31/07/2026 · Trung du',
    createdAt: '2026-07-28T03:10:00.000Z',
    tour: { title: 'Huế - Hội An - Đà Nẵng 4N3Đ', slug: 'hue-hoi-an-dn-4n3d', code: 'T-HHD-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Phạm Ngọc Sơn', phone: '0989 123 456', email: 'son.pham@gmail.com' },
  },
]

const demoLine = [
  { label: 'Thứ 2', value: 8 },
  { label: 'Thứ 3', value: 14 },
  { label: 'Thứ 4', value: 11 },
  { label: 'Thứ 5', value: 19 },
  { label: 'Thứ 6', value: 23 },
  { label: 'Thứ 7', value: 31 },
  { label: 'Chủ nhật', value: 27 },
]

const demoCalendarEvents: CalendarEvent[] = [
  { day: 8, tone: 'orange', label: 'Gọi xác nhận BK-VNEX-24080702' },
  { day: 14, tone: 'blue', label: 'Khởi hành đoàn Alpha Ninh Bình' },
  { day: 21, tone: 'blue', label: 'Khởi hành Phú Quốc (HOT 3 chỗ)' },
  { day: 22, tone: 'emerald', label: 'Check tour Phú Quốc - gọi hỏi khách' },
]

const demoTasks = [
  { time: '09:30', tone: 'orange' as const, title: '📞 Gọi xác nhận Đà Lạt BK-VNEX-24080702', desc: 'Khách Lê Minh Khôi - Hạn giữ chỗ 12:00 08/08' },
  { time: '10:30', tone: 'blue' as const, title: '📧 Gửi hợp đồng đoàn TNHH Alpha Ninh Bình', desc: '10 người - 14/08 - Thanh toán 50%' },
  { time: '14:00', tone: 'emerald' as const, title: '✅ Check-in khách Phú Quốc 21/08 đã nhận', desc: '3 khách + 1 em bé - Đã thanh toán online 100%' },
  { time: '15:30', tone: 'rose' as const, title: '⚠️ Hà Giang 19/09 - Còn 4 chỗ HOT', desc: 'Liên hệ khách hàng Group Tour 15 người - ưu tiên sắp xếp' },
]

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

  const used = useMemo(() => data ?? null, [data])
  const fallback = !used

  const list = useMemo(() => {
    if (used && used.recentBookings.length > 0) return mapRecentToBooking(used.recentBookings)
    return mapRecentToBooking(demoStaffBookings)
  }, [used])

  const stats = useMemo(() => {
    const pending = Math.max(5, list.filter((b) => b.status === 'new' || b.status === 'pending').length)
    const confirmed = Math.max(2, list.filter((b) => b.status === 'confirmed' || b.status === 'in_progress').length)
    const pax = Math.max(28, list.reduce((s, b) => s + b.adultCount + b.childCount + b.infantCount, 0))
    const rev = Math.max(75_000_000, list.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.totalAmount, 0))
    return { pending, confirmed, pax, rev }
  }, [list])

  const lineData = used && used.line7Days.length ? used.line7Days : demoLine
  const calendarEvents = used && used.calendarEvents.length ? used.calendarEvents : demoCalendarEvents
  const calendar = used?.calendar ?? { year: today.getFullYear(), month: today.getMonth(), today: today.getDate() }

  return (
    <div className="space-y-6 2xl:space-y-7">
      <Card className="!p-4 2xl:!p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-blue-600 text-white shadow-lg shadow-orange-500/20 ring-4 ring-orange-50 2xl:h-14 2xl:w-14">
              <Wrench className="h-6 w-6 2xl:h-7 2xl:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-50 to-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ring-orange-200/60 text-orange-700">
                  <Sparkles className="h-3 w-3" /> VẬN HÀNH · Staff Panel
                </span>
                {error ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-rose-200 text-rose-700">
                    {error} · Dữ liệu mẫu
                  </span>
                ) : loading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-blue-200 text-blue-700">
                    <RefreshCcw className="h-3 w-3 animate-spin" /> Đồng bộ dữ liệu staff từ DB...
                  </span>
                ) : fallback ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-amber-200 text-amber-700">
                    DB chưa có đơn · Dữ liệu mẫu
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-emerald-200 text-emerald-700">
                    Đơn bạn phụ trách từ DB
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl 2xl:text-3xl">
                DASHBOARD VẬN HÀNH BOOKING
              </h1>
              <div className="mt-1 text-xs 2xl:text-sm text-slate-500">
                Khoảng ngày {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())} ·{' '}
                <span className="inline-flex items-center gap-1 font-bold text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.2)]" /> Online
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs shadow-sm 2xl:h-11 md:inline-flex">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-700 2xl:text-sm">
                {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())}
              </span>
            </div>
            <Link
              className="inline-flex h-10 items-center gap-2 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 px-3.5 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 2xl:h-11"
              to="/staff/bookings"
            >
              <ListChecks className="h-4 w-4" />
              Mở Bookings
            </Link>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] 2xl:h-11"
              onClick={refresh}
              type="button"
            >
              <RefreshCcw className={cn('h-4 w-4 text-blue-600', loading && 'animate-spin')} />
              Làm mới
            </button>
            <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm 2xl:h-11 2xl:w-11">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
                5
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:gap-5 xl:grid-cols-4">
        <KpiCard
          label="Đơn chờ xử lý (HOT)"
          value={formatInt(stats.pending)}
          sub="Ưu tiên gọi xác nhận ngay"
          tone="rose"
          icon={<PhoneCall className="h-5 w-5" />}
          onClick={() => (window.location.href = '/staff/bookings?status=pending')}
        />
        <KpiCard
          label="Đã xác nhận"
          value={formatInt(stats.confirmed)}
          sub="Chuẩn bị tài liệu / thông báo"
          tone="blue"
          trend="up"
          trendPct={8.3}
          icon={<BookOpenCheck className="h-5 w-5" />}
        />
        <KpiCard
          label="Hành khách phụ trách"
          value={formatInt(stats.pax)}
          sub={`${list.length} đơn trong danh sách gần nhất`}
          tone="emerald"
          trend="up"
          trendPct={14.7}
          icon={<Users2 className="h-5 w-5" />}
        />
        <KpiCard
          label="Doanh thu phụ trách"
          value={formatMoney(stats.rev)}
          sub={`Tổng ${formatVNDShort(stats.rev)} chưa tính đơn hủy`}
          tone="orange"
          trend="up"
          trendPct={11.2}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:gap-5 xl:grid-cols-12">
        <Card className="!p-0 xl:col-span-8 overflow-hidden">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 p-5 pb-4 2xl:p-6">
            <div>
              <SectionTitle
                title={<>Đơn đặt Tour phụ trách của bạn</>}
                subtitle={`${list.length} đơn gần nhất · Click 🔍 Chi tiết ở trang Bookings để xử lý từng đơn ${loading ? '(đang đồng bộ DB)' : fallback ? '(dữ liệu mẫu khi chưa có đơn assigned)' : '(từ DB thực tế)'}`}
                action={
                  <Link
                    className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-blue-800 2xl:h-10"
                    to="/staff/bookings"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Xem đầy đủ
                  </Link>
                }
              />
            </div>
          </div>
          <RecentBookingsTable items={list} />
        </Card>

        <div className="space-y-4 2xl:space-y-5 xl:col-span-4">
          <Card className="2xl:p-6">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-orange-600" />
                  Lịch tuần · Tháng {String(calendar.month + 1).padStart(2, '0')}/{calendar.year}
                </span>
              }
              subtitle="Các mốc thời gian quan trọng cần nhớ"
            />
            <div className="mt-4">
              <MiniCalendar
                events={calendarEvents}
                month={calendar.month}
                today={calendar.today}
                year={calendar.year}
              />
            </div>
          </Card>

          <Card className="2xl:p-6">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <PhoneCall className="h-4 w-4 text-rose-600" />
                  Công việc hôm nay
                </span>
              }
              subtitle="Checklist theo ca vận hành sáng / chiều"
            />
            <div className="mt-4">
              <ActivityTimeline items={demoTasks} />
            </div>
          </Card>
        </div>
      </div>

      <Card className="2xl:p-6">
        <SectionTitle
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600" />
              Lượng khách bạn xử lý 7 ngày
            </span>
          }
          subtitle="Tổng số hành khách theo các đơn bạn phụ trách"
        />
        <div className="mt-4 max-w-4xl">
          <RevenueLineChart currencySuffix=" khách" data={lineData} height={260} />
        </div>
      </Card>
    </div>
  )
}
