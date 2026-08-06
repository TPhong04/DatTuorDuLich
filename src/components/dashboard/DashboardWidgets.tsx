import { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarCheck, CheckCircle2, Clock4, Users2, Wallet } from 'lucide-react'
import { Booking } from '@/features/bookings/bookings'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'
import { formatMoney, formatVNDShort } from '@/utils/format'

type Trend = 'up' | 'down'

type KpiCardProps = {
  label: string
  value: string
  sub?: string
  trend?: Trend
  trendPct?: number
  icon?: ReactNode
  tone?: 'blue' | 'orange' | 'emerald' | 'rose'
  onClick?: () => void
}

const toneMap: Record<NonNullable<KpiCardProps['tone']>, { bg: string; ring: string; chip: string; text: string; iconBg: string }> = {
  blue: {
    bg: 'from-blue-50 to-white via-white',
    ring: 'ring-blue-100',
    chip: 'bg-blue-500',
    text: 'text-blue-700',
    iconBg: 'bg-blue-50 text-blue-600 ring-blue-100',
  },
  orange: {
    bg: 'from-orange-50 to-white via-white',
    ring: 'ring-orange-100',
    chip: 'bg-orange-500',
    text: 'text-orange-700',
    iconBg: 'bg-orange-50 text-orange-600 ring-orange-100',
  },
  emerald: {
    bg: 'from-emerald-50 to-white via-white',
    ring: 'ring-emerald-100',
    chip: 'bg-emerald-500',
    text: 'text-emerald-700',
    iconBg: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  },
  rose: {
    bg: 'from-rose-50 to-white via-white',
    ring: 'ring-rose-100',
    chip: 'bg-rose-500',
    text: 'text-rose-700',
    iconBg: 'bg-rose-50 text-rose-600 ring-rose-100',
  },
}

export function KpiCard({
  label,
  value,
  sub,
  trend = 'up',
  trendPct = 0,
  icon,
  tone = 'blue',
  onClick,
}: KpiCardProps) {
  const t = toneMap[tone]
  return (
    <button
      onClick={onClick}
      type="button"
      className={cn(
        'group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-left shadow-sm ring-1 ring-inset transition hover:-translate-y-0.5 hover:shadow-md',
        t.bg,
        t.ring,
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-white to-transparent opacity-70 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
          <div className={cn('mt-2 text-3xl font-black tracking-tight', t.text)}>{value}</div>
          {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
        </div>
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ring-inset', t.iconBg)}>
          {icon}
        </div>
      </div>
      {trendPct ? (
        <div className="relative mt-4 flex items-center gap-1.5 text-[11px] font-bold">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5',
              trend === 'up' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700',
            )}
          >
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendPct.toFixed(1)}%
          </span>
          <span className="text-slate-500">so với tuần trước</span>
        </div>
      ) : null}
    </button>
  )
}

type BookingStatusBadgeProps = {
  status: Booking['status']
  paymentStatus?: Booking['paymentStatus']
}

const statusTone: Record<Booking['status'], string> = {
  new: 'bg-sky-50 text-sky-700 ring-sky-100',
  pending: 'bg-amber-50 text-amber-700 ring-amber-100',
  confirmed: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  in_progress: 'bg-violet-50 text-violet-700 ring-violet-100',
  completed: 'bg-blue-50 text-blue-700 ring-blue-100',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-100',
}

const statusLabel: Record<Booking['status'], string> = {
  new: 'Mới',
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  in_progress: 'Đang đi',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
}

const payTone: Record<Booking['paymentStatus'], string> = {
  unpaid: 'bg-rose-50 text-rose-700 ring-rose-100',
  partial: 'bg-amber-50 text-amber-700 ring-amber-100',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
}

const payLabel: Record<Booking['paymentStatus'], string> = {
  unpaid: 'Chưa thanh toán',
  partial: 'Cọc 1 phần',
  paid: 'Đã thanh toán',
}

