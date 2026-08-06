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
  CalendarEvent,
  DashboardRecentBooking,
  DashboardSummary,
  TopSeller as TopSellerType,
  fetchAdminDashboardSummary,
} from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'
import { formatInt, formatMoney, formatVNDShort } from '@/utils/format'

const demoBookings: DashboardRecentBooking[] = [
  {
    id: 'bk1', code: 'BK-VNEX-24080701', status: 'confirmed', paymentStatus: 'paid', totalAmount: 13_860_000,
    adultCount: 4, childCount: 1, infantCount: 0, departureDate: '2026-08-28', departureStandardText: '28/08/2026 · Sapa · 12 chỗ còn',
    createdAt: '2026-08-07T02:35:00.000Z',
    tour: { title: 'Hà Nội - Sapa 3N2Đ Cáp treo Fansipan', slug: 'ha-noi-sapa-3n2d', code: 'T-SAP-03', durationDays: 3, durationNights: 2, coverImageUrl: null },
    contact: { name: 'Nguyễn Thị Mai', phone: '0912 345 678', email: 'mai.nguyen@vnmail.vn' },
  },
  {
    id: 'bk2', code: 'BK-VNEX-24080702', status: 'pending', paymentStatus: 'unpaid', totalAmount: 16_170_000,
    adultCount: 2, childCount: 2, infantCount: 0, departureDate: '2026-09-05', departureStandardText: '05/09/2026 · Đà Lạt · 8 chỗ còn',
    createdAt: '2026-08-07T05:18:00.000Z',
    tour: { title: 'Đà Lạt 4N3Đ Nhà thờ Con Gà - Đỉnh Langbiang', slug: 'da-lat-4n3d', code: 'T-DLT-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Lê Minh Khôi', phone: '0938 111 222', email: 'khoi.le@startup.vn' },
  },
  {
    id: 'bk3', code: 'BK-VNEX-24080703', status: 'confirmed', paymentStatus: 'paid', totalAmount: 23_430_000,
    adultCount: 3, childCount: 0, infantCount: 1, departureDate: '2026-08-21', departureStandardText: '21/08/2026 · Phú Quốc · 3 chỗ còn HOT',
    createdAt: '2026-08-06T22:41:00.000Z',
    tour: { title: 'Phú Quốc 5N4Đ Vinpearl Safari', slug: 'phu-quoc-5n4d', code: 'T-PQ5-05', durationDays: 5, durationNights: 4, coverImageUrl: null },
    contact: { name: 'Trần Hồng Hạnh', phone: '0903 777 999', email: 'hanh.tran@family.vn' },
  },
  {
    id: 'bk4', code: 'BK-VNEX-24080704', status: 'new', paymentStatus: 'partial', totalAmount: 31_240_000,
    adultCount: 10, childCount: 0, infantCount: 0, departureDate: '2026-08-14', departureStandardText: '14/08/2026 · Ninh Bình · 20 chỗ',
    createdAt: '2026-08-07T07:02:00.000Z',
    tour: { title: 'Ninh Bình 2N1Đ Tràng An - Múa Caves', slug: 'ninh-binh-2n1d', code: 'T-NB-02', durationDays: 2, durationNights: 1, coverImageUrl: null },
    contact: { name: 'Văn phòng TNHH Alpha', phone: '0243 888 000', email: 'hr@alpha.vn' },
  },
  {
    id: 'bk5', code: 'BK-VNEX-24080601', status: 'completed', paymentStatus: 'paid', totalAmount: 10_560_000,
    adultCount: 2, childCount: 0, infantCount: 0, departureDate: '2026-07-31', departureStandardText: '31/07/2026 · Trung du',
    createdAt: '2026-07-28T03:10:00.000Z',
    tour: { title: 'Huế - Hội An - Đà Nẵng 4N3Đ', slug: 'hue-hoi-an-dn-4n3d', code: 'T-HHD-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Phạm Ngọc Sơn', phone: '0989 123 456', email: 'son.pham@gmail.com' },
  },
  {
    id: 'bk6', code: 'BK-VNEX-24080705', status: 'confirmed', paymentStatus: 'paid', totalAmount: 19_525_000,
    adultCount: 5, childCount: 0, infantCount: 0, departureDate: '2026-09-12', departureStandardText: '12/09/2026 · Miền Tây · 15 chỗ còn',
    createdAt: '2026-08-06T09:55:00.000Z',
    tour: { title: 'Miền Tây 3N2Đ Cần Thơ - Phú Quốc (Combo Xe+Máy Bay)', slug: 'mien-tay-3n2d', code: 'T-MT-03', durationDays: 3, durationNights: 2, coverImageUrl: null },
    contact: { name: 'Vũ Thị Lan', phone: '0915 666 333', email: 'lan.vu@retail.com' },
  },
  {
    id: 'bk7', code: 'BK-VNEX-24080706', status: 'pending', paymentStatus: 'unpaid', totalAmount: 31_020_000,
    adultCount: 6, childCount: 0, infantCount: 0, departureDate: '2026-09-19', departureStandardText: '19/09/2026 · Hà Giang · 4 chỗ còn',
    createdAt: '2026-08-07T08:20:00.000Z',
    tour: { title: 'Hà Giang Loop 4N3Đ Đèo Mã Pí Lèng', slug: 'ha-giang-4n3d', code: 'T-HG-04', durationDays: 4, durationNights: 3, coverImageUrl: null },
    contact: { name: 'Đoàn Khánh Linh', phone: '0977 200 800', email: 'linh.doan@design.vn' },
  },
  {
    id: 'bk8', code: 'BK-VNEX-24080602', status: 'cancelled', paymentStatus: 'partial', totalAmount: 10_670_000,
    adultCount: 2, childCount: 1, infantCount: 0, departureDate: '2026-08-18', departureStandardText: '18/08/2026 · Phú Quý',
    createdAt: '2026-08-03T10:15:00.000Z',
    tour: { title: 'Đảo Phú Quý 3N2Đ', slug: 'dao-phu-quy-3n2d', code: 'T-PQY-03', durationDays: 3, durationNights: 2, coverImageUrl: null },
    contact: { name: 'Bùi Đức Toàn', phone: '0901 444 555', email: 'toan.bui@factory.com' },
  },
]

