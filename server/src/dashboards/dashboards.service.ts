import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Booking, BookingDocument } from '../bookings/booking.schema'
import { Tour, TourDocument } from '../tours/tour.schema'

export type AdminDashboardKpis = {
  bookingCount: number
  bookingRevenueTotal: number
  passengerTotal: number
  pendingCount: number
}

export type AdminDonutSlice = { label: string; value: number; color: string }

export type AdminLinePoint = { label: string; value: number }

export type AdminTopSeller = {
  rank: number
  tourId: string | null
  title: string
  tourCode: string | null
  sold: number
  revenue: number
  tone: string
}

export type AdminDashboardRecentBooking = {
  id: string
  code: string
  status: Booking['status']
  paymentStatus: Booking['paymentStatus']
  totalAmount: number
  adultCount: number
  childCount: number
  infantCount: number
  departureDate: string
  departureStandardText: string | null
  createdAt: string
  tour: { title: string; slug: string; code: string | null; durationDays: number; durationNights: number; coverImageUrl: string | null }
  contact: { name: string; phone: string; email: string | null }
}

export type AdminCalendarEvent = { day: number; tone: 'blue' | 'orange' | 'rose' | 'emerald'; label: string }

export type AdminDashboardSummary = {
  kpis: AdminDashboardKpis
  statusSlices: AdminDonutSlice[]
  tourTypeSlices: AdminDonutSlice[]
  line7Days: AdminLinePoint[]
  topSellers: AdminTopSeller[]
  recentBookings: AdminDashboardRecentBooking[]
  calendarEvents: AdminCalendarEvent[]
  calendar: { year: number; month: number; today: number }
}

const STATUS_META: Array<{ key: Booking['status']; label: string; color: string }> = [
  { key: 'confirmed', label: 'Đã xác nhận', color: '#10b981' },
  { key: 'new', label: 'Mới tạo', color: '#8b5cf6' },
  { key: 'pending', label: 'Chờ thanh toán / Xác nhận', color: '#f97316' },
  { key: 'in_progress', label: 'Đang khởi hành', color: '#0ea5e9' },
  { key: 'completed', label: 'Đã hoàn thành', color: '#2563eb' },
  { key: 'cancelled', label: 'Đã hủy', color: '#f43f5e' },
]

const TOUR_TYPE_META: Array<{ predicate: (t: TourDocument | null, tourCode: string | null, title: string) => boolean; label: string; color: string }> = [
  { predicate: (t, code, title) => /ngoài\s?nước|quốc\s?tế|campuchia|thái\s?lan|hàn\s?quốc|nhật\s?bản|china|trung\s?quốc|siam|laos|myanmar|singapore|malaysia/i.test(title) || /intl|external|nx|nt/i.test(code || ''), label: 'Nước ngoài', color: '#f97316' },
  { predicate: (t, code, title) => /đoàn|mice|công\s?ty|doanh\s?nghiệp|sự\s?kiện|team\s?building/i.test(title) || /tour\s?xe|xe\s?khách|limo|bus/i.test(title) || (!!t && t.type === 'group'), label: 'Tour xe / Đoàn riêng', color: '#0ea5e9' },
]

const TOP_TONES = [
  'bg-gradient-to-br from-blue-500 to-orange-500',
  'bg-gradient-to-br from-orange-500 to-rose-500',
  'bg-gradient-to-br from-emerald-500 to-teal-600',
  'bg-gradient-to-br from-violet-500 to-indigo-600',
  'bg-gradient-to-br from-sky-500 to-cyan-600',
]

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

function pickTourCategory(row: { tourId: Types.ObjectId | null; title: string; code: string | null }, tours: Map<string, TourDocument | null>): { label: string; color: string } {
  const t = row.tourId ? (tours.get((row.tourId as Types.ObjectId).toString()) ?? null) : null
  for (const rule of TOUR_TYPE_META) {
    if (rule.predicate(t, row.code, row.title)) return { label: rule.label, color: rule.color }
  }
  return { label: 'Trong nước', color: '#2563eb' }
}

function calendarTone(dep: TourDocument | null, bookingCount: number, statuses: { pending: number; soldoutLowSeat: boolean }): 'blue' | 'orange' | 'rose' | 'emerald' {
  if (statuses.soldoutLowSeat) return 'rose'
  if (statuses.pending > 0 || bookingCount >= 4) return 'orange'
  if (dep) return 'emerald'
  return 'blue'
}

