import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Banknote,
  BarChart3,
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Compass,
  Filter,
  FileSpreadsheet,
  GripVertical,
  Mail,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Tag,
  TriangleAlert,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'

import PageHeader from '@/components/ui/PageHeader'
import { DonutChart, RevenueLineChart } from '@/components/dashboard/DashboardCharts'
import { KpiCard } from '@/components/dashboard/DashboardWidgets'
import {
  type BookingPaymentMethod,
  type BookingPaymentStatus,
  type BookingStatus,
  type FinancialReport,
  type FinancialReportBar,
  type FinancialReportPeriodPreset,
  type MonthlyAggRow,
  type OutstandingRow,
  type ReportBookingsGroupKey,
  type ReportBookingsPeriodPreset,
  type ReportBookingsResponse,
  type ReportBookingsRow,
  type ReportBookingsSortKey,
  fetchAdminFinancialReport,
  fetchAdminReportBookings,
} from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'
import { formatInt, formatMoney, formatVNDShort } from '@/utils/format'

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] animate-[shimmer_1.6s_infinite_linear]',
        className,
      )}
    />
  )
}

function KpiSkeleton({ tone = 'blue' }: { tone?: 'blue' | 'orange' | 'emerald' | 'rose' }) {
  const bgMap: Record<string, string> = {
    blue: 'from-blue-50 to-white via-white ring-blue-100',
    orange: 'from-orange-50 to-white via-white ring-orange-100',
    emerald: 'from-emerald-50 to-white via-white ring-emerald-100',
    rose: 'from-rose-50 to-white via-white ring-rose-100',
  }
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-sm ring-1 ring-inset',
        bgMap[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="w-32">
            <Shimmer className="h-3" />
          </div>
          <div className="w-[60%]">
            <Shimmer className="h-9 rounded-xl" />
          </div>
          <div className="w-[85%]">
            <Shimmer className="h-2.5" />
          </div>
        </div>
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-white ring-1 ring-slate-100">
          <Shimmer className="rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function ChartCardSkeleton({ withBars = false }: { withBars?: boolean }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
      <div className="mb-5 flex items-end justify-between">
        <div className="space-y-2">
          <div className="w-48">
            <Shimmer className="h-5 rounded-lg" />
          </div>
          <div className="w-72">
            <Shimmer className="h-2.5" />
          </div>
        </div>
        <div className="w-20">
          <Shimmer className="h-6 rounded-full" />
        </div>
      </div>
      {withBars ? (
        <div className="space-y-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <div className="w-32">
                  <Shimmer className="h-3 rounded-md" />
                </div>
                <div className="w-20">
                  <Shimmer className="h-3 rounded-md" />
                </div>
              </div>
              <div>
                <Shimmer className="h-3 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-2xl bg-slate-50 p-2">
          <Shimmer className="h-[240px] rounded-xl" />
        </div>
      )}
    </div>
  )
}

function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 md:grid-cols-8">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={`h-${i}`} className="col-span-1">
            <Shimmer className="h-3 rounded-md" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="grid grid-cols-4 items-center gap-3 md:grid-cols-8">
          {Array.from({ length: cols }).map((__, c) => (
            <div key={`c-${r}-${c}`} className="col-span-1">
              <Shimmer className="h-4 rounded-md" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function MonthlyTableSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-56">
            <Shimmer className="h-5 rounded-lg" />
          </div>
          <div className="w-80">
            <Shimmer className="h-2.5" />
          </div>
        </div>
        <div className="w-36">
          <Shimmer className="h-7 rounded-full" />
        </div>
      </div>
      <TableSkeleton rows={13} cols={8} />
    </div>
  )
}

function OutstandingTableSkeleton() {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="w-64">
            <Shimmer className="h-5 rounded-lg" />
          </div>
          <div className="w-[30rem] max-w-full">
            <Shimmer className="h-2.5" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-36">
            <Shimmer className="h-7 rounded-full" />
          </div>
          <div className="w-36">
            <Shimmer className="h-7 rounded-full" />
          </div>
        </div>
      </div>
      <TableSkeleton rows={8} cols={10} />
    </div>
  )
}

const PRESETS: Array<{ key: FinancialReportPeriodPreset; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
  { key: 'custom', label: 'Tùy chỉnh' },
]

type ReportTabKey = 'financial' | 'bookings' | 'tours' | 'customers' | 'departures' | 'staff' | 'promotions'

const REPORTS_TABS: Array<{ key: ReportTabKey; label: string; icon: 'banknote' | 'receipt' | 'compass' | 'users' | 'calendar' | 'briefcase' | 'tag'; disabled?: boolean; disabledReason?: string }> = [
  { key: 'financial', label: 'Tổng quan tài chính', icon: 'banknote' },
  { key: 'bookings', label: 'Báo cáo bookings chi tiết', icon: 'receipt' },
  { key: 'tours', label: 'Hiệu suất tours', icon: 'compass', disabled: true, disabledReason: 'Tab 3 - Sắp lên' },
  { key: 'customers', label: 'CRM khách hàng', icon: 'users', disabled: true, disabledReason: 'Tab 4 - Sắp lên' },
  { key: 'departures', label: 'Lịch khởi hành / Fill rate', icon: 'calendar', disabled: true, disabledReason: 'Tab 5 - Sắp lên' },
  { key: 'staff', label: 'Hiệu suất nhân viên', icon: 'briefcase', disabled: true, disabledReason: 'Tab 6 - Sắp lên' },
  { key: 'promotions', label: 'Khuyến mãi / Marketing', icon: 'tag', disabled: true, disabledReason: 'Tab 7 - Sắp lên' },
]

const TOUR_TYPE_FILTERS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Tất cả loại tour' },
  { key: 'Trong nước', label: 'Trong nước' },
  { key: 'Nước ngoài', label: 'Nước ngoài' },
  { key: 'Đoàn riêng / MICE', label: 'Đoàn riêng / MICE' },
  { key: 'Tour xe / Đường bộ', label: 'Tour xe / Đường bộ' },
]