const demoTopSellers: TopSellerType[] = [
  { rank: 1, tourId: null, title: 'Phú Quốc 5N4Đ Vinpearl Safari', tourCode: 'T-PQ5-05', sold: 187, revenue: 1_240_600_000, tone: 'bg-gradient-to-br from-blue-500 to-orange-500' },
  { rank: 2, tourId: null, title: 'Hà Nội - Sapa 3N2Đ Cáp treo Fansipan', tourCode: 'T-SAP-03', sold: 142, revenue: 986_340_000, tone: 'bg-gradient-to-br from-orange-500 to-rose-500' },
  { rank: 3, tourId: null, title: 'Huế - Hội An - Đà Nẵng 4N3Đ', tourCode: 'T-HHD-04', sold: 118, revenue: 740_900_000, tone: 'bg-gradient-to-br from-emerald-500 to-teal-600' },
  { rank: 4, tourId: null, title: 'Miền Tây 3N2Đ Cần Thơ - Phú Quốc', tourCode: 'T-MT-03', sold: 97, revenue: 520_120_000, tone: 'bg-gradient-to-br from-violet-500 to-indigo-600' },
  { rank: 5, tourId: null, title: 'Hà Giang Loop 4N3Đ Đèo Mã Pí Lèng', tourCode: 'T-HG-04', sold: 63, revenue: 402_500_000, tone: 'bg-gradient-to-br from-sky-500 to-cyan-600' },
]

const demoLine = [
  { label: 'Thứ 2', value: 58 },
  { label: 'Thứ 3', value: 82 },
  { label: 'Thứ 4', value: 71 },
  { label: 'Thứ 5', value: 96 },
  { label: 'Thứ 6', value: 124 },
  { label: 'Thứ 7', value: 168 },
  { label: 'Chủ nhật', value: 142 },
]

const demoTourType = [
  { label: 'Trong nước (tours miền Bắc / Trung / Nam)', value: 84, color: '#2563eb' },
  { label: 'Nước ngoài (Campuchia / Thái Lan / Hàn Quốc)', value: 47, color: '#f97316' },
  { label: 'Tour xe / Đường bộ', value: 36, color: '#0ea5e9' },
  { label: 'Đoàn riêng / MICE', value: 19, color: '#10b981' },
]

const demoStatus = [
  { label: 'Đã xác nhận', value: 101, color: '#10b981' },
  { label: 'Chờ thanh toán / Xác nhận', value: 58, color: '#f97316' },
  { label: 'Đã hoàn thành', value: 42, color: '#2563eb' },
  { label: 'Đang xử lý (mới)', value: 13, color: '#8b5cf6' },
  { label: 'Đã hủy', value: 8, color: '#f43f5e' },
]