export function BookingStatusBadge({ status, paymentStatus }: BookingStatusBadgeProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', statusTone[status])}>
        {statusLabel[status]}
      </span>
      {paymentStatus ? (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset', payTone[paymentStatus])}>
          {payLabel[paymentStatus]}
        </span>
      ) : null}
    </div>
  )
}

type SectionTitleProps = {
  title: ReactNode
  action?: ReactNode
  subtitle?: ReactNode
}

export function SectionTitle({ title, subtitle, action }: SectionTitleProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-800">{title}</h3>
        {subtitle ? <div className="mt-1 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', className)}>
      {children}
    </div>
  )
}

type TopSeller = { rank: number; title: string; tourCode?: string | null; sold: number; revenue: number; tone: string }

export function TopSellers({ data }: { data: TopSeller[] }) {
  return (
    <div className="space-y-3">
      {data.map((it) => (
        <div key={it.rank} className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-black text-white shadow-sm ring-1 ring-white/30',
              it.tone,
            )}
          >
            #0{it.rank}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-slate-800">{it.title}</div>
            <div className="mt-0.5 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {it.tourCode ? <span>Mã: {it.tourCode}</span> : null}
              <span className="inline-flex items-center gap-1">
                <Users2 className="h-3 w-3" /> {it.sold} khách
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-black text-orange-600">{formatVNDShort(it.revenue)}</div>
            <div className="text-[10px] text-slate-400">{formatMoney(it.revenue)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

type CalendarEvent = { day: number; tone: 'blue' | 'orange' | 'rose' | 'emerald'; label?: string }

export function MiniCalendar({
  year,
  month,
  today,
  events = [],
}: {
  year: number
  month: number
  today: number
  events?: CalendarEvent[]
}) {
  const startWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const eventMap = new Map<number, CalendarEvent['tone']>()
  events.forEach((e) => eventMap.set(e.day, e.tone))
  const weekdayLabels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
  const toneCls: Record<CalendarEvent['tone'], string> = {
    blue: 'bg-blue-500 text-white',
    orange: 'bg-orange-500 text-white',
    rose: 'bg-rose-500 text-white',
    emerald: 'bg-emerald-500 text-white',
  }
  const monthLabel = `Tháng ${String(month + 1).padStart(2, '0')}/${year}`

  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {weekdayLabels.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5 text-center text-xs">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />
          const isToday = d === today
          const ev = eventMap.get(d)
          return (
            <div
              key={i}
              className={cn(
                'relative aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition',
                isToday
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : ev
                  ? cn(toneCls[ev], 'shadow-sm')
                  : 'text-slate-600 hover:bg-slate-100',
              )}
              title={ev ? `Ngày ${d}/${month + 1}: ${monthLabel} - ${ev}` : `Ngày ${d}/${month + 1}`}
            >
              {d}
              {isToday && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-orange-400" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

type TimelineEvent = {
  time: string
  tone: 'blue' | 'orange' | 'emerald' | 'rose'
  title: string
  desc?: string
  avatar?: string
}

const timelineTone: Record<TimelineEvent['tone'], string> = {
  blue: 'bg-blue-500 ring-blue-100',
  orange: 'bg-orange-500 ring-orange-100',
  emerald: 'bg-emerald-500 ring-emerald-100',
  rose: 'bg-rose-500 ring-rose-100',
}

export function ActivityTimeline({ items }: { items: TimelineEvent[] }) {
  return (
    <ol className="relative space-y-4 pl-8">
      <span className="absolute left-[13px] top-1 bottom-1 w-px bg-slate-200" />
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span
            className={cn(
              'absolute -left-[26px] top-1 flex h-6 w-6 items-center justify-center rounded-full ring-4',
              timelineTone[it.tone],
            )}
          >
            <span className="block h-1.5 w-1.5 rounded-full bg-white" />
          </span>
          <div className="flex items-start gap-3">
            {it.avatar ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-orange-500 text-[11px] font-black text-white">
                {it.avatar}
              </div>
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Clock4 className="h-3.5 w-3.5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{it.time}</span>
                <span className="truncate text-sm font-bold text-slate-800">{it.title}</span>
              </div>
              {it.desc ? <div className="mt-0.5 text-xs text-slate-500">{it.desc}</div> : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function IconByTone({ tone }: { tone: NonNullable<KpiCardProps['tone']> }) {
  switch (tone) {
    case 'blue':
      return <CheckCircle2 className="h-5 w-5" />
    case 'orange':
      return <Wallet className="h-5 w-5" />
    case 'emerald':
      return <Users2 className="h-5 w-5" />
    case 'rose':
      return <CalendarCheck className="h-5 w-5" />
  }
}

export function RecentBookingsTable({ items }: { items: Booking[] }) {
  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center text-sm text-slate-500">
        Chưa có booking mới nào trong khoảng thời gian này.
      </div>
    )
  }
  const dots: Record<string, string> = {
    new: 'bg-sky-500',
    pending: 'bg-amber-500',
    confirmed: 'bg-emerald-500',
    in_progress: 'bg-violet-500',
    completed: 'bg-blue-500',
    cancelled: 'bg-rose-500',
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3 first:rounded-l-2xl">#</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Mã đơn</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Khách hàng</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">SĐT</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Tour</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Khởi hành</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Khách</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3 text-right last:rounded-r-2xl">Tổng</th>
            <th className="whitespace-nowrap border-y border-slate-100 bg-slate-50/60 px-5 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {items.map((b, i) => (
            <tr key={b.id} className="align-middle hover:bg-slate-50/70">
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3 font-mono text-xs text-slate-400">
                {String(i + 1).padStart(2, '0')}
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3">
                <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-2.5 py-1 ring-1 ring-inset ring-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span className="font-mono text-[11px] font-black tracking-wide text-blue-700">{b.code}</span>
                </div>
              </td>
              <td className="border-b border-slate-100 px-5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full text-xs font-black text-white ring-2 ring-white shadow-sm',
                        i % 4 === 0
                          ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                          : i % 4 === 1
                          ? 'bg-gradient-to-br from-orange-500 to-rose-500'
                          : i % 4 === 2
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          : 'bg-gradient-to-br from-violet-500 to-indigo-600',
                      )}
                    >
                      {(b.contact.name || '?').trim().slice(0, 1).toUpperCase()}
                    </div>
                    <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white', dots[b.status])} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-slate-800">{b.contact.name}</div>
                    <div className="truncate text-[11px] text-slate-500">{b.contact.email || '—'}</div>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-slate-600">{b.contact.phone}</td>
              <td className="border-b border-slate-100 px-5 py-3">
                <div className="truncate font-semibold text-slate-800">{b.tour.title}</div>
                <div className="truncate text-[11px] text-slate-500">{b.tour.code || '—'}</div>
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-slate-600">
                {b.departureStandardText || formatDate(b.departureDate)}
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-xs text-slate-600">
                {b.adultCount ? <span className="mr-1.5 rounded-md bg-slate-100 px-1.5 py-0.5 font-bold">NL {b.adultCount}</span> : null}
                {b.childCount ? <span className="mr-1.5 rounded-md bg-orange-50 px-1.5 py-0.5 font-bold text-orange-700">TE {b.childCount}</span> : null}
                {b.infantCount ? <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700">EB {b.infantCount}</span> : null}
              </td>
              <td className="whitespace-nowrap border-b border-slate-100 px-5 py-3 text-right font-black text-orange-600">
                {formatMoney(b.totalAmount)}
              </td>
              <td className="border-b border-slate-100 px-5 py-3">
                <BookingStatusBadge status={b.status} paymentStatus={b.paymentStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