const STATUS_CHIP: Record<OutstandingRow['status'], { label: string; cls: string }> = {
  new: { label: 'Mới', cls: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200' },
  pending: { label: 'Chờ xác nhận', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  in_progress: { label: 'Đang đi', cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  cancelled: { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
}

const PMT_CHIP: Record<OutstandingRow['paymentStatus'], { label: string; cls: string }> = {
  unpaid: { label: 'Chưa thanh toán', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  partial: { label: 'Đã cọc', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  paid: { label: 'Đã thanh toán', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
}

function presetsToday(): { fromISO: string; toISO: string } {
  const d = new Date()
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { fromISO: iso, toISO: iso }
}
function presetMonth(): { fromISO: string; toISO: string } {
  const d = new Date()
  const year = d.getFullYear()
  const m = d.getMonth()
  const first = new Date(year, m, 1)
  const last = new Date(year, m + 1, 0)
  const toISO = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  return { fromISO: toISO(first), toISO: toISO(last) }
}

function RegionalBarChart({ bars }: { bars: FinancialReportBar[] }) {
  const max = Math.max(1, ...bars.map((b) => b.value))
  if (bars.length === 0) {
    return <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có dữ liệu theo vùng trong kỳ.</div>
  }
  return (
    <div className="space-y-3">
      {bars.map((b, i) => {
        const pct = Math.round((b.value / max) * 100)
        return (
          <div key={b.label + i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-700">
              <span className="truncate">{b.label}</span>
              <span className="shrink-0 font-bold text-slate-900">{formatVNDShort(b.value)}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: b.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MonthlyAggTable({ rows }: { rows: MonthlyAggRow[] }) {
  if (rows.length === 0) {
    return <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Chưa có dữ liệu tổng hợp theo tháng.</div>
  }
  const maxRev = Math.max(1, ...rows.map((r) => r.revenue))
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Tháng</th>
            <th className="px-3 py-2">Đơn</th>
            <th className="px-3 py-2">Hoàn thành</th>
            <th className="px-3 py-2">Hủy</th>
            <th className="px-3 py-2">Khách</th>
            <th className="px-3 py-2 w-[35%]">Doanh thu</th>
            <th className="px-3 py-2 text-right">AOV</th>
            <th className="px-3 py-2 text-right">Hủy %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const w = Math.round((r.revenue / maxRev) * 100)
            return (
              <tr key={r.key} className="group hover:bg-blue-50/40">
                <td className="px-3 py-2 font-semibold text-slate-900">{r.label}</td>
                <td className="px-3 py-2 text-slate-700">{formatInt(r.bookingCount)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                    <CheckCircle2 size={12} /> {formatInt(r.completedCount)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-100">
                    <XCircle size={12} /> {formatInt(r.cancelledCount)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-700">{formatInt(r.passengerTotal)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-blue-600 to-orange-500"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="w-24 shrink-0 text-right font-semibold text-slate-900">{formatVNDShort(r.revenue)}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-700">{formatMoney(r.aov)}</td>
                <td className={cn('px-3 py-2 text-right font-semibold', r.cancellationRate > 10 ? 'text-rose-600' : 'text-emerald-600')}>
                  {r.cancellationRate.toFixed(1)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function OutstandingTable({ rows }: { rows: OutstandingRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-5 text-sm ring-1 ring-emerald-100">
        <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
        <div className="text-emerald-800">
          <div className="font-semibold">Tuyệt vời!</div>
          <div className="text-emerald-700/90">Trong kỳ báo cáo không có đơn nào còn nợ tiền hoặc quá hạn thanh toán.</div>
        </div>
      </div>
    )
  }
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">Mã đơn</th>
            <th className="px-3 py-2">Khách hàng</th>
            <th className="px-3 py-2">Tour</th>
            <th className="px-3 py-2">Khởi hành</th>
            <th className="px-3 py-2">Tổng tiền</th>
            <th className="px-3 py-2">Đã thu</th>
            <th className="px-3 py-2">Còn nợ</th>
            <th className="px-3 py-2">TT đơn</th>
            <th className="px-3 py-2">Thanh toán</th>
            <th className="px-3 py-2">Quá hạn</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const status = STATUS_CHIP[r.status]
            const pmt = PMT_CHIP[r.paymentStatus]
            return (
              <tr key={r.id} className="group hover:bg-orange-50/40">
                <td className="px-3 py-2 font-mono text-xs font-bold text-blue-700">{r.code}</td>
                <td className="px-3 py-2">
                  <div className="font-semibold text-slate-900">{r.customer.name}</div>
                  <div className="text-xs text-slate-500">{r.customer.phone}</div>
                </td>
                <td className="px-3 py-2 min-w-[220px]">
                  <div className="font-medium text-slate-800 line-clamp-1">{r.tour.title}</div>
                  {r.tour.code ? <div className="text-xs text-slate-500 font-mono">{r.tour.code}</div> : null}
                </td>
                <td className="px-3 py-2 text-slate-700">{formatDate(r.departureDate)}</td>
                <td className="px-3 py-2 font-semibold text-slate-900">{formatMoney(r.totalAmount)}</td>
                <td className="px-3 py-2 font-medium text-emerald-700">{formatMoney(r.paidAmount)}</td>
                <td className="px-3 py-2">
                  <span className="font-extrabold text-rose-700">{formatMoney(r.outstandingAmount)}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', status.cls)}>{status.label}</span>
                </td>
                <td className="px-3 py-2">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', pmt.cls)}>{pmt.label}</span>
                </td>
                <td className="px-3 py-2">
                  {r.overdueDays > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                      <TriangleAlert size={12} /> {r.overdueDays} ngày
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function buildDemoFinancialReport(preset: FinancialReportPeriodPreset, fromISO: string, toISO: string): FinancialReport {
  const linePoints =
    preset === 'year' || preset === 'quarter'
      ? Array.from({ length: 12 }, (_, i) => ({
          key: `m${i}`,
          label: `T${String(i + 1).padStart(2, '0')}`,
          value: [38, 46, 52, 78, 92, 118, 148, 156, 132, 104, 84, 66][i] || 0,
        }))
      : Array.from({ length: 7 }, (_, i) => ({
          key: `d${i}`,
          label: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'][i],
          value: [42, 58, 74, 62, 96, 148, 124][i] || 0,
        }))
  return {
    period: { preset, fromISO, toISO },
    kpis: {
      bookingCountAll: 268,
      bookingCountCompleted: 230,
      bookingCountCancelled: 18,
      grossRevenue: 2_880_000_000,
      discountTotalEstimated: 86_000_000,
      netRevenue: 2_794_000_000,
      paidTotal: 2_235_000_000,
      partialPaidTotal: 312_000_000,
      unpaidTotal: 247_000_000,
      outstandingTotal: 559_000_000,
      passengerTotal: 986,
      passengerAdult: 723,
      passengerChild: 214,
      passengerInfant: 49,
      aovCompleted: 12_147_826,
      cancellationRate: 6.72,
      topTour: { tourId: 'demo', title: 'Phú Quốc 5N4Đ - Vinpearl Safari', tourCode: 'T-PQ5-05', revenue: 428_000_000 },
      overdueOutstandingTotal: 320_000_000,
      overdueCount: 12,
      paymentCompletionRate: 79.98,
    },
    revenueLine: linePoints,
    tourTypeSlices: [
      { label: 'Trong nước', value: 1_620_000_000, color: '#2563eb' },
      { label: 'Nước ngoài', value: 796_000_000, color: '#f97316' },
      { label: 'Đoàn riêng / MICE', value: 268_000_000, color: '#0ea5e9' },
      { label: 'Tour xe / Đường bộ', value: 110_000_000, color: '#10b981' },
    ],
    paymentMethodSlices: [
      { label: 'Chuyển khoản ngân hàng', value: 1_942_000_000, color: '#2563eb' },
      { label: 'Thanh toán online (VNPay/MoMo)', value: 669_000_000, color: '#10b981' },
      { label: 'Giữ chỗ / Tiền mặt tại VP', value: 183_000_000, color: '#f97316' },
    ],
    regionRevenueBars: [
      { label: 'Miền Bắc', value: 984_000_000, color: '#2563eb' },
      { label: 'Miền Nam', value: 846_000_000, color: '#f97316' },
      { label: 'Quốc tế', value: 560_000_000, color: '#8b5cf6' },
      { label: 'Miền Trung', value: 404_000_000, color: '#10b981' },
    ],
    monthly: Array.from({ length: 12 }, (_, i) => {
      const rev = [162, 148, 186, 224, 268, 312, 356, 392, 326, 268, 218, 186][i] * 1_000_000
      const count = Math.round(rev / 10_500_000)
      const cancelled = Math.round(count * (5 + (i % 5) * 0.6) / 100)
      return {
        key: `2026-${String(i + 1).padStart(2, '0')}`,
        label: `T${String(i + 1).padStart(2, '0')}/2026`,
        bookingCount: count,
        completedCount: Math.max(0, count - cancelled),
        cancelledCount: cancelled,
        revenue: rev,
        passengerTotal: Math.round(count * 3.6),
        aov: 10_500_000,
        cancellationRate: count === 0 ? 0 : (cancelled / count) * 100,
      }
    }),
    outstanding: [
      {
        id: 'd1',
        code: 'BK-VNEX-24080014',
        customer: { name: 'Nguyễn Thị Minh Anh', phone: '0912 345 678', email: 'anh@example.com' },
        tour: { title: 'Hà Giang Loop 4N3Đ - Mùa lúa chín', code: 'T-HG4-03' },
        departureDate: '2026-08-14',
        createdAt: '2026-07-20T10:20:00.000Z',
        totalAmount: 18_600_000,
        paidAmount: 0,
        outstandingAmount: 18_600_000,
        status: 'confirmed',
        paymentStatus: 'unpaid',
        holdsUntil: '2026-07-27T09:00:00.000Z',
        overdueDays: 11,
      },
      {
        id: 'd2',
        code: 'BK-VNEX-24080021',
        customer: { name: 'Trần Văn Hoàng', phone: '0934 987 654', email: null },
        tour: { title: 'Phú Quốc 5N4Đ - Khu nghỉ dưỡng Sang trọng', code: 'T-PQ5-05' },
        departureDate: '2026-08-16',
        createdAt: '2026-07-15T08:00:00.000Z',
        totalAmount: 76_400_000,
        paidAmount: 38_200_000,
        outstandingAmount: 38_200_000,
        status: 'confirmed',
        paymentStatus: 'partial',
        holdsUntil: '2026-07-30T09:00:00.000Z',
        overdueDays: 8,
      },
      {
        id: 'd3',
        code: 'BK-VNEX-24070113',
        customer: { name: 'Công ty TNHH Hữu Phát', phone: '024 3567 1234', email: 'huuphat@corp.vn' },
        tour: { title: 'Tour MICE - Hội nghị Khách sạn InterContinental Đà Nẵng 3N2Đ', code: 'T-DN3-08-M' },
        departureDate: '2026-08-10',
        createdAt: '2026-06-18T10:00:00.000Z',
        totalAmount: 268_800_000,
        paidAmount: 134_400_000,
        outstandingAmount: 134_400_000,
        status: 'pending',
        paymentStatus: 'partial',
        holdsUntil: '2026-08-01T09:00:00.000Z',
        overdueDays: 6,
      },
    ],
  }
}

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTabKey>('financial')
  const [preset, setPreset] = useState<FinancialReportPeriodPreset>('month')
  const { fromISO: fromISOInit, toISO: toISOInit } = useMemo(() => presetMonth(), [])
  const [fromISO, setFromISO] = useState<string>(fromISOInit)
  const [toISO, setToISO] = useState<string>(toISOInit)
  const [tourType, setTourType] = useState<string>('all')
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<FinancialReport | null>(null)
  const [stale, setStale] = useState(false)
  const nonceRef = useRef(0)
  const [showRefreshed, setShowRefreshed] = useState(0)

  // Tab 2 state
  const bNonceRef = useRef(0)
  const [bInitialLoading, setBInitialLoading] = useState(true)
  const [bStale, setBStale] = useState(false)
  const [bError, setBError] = useState<string | null>(null)
  const [bData, setBData] = useState<ReportBookingsResponse | null>(null)
  const [bPreset, setBPreset] = useState<ReportBookingsPeriodPreset>('month')
  const { fromISO: bFromInit, toISO: bToInit } = useMemo(() => presetMonth(), [])
  const [bFrom, setBFrom] = useState(bFromInit)
  const [bTo, setBTo] = useState(bToInit)
  const [bSearch, setBSearch] = useState('')
  const [bStatuses, setBStatuses] = useState<BookingStatus[]>([])
  const [bPaymentStatuses, setBPaymentStatuses] = useState<BookingPaymentStatus[]>([])
  const [bPassengerTypes, setBPassengerTypes] = useState<Array<'NL' | 'TE' | 'EB'>>([])
  const [bPaymentMethods, setBPaymentMethods] = useState<BookingPaymentMethod[]>([])
  const [bTourCategory, setBTourCategory] = useState<string>('all')
  const [bDepartureFrom, setBDepartureFrom] = useState<string>('')
  const [bDepartureTo, setBDepartureTo] = useState<string>('')
  const [bMinAmount, setBMinAmount] = useState<string>('')
  const [bMaxAmount, setBMaxAmount] = useState<string>('')
  const [bGroup, setBGroup] = useState<ReportBookingsGroupKey>('none')
  const [bSort, setBSort] = useState<ReportBookingsSortKey>('createdAt_desc')
  const [bPage, setBPage] = useState(1)
  const [bPageSize, setBPageSize] = useState<25 | 50 | 100>(25)
  const [bFilterOpen, setBFilterOpen] = useState(false)
  const [bSelectedIds, setBSelectedIds] = useState<Set<string>>(new Set())
  const [bShowAllSelect, setBShowAllSelect] = useState(false)

  const demo = useMemo(() => {
    const p = preset === 'custom' ? 'month' : preset
    return buildDemoFinancialReport(p, fromISO || fromISOInit, toISO || toISOInit)
  }, [preset, fromISO, toISO, fromISOInit, toISOInit])

  const used: FinancialReport = useMemo(() => {
    if (data && (data.monthly.length > 0 || data.revenueLine.some((x) => x.value > 0))) return data
    return demo
  }, [data, demo])

  const load = async () => {
    const nonce = (nonceRef.current += 1)
    if (initialLoading) {
      setInitialLoading(true)
    } else {
      setStale(true)
    }
    setError(null)
    try {
      const r = await fetchAdminFinancialReport({
        preset,
        from: fromISO,
        to: toISO,
        tourTypeCategory: tourType === 'all' ? undefined : tourType,
      })
      if (nonce !== nonceRef.current) return
      setData(r)
    } catch (e: any) {
      if (nonce !== nonceRef.current) return
      setError(e?.message || 'Không thể tải báo cáo')
    } finally {
      if (nonce !== nonceRef.current) return
      if (initialLoading) setInitialLoading(false)
      setStale(false)
      setShowRefreshed((s) => s + 1)
    }
  }

  const bLoad = async () => {
    const nonce = (bNonceRef.current += 1)
    if (bInitialLoading) setBInitialLoading(true)
    else setBStale(true)
    setBError(null)
    try {
      const minAmt = bMinAmount.trim() !== '' ? Number(bMinAmount.replace(/[^\d]/g, '')) : undefined
      const maxAmt = bMaxAmount.trim() !== '' ? Number(bMaxAmount.replace(/[^\d]/g, '')) : undefined
      const r = await fetchAdminReportBookings({
        preset: bPreset,
        from: bFrom,
        to: bTo,
        search: bSearch.trim() || undefined,
        statuses: bStatuses.length > 0 ? bStatuses : undefined,
        paymentStatuses: bPaymentStatuses.length > 0 ? bPaymentStatuses : undefined,
        passengerTypes: bPassengerTypes.length > 0 ? bPassengerTypes : undefined,
        paymentMethods: bPaymentMethods.length > 0 ? bPaymentMethods : undefined,
        tourTypeCategory: bTourCategory === 'all' ? undefined : bTourCategory,
        departureFrom: bDepartureFrom || undefined,
        departureTo: bDepartureTo || undefined,
        minAmount: typeof minAmt === 'number' && Number.isFinite(minAmt) ? minAmt : undefined,
        maxAmount: typeof maxAmt === 'number' && Number.isFinite(maxAmt) ? maxAmt : undefined,
        groupBy: bGroup,
        sort: bSort,
        page: bPage,
        pageSize: bPageSize,
      })
      if (nonce !== bNonceRef.current) return
      setBData(r)
      setBSelectedIds(new Set())
    } catch (e: any) {
      if (nonce !== bNonceRef.current) return
      setBError(e?.message || 'Không thể tải báo cáo bookings')
    } finally {
      if (nonce !== bNonceRef.current) return
      if (bInitialLoading) setBInitialLoading(false)
      setBStale(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, fromISO, toISO, tourType])

  useEffect(() => {
    if (activeTab !== 'bookings') return
    void bLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    bPreset,
    bFrom,
    bTo,
    bSearch,
    bStatuses,
    bPaymentStatuses,
    bPassengerTypes,
    bPaymentMethods,
    bTourCategory,
    bDepartureFrom,
    bDepartureTo,
    bMinAmount,
    bMaxAmount,
    bGroup,
    bSort,
    bPage,
    bPageSize,
  ])

  const k = used.kpis
  const isLoading = initialLoading || stale

  const dataStateBadge = useMemo(() => {
    if (initialLoading) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
          <RefreshCcw size={14} className="animate-spin" /> Đang tải dữ liệu…
        </span>
      )
    }
    if (stale) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <RefreshCcw size={14} className="animate-spin" /> Đang cập nhật kỳ…
        </span>
      )
    }
    if (error) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
          <TriangleAlert size={14} /> Lỗi kết nối API - đang hiển thị mẫu
        </span>
      )
    }
    if (!data || (data.monthly.length === 0 && data.revenueLine.every((x) => x.value === 0))) {
      return (
        <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200">
          <Sparkles size={14} /> DB chưa có đơn - đang hiển thị mẫu tham khảo
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
        <CheckCircle2 size={14} /> Dữ liệu thực tế từ DB
      </span>
    )
  }, [initialLoading, stale, error, data])

  return (
    <div className="space-y-6 2xl:space-y-7 [&>*]:animate-[fadeSlideIn_0.35s_ease-out]">
      <PageHeader
        title="Báo cáo"
        subtitle="7 tabs theo module CRM VietNamExplorer: Tài chính, Bookings, Tours, KH, Lịch KH, NV, Marketing."
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeTab === 'financial' ? dataStateBadge : null}
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white"
            >
              <RefreshCcw size={14} /> Làm mới
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-900/20 ring-1 ring-blue-900/10 hover:brightness-105"
            >
              <FileSpreadsheet size={14} /> Xuất Excel
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-900/20 ring-1 ring-orange-900/10 hover:brightness-105"
            >
              <Printer size={14} /> In / PDF
            </button>
          </div>
        }
      />

      {/* Tab bar: 7 tabs giống CRM TravelMaster */}
      <div className="overflow-x-auto rounded-3xl bg-white p-2 shadow-sm ring-1 ring-blue-100 2xl:p-3">
        <div className="flex min-w-max items-stretch gap-2">
          {REPORTS_TABS.map((tab) => {
            const iconMap: Record<typeof tab.icon, typeof Banknote> = {
              banknote: Banknote,
              receipt: Receipt,
              compass: Compass,
              users: Users,
              calendar: Calendar,
              briefcase: Briefcase,
              tag: Tag,
            }
            const Icon = iconMap[tab.icon] || Banknote
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                disabled={tab.disabled}
                title={tab.disabledReason || undefined}
                onClick={() => !tab.disabled && setActiveTab(tab.key)}
                className={cn(
                  'group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-extrabold tracking-wide ring-1 transition-all duration-200',
                  active
                    ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
                    : tab.disabled
                      ? 'cursor-not-allowed bg-slate-50 text-slate-400 ring-slate-100 hover:bg-slate-50'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 hover:text-slate-900',
                )}
              >
                <Icon
                  size={16}
                  className={cn(
                    'shrink-0 transition-transform duration-200',
                    !tab.disabled && !active && 'group-hover:-translate-y-0.5 group-hover:scale-110',
                  )}
                />
                <span className="whitespace-nowrap">{tab.label}</span>
                {tab.disabled ? <span className="ml-1 rounded-full bg-white/60 px-2 py-0.5 text-[9px] font-bold text-slate-500 ring-1 ring-slate-200/80">Sắp ra</span> : null}
              </button>
            )
          })}
        </div>
      </div>

      {activeTab === 'financial' ? (
        <>
          {/* Filter bar */}
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kỳ báo cáo</span>
                {PRESETS.map((p) => {
                  const active = preset === p.key
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        setPreset(p.key)
                        if (p.key === 'today') {
                          const t = presetsToday()
                          setFromISO(t.fromISO)
                          setToISO(t.toISO)
                        } else if (p.key === 'custom') {
                          // keep user date picker
                        } else {
                          const m = presetMonth()
                          setFromISO(m.fromISO)
                          setToISO(m.toISO)
                        }
                      }}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition',
                        active
                          ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
                          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Từ ngày</label>
                <input
                  type="date"
                  value={fromISO}
                  onChange={(e) => {
                    setFromISO(e.target.value)
                    if (preset !== 'custom') setPreset('custom')
                  }}
                  className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none"
                />
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">→ Đến</label>
                <input
                  type="date"
                  value={toISO}
                  onChange={(e) => {
                    setToISO(e.target.value)
                    if (preset !== 'custom') setPreset('custom')
                  }}
                  className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none"
                />
                <select
                  value={tourType}
                  onChange={(e) => setTourType(e.target.value)}
                  className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none"
                >
                  {TOUR_TYPE_FILTERS.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-orange-50 p-3 text-sm ring-1 ring-blue-100">
              <CalendarDays size={18} className="shrink-0 text-blue-700" />
              <div className="text-slate-700">
                Khoảng thời gian: <span className="font-bold text-slate-900">{formatDate(used.period.fromISO)}</span>
                {' → '}
                <span className="font-bold text-slate-900">{formatDate(used.period.toISO)}</span>
                <span className="mx-2 text-slate-300">·</span>
                <span className="font-semibold text-slate-700">Màu sắc:</span>{' '}
                <span className="font-bold text-blue-800">Xanh dương</span> tổng quan ·{' '}
                <span className="font-bold text-orange-600">Cam</span> doanh thu ·{' '}
                <span className="font-bold text-emerald-700">Xanh lá</span> hoàn thành ·{' '}
                <span className="font-bold text-rose-600">Đỏ</span> hủy / công nợ.
              </div>
            </div>
          </div>

          {/* 8 KPI 2 hàng */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:gap-6">
        <KpiCard
          tone="blue"
          label="Tổng đơn trong kỳ"
          value={formatInt(k.bookingCountAll)}
          sub={`${formatInt(k.bookingCountCompleted)} hoàn thành · ${formatInt(k.bookingCountCancelled)} hủy`}
          icon={<BarChart3 size={22} />}
        />
        <KpiCard
          tone="orange"
          label="Doanh thu NET"
          value={formatVNDShort(k.netRevenue)}
          sub={`Brutto ${formatVNDShort(k.grossRevenue)} · Giảm giá ước tính ${formatVNDShort(k.discountTotalEstimated)}`}
          icon={<CircleDollarSign size={22} />}
        />
        <KpiCard
          tone="orange"
          label="Đã thu / Chưa thu"
          value={formatVNDShort(k.paidTotal)}
          sub={`Chưa thu ${formatVNDShort(k.outstandingTotal)} · ${k.paymentCompletionRate.toFixed(1)}% hoàn thành thanh toán`}
          icon={<Wallet size={22} />}
        />
        <KpiCard
          tone="emerald"
          label="Lượt hành khách"
          value={formatInt(k.passengerTotal)}
          sub={`NL ${formatInt(k.passengerAdult)} · TE ${formatInt(k.passengerChild)} · EB ${formatInt(k.passengerInfant)}`}
          icon={<Users size={22} />}
        />
        <KpiCard
          tone="blue"
          label="AOV / đơn hoàn thành"
          value={formatMoney(k.aovCompleted)}
          sub="Trung bình một đơn (sau giảm giá)"
          icon={<Sparkles size={22} />}
        />
        <KpiCard
          tone="orange"
          label="Tour HOT kỳ"
          value={k.topTour ? formatVNDShort(k.topTour.revenue) : '—'}
          sub={
            k.topTour
              ? `${k.topTour.tourCode ? k.topTour.tourCode + ' · ' : ''}${k.topTour.title}`
              : 'Chưa có tour nào tạo doanh thu'
          }
          icon={<BarChart3 size={22} />}
        />
        <KpiCard
          tone="rose"
          label="Tỷ lệ hủy đơn"
          value={`${k.cancellationRate.toFixed(1)}%`}
          sub={`${formatInt(k.bookingCountCancelled)} hủy / ${formatInt(k.bookingCountAll)} tổng đơn`}
          icon={<XCircle size={22} />}
        />
        <KpiCard
          tone="rose"
          label="Công nợ quá hạn"
          value={formatVNDShort(k.overdueOutstandingTotal)}
          sub={`${formatInt(k.overdueCount)} đơn quá hạn > 1 ngày · Tổng công nợ ${formatVNDShort(k.outstandingTotal)}`}
          icon={<TriangleAlert size={22} />}
        />
      </div>

      {/* Alerts cảnh báo đỏ */}
      <div
        key={showRefreshed + '-alert'}
        className={cn(
          'transition-all duration-300 ease-out',
          initialLoading ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100',
        )}
        style={{ minHeight: k.overdueCount > 0 ? 104 : 0, overflow: 'hidden' }}
      >
        {k.overdueCount > 0 ? (
          <div className="rounded-3xl bg-gradient-to-r from-rose-50 via-white to-orange-50 p-5 shadow-sm ring-1 ring-rose-200">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-rose-600 p-2 text-white shadow-md shadow-rose-900/10">
                <TriangleAlert size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-rose-800">
                  Cảnh báo công nợ: {formatInt(k.overdueCount)} đơn quá hạn · tổng {formatMoney(k.overdueOutstandingTotal)}
                </div>
                <div className="mt-1 text-sm text-rose-700/90">
                  Các đơn này đã vượt thời hạn cọc/thanh toán, đề xuất Nhân viên liên hệ lại hoặc tự động hủy giữ chỗ theo
                  chính sách.
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-rose-900/10 hover:bg-rose-700"
              >
                Xem chi tiết công nợ ↓
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* 8 KPI 2 hàng */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 2xl:gap-6" style={{ minHeight: 264 }}>
        {isLoading ? (
          <>
            <KpiSkeleton tone="blue" />
            <KpiSkeleton tone="orange" />
            <KpiSkeleton tone="orange" />
            <KpiSkeleton tone="emerald" />
            <KpiSkeleton tone="blue" />
            <KpiSkeleton tone="orange" />
            <KpiSkeleton tone="rose" />
            <KpiSkeleton tone="rose" />
          </>
        ) : (
          <>
            <div key={showRefreshed + '-k1'} className={cn('transition-all duration-300 ease-out', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="blue"
                label="Tổng đơn trong kỳ"
                value={formatInt(k.bookingCountAll)}
                sub={`${formatInt(k.bookingCountCompleted)} hoàn thành · ${formatInt(k.bookingCountCancelled)} hủy`}
                icon={<BarChart3 size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k2'} className={cn('transition-all duration-300 ease-out delay-[30ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="orange"
                label="Doanh thu NET"
                value={formatVNDShort(k.netRevenue)}
                sub={`Brutto ${formatVNDShort(k.grossRevenue)} · Giảm giá ước tính ${formatVNDShort(k.discountTotalEstimated)}`}
                icon={<CircleDollarSign size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k3'} className={cn('transition-all duration-300 ease-out delay-[60ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="orange"
                label="Đã thu / Chưa thu"
                value={formatVNDShort(k.paidTotal)}
                sub={`Chưa thu ${formatVNDShort(k.outstandingTotal)} · ${k.paymentCompletionRate.toFixed(1)}% hoàn thành thanh toán`}
                icon={<Wallet size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k4'} className={cn('transition-all duration-300 ease-out delay-[90ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="emerald"
                label="Lượt hành khách"
                value={formatInt(k.passengerTotal)}
                sub={`NL ${formatInt(k.passengerAdult)} · TE ${formatInt(k.passengerChild)} · EB ${formatInt(k.passengerInfant)}`}
                icon={<Users size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k5'} className={cn('transition-all duration-300 ease-out delay-[120ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="blue"
                label="AOV / đơn hoàn thành"
                value={formatMoney(k.aovCompleted)}
                sub="Trung bình một đơn (sau giảm giá)"
                icon={<Sparkles size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k6'} className={cn('transition-all duration-300 ease-out delay-[150ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="orange"
                label="Tour HOT kỳ"
                value={k.topTour ? formatVNDShort(k.topTour.revenue) : '—'}
                sub={
                  k.topTour
                    ? `${k.topTour.tourCode ? k.topTour.tourCode + ' · ' : ''}${k.topTour.title}`
                    : 'Chưa có tour nào tạo doanh thu'
                }
                icon={<BarChart3 size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k7'} className={cn('transition-all duration-300 ease-out delay-[180ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="rose"
                label="Tỷ lệ hủy đơn"
                value={`${k.cancellationRate.toFixed(1)}%`}
                sub={`${formatInt(k.bookingCountCancelled)} hủy / ${formatInt(k.bookingCountAll)} tổng đơn`}
                icon={<XCircle size={22} />}
              />
            </div>
            <div key={showRefreshed + '-k8'} className={cn('transition-all duration-300 ease-out delay-[210ms]', stale ? 'blur-[1px] opacity-60 saturate-95' : 'opacity-100')}>
              <KpiCard
                tone="rose"
                label="Công nợ quá hạn"
                value={formatVNDShort(k.overdueOutstandingTotal)}
                sub={`${formatInt(k.overdueCount)} đơn quá hạn > 1 ngày · Tổng công nợ ${formatVNDShort(k.outstandingTotal)}`}
                icon={<TriangleAlert size={22} />}
              />
            </div>
          </>
        )}
      </div>

      {/* 4 chart 2x2 */}
      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:gap-6"
        style={{ minHeight: 780 }}
      >
        {isLoading ? (
          <>
            <ChartCardSkeleton />
            <ChartCardSkeleton />
            <ChartCardSkeleton />
            <ChartCardSkeleton withBars />
          </>
        ) : (
          <>
            <div key={showRefreshed + '-c1'} className={cn('transition-all duration-500 ease-out', stale ? 'opacity-60 saturate-95' : 'opacity-100')}>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Lượng khách hàng mới theo ngày</h3>
                    <p className="text-sm text-slate-500">Biến động số hành khách mới trong kỳ báo cáo đã chọn.</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
                    {used.period.preset === 'custom' ? 'Tùy chỉnh' : used.period.preset.toUpperCase()}
                  </span>
                </div>
                <RevenueLineChart
                  data={used.revenueLine}
                  height={260}
                  currencySuffix=" khách"
                  accentFrom="#fbbf24"
                  accentTo="#f97316"
                />
              </div>
            </div>
            <div key={showRefreshed + '-c2'} className={cn('transition-all duration-500 ease-out delay-75', stale ? 'opacity-60 saturate-95' : 'opacity-100')}>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-black tracking-tight text-slate-900">Doanh thu theo loại tour</h3>
                  <p className="text-sm text-slate-500">Phân bố NET doanh thu theo 4 nhóm sản phẩm chính.</p>
                </div>
                <DonutChart
                  size={220}
                  thickness={32}
                  data={used.tourTypeSlices}
                  centerLabel="Tổng 4 loại"
                  centerValue={formatVNDShort(k.netRevenue)}
                  centerSub="đơn đã bán"
                />
              </div>
            </div>
            <div key={showRefreshed + '-c3'} className={cn('transition-all duration-500 ease-out delay-150', stale ? 'opacity-60 saturate-95' : 'opacity-100')}>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
                <div className="mb-4">
                  <h3 className="text-lg font-black tracking-tight text-slate-900">Doanh thu theo hình thức thanh toán</h3>
                  <p className="text-sm text-slate-500">Gợi ý đẩy push thanh toán online giúp giảm thời gian thu hộ.</p>
                </div>
                <DonutChart
                  size={220}
                  thickness={32}
                  data={used.paymentMethodSlices}
                  centerLabel="Hoàn thành TT"
                  centerValue={`${k.paymentCompletionRate.toFixed(1)}%`}
                  centerSub={`Đã thu ${formatVNDShort(k.paidTotal)}`}
                />
              </div>
            </div>
            <div key={showRefreshed + '-c4'} className={cn('transition-all duration-500 ease-out delay-[225ms]', stale ? 'opacity-60 saturate-95' : 'opacity-100')}>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
                <div className="mb-4 flex items-end justify-between">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900">Doanh thu theo vùng</h3>
                    <p className="text-sm text-slate-500">Top 6 vùng / miền có đóng góp doanh thu lớn nhất.</p>
                  </div>
                  <BarChart3 size={22} className="text-blue-600" />
                </div>
                <RegionalBarChart bars={used.regionRevenueBars} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bảng tổng hợp theo tháng */}
      <div key={showRefreshed + '-tbl-monthly'} style={{ minHeight: 620 }} className={cn('transition-all duration-500 ease-out', stale ? 'opacity-70 saturate-95' : 'opacity-100')}>
        {isLoading ? (
          <MonthlyTableSkeleton />
        ) : (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Tổng hợp theo tháng (12 tháng)</h3>
                <p className="text-sm text-slate-500">So sánh doanh thu, đơn hàng, lượt khách và tỷ lệ hủy mỗi tháng.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                <Users size={14} /> Tổng {formatInt(used.monthly.reduce((s, r) => s + r.passengerTotal, 0))} khách
              </span>
            </div>
            <MonthlyAggTable rows={used.monthly} />
          </div>
        )}
      </div>

      {/* Bảng công nợ cần thu */}
      <div key={showRefreshed + '-tbl-os'} style={{ minHeight: 520 }} className={cn('transition-all duration-500 ease-out delay-100', stale ? 'opacity-70 saturate-95' : 'opacity-100')}>
        {isLoading ? (
          <OutstandingTableSkeleton />
        ) : (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">Công nợ cần thu · {formatInt(used.outstanding.length)} đơn</h3>
                <p className="text-sm text-slate-500">
                  Liệt kê Top các đơn còn thiếu tiền cọc / thanh toán · Sắp xếp theo ngày quá hạn &gt; số tiền nợ.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                  <TriangleAlert size={14} /> Quá hạn {formatVNDShort(k.overdueOutstandingTotal)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-orange-200">
                  <Wallet size={14} /> Tổng nợ {formatVNDShort(k.outstandingTotal)}
                </span>
              </div>
            </div>
            <OutstandingTable rows={used.outstanding} />
          </div>
        )}
      </div>
  </>
) : activeTab === 'bookings' ? (
        <AdminBookingsReportTab
          initialLoading={bInitialLoading}
          stale={bStale}
          error={bError}
          data={bData}
          preset={bPreset}
          setPreset={setBPreset}
          fromISO={bFrom}
          setFromISO={(v) => {
            setBFrom(v)
            setBPreset('custom')
            setBPage(1)
          }}
          toISO={bTo}
          setToISO={(v) => {
            setBTo(v)
            setBPreset('custom')
            setBPage(1)
          }}
          search={bSearch}
          setSearch={(v) => {
            setBSearch(v)
            setBPage(1)
          }}
          statuses={bStatuses}
          setStatuses={setBStatuses}
          paymentStatuses={bPaymentStatuses}
          setPaymentStatuses={setBPaymentStatuses}
          passengerTypes={bPassengerTypes}
          setPassengerTypes={setBPassengerTypes}
          paymentMethods={bPaymentMethods}
          setPaymentMethods={setBPaymentMethods}
          tourCategory={bTourCategory}
          setTourCategory={(v) => {
            setBTourCategory(v)
            setBPage(1)
          }}
          departureFrom={bDepartureFrom}
          setDepartureFrom={(v) => {
            setBDepartureFrom(v)
            setBPage(1)
          }}
          departureTo={bDepartureTo}
          setDepartureTo={(v) => {
            setBDepartureTo(v)
            setBPage(1)
          }}
          minAmount={bMinAmount}
          setMinAmount={(v) => {
            setBMinAmount(v)
            setBPage(1)
          }}
          maxAmount={bMaxAmount}
          setMaxAmount={(v) => {
            setBMaxAmount(v)
            setBPage(1)
          }}
          groupBy={bGroup}
          setGroupBy={(v) => {
            setBGroup(v)
            setBPage(1)
          }}
          sort={bSort}
          setSort={(v) => {
            setBSort(v)
            setBPage(1)
          }}
          page={bPage}
          setPage={setBPage}
          pageSize={bPageSize}
          setPageSize={(v) => {
            setBPageSize(v)
            setBPage(1)
          }}
          filterOpen={bFilterOpen}
          setFilterOpen={setBFilterOpen}
          selectedIds={bSelectedIds}
          setSelectedIds={setBSelectedIds}
          showAllSelect={bShowAllSelect}
          setShowAllSelect={setBShowAllSelect}
          onRefresh={() => void bLoad()}
          onChangePeriodPreset={(p) => {
            setBPreset(p)
            if (p === 'today') {
              const t = presetsToday()
              setBFrom(t.fromISO)
              setBTo(t.toISO)
            } else if (p !== 'custom') {
              const m = presetMonth()
              setBFrom(m.fromISO)
              setBTo(m.toISO)
            }
            setBPage(1)
          }}
        />
      ) : null}
    </div>
  )
}

const BOOKING_STATUS_META: Record<BookingStatus, { label: string; cls: string }> = {
  new: { label: 'Đơn mới', cls: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200' },
  pending: { label: 'Chờ xử lý', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  in_progress: { label: 'Đang thực hiện', cls: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200' },
  completed: { label: 'Hoàn thành', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  cancelled: { label: 'Đã hủy', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
}
const PAYMENT_STATUS_META: Record<BookingPaymentStatus, { label: string; cls: string }> = {
  unpaid: { label: 'Chưa thanh toán', cls: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' },
  partial: { label: 'Thanh toán 1 phần', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  paid: { label: 'Đã thanh toán đủ', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
}
const PAYMENT_METHOD_META: Record<BookingPaymentMethod, { label: string }> = {
  bank_transfer: { label: 'Chuyển khoản' },
  online: { label: 'Online' },
  hold: { label: 'Giữ chỗ / TM' },
}

const REPORT_BOOKING_PRESETS: Array<{ key: ReportBookingsPeriodPreset; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week', label: 'Tuần này' },
  { key: 'month', label: 'Tháng này' },
  { key: 'quarter', label: 'Quý' },
  { key: 'year', label: 'Năm' },
  { key: 'custom', label: 'Tùy chọn' },
]
const TOUR_CATEGORY_OPTIONS = [
  { key: 'all', label: 'Tất cả loại tour' },
  { key: 'Trong nước', label: 'Tour nội địa' },
  { key: 'Nước ngoài', label: 'Tour nước ngoài' },
  { key: 'Đoàn riêng / MICE', label: 'Đoàn riêng / MICE' },
  { key: 'Tour xe / Đường bộ', label: 'Tour xe / Đường bộ' },
]
const GROUP_BY_OPTIONS: Array<{ key: ReportBookingsGroupKey; label: string }> = [
  { key: 'none', label: 'Không nhóm' },
  { key: 'month_created', label: 'Nhóm theo tháng tạo đơn' },
  { key: 'staff_created', label: 'Nhóm theo nhân viên' },
  { key: 'tour_type', label: 'Nhóm theo loại tour' },
  { key: 'region', label: 'Nhóm theo vùng' },
  { key: 'status', label: 'Nhóm theo trạng thái' },
  { key: 'payment_status', label: 'Nhóm theo TT thanh toán' },
]
const SORT_OPTIONS: Array<{ key: ReportBookingsSortKey; label: string }> = [
  { key: 'createdAt_desc', label: 'Ngày tạo mới nhất' },
  { key: 'createdAt_asc', label: 'Ngày tạo cũ nhất' },
  { key: 'totalAmount_desc', label: 'Giá trị đơn cao → thấp' },
  { key: 'totalAmount_asc', label: 'Giá trị đơn thấp → cao' },
  { key: 'departureDate_desc', label: 'Ngày KH gần → xa' },
  { key: 'departureDate_asc', label: 'Ngày KH xa → gần' },
]
const STATUS_OPTIONS: Array<{ key: BookingStatus; label: string }> = [
  { key: 'new', label: 'Đơn mới' },
  { key: 'pending', label: 'Chờ xử lý' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'in_progress', label: 'Đang thực hiện' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
]
const PAYMENT_STATUS_OPTIONS: Array<{ key: BookingPaymentStatus; label: string }> = [
  { key: 'unpaid', label: 'Chưa thanh toán' },
  { key: 'partial', label: 'Thanh toán 1 phần' },
  { key: 'paid', label: 'Đã thanh toán đủ' },
]
const PAYMENT_METHOD_OPTIONS: Array<{ key: BookingPaymentMethod; label: string }> = [
  { key: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
  { key: 'online', label: 'Online (VNPay/MoMo)' },
  { key: 'hold', label: 'Giữ chỗ / Tiền mặt' },
]
const PAX_TYPE_OPTIONS: Array<{ key: 'NL' | 'TE' | 'EB'; label: string }> = [
  { key: 'NL', label: 'Người lớn' },
  { key: 'TE', label: 'Trẻ em' },
  { key: 'EB', label: 'Sơ sinh' },
]

function BookingSmallKpi({
  tone,
  label,
  value,
  sub,
  icon,
}: {
  tone: 'blue' | 'orange' | 'emerald' | 'rose'
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
}) {
  const toneMap = {
    blue: { grad: 'from-blue-50 to-white', ring: 'ring-blue-100', iconBg: 'bg-blue-100 text-blue-700' },
    orange: { grad: 'from-orange-50 to-white', ring: 'ring-orange-100', iconBg: 'bg-orange-100 text-orange-700' },
    emerald: { grad: 'from-emerald-50 to-white', ring: 'ring-emerald-100', iconBg: 'bg-emerald-100 text-emerald-700' },
    rose: { grad: 'from-rose-50 to-white', ring: 'ring-rose-100', iconBg: 'bg-rose-100 text-rose-700' },
  }
  const tm = toneMap[tone]
  return (
    <div className={cn('relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-sm ring-1 ring-inset', tm.grad, tm.ring)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</div>
          {sub ? <div className="mt-1 text-xs font-semibold text-slate-500">{sub}</div> : null}
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', tm.iconBg)}>{icon}</div>
      </div>
    </div>
  )
}

function MiniKpiSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-5 shadow-sm ring-1 ring-inset ring-blue-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="w-32"><Shimmer className="h-3" /></div>
          <div className="w-[70%]"><Shimmer className="h-7 rounded-xl" /></div>
          <div className="w-[85%]"><Shimmer className="h-2.5" /></div>
        </div>
        <div className="h-11 w-11 shrink-0 rounded-2xl bg-white ring-1 ring-slate-100"><Shimmer className="rounded-2xl" /></div>
      </div>
    </div>
  )
}

function ChipToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition',
        active
          ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
      )}
    >
      {active ? <Check size={12} /> : <Square size={12} className="opacity-60" />}
      {children}
    </button>
  )
}

function buildDemoBookingsReport(preset: ReportBookingsPeriodPreset, fromISO: string, toISO: string, page: number, pageSize: number): ReportBookingsResponse {
  const rows: ReportBookingsRow[] = Array.from({ length: 68 }, (_, i) => {
    const createdAt = new Date(new Date(toISO).getTime() - i * 86_400_000 * 1.4)
    const departureDate = new Date(createdAt.getTime() + (10 + (i % 22)) * 86_400_000)
    const tours = [
      { title: 'Hà Nội - Hạ Long 2N1Đ Luxury Cruise', code: 'T-HL2-01', cat: 'Trong nước', region: 'Bắc' },
      { title: 'Hà Giang Loop 4N3Đ - Mùa lúa chín', code: 'T-HG4-03', cat: 'Trong nước', region: 'Bắc' },
      { title: 'Đà Nẵng - Hội An - Huế 5N4Đ Voucher Vinpearl', code: 'T-DN5-01', cat: 'Trong nước', region: 'Trung' },
      { title: 'Phú Quốc 5N4Đ - Khu nghỉ dưỡng Sang trọng', code: 'T-PQ5-05', cat: 'Nước ngoài' as any, region: 'Nam' },
      { title: 'Thái Lan Bangkok Pattaya 5N4Đ', code: 'T-TL5-08', cat: 'Nước ngoài', region: 'Quốc tế' },
      { title: 'Tour MICE - Hội nghị InterContinental Đà Nẵng 3N2Đ', code: 'T-DN3-08-M', cat: 'Đoàn riêng / MICE', region: 'Trung' },
    ]
    const tr = tours[i % tours.length]
    const status = (['new', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as BookingStatus[])[i % 6]
    const pst = (['unpaid', 'partial', 'paid'] as BookingPaymentStatus[])[i % 3]
    const pmt = (['bank_transfer', 'online', 'hold'] as BookingPaymentMethod[])[i % 3]
    const nl = 2 + (i % 5)
    const te = i % 4
    const eb = i % 2
    const base = 4_800_000 + (i % 18) * 1_200_000
    const totalAmount = nl * base + te * (base * 0.75) + eb * (base * 0.1)
    const paid = pst === 'paid' ? totalAmount : pst === 'partial' ? Math.round(totalAmount * 0.5) : 0
    return {
      id: `demo-${i}`,
      code: `BK-DEMO-${String(2600 + i).padStart(5, '0')}`,
      customerName: [
        'Nguyễn Thị Minh Anh', 'Trần Văn Hoàng', 'Công ty TNHH Hữu Phát',
        'Lê Thị Lan Anh', 'Phạm Đức Long', 'Hoàng Thị Mai', 'Vũ Thị Kim Oanh',
      ][i % 7],
      customerPhone: `0${String(900 + i * 37).slice(0, 3)} ${String(1000 + i * 37).slice(0, 4)} ${String(2000 + i * 13).slice(0, 4)}`,
      customerEmail: i % 3 === 0 ? `customer${i}@example.com` : null,
      passengerCount: nl + te + eb,
      passengerAdult: nl,
      passengerChild: te,
      passengerInfant: eb,
      tourId: `t-${i % 6}`,
      tourCode: tr.code,
      tourTitle: tr.title,
      tourTypeCategory: tr.cat as any,
      region: tr.region,
      departureDateISO: toISO2(departureDate),
      createdAtISO: toISO2(createdAt),
      createdByStaffId: `u-${i % 4}`,
      createdByStaffName: ['Châu Thị Thu (Admin)', 'Nguyễn Hùng (Sale01)', 'Lê Lan (Sale02)', 'Hoàng Mai (Sale03)'][i % 4],
      status,
      paymentStatus: pst,
      paymentMethod: pmt,
      subtotalAmount: Math.round(totalAmount * 0.9),
      surchargeAmount: Math.round(totalAmount * 0.03),
      vatAmount: Math.round(totalAmount * 0.07),
      totalAmount: Math.round(totalAmount),
      paidAmount: Math.round(paid),
      outstandingAmount: Math.max(0, Math.round(totalAmount - paid)),
      holdsUntilISO: pst === 'unpaid' || pst === 'partial' ? toISO2(new Date(createdAt.getTime() + 5 * 86_400_000)) : null,
      overdueDays: (pst !== 'paid' && i % 5 === 0) ? (i % 8) + 1 : 0,
      notes: i % 3 === 0 ? 'Gọi xác nhận khách vào chiều thứ 6' : null,
    }
  })
  const totalRows = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const start = Math.max(0, (page - 1) * pageSize)
  const pageRows = rows.slice(start, start + pageSize)
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
  return {
    period: { preset, fromISO, toISO },
    summary: {
      bookingCountAll: rows.length,
      totalAmount: sum(rows.map((r) => r.totalAmount)),
      paidAmount: sum(rows.map((r) => r.paidAmount)),
      outstandingAmount: sum(rows.map((r) => r.outstandingAmount)),
      overdueAmount: sum(rows.filter((r) => r.overdueDays > 0).map((r) => r.outstandingAmount)),
      completedCount: rows.filter((r) => r.status === 'completed').length,
      cancelledCount: rows.filter((r) => r.status === 'cancelled').length,
      passengerTotal: sum(rows.map((r) => r.passengerCount)),
    },
    groupRows: [],
    groupKey: 'none',
    rows: pageRows,
    page,
    pageSize,
    totalRows,
    totalPages,
    sort: 'createdAt_desc',
  }
}
function toISO2(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

type BookingsTabProps = {
  initialLoading: boolean
  stale: boolean
  error: string | null
  data: ReportBookingsResponse | null
  preset: ReportBookingsPeriodPreset
  setPreset: (p: ReportBookingsPeriodPreset) => void
  fromISO: string
  setFromISO: (v: string) => void
  toISO: string
  setToISO: (v: string) => void
  search: string
  setSearch: (v: string) => void
  statuses: BookingStatus[]
  setStatuses: (v: BookingStatus[]) => void
  paymentStatuses: BookingPaymentStatus[]
  setPaymentStatuses: (v: BookingPaymentStatus[]) => void
  passengerTypes: Array<'NL' | 'TE' | 'EB'>
  setPassengerTypes: (v: Array<'NL' | 'TE' | 'EB'>) => void
  paymentMethods: BookingPaymentMethod[]
  setPaymentMethods: (v: BookingPaymentMethod[]) => void
  tourCategory: string
  setTourCategory: (v: string) => void
  departureFrom: string
  setDepartureFrom: (v: string) => void
  departureTo: string
  setDepartureTo: (v: string) => void
  minAmount: string
  setMinAmount: (v: string) => void
  maxAmount: string
  setMaxAmount: (v: string) => void
  groupBy: ReportBookingsGroupKey
  setGroupBy: (v: ReportBookingsGroupKey) => void
  sort: ReportBookingsSortKey
  setSort: (v: ReportBookingsSortKey) => void
  page: number
  setPage: (v: number) => void
  pageSize: 25 | 50 | 100
  setPageSize: (v: 25 | 50 | 100) => void
  filterOpen: boolean
  setFilterOpen: (v: boolean) => void
  selectedIds: Set<string>
  setSelectedIds: (v: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  showAllSelect: boolean
  setShowAllSelect: (v: boolean) => void
  onRefresh: () => void
  onChangePeriodPreset: (p: ReportBookingsPeriodPreset) => void
}

function AdminBookingsReportTab(p: BookingsTabProps) {
  const isLoading = p.initialLoading || p.stale
  const demo = useMemo(() => buildDemoBookingsReport(p.preset, p.fromISO, p.toISO, p.page, p.pageSize), [p.preset, p.fromISO, p.toISO, p.page, p.pageSize])
  const used = useMemo<ReportBookingsResponse>(() => {
    if (p.data && (p.data.totalRows > 0 || p.data.rows.length > 0)) return p.data
    // if group request, apply grouping on demo too for preview
    if (p.groupBy !== 'none' && demo.rows.length > 0) {
      const allRows = buildDemoBookingsReport(p.preset, p.fromISO, p.toISO, 1, 99999).rows
      const gmap = new Map<string, any>()
      for (const r of allRows) {
        let key: string, label: string
        switch (p.groupBy) {
          case 'month_created': {
            const d = new Date(r.createdAtISO)
            key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            label = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`
            break
          }
          case 'staff_created':
            key = r.createdByStaffId || 'none'
            label = r.createdByStaffName || 'Không xác định'
            break
          case 'tour_type':
            key = r.tourTypeCategory
            label = r.tourTypeCategory
            break
          case 'region':
            key = r.region
            label = r.region
            break
          case 'status':
            key = r.status
            label = BOOKING_STATUS_META[r.status].label
            break
          case 'payment_status':
            key = r.paymentStatus
            label = PAYMENT_STATUS_META[r.paymentStatus].label
            break
          default:
            key = 'all'
            label = 'Tất cả'
        }
        const cur = gmap.get(key) || {
          key, label, bookingCount: 0, passengerTotal: 0, totalAmount: 0, paidAmount: 0, outstandingAmount: 0, aov: 0, completedCount: 0, cancelledCount: 0,
        }
        cur.bookingCount += 1
        cur.passengerTotal += r.passengerCount
        cur.totalAmount += r.totalAmount
        cur.paidAmount += r.paidAmount
        cur.outstandingAmount += r.outstandingAmount
        if (r.status === 'completed') cur.completedCount += 1
        if (r.status === 'cancelled') cur.cancelledCount += 1
        gmap.set(key, cur)
      }
      const groupRows = Array.from(gmap.values()).sort((a, b) => b.totalAmount - a.totalAmount).map((g) => ({ ...g, aov: g.bookingCount === 0 ? 0 : g.totalAmount / g.bookingCount }))
      return { ...demo, groupRows, groupKey: p.groupBy }
    }
    return demo
  }, [p.data, p.groupBy, p.preset, p.fromISO, p.toISO, p.page, p.pageSize])
  const s = used.summary

  const dataStateBadge = useMemo(() => {
    if (p.initialLoading) return (<span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200"><RefreshCcw size={14} className="animate-spin" /> Đang tải bookings…</span>)
    if (p.stale) return (<span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200"><RefreshCcw size={14} className="animate-spin" /> Đang cập nhật bộ lọc…</span>)
    if (p.error) return (<span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-200"><TriangleAlert size={14} /> Lỗi API - đang hiển thị mẫu</span>)
    if (!p.data || p.data.totalRows === 0) return (<span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-200"><Sparkles size={14} /> DB rỗng / không khớp bộ lọc - mẫu tham khảo</span>)
    return (<span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 size={14} /> {formatInt(p.data.totalRows)} đơn thực tế</span>)
  }, [p.initialLoading, p.stale, p.error, p.data])

  const activeFilterCount =
    (p.statuses.length) + (p.paymentStatuses.length) + (p.passengerTypes.length) + (p.paymentMethods.length) +
    (p.tourCategory !== 'all' ? 1 : 0) + (p.departureFrom ? 1 : 0) + (p.departureTo ? 1 : 0) +
    (p.minAmount.trim() ? 1 : 0) + (p.maxAmount.trim() ? 1 : 0) + (p.search.trim() ? 1 : 0)

  const resetAllFilters = () => {
    p.setSearch('')
    p.setStatuses([])
    p.setPaymentStatuses([])
    p.setPassengerTypes([])
    p.setPaymentMethods([])
    p.setTourCategory('all')
    p.setDepartureFrom('')
    p.setDepartureTo('')
    p.setMinAmount('')
    p.setMaxAmount('')
  }

  const allPageIds = useMemo(() => new Set(used.rows.map((r) => r.id)), [used.rows])
  const allSelectedOnPage = used.rows.length > 0 && [...allPageIds].every((id) => p.selectedIds.has(id))
  const someSelectedOnPage = [...allPageIds].some((id) => p.selectedIds.has(id))

  const toggleSelectAllOnPage = () => {
    if (allSelectedOnPage) {
      const next = new Set(p.selectedIds)
      for (const id of allPageIds) next.delete(id)
      p.setSelectedIds(next)
    } else {
      const next = new Set(p.selectedIds)
      for (const id of allPageIds) next.add(id)
      p.setSelectedIds(next)
    }
  }

  const exportSelectedToCSV = () => {
    const rows = p.selectedIds.size > 0 ? used.rows.filter((r) => p.selectedIds.has(r.id)) : used.rows
    if (rows.length === 0) return
    const header = ['Mã đơn', 'Tên KH', 'SĐT', 'Email', 'Tour', 'Loại tour', 'Vùng', 'Ngày tạo', 'Ngày KH', 'NV tạo', 'Trạng thái', 'TT TT', 'NL', 'TE', 'EB', 'SL', 'Tổng', 'Đã thu', 'Còn nợ', 'Quá hạn ngày']
    const rowsCsv = rows.map((r) => [
      r.code, r.customerName, r.customerPhone, r.customerEmail || '', r.tourTitle, r.tourTypeCategory, r.region,
      formatDate(r.createdAtISO), formatDate(r.departureDateISO), r.createdByStaffName || '',
      BOOKING_STATUS_META[r.status].label, PAYMENT_STATUS_META[r.paymentStatus].label,
      String(r.passengerAdult), String(r.passengerChild), String(r.passengerInfant), String(r.passengerCount),
      String(r.totalAmount), String(r.paidAmount), String(r.outstandingAmount), String(r.overdueDays),
    ])
    const csv = [header, ...rowsCsv].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bookings-${p.fromISO}_${p.toISO}-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 2xl:space-y-7">
      {/* Header right actions global already in page root; now add toolbar for tab */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-blue-700 text-white shadow-sm shadow-blue-900/20">
              <Receipt size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">Báo cáo bookings chi tiết</h2>
              <p className="text-sm text-slate-500">15 bộ lọc · Group By 7 loại · Bulk Actions · Xuất Excel / PDF · Phân trang 25/50/100.</p>
            </div>
            {dataStateBadge}
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={p.search}
                placeholder="Tìm mã đơn / KH / SĐT / Email / Tour…"
                onChange={(e) => p.setSearch(e.target.value)}
                className="w-[280px] rounded-2xl bg-slate-50 pl-9 pr-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none 2xl:w-[360px]"
              />
            </div>
            <button
              type="button"
              onClick={() => p.setFilterOpen(!p.filterOpen)}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold ring-1 transition',
                p.filterOpen || activeFilterCount > 0
                  ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
                  : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <Filter size={14} />
              Bộ lọc nâng cao
              {activeFilterCount > 0 ? (
                <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1.5 text-[10px] font-black ring-1 ring-white/30">{activeFilterCount}</span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={p.onRefresh}
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-white"
            >
              <RefreshCcw size={14} /> Làm mới
            </button>
            <button
              type="button"
              onClick={exportSelectedToCSV}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-blue-900/20 ring-1 ring-blue-900/10 hover:brightness-105"
            >
              <FileSpreadsheet size={14} /> Xuất CSV {p.selectedIds.size > 0 ? `(${formatInt(p.selectedIds.size)})` : ''}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-orange-900/20 ring-1 ring-orange-900/10 hover:brightness-105"
            >
              <Printer size={14} /> In / PDF
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Kỳ báo cáo</span>
            {REPORT_BOOKING_PRESETS.map((preset) => {
              const active = p.preset === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => p.onChangePeriodPreset(preset.key)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition',
                    active
                      ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                  )}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Từ</label>
            <input type="date" value={p.fromISO} onChange={(e) => p.setFromISO(e.target.value)} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">→ Đến</label>
            <input type="date" value={p.toISO} onChange={(e) => p.setToISO(e.target.value)} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
            <select value={p.tourCategory} onChange={(e) => p.setTourCategory(e.target.value)} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none">
              {TOUR_CATEGORY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select value={p.groupBy} onChange={(e) => p.setGroupBy(e.target.value as ReportBookingsGroupKey)} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none">
              {GROUP_BY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            <select value={p.sort} onChange={(e) => p.setSort(e.target.value as ReportBookingsSortKey)} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none">
              {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {p.filterOpen ? (
          <div className="mt-4 animate-[fadeSlideIn_0.35s_ease-out] rounded-2xl bg-gradient-to-r from-slate-50 via-white to-slate-50 p-4 ring-1 ring-slate-200">
            <div className="mb-3 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-slate-600">
                <SlidersHorizontal size={14} /> Bộ lọc nâng cao
              </div>
              <button type="button" onClick={resetAllFilters} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                <X size={12} /> Xóa toàn bộ
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <FilterBox label="Trạng thái đơn">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((o) => (
                    <ChipToggle key={o.key} active={p.statuses.includes(o.key)} onClick={() => {
                      p.setStatuses(p.statuses.includes(o.key) ? p.statuses.filter((x) => x !== o.key) : [...p.statuses, o.key])
                    }}>{o.label}</ChipToggle>
                  ))}
                </div>
              </FilterBox>
              <FilterBox label="Trạng thái thanh toán">
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_STATUS_OPTIONS.map((o) => (
                    <ChipToggle key={o.key} active={p.paymentStatuses.includes(o.key)} onClick={() => {
                      p.setPaymentStatuses(p.paymentStatuses.includes(o.key) ? p.paymentStatuses.filter((x) => x !== o.key) : [...p.paymentStatuses, o.key])
                    }}>{o.label}</ChipToggle>
                  ))}
                </div>
              </FilterBox>
              <FilterBox label="Phương thức thanh toán">
                <div className="flex flex-wrap gap-2">
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <ChipToggle key={o.key} active={p.paymentMethods.includes(o.key)} onClick={() => {
                      p.setPaymentMethods(p.paymentMethods.includes(o.key) ? p.paymentMethods.filter((x) => x !== o.key) : [...p.paymentMethods, o.key])
                    }}>{o.label}</ChipToggle>
                  ))}
                </div>
              </FilterBox>
              <FilterBox label="Loại hành khách">
                <div className="flex flex-wrap gap-2">
                  {PAX_TYPE_OPTIONS.map((o) => (
                    <ChipToggle key={o.key} active={p.passengerTypes.includes(o.key)} onClick={() => {
                      p.setPassengerTypes(p.passengerTypes.includes(o.key) ? p.passengerTypes.filter((x) => x !== o.key) : [...p.passengerTypes, o.key])
                    }}>{o.label} ({o.key})</ChipToggle>
                  ))}
                </div>
              </FilterBox>
              <FilterBox label="Ngày khởi hành">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs font-bold text-slate-500">Từ</label>
                  <input type="date" value={p.departureFrom} onChange={(e) => p.setDepartureFrom(e.target.value)} className="rounded-2xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
                  <label className="text-xs font-bold text-slate-500">→ Đến</label>
                  <input type="date" value={p.departureTo} onChange={(e) => p.setDepartureTo(e.target.value)} className="rounded-2xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
                </div>
              </FilterBox>
              <FilterBox label="Giá trị đơn (VND)">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="text" value={p.minAmount} onChange={(e) => p.setMinAmount(e.target.value)} placeholder="Từ (VD 5000000)" className="w-[45%] rounded-2xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
                  <span className="text-xs text-slate-400">→</span>
                  <input type="text" value={p.maxAmount} onChange={(e) => p.setMaxAmount(e.target.value)} placeholder="Đến (VD 50000000)" className="w-[45%] rounded-2xl bg-white px-3 py-2 text-sm font-medium ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none" />
                </div>
              </FilterBox>
              <FilterBox label="Phân trang / Trang">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500">Số dòng / trang</span>
                  {[25, 50, 100].map((sz) => (
                    <ChipToggle key={sz} active={p.pageSize === sz} onClick={() => p.setPageSize(sz as 25 | 50 | 100)}>{sz}</ChipToggle>
                  ))}
                </div>
              </FilterBox>
              <FilterBox label="Gợi ý nhanh">
                <div className="flex flex-wrap gap-2">
                  <ChipToggle active={false} onClick={() => {
                    p.setStatuses(['cancelled'])
                    p.setPaymentStatuses([])
                    p.setPaymentMethods([])
                    p.setPassengerTypes([])
                    p.setTourCategory('all')
                  }}>Đơn đã hủy kỳ này</ChipToggle>
                  <ChipToggle active={false} onClick={() => {
                    p.setPaymentStatuses(['unpaid', 'partial'])
                    p.setStatuses([])
                  }}>Còn công nợ</ChipToggle>
                </div>
              </FilterBox>
            </div>
          </div>
        ) : null}
      </div>

      {/* 6 KPI summary */}
      <div style={{ minHeight: 192 }} className={cn('grid grid-cols-1 gap-5 transition-all duration-500 ease-out sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 2xl:gap-6', isLoading ? 'opacity-80' : 'opacity-100')}>
        {isLoading ? (
          <>
            <MiniKpiSkeleton /><MiniKpiSkeleton /><MiniKpiSkeleton /><MiniKpiSkeleton /><MiniKpiSkeleton /><MiniKpiSkeleton />
          </>
        ) : (
          <>
            <BookingSmallKpi tone="blue" label="Tổng đơn kỳ này" value={formatInt(s.bookingCountAll)} sub={`${formatInt(s.completedCount)} hoàn thành · ${formatInt(s.cancelledCount)} hủy`} icon={<BarChart3 size={18} />} />
            <BookingSmallKpi tone="orange" label="Tổng doanh thu" value={formatVNDShort(s.totalAmount)} sub={`AOV ${formatVNDShort(s.bookingCountAll === 0 ? 0 : s.totalAmount / s.bookingCountAll)}`} icon={<CircleDollarSign size={18} />} />
            <BookingSmallKpi tone="emerald" label="Đã thu" value={formatVNDShort(s.paidAmount)} sub={`${s.totalAmount === 0 ? 0 : Math.round((s.paidAmount / s.totalAmount) * 100)}% hoàn tất TT`} icon={<CheckCircle2 size={18} />} />
            <BookingSmallKpi tone="rose" label="Còn nợ" value={formatVNDShort(s.outstandingAmount)} sub={`Quá hạn ${formatVNDShort(s.overdueAmount)}`} icon={<Wallet size={18} />} />
            <BookingSmallKpi tone="blue" label="Lượt khách" value={formatInt(s.passengerTotal)} sub={`Tổng NL + TE + EB toàn bộ đơn`} icon={<Users size={18} />} />
            <BookingSmallKpi tone="orange" label="Tỷ lệ hủy" value={`${s.bookingCountAll === 0 ? 0 : Math.round((s.cancelledCount / s.bookingCountAll) * 100)}%`} sub={`${formatInt(s.cancelledCount)} / ${formatInt(s.bookingCountAll)} đơn`} icon={<XCircle size={18} />} />
          </>
        )}
      </div>

      {/* Group By table */}
      {used.groupRows.length > 0 ? (
        <div style={{ minHeight: 320 }} className={cn('rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 transition-all duration-500 ease-out 2xl:p-6', isLoading ? 'opacity-80' : 'opacity-100')}>
          <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Tổng hợp theo nhóm · {GROUP_BY_OPTIONS.find((o) => o.key === used.groupKey)?.label || used.groupKey}</h3>
              <p className="text-sm text-slate-500">{formatInt(used.groupRows.length)} nhóm · Sắp xếp theo tổng doanh thu.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-50 to-orange-50 px-3 py-1 text-xs font-bold text-blue-700 ring-1 ring-blue-200">
              <GripVertical size={14} /> Sắp xếp theo doanh thu giảm dần
            </div>
          </div>
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 w-[320px]">Nhóm</th>
                  <th className="px-3 py-2 text-right">Số đơn</th>
                  <th className="px-3 py-2 text-right">Hoàn thành</th>
                  <th className="px-3 py-2 text-right">Đã hủy</th>
                  <th className="px-3 py-2 text-right">Lượt KH</th>
                  <th className="px-3 py-2 text-right">Tổng doanh thu</th>
                  <th className="px-3 py-2 text-right">AOV</th>
                  <th className="px-3 py-2 text-right">Đã thu</th>
                  <th className="px-3 py-2 text-right">Còn nợ</th>
                </tr>
              </thead>
              <tbody>
                {used.groupRows.map((g, idx) => (
                  <tr key={g.key} className="group hover:bg-orange-50/40">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-xs font-black text-slate-600 ring-1 ring-slate-200">{idx + 1}</span>
                        <span className="font-bold text-slate-900">{g.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-slate-900">{formatInt(g.bookingCount)}</td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-700">{formatInt(g.completedCount)}</td>
                    <td className="px-3 py-2 text-right font-medium text-rose-600">{formatInt(g.cancelledCount)}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{formatInt(g.passengerTotal)}</td>
                    <td className="px-3 py-2 text-right font-extrabold text-orange-700">{formatMoney(g.totalAmount)}</td>
                    <td className="px-3 py-2 text-right text-slate-800">{formatVNDShort(g.aov)}</td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatMoney(g.paidAmount)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn('font-bold', g.outstandingAmount > 0 ? 'text-rose-700' : 'text-slate-400')}>{formatMoney(g.outstandingAmount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* Booking table + bulk */}
      <div style={{ minHeight: 860 }} className={cn('transition-all duration-500 ease-out', isLoading ? 'opacity-80' : 'opacity-100')}>
        {isLoading ? (
          <TableSkeleton cols={14} rows={Math.min(p.pageSize, 25)} />
        ) : (
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blue-100 2xl:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-black tracking-tight text-slate-900">
                  Danh sách bookings · Trang {formatInt(used.page)}/{formatInt(used.totalPages)}
                </h3>
                <p className="text-sm text-slate-500">{formatInt(used.totalRows)} đơn phù hợp bộ lọc · {formatInt(used.rows.length)} đơn trong trang.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {p.selectedIds.size > 0 ? (
                  <>
                    <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-50 to-orange-50 px-3 py-1.5 text-xs font-extrabold text-blue-800 ring-1 ring-blue-200">
                      <CheckCircle2 size={14} /> Đã chọn {formatInt(p.selectedIds.size)} đơn
                    </div>
                    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      <Mail size={14} /> Gửi email chọn lọc
                    </button>
                    <button type="button" className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                      <Printer size={14} /> In hợp đồng chọn
                    </button>
                    <button type="button" onClick={exportSelectedToCSV} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-700 to-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-blue-900/20 ring-1 ring-blue-900/10 hover:brightness-105">
                      <FileSpreadsheet size={14} /> Xuất chọn lọc
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                <input type="checkbox" checked={allSelectedOnPage} onChange={toggleSelectAllOnPage} className="h-3.5 w-3.5 rounded text-blue-700" />
                {someSelectedOnPage && !allSelectedOnPage ? <span className="text-amber-600">—</span> : null}
                <span>Chọn {allSelectedOnPage ? 'bỏ chọn' : 'tất cả'} dòng trang này</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                <input type="checkbox" checked={p.showAllSelect} onChange={(e) => p.setShowAllSelect(e.target.checked)} className="h-3.5 w-3.5 rounded text-blue-700" />
                <span>Bật chọn trên tất cả {formatInt(used.totalRows)} đơn (không chỉ trang)</span>
              </label>
              {p.selectedIds.size > 0 ? (
                <button type="button" onClick={() => p.setSelectedIds(new Set())} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50">
                  <X size={12} /> Bỏ chọn tất cả
                </button>
              ) : null}
            </div>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="min-w-[1600px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 w-10"></th>
                    <th className="px-3 py-2">Mã đơn</th>
                    <th className="px-3 py-2 min-w-[180px]">Khách hàng</th>
                    <th className="px-3 py-2 min-w-[240px]">Tour</th>
                    <th className="px-3 py-2">Loại / Vùng</th>
                    <th className="px-3 py-2">Ngày tạo</th>
                    <th className="px-3 py-2">Khởi hành</th>
                    <th className="px-3 py-2 min-w-[140px]">Nhân viên</th>
                    <th className="px-3 py-2">TT đơn</th>
                    <th className="px-3 py-2">TT thanh toán</th>
                    <th className="px-3 py-2 text-right">SL</th>
                    <th className="px-3 py-2 text-right">Tổng tiền</th>
                    <th className="px-3 py-2 text-right">Còn nợ</th>
                    <th className="px-3 py-2">Quá hạn</th>
                  </tr>
                </thead>
                <tbody>
                  {used.rows.map((r) => (
                    <BookingTableRow
                      key={r.id}
                      row={r}
                      selected={p.selectedIds.has(r.id) || (p.showAllSelect && used.totalRows < 99999)}
                      onToggleSelected={() => {
                        const next = new Set(p.selectedIds)
                        if (next.has(r.id)) next.delete(r.id)
                        else next.add(r.id)
                        p.setSelectedIds(next)
                      }}
                    />
                  ))}
                  {used.rows.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-3 py-10">
                        <div className="mx-auto max-w-md rounded-2xl bg-slate-50 p-5 text-center ring-1 ring-slate-100">
                          <Search size={22} className="mx-auto mb-2 text-slate-400" />
                          <div className="font-semibold text-slate-700">Không tìm thấy đơn nào khớp bộ lọc.</div>
                          <div className="mt-1 text-xs text-slate-500">Thử giảm bộ lọc hoặc thay đổi kỳ báo cáo.</div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="mt-5 flex flex-col items-start justify-between gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100 lg:flex-row lg:items-center">
              <div className="text-xs font-semibold text-slate-600">
                Hiển thị <span className="font-black text-slate-900">{formatInt(Math.min(1 + (used.page - 1) * used.pageSize, used.totalRows))}</span>
                {' → '}
                <span className="font-black text-slate-900">{formatInt(Math.min(used.page * used.pageSize, used.totalRows))}</span>
                {' / '}
                <span className="font-black text-slate-900">{formatInt(used.totalRows)}</span> đơn
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={used.page <= 1}
                  onClick={() => p.setPage(Math.max(1, used.page - 1))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={14} /> Trước
                </button>
                {PaginatorPages({ page: used.page, totalPages: used.totalPages }).map((pn, idx) =>
                  typeof pn === 'number' ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => p.setPage(pn)}
                      className={cn(
                        'inline-flex h-8 min-w-8 items-center justify-center rounded-full px-2.5 text-xs font-black ring-1 transition',
                        used.page === pn
                          ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-sm shadow-blue-900/10'
                          : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
                      )}
                    >
                      {formatInt(pn)}
                    </button>
                  ) : (
                    <span key={idx} className="px-1.5 text-xs font-bold text-slate-400">…</span>
                  ),
                )}
                <button
                  type="button"
                  disabled={used.page >= used.totalPages}
                  onClick={() => p.setPage(Math.min(used.totalPages, used.page + 1))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Sau <ChevronRight size={14} />
                </button>
                <select value={used.pageSize} onChange={(e) => p.setPageSize(Number(e.target.value) as 25 | 50 | 100)} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none">
                  <option value={25}>25 dòng / trang</option>
                  <option value={50}>50 dòng / trang</option>
                  <option value={100}>100 dòng / trang</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200">
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</div>
      {children}
    </div>
  )
}

function BookingTableRow({ row, selected, onToggleSelected }: { row: ReportBookingsRow; selected: boolean; onToggleSelected: () => void }) {
  const s = BOOKING_STATUS_META[row.status]
  const ps = PAYMENT_STATUS_META[row.paymentStatus]
  return (
    <tr className={cn('group transition-colors', selected ? 'bg-gradient-to-r from-blue-50/60 via-orange-50/40 to-transparent' : 'hover:bg-slate-50/70')}>
      <td className="px-3 py-2">
        <label className="inline-flex cursor-pointer items-center">
          <input type="checkbox" checked={selected} onChange={onToggleSelected} className="h-4 w-4 rounded text-blue-700" />
        </label>
      </td>
      <td className="px-3 py-2">
        <div className="font-mono text-xs font-black text-blue-700">{row.code}</div>
        {row.notes ? <div className="mt-0.5 text-[10px] text-slate-400 line-clamp-1">📝 {row.notes}</div> : null}
      </td>
      <td className="px-3 py-2">
        <div className="font-semibold text-slate-900">{row.customerName}</div>
        <div className="text-xs text-slate-500">{row.customerPhone}</div>
        {row.customerEmail ? <div className="text-[11px] text-slate-400 line-clamp-1">{row.customerEmail}</div> : null}
      </td>
      <td className="px-3 py-2">
        <div className="font-medium text-slate-800 line-clamp-1">{row.tourTitle}</div>
        {row.tourCode ? <div className="text-xs font-mono text-slate-500">{row.tourCode}</div> : null}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-200">{row.tourTypeCategory}</span>
        <div className="mt-1 text-[10px] font-semibold text-slate-500">· {row.region}</div>
      </td>
      <td className="px-3 py-2 text-xs text-slate-700">{formatDate(row.createdAtISO)}</td>
      <td className="px-3 py-2 text-xs text-slate-700">
        <div className="font-semibold">{formatDate(row.departureDateISO)}</div>
        <div className="text-[10px] text-slate-500">{PAYMENT_METHOD_META[row.paymentMethod].label}</div>
      </td>
      <td className="px-3 py-2">
        <div className="text-xs font-semibold text-slate-800">{row.createdByStaffName || 'Chưa gán'}</div>
      </td>
      <td className="px-3 py-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', s.cls)}>{s.label}</span>
      </td>
      <td className="px-3 py-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', ps.cls)}>{ps.label}</span>
      </td>
      <td className="px-3 py-2 text-right text-xs text-slate-700">
        <div className="font-bold text-slate-900">{formatInt(row.passengerCount)}</div>
        <div className="text-[10px] text-slate-500">NL{row.passengerAdult}·TE{row.passengerChild}·EB{row.passengerInfant}</div>
      </td>
      <td className="px-3 py-2 text-right">
        <div className="font-extrabold text-orange-700">{formatMoney(row.totalAmount)}</div>
        <div className="text-[10px] text-emerald-700">Đã thu {formatMoney(row.paidAmount)}</div>
      </td>
      <td className="px-3 py-2 text-right">
        <span className={cn('font-extrabold', row.outstandingAmount > 0 ? 'text-rose-700' : 'text-slate-300')}>
          {row.outstandingAmount > 0 ? formatMoney(row.outstandingAmount) : '—'}
        </span>
      </td>
      <td className="px-3 py-2">
        {row.overdueDays > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">
            <TriangleAlert size={10} /> {row.overdueDays} ngày
          </span>
        ) : (
          <span className="text-[10px] text-slate-300">—</span>
        )}
      </td>
    </tr>
  )
}

function PaginatorPages({ page, totalPages }: { page: number; totalPages: number }) {
  const out: Array<number | '...'> = []
  const window = 2
  const last = totalPages
  const first = 1
  for (let i = Math.max(first, page - window); i <= Math.min(last, page + window); i += 1) out.push(i)
  if (out[0] !== first) {
    out.unshift('...')
    out.unshift(first)
  }
  if (out[out.length - 1] !== last) {
    out.push('...')
    out.push(last)
  }
  return out
}