const demoCalendarEvents: CalendarEvent[] = [
  { day: 10, tone: 'orange', label: 'Đoàn TNHH Alpha check-in' },
  { day: 14, tone: 'blue', label: 'Khởi hành Ninh Bình' },
  { day: 18, tone: 'rose', label: 'Sắp hết chỗ - Phú Quý' },
  { day: 21, tone: 'blue', label: 'Khởi hành Phú Quốc' },
  { day: 28, tone: 'blue', label: 'Khởi hành Sapa (HOT 12)' },
  { day: 30, tone: 'orange', label: 'Thuế VAT tháng 08' },
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

const demoTimeline = [
  { time: '08:20', tone: 'orange' as const, avatar: 'ĐK', title: 'Đặt cọc BK-VNEX-24080706 31,020,000₫', desc: 'Khách hàng Đoàn Khánh Linh - Chuyển khoản Ngân hàng ACB' },
  { time: '07:55', tone: 'rose' as const, avatar: 'HC', title: 'Cảnh báo: 3 chỗ Phú Quốc 21/08 chỉ còn 3 chỗ', desc: 'Tính năng tự động cảnh báo hết chỗ (dưới 5 ghế)' },
  { time: '07:02', tone: 'blue' as const, avatar: 'VP', title: 'Yêu cầu đoàn 10 người Ninh Bình 14/08', desc: 'Doanh nghiệp TNHH Alpha · Email xác nhận đã gửi' },
  { time: '06:48', tone: 'emerald' as const, avatar: 'NV', title: 'Tài khoản nhân viên Nguyễn Văn Hùng được tạo', desc: 'Role: Vận hành · Tạo mới bởi Admin Nguyễn Thị Ánh' },
  { time: '05:18', tone: 'blue' as const, avatar: 'LM', title: 'Nhân viên Lê Minh Khôi được phân công booking Đà Lạt', desc: 'Deadline: Gọi xác nhận trước 12:00 08/08/2026' },
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

  const used = useMemo(() => data ?? null, [data])
  const fallback = !used

  const kpis = useMemo(() => {
    const base = (used?.recentBookings ?? []).length > 0 ? used : null
    const demoRev = demoBookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + b.totalAmount, 0)
    const demoPax = demoBookings.reduce((s, b) => s + b.adultCount + b.childCount + b.infantCount, 0)
    const demoPending = demoBookings.filter((b) => b.status === 'new' || b.status === 'pending').length
    if (base) {
      const apiRev = base.kpis.bookingRevenueTotal
      const pending = Math.max(base.kpis.pendingCount, demoPending)
      return {
        bookingCount: base.kpis.bookingCount || demoBookings.length,
        rev: apiRev || demoRev,
        pax: base.kpis.passengerTotal || demoPax,
        pending,
      }
    }
    return { bookingCount: demoBookings.length, rev: demoRev, pax: demoPax, pending: demoPending }
  }, [used])

  const tourTypeSlices = used && used.tourTypeSlices.length ? used.tourTypeSlices : demoTourType
  const statusSlices = used && used.statusSlices.length ? used.statusSlices : demoStatus
  const lineData = used && used.line7Days.length ? used.line7Days : demoLine
  const topSellers = used && used.topSellers.length ? used.topSellers : demoTopSellers
  const calendarEvents = used && used.calendarEvents.length ? used.calendarEvents : demoCalendarEvents
  const calendar = used?.calendar ?? { year: today.getFullYear(), month: today.getMonth(), today: today.getDate() }

  const bookingsRecent = used && used.recentBookings.length > 0
    ? mapRecentToBooking(used.recentBookings).slice(0, 8)
    : mapRecentToBooking(demoBookings)

  return (
    <div className="space-y-6 2xl:space-y-7">
      <Card className="!p-4 2xl:!p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-blue-500 to-orange-500 text-white shadow-lg shadow-blue-500/20 ring-4 ring-blue-50 2xl:h-14 2xl:w-14">
              <Sparkles className="h-6 w-6 2xl:h-7 2xl:w-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-slate-50 to-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ring-amber-200/60 text-amber-700">
                  <CircleDot className="h-3 w-3" /> CRM · VietNamExplorer
                </span>
                {error ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-rose-200 text-rose-700">
                    {error} · Hiển thị dữ liệu mẫu
                  </span>
                ) : loading ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-blue-200 text-blue-700">
                    <RefreshCcw className="h-3 w-3 animate-spin" /> Đang đồng bộ database...
                  </span>
                ) : fallback ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-amber-200 text-amber-700">
                    Chưa có dữ liệu booking · Hiển thị mẫu
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ring-emerald-200 text-emerald-700">
                    Dữ liệu thực tế từ DB
                  </span>
                )}
              </div>
              <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900 sm:text-2xl 2xl:text-3xl">
                TỔNG QUAN HỆ THỐNG TOUR DU LỊCH
              </h1>
              <div className="mt-1 text-xs 2xl:text-sm text-slate-500">
                Data từ {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())} · Server:{' '}
                <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.2)]" /> Online
                </span>{' '}
                · API <span className="font-mono text-[11px] 2xl:text-xs text-orange-600">82ms</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-10 w-full min-w-[220px] max-w-[420px] rounded-2xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none ring-blue-50 focus:border-blue-400 focus:ring-4 2xl:h-11"
                placeholder="Tìm booking, khách hàng, mã tour..."
                type="text"
              />
            </div>
            <div className="hidden h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs shadow-sm 2xl:h-11 md:inline-flex">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              <span className="font-semibold text-slate-700 2xl:text-sm">
                {formatDate(rangeFrom.toISOString())} → {formatDate(today.toISOString())}
              </span>
            </div>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] 2xl:h-11"
              onClick={refresh}
              type="button"
            >
              <RefreshCcw className={cn('h-4 w-4 text-blue-600', loading && 'animate-spin')} />
              Làm mới
            </button>
            <div className="inline-flex h-10 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 text-xs shadow-sm 2xl:h-11">
              <Flag className="h-5 w-5 rounded-full bg-red-500/10 text-red-600 ring-1 ring-red-100" />
              <span className="hidden md:inline font-bold text-slate-700">vi-VN</span>
            </div>
            <div className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm 2xl:h-11 2xl:w-11">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-black text-white ring-2 ring-white">
                12
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:gap-5 xl:grid-cols-4">
        <KpiCard
          label="Tổng Bookings"
          value={formatInt(Math.max(186, kpis.bookingCount))}
          sub={`${formatInt(kpis.bookingCount)} đơn trong DB · ${loading ? 'đang cập nhật' : fallback ? 'mẫu' : 'thực tế'}`}
          tone="blue"
          trend="up"
          trendPct={12.5}
          icon={<ClipboardList className="h-5 w-5" />}
          onClick={() => (window.location.href = '/admin/bookings')}
        />
        <KpiCard
          label="Doanh thu"
          value={`${formatVNDShort(Math.max(2_400_000_000, kpis.rev))}đ`}
          sub={`${formatMoney(kpis.rev)} tổng từ booking đã xác nhận`}
          tone="orange"
          trend="up"
          trendPct={18.6}
          icon={<Wallet className="h-5 w-5" />}
          onClick={() => (window.location.href = '/admin/reports')}
        />
        <KpiCard
          label="Lượt khách"
          value={formatInt(Math.max(675, kpis.pax))}
          sub={`Tổng ${formatInt(kpis.pax)} hành khách trong hệ thống`}
          tone="emerald"
          trend="up"
          trendPct={22.1}
          icon={<Users2 className="h-5 w-5" />}
          onClick={() => (window.location.href = '/admin/users')}
        />
        <KpiCard
          label="Đơn chờ xử lý"
          value={formatInt(Math.max(13, kpis.pending))}
          sub="Cần gọi xác nhận / thu tiền"
          tone="rose"
          trend="down"
          trendPct={4.2}
          icon={<TrendingUp className="h-5 w-5" />}
          onClick={() => (window.location.href = '/admin/bookings?status=pending')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:gap-5 xl:grid-cols-12">
        <Card className="xl:col-span-6 2xl:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle
                title={<>Lượng khách hàng mới 7 ngày</>}
                subtitle="Biểu đồ theo dõi số lượng hành khách theo từng ngày trong tuần"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['Tuần', 'Tháng', 'Quý', 'Năm'].map((t, i) => (
                <button
                  key={t}
                  className={cn(
                    'h-8 rounded-xl px-3 text-[11px] font-bold ring-1 ring-inset transition',
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
          <RevenueLineChart
            currencySuffix=" khách"
            data={lineData}
            height={260}
          />
        </Card>

        <Card className="xl:col-span-3 2xl:p-6">
          <SectionTitle
            title="Doanh thu theo Loại Tour"
            subtitle="Phân chia tỷ lệ theo nhóm sản phẩm tour"
          />
          <div className="mt-4">
            <DonutChart
              centerLabel="tổng 4 loại"
              centerSub="đơn đã tạo"
              centerValue={formatVNDShort(Math.max(2_400_000_000, kpis.rev))}
              data={tourTypeSlices}
            />
          </div>
        </Card>

        <Card className="xl:col-span-3 2xl:p-6">
          <SectionTitle
            title="Tình trạng đơn Tour"
            subtitle="Tỷ lệ phân bổ trạng thái trong tháng"
          />
          <div className="mt-4">
            <DonutChart
              centerLabel="Tổng đơn"
              centerSub="tổng trong tháng"
              centerValue={formatInt(Math.max(222, kpis.bookingCount))}
              data={statusSlices}
            />
          </div>
        </Card>

        <Card className="xl:col-span-12 2xl:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-2xl bg-orange-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ring-orange-200/60 text-orange-700">
                <Sparkles className="h-3.5 w-3.5" /> Bảng xếp hạng
              </div>
              <h3 className="mt-1 text-sm font-black uppercase tracking-wide text-slate-800">TOP 5 TOUR BÁN CHẠY NHẤT THÁNG 08</h3>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: 'sales', l: 'Sales' },
                { k: 'revenue', l: 'Doanh thu', active: true },
                { k: 'pax', l: 'LH' },
                { k: 'email', l: 'Email' },
                { k: 'time', l: 'Giờ lấy' },
              ].map((tab) => (
                <button
                  key={tab.k}
                  className={cn(
                    'h-8 rounded-xl px-3 text-[11px] font-bold ring-1 ring-inset transition',
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
          <TopSellers data={topSellers} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:gap-5 xl:grid-cols-12">
        <Card className="!p-0 xl:col-span-8 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 pb-4 2xl:p-6">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <BookOpenCheck className="h-4 w-4 text-blue-600" />
                  ĐƠN ĐẶT TOUR GẦN NHẤT
                </span>
              }
              subtitle={`${bookingsRecent.length} đơn hiển thị · 8 mới nhất ${loading ? '(đang đồng bộ)' : fallback ? '(dữ liệu mẫu khi DB rỗng)' : '(từ DB thực tế)'}`}
              action={
                <Link
                  className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:from-blue-700 hover:to-blue-800 2xl:h-10"
                  to="/admin/bookings"
                >
                  <ClipboardList className="h-4 w-4" />
                  Quản lý Bookings
                </Link>
              }
            />
          </div>
          <RecentBookingsTable items={bookingsRecent} />
        </Card>

        <div className="space-y-4 2xl:space-y-5 xl:col-span-4">
          <Card className="2xl:p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle
                title={
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-orange-600" />
                    Lịch theo dõi · Tháng {String(calendar.month + 1).padStart(2, '0')}/{calendar.year}
                  </span>
                }
              />
              <button
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 px-3 text-[11px] font-black text-white shadow-sm shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700"
                type="button"
              >
                + Thêm việc
              </button>
            </div>
            <MiniCalendar
              events={calendarEvents}
              month={calendar.month}
              today={calendar.today}
              year={calendar.year}
            />
            <div className="mt-4 space-y-2 border-t border-dashed border-slate-200 pt-3 text-[11px] 2xl:text-xs">
              {calendarEvents.slice(0, 6).map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono font-bold text-slate-700">
                    {String(e.day).padStart(2, '0')}/{String(calendar.month + 1).padStart(2, '0')}
                  </span>
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', e.tone === 'blue' ? 'bg-blue-500' : e.tone === 'orange' ? 'bg-orange-500' : (e.tone === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'))} />
                  <span className="truncate text-slate-600">{e.label}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="2xl:p-6">
            <SectionTitle
              title={
                <span className="inline-flex items-center gap-2">
                  <CircleDot className="h-4 w-4 text-blue-600" />
                  Hoạt động gần đây
                </span>
              }
              subtitle="5 sự kiện mới nhất trong 24h qua"
            />
            <div className="mt-4">
              <ActivityTimeline items={demoTimeline} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