@Injectable()
export class DashboardsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Tour.name) private readonly tourModel: Model<TourDocument>,
  ) {}

  async getAdminSummary(userId: Types.ObjectId | null, opts?: { scopeToOwner?: boolean }): Promise<AdminDashboardSummary> {
    const now = new Date()
    const nowISO = toISO(now)

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      d.setDate(d.getDate() - (6 - i))
      return d
    })

    const scopeQuery: Record<string, unknown> = opts?.scopeToOwner && userId ? { createdBy: userId } : {}

    const [allBookings, toursAll] = await Promise.all([
      this.bookingModel
        .find({ ...scopeQuery })
        .select(
          'code status paymentStatus totalAmount adultCount childCount infantCount departureDate departureStandardText createdAt tourId tourSnapshot contact',
        )
        .sort({ createdAt: -1 })
        .limit(500)
        .lean(),
      this.tourModel.find({}).select('title slug code type region themes categories departures').lean(),
    ])

    const toursMap = new Map<string, TourDocument>()
    toursAll.forEach((t) => toursMap.set((t._id as Types.ObjectId).toString(), t as TourDocument))

    const kpis: AdminDashboardKpis = {
      bookingCount: 0,
      bookingRevenueTotal: 0,
      passengerTotal: 0,
      pendingCount: 0,
    }
    const statusCounts = new Map<Booking['status'], number>()
    const byDayPassenger = new Map<string, number>()
    const byTourStats = new Map<string, { tourId: Types.ObjectId | null; title: string; code: string | null; pax: number; revenue: number }>()
    const tourCategoryCounts = new Map<string, number>()

    days.forEach((d) => byDayPassenger.set(toISO(d), 0))

    for (const b of allBookings) {
      const isCancelled = b.status === 'cancelled'
      kpis.bookingCount += 1
      if (!isCancelled) {
        kpis.bookingRevenueTotal += Number(b.totalAmount || 0)
        const pax = Number(b.adultCount || 0) + Number(b.childCount || 0) + Number(b.infantCount || 0)
        kpis.passengerTotal += pax
      }
      if (b.status === 'new' || b.status === 'pending') kpis.pendingCount += 1
      statusCounts.set(b.status, (statusCounts.get(b.status) ?? 0) + 1)

      const createdDay = toISO(b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt))
      if (byDayPassenger.has(createdDay)) {
        const pax = Number(b.adultCount || 0) + Number(b.childCount || 0) + Number(b.infantCount || 0)
        byDayPassenger.set(createdDay, (byDayPassenger.get(createdDay) ?? 0) + pax)
      }

      const title = String(b.tourSnapshot?.title || toursMap.get(String(b.tourId))?.title || 'Tour chưa xác định')
      const code = String(b.tourSnapshot?.code || toursMap.get(String(b.tourId))?.code || '') || null
      const key = String(b.tourId || title)
      const agg = byTourStats.get(key) || { tourId: b.tourId as Types.ObjectId | null, title, code, pax: 0, revenue: 0 }
      agg.pax += Number(b.adultCount || 0) + Number(b.childCount || 0) + Number(b.infantCount || 0)
      if (!isCancelled) agg.revenue += Number(b.totalAmount || 0)
      byTourStats.set(key, agg)

      const cat = pickTourCategory(
        { tourId: (b.tourId as Types.ObjectId) || null, title, code },
        toursMap as unknown as Map<string, TourDocument | null>,
      )
      tourCategoryCounts.set(cat.label + '|' + cat.color, (tourCategoryCounts.get(cat.label + '|' + cat.color) ?? 0) + 1)
    }

    const statusSlices: AdminDonutSlice[] = STATUS_META.map((m) => ({
      label: m.label,
      value: statusCounts.get(m.key) ?? 0,
      color: m.color,
    })).filter((s) => s.value > 0)

    const tourTypeSlices: AdminDonutSlice[] = Array.from(tourCategoryCounts.entries()).map(([key, value]) => {
      const [label, color] = key.split('|')
      return { label, value, color: color || '#94a3b8' }
    })
    if (tourTypeSlices.length === 0) {
      tourTypeSlices.push({ label: 'Trong nước', value: Math.max(1, kpis.bookingCount), color: '#2563eb' })
    }
    if (statusSlices.length === 0) {
      statusSlices.push({ label: 'Mới tạo', value: 1, color: '#8b5cf6' })
    }

    const line7Days: AdminLinePoint[] = days.map((d) => {
      const iso = toISO(d)
      return { label: WEEKDAY_LABELS[d.getDay()] || iso, value: byDayPassenger.get(iso) ?? 0 }
    })

    const topSellers: AdminTopSeller[] = Array.from(byTourStats.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map((row, idx) => ({
        rank: idx + 1,
        tourId: row.tourId ? String(row.tourId) : null,
        title: row.title,
        tourCode: row.code,
        sold: row.pax,
        revenue: row.revenue,
        tone: TOP_TONES[idx] || TOP_TONES[0],
      }))

    const recentBookings: AdminDashboardRecentBooking[] = allBookings.slice(0, 12).map((b) => ({
      id: String(b._id),
      code: b.code,
      status: b.status,
      paymentStatus: b.paymentStatus,
      totalAmount: Number(b.totalAmount || 0),
      adultCount: Number(b.adultCount || 0),
      childCount: Number(b.childCount || 0),
      infantCount: Number(b.infantCount || 0),
      departureDate: toISO(b.departureDate instanceof Date ? b.departureDate : new Date(b.departureDate)),
      departureStandardText: b.departureStandardText || null,
      createdAt: (b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt)).toISOString(),
      tour: {
        title: b.tourSnapshot?.title || toursMap.get(String(b.tourId))?.title || 'Tour',
        slug: b.tourSnapshot?.slug || toursMap.get(String(b.tourId))?.slug || '',
        code: b.tourSnapshot?.code || toursMap.get(String(b.tourId))?.code || null,
        durationDays: b.tourSnapshot?.durationDays ?? toursMap.get(String(b.tourId))?.durationDays ?? 1,
        durationNights: b.tourSnapshot?.durationNights ?? toursMap.get(String(b.tourId))?.durationNights ?? 0,
        coverImageUrl: b.tourSnapshot?.coverImageUrl ?? toursMap.get(String(b.tourId))?.coverImageUrl ?? null,
      },
      contact: {
        name: b.contact?.name || '',
        phone: b.contact?.phone || '',
        email: b.contact?.email || null,
      },
    }))

    const yMonth = now.getFullYear()
    const mMonth = now.getMonth()
    const calendar: AdminDashboardSummary['calendar'] = { year: yMonth, month: mMonth, today: now.getDate() }

    const daysInMonth = new Date(yMonth, mMonth + 1, 0).getDate()
    const depStart = new Date(yMonth, mMonth, 1)
    const depEnd = new Date(yMonth, mMonth, daysInMonth, 23, 59, 59, 999)
    const monthBookings = allBookings.filter((b) => {
      const dd = b.departureDate instanceof Date ? b.departureDate : new Date(b.departureDate)
      return dd >= depStart && dd <= depEnd
    })
    const bookingByDay = new Map<number, { count: number; pending: number; lowSeat: boolean; tour: TourDocument | null }>()
    for (const b of monthBookings) {
      const dd = b.departureDate instanceof Date ? b.departureDate : new Date(b.departureDate)
      const d = dd.getDate()
      const cur = bookingByDay.get(d) || { count: 0, pending: 0, lowSeat: false, tour: null }
      cur.count += 1
      if (b.status === 'new' || b.status === 'pending') cur.pending += 1
      const t = b.tourId ? toursMap.get(String(b.tourId)) ?? null : null
      if (!cur.tour) cur.tour = (t as TourDocument | null) ?? null
      if (t && Array.isArray((t as any)?.departures)) {
        const dstd = toISO(b.departureDate instanceof Date ? b.departureDate : new Date(b.departureDate))
        const matchDep = ((t as any).departures as Array<any>).find(
          (dep: any) => dep?.departureDate && toISO(new Date(dep.departureDate)) === dstd,
        )
        if (typeof matchDep?.seatsAvailable === 'number' && matchDep.seatsAvailable <= 5) cur.lowSeat = true
      }
      bookingByDay.set(d, cur)
    }

    const calendarEvents: AdminCalendarEvent[] = Array.from(bookingByDay.entries())
      .sort((a, b) => a[0] - b[0])
      .slice(0, 10)
      .map(([day, meta]) => {
        const tone = calendarTone(meta.tour as TourDocument | null, meta.count, { pending: meta.pending, soldoutLowSeat: meta.lowSeat })
        const tourTitle = (meta.tour as TourDocument | null)?.title || 'Đợt khởi hành'
        const labelPieces: string[] = []
        if (meta.lowSeat) labelPieces.push('⚠️ Hết chỗ nhanh')
        labelPieces.push(`${meta.count} đơn`)
        if (meta.pending > 0) labelPieces.push(`${meta.pending} chờ xác nhận`)
        labelPieces.push(tourTitle)
        return { day, tone, label: labelPieces.join(' · ') }
      })
    if (calendarEvents.length === 0) {
      calendarEvents.push({ day: Math.min(now.getDate() + 3, daysInMonth), tone: 'blue', label: `Hôm nay: ${nowISO} - Dữ liệu lịch tour sẽ được cập nhật tự động khi có booking mới.` })
    }

    void startOfDay

    return { kpis, statusSlices, tourTypeSlices, line7Days, topSellers, recentBookings, calendarEvents, calendar }
  }
}
