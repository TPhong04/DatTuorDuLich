import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Booking, BookingDocument } from '../bookings/booking.schema'
import { Tour, TourDocument } from '../tours/tour.schema'
import { User, UserDocument } from '../users/user.schema'

export type ReportPeriodPreset = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'

export type AdminFinancialSummaryInput = {
  fromISO?: string | null
  toISO?: string | null
  preset?: ReportPeriodPreset
  tourTypeCategory?: string | null
  createdById?: string | null
  channel?: string | null
  scopeToOwner?: boolean
  userId?: Types.ObjectId | null
}

export type FinancialKpis = {
  bookingCountAll: number
  bookingCountCompleted: number
  bookingCountCancelled: number
  grossRevenue: number
  discountTotalEstimated: number
  netRevenue: number
  paidTotal: number
  unpaidTotal: number
  partialPaidTotal: number
  outstandingTotal: number
  passengerTotal: number
  passengerAdult: number
  passengerChild: number
  passengerInfant: number
  aovCompleted: number
  cancellationRate: number
  topTour: { tourId: string | null; title: string; tourCode: string | null; revenue: number } | null
  overdueOutstandingTotal: number
  overdueCount: number
  paymentCompletionRate: number
}

export type AdminDonutSlice = { label: string; value: number; color: string }
export type AdminLinePoint = { label: string; value: number; key: string }
export type AdminBarRow = { label: string; value: number; color: string; valueSecondary?: number }

export type MonthlyAggRow = {
  key: string
  label: string
  bookingCount: number
  completedCount: number
  cancelledCount: number
  revenue: number
  passengerTotal: number
  aov: number
  cancellationRate: number
}

export type OutStandingRow = {
  id: string
  code: string
  customer: { name: string; phone: string; email: string | null }
  tour: { title: string; code: string | null }
  departureDate: string
  createdAt: string
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  status: Booking['status']
  paymentStatus: Booking['paymentStatus']
  holdsUntil: string | null
  overdueDays: number
}

export type FinancialReport = {
  period: { fromISO: string; toISO: string; preset: ReportPeriodPreset }
  kpis: FinancialKpis
  revenueLine: AdminLinePoint[]
  tourTypeSlices: AdminDonutSlice[]
  paymentMethodSlices: AdminDonutSlice[]
  regionRevenueBars: AdminBarRow[]
  monthly: MonthlyAggRow[]
  outstanding: OutStandingRow[]
}

export type ReportBookingsGroupKey = 'none' | 'month_created' | 'staff_created' | 'tour_type' | 'region' | 'status' | 'payment_status'

export type ReportBookingsSortKey =
  | 'createdAt_desc'
  | 'createdAt_asc'
  | 'totalAmount_desc'
  | 'totalAmount_asc'
  | 'departureDate_desc'
  | 'departureDate_asc'

export type ReportBookingsFilterInput = {
  preset?: ReportPeriodPreset
  fromISO?: string | null
  toISO?: string | null
  statuses?: Array<Booking['status']> | null
  paymentStatuses?: Array<Booking['paymentStatus']> | null
  passengerTypes?: Array<'NL' | 'TE' | 'EB'> | null
  paymentMethods?: Array<Booking['paymentMethod']> | null
  tourTypeCategory?: string | null
  tourIds?: string[] | null
  departureFromISO?: string | null
  departureToISO?: string | null
  createdByStaffIds?: string[] | null
  minAmount?: number | null
  maxAmount?: number | null
  searchKeyword?: string | null
  channels?: string[] | null
  groupBy?: ReportBookingsGroupKey
  sort?: ReportBookingsSortKey
  page?: number
  pageSize?: number
  scopeToOwner?: boolean
  userId?: Types.ObjectId | null
}

export type ReportBookingsRow = {
  id: string
  code: string
  customerName: string
  customerPhone: string
  customerEmail: string | null
  passengerCount: number
  passengerAdult: number
  passengerChild: number
  passengerInfant: number
  tourId: string | null
  tourCode: string | null
  tourTitle: string
  tourTypeCategory: string
  region: string
  departureDateISO: string
  createdAtISO: string
  createdByStaffId: string | null
  createdByStaffName: string | null
  status: Booking['status']
  paymentStatus: Booking['paymentStatus']
  paymentMethod: Booking['paymentMethod']
  subtotalAmount: number
  surchargeAmount: number
  vatAmount: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  holdsUntilISO: string | null
  overdueDays: number
  notes: string | null
}

export type ReportBookingsGroupRow = {
  key: string
  label: string
  bookingCount: number
  passengerTotal: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  aov: number
  completedCount: number
  cancelledCount: number
}

export type ReportBookingsSummary = {
  bookingCountAll: number
  totalAmount: number
  paidAmount: number
  outstandingAmount: number
  overdueAmount: number
  completedCount: number
  cancelledCount: number
  passengerTotal: number
}

export type ReportBookingsResponse = {
  period: { fromISO: string; toISO: string; preset: ReportPeriodPreset }
  summary: ReportBookingsSummary
  groupRows: ReportBookingsGroupRow[]
  groupKey: ReportBookingsGroupKey
  rows: ReportBookingsRow[]
  page: number
  pageSize: number
  totalRows: number
  totalPages: number
  sort: ReportBookingsSortKey
}


const TOUR_TYPE_META: Array<{
  predicate: (t: TourDocument | null, tourCode: string | null, title: string) => boolean
  label: string
  color: string
}> = [
  {
    predicate: (_t, code, title) =>
      /ngoài\s?nước|quốc\s?tế|campuchia|thái\s?lan|hàn\s?quốc|nhật\s?bản|china|trung\s?quốc|siam|laos|myanmar|singapore|malaysia/i.test(
        title,
      ) || /intl|external|nx|nt/i.test(code || ''),
    label: 'Nước ngoài',
    color: '#f97316',
  },
  {
    predicate: (t, _code, title) =>
      /đoàn|mice|công\s?ty|doanh\s?nghiệp|sự\s?kiện|team\s?building/i.test(title) ||
      (!!t && t.type === 'group'),
    label: 'Đoàn riêng / MICE',
    color: '#0ea5e9',
  },
  {
    predicate: (_t, _code, title) => /tour\s?xe|xe\s?khách|limo|bus|đường\s?bộ/i.test(title),
    label: 'Tour xe / Đường bộ',
    color: '#10b981',
  },
]

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
const PAYMENT_META: Record<Booking['paymentMethod'], { label: string; color: string }> = {
  bank_transfer: { label: 'Chuyển khoản ngân hàng', color: '#2563eb' },
  online: { label: 'Thanh toán online (VNPay/MoMo)', color: '#10b981' },
  hold: { label: 'Giữ chỗ / Tiền mặt tại VP', color: '#f97316' },
}
const REGION_PRIORITY = ['Bắc', 'Trung', 'Nam', 'Quốc tế']

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
}
function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function parseDateSafe(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export type BookingWithLean = {
  _id: Types.ObjectId
  status: Booking['status']
  paymentStatus: Booking['paymentStatus']
  paymentMethod: Booking['paymentMethod']
  totalAmount: number
  surchargeAmount: number
  subtotalAmount: number
  adultCount: number
  childCount: number
  infantCount: number
  departureDate: Date
  createdAt: Date
  holdsUntil: Date | null
  cancelledAt: Date | null
  tourId: Types.ObjectId | null
  tourSnapshot?: { title?: string; code?: string | null } | null
  contact: { name: string; phone: string; email: string | null; address: string | null }
  code: string
  createdBy: Types.ObjectId | null
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Tour.name) private readonly tourModel: Model<TourDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private classifyTour(tour: TourDocument | null, tourCode: string | null, title: string) {
    for (const meta of TOUR_TYPE_META) {
      if (meta.predicate(tour, tourCode, title)) {
        return { category: meta.label, color: meta.color }
      }
    }
    return { category: 'Tour Việt Nam nội địa', color: '#64748b' }
  }

  private inferRegion(tour: TourDocument | null, tourCode: string | null, title: string): string {
    if (tour?.region && REGION_PRIORITY.includes(tour.region)) return tour.region
    if (tour?.region) return tour.region
    const text = `${title || ''} ${tourCode || ''}`.toLowerCase()
    if (/(hạ long|sapa|sài gòn|hà nội|ninh bình|mộc châu|điện biên|hà giang|quảng ninh|hai phòng|lào cai|yên bái|nam định|thái bình|hưng yên)/i.test(text)) return 'Bắc'
    if (/(đà nẵng|hội an|huế|nha trang|phú yên|quảng nam|quảng ngãi|kon tum|bình định|đắc lắc|hòa bình|thừa thiên|huế|quảng trị|quảng bình|đắk nông|gia lai)/i.test(text)) return 'Trung'
    if (/(hồ chí minh|tphcm|sài gòn|vũng tàu|phú quốc|cần thơ|hậu giang|tiền giang|bến tre|đồng tháp|an giang|kiên giang|cà mau|bà rịa|bình dương|đồng nai|bình phước|tây ninh|lâm đồng|đà lạt|long an)/i.test(text)) return 'Nam'
    if (/(ngoài nước|quốc tế|campuchia|thái lan|hàn quốc|nhật bản|lao|miến|china|singapore|malaysia|myanmar|intl|nx|nt)/i.test(text)) return 'Quốc tế'
    return 'Chưa phân loại'
  }

  resolvePeriod(preset: ReportPeriodPreset | undefined, fromISO: string | null | undefined, toISO: string | null | undefined) {
    const now = new Date()
    let from: Date
    let to: Date
    let realPreset: ReportPeriodPreset = preset || 'month'

    if (preset === 'custom' && fromISO && toISO) {
      const f = parseDateSafe(fromISO)
      const t = parseDateSafe(toISO)
      if (f && t) {
        from = startOfDay(f)
        to = endOfDay(t)
        realPreset = 'custom'
      }
    }

    switch (realPreset) {
      case 'today':
        from = startOfDay(now)
        to = endOfDay(now)
        break
      case 'week': {
        const day = now.getDay()
        from = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day === 0 ? 6 : day - 1)))
        to = new Date(from)
        to.setDate(to.getDate() + 6)
        to = endOfDay(to)
        break
      }
      case 'month':
        from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
        to = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
        break
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3)
        from = startOfDay(new Date(now.getFullYear(), q * 3, 1))
        to = endOfDay(new Date(now.getFullYear(), q * 3 + 3, 0))
        break
      }
      case 'year':
        from = startOfDay(new Date(now.getFullYear(), 0, 1))
        to = endOfDay(new Date(now.getFullYear(), 11, 31))
        break
      default: {
        const f = parseDateSafe(fromISO) || startOfDay(now)
        const t = parseDateSafe(toISO) || endOfDay(now)
        from = startOfDay(f)
        to = endOfDay(t)
      }
    }

    return { from, to, preset: realPreset }
  }

  private categorizeTour(row: {
    tourId: Types.ObjectId | null
    title: string
    code: string | null
    region: string | null
    type?: Tour['type']
  }): { category: string; categoryColor: string; regionLabel: string } {
    let t: TourDocument | null = null
    if (row.tourId) t = (this.tourCache.get(String(row.tourId)) as TourDocument) ?? null
    for (const rule of TOUR_TYPE_META) {
      if (rule.predicate(t, row.code, row.title)) {
        return { category: rule.label, categoryColor: rule.color, regionLabel: this.regionFor(row.region, row.title) }
      }
    }
    return { category: 'Trong nước', categoryColor: '#2563eb', regionLabel: this.regionFor(row.region, row.title) }
  }

  private regionFor(region: string | null, title: string) {
    const r = (region || title || '').toLowerCase()
    for (const label of REGION_PRIORITY) {
      if (label === 'Quốc tế') continue
      if (r.includes(label.toLowerCase())) return `Miền ${label}`
    }
    if (/quốc tế|nx|nước ngoài|international|campuchia|thai|korea|japan|singapore|malaysia|laos|myanmar|china/i.test(r)) return 'Quốc tế'
    return 'Không phân vùng'
  }

  private tourCache = new Map<string, TourDocument | null>()

  async getFinancialReport(input: AdminFinancialSummaryInput): Promise<FinancialReport> {
    const { from, to, preset } = this.resolvePeriod(input.preset, input.fromISO, input.toISO)

    const scopeQuery: Record<string, unknown> = input.scopeToOwner && input.userId ? { createdBy: input.userId } : {}
    if (input.createdById && Types.ObjectId.isValid(input.createdById)) {
      scopeQuery.createdBy = new Types.ObjectId(input.createdById)
    }

    const allBookingsQ = this.bookingModel
      .find({ createdAt: { $gte: from, $lte: to }, ...scopeQuery })
      .select(
        '_id code status paymentStatus paymentMethod totalAmount surchargeAmount subtotalAmount adultCount childCount infantCount departureDate createdAt holdsUntil cancelledAt tourId tourSnapshot contact createdBy',
      )
      .lean()
    const toursQ = this.tourModel.find({}).select('_id title code type region').lean()
    const allBookings = (await allBookingsQ) as unknown as BookingWithLean[]
    const tours = (await toursQ) as TourDocument[]

    this.tourCache = new Map()
    for (const t of tours) this.tourCache.set(String((t as any)._id), t as TourDocument)

    const enriched = allBookings.map((b) => {
      const tourTitle = b.tourSnapshot?.title || this.tourCache.get(String(b.tourId))?.title || 'Tour'
      const tourCode = b.tourSnapshot?.code ?? this.tourCache.get(String(b.tourId))?.code ?? null
      const region =
        (this.tourCache.get(String(b.tourId)) as TourDocument | undefined)?.region ||
        (b.tourSnapshot?.title || '')
      const type = (this.tourCache.get(String(b.tourId)) as TourDocument | undefined)?.type
      const cat = this.categorizeTour({ tourId: b.tourId, title: tourTitle, code: tourCode, region, type })
      return { booking: b, tourTitle, tourCode, cat }
    })

    let filtered = enriched
    if (input.tourTypeCategory && input.tourTypeCategory !== 'all') {
      filtered = filtered.filter((x) => x.cat.category === input.tourTypeCategory)
    }

    // KPI aggregation
    const nowDate = new Date()
    const kpis: FinancialKpis = {
      bookingCountAll: 0,
      bookingCountCompleted: 0,
      bookingCountCancelled: 0,
      grossRevenue: 0,
      discountTotalEstimated: 0,
      netRevenue: 0,
      paidTotal: 0,
      unpaidTotal: 0,
      partialPaidTotal: 0,
      outstandingTotal: 0,
      passengerTotal: 0,
      passengerAdult: 0,
      passengerChild: 0,
      passengerInfant: 0,
      aovCompleted: 0,
      cancellationRate: 0,
      topTour: null,
      overdueOutstandingTotal: 0,
      overdueCount: 0,
      paymentCompletionRate: 0,
    }
    const completedRevenue: number[] = []
    const tourAgg = new Map<string, { tourId: string | null; title: string; code: string | null; revenue: number }>()
    const categoryAgg = new Map<string, number>()
    const paymentMethodAgg = new Map<Booking['paymentMethod'], number>()
    const regionAgg = new Map<string, number>()

    // Line buckets by day
    const buckets = new Map<string, { dateKey: string; label: string; value: number }>()
    {
      const cursor = new Date(from)
      while (cursor <= to) {
        const key = toISO(cursor)
        buckets.set(key, { dateKey: key, label: cursor.getDate() + '/' + (cursor.getMonth() + 1), value: 0 })
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    const monthlyMap = new Map<string, MonthlyAggRow>()
    const outstandingList: OutStandingRow[] = []

    for (const item of filtered) {
      const { booking, tourTitle, tourCode, cat } = item
      const isCancelled = booking.status === 'cancelled'
      kpis.bookingCountAll += 1
      if (booking.status === 'completed' || booking.status === 'confirmed' || booking.status === 'in_progress') {
        kpis.bookingCountCompleted += 1
        if (booking.status === 'completed') completedRevenue.push(Number(booking.totalAmount || 0))
      }
      if (isCancelled) kpis.bookingCountCancelled += 1
      kpis.grossRevenue += Number(booking.subtotalAmount || 0) + Number(booking.surchargeAmount || 0)
      if (!isCancelled) kpis.netRevenue += Number(booking.totalAmount || 0)
      kpis.passengerAdult += Number(booking.adultCount || 0)
      kpis.passengerChild += Number(booking.childCount || 0)
      kpis.passengerInfant += Number(booking.infantCount || 0)
      kpis.passengerTotal += Number(booking.adultCount || 0) + Number(booking.childCount || 0) + Number(booking.infantCount || 0)

      let paidAmount = 0
      if (booking.paymentStatus === 'paid') paidAmount = Number(booking.totalAmount || 0)
      else if (booking.paymentStatus === 'partial') paidAmount = Math.round(Number(booking.totalAmount || 0) * 0.5)
      const outstanding = Math.max(0, Number(booking.totalAmount || 0) - paidAmount)

      if (booking.paymentStatus === 'paid') kpis.paidTotal += Number(booking.totalAmount || 0)
      else if (booking.paymentStatus === 'partial') {
        kpis.paidTotal += paidAmount
        kpis.partialPaidTotal += Number(booking.totalAmount || 0)
        kpis.unpaidTotal += outstanding
      } else {
        kpis.unpaidTotal += outstanding
      }
      if (!isCancelled) kpis.outstandingTotal += outstanding

      categoryAgg.set(cat.category, (categoryAgg.get(cat.category) ?? 0) + (isCancelled ? 0 : Number(booking.totalAmount || 0)))
      paymentMethodAgg.set(booking.paymentMethod, (paymentMethodAgg.get(booking.paymentMethod) ?? 0) + (isCancelled ? 0 : Number(booking.totalAmount || 0)))
      regionAgg.set(cat.regionLabel, (regionAgg.get(cat.regionLabel) ?? 0) + (isCancelled ? 0 : Number(booking.totalAmount || 0)))

      const createdAtDay = toISO(booking.createdAt instanceof Date ? booking.createdAt : new Date(booking.createdAt))
      const buck = buckets.get(createdAtDay)
      if (buck) {
        const pax =
          Number(booking.adultCount || 0) + Number(booking.childCount || 0) + Number(booking.infantCount || 0)
        buck.value += pax
      }

      const tKey = String(booking.tourId) || tourTitle
      const agg = tourAgg.get(tKey) || {
        tourId: booking.tourId ? String(booking.tourId) : null,
        title: tourTitle,
        code: tourCode,
        revenue: 0,
      }
      agg.revenue += isCancelled ? 0 : Number(booking.totalAmount || 0)
      tourAgg.set(tKey, agg)

      // Month row
      const mDate = booking.createdAt instanceof Date ? booking.createdAt : new Date(booking.createdAt)
      const mKey = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}`
      const mRow = monthlyMap.get(mKey) || {
        key: mKey,
        label: `T${String(mDate.getMonth() + 1).padStart(2, '0')}/${mDate.getFullYear()}`,
        bookingCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        revenue: 0,
        passengerTotal: 0,
        aov: 0,
        cancellationRate: 0,
      }
      mRow.bookingCount += 1
      if (booking.status === 'completed' || booking.status === 'confirmed' || booking.status === 'in_progress') mRow.completedCount += 1
      if (booking.status === 'cancelled') mRow.cancelledCount += 1
      if (!isCancelled) {
        mRow.revenue += Number(booking.totalAmount || 0)
        mRow.passengerTotal +=
          Number(booking.adultCount || 0) + Number(booking.childCount || 0) + Number(booking.infantCount || 0)
      }
      monthlyMap.set(mKey, mRow)

      // Outstanding list
      if (!isCancelled && outstanding > 0) {
        let overdueDays = 0
        if (booking.holdsUntil) {
          const hu = booking.holdsUntil instanceof Date ? booking.holdsUntil : new Date(booking.holdsUntil)
          if (hu < nowDate) {
            overdueDays = Math.max(0, Math.round((nowDate.getTime() - hu.getTime()) / (24 * 3600 * 1000)))
          }
        } else if (
          booking.departureDate &&
          new Date(booking.departureDate).getTime() < nowDate.getTime() &&
          booking.paymentStatus !== 'paid'
        ) {
          overdueDays = Math.max(0, Math.round((nowDate.getTime() - new Date(booking.departureDate).getTime()) / (24 * 3600 * 1000)))
        }
        if (overdueDays > 0) {
          kpis.overdueCount += 1
          kpis.overdueOutstandingTotal += outstanding
        }
        outstandingList.push({
          id: String(booking._id),
          code: booking.code,
          customer: {
            name: booking.contact?.name || '',
            phone: booking.contact?.phone || '',
            email: booking.contact?.email || null,
          },
          tour: { title: tourTitle, code: tourCode },
          departureDate: toISO(booking.departureDate instanceof Date ? booking.departureDate : new Date(booking.departureDate)),
          createdAt: (booking.createdAt instanceof Date ? booking.createdAt : new Date(booking.createdAt)).toISOString(),
          totalAmount: Number(booking.totalAmount || 0),
          paidAmount,
          outstandingAmount: outstanding,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          holdsUntil: booking.holdsUntil
            ? (booking.holdsUntil instanceof Date ? booking.holdsUntil : new Date(booking.holdsUntil)).toISOString()
            : null,
          overdueDays,
        })
      }
    }

    kpis.discountTotalEstimated = Math.max(0, kpis.grossRevenue - (kpis.netRevenue + kpis.bookingCountCancelled * 0))
    kpis.cancellationRate = kpis.bookingCountAll === 0 ? 0 : (kpis.bookingCountCancelled / kpis.bookingCountAll) * 100
    kpis.aovCompleted =
      completedRevenue.length === 0 ? 0 : completedRevenue.reduce((s, n) => s + n, 0) / completedRevenue.length
    kpis.paymentCompletionRate =
      kpis.bookingCountAll === 0 || kpis.paidTotal + kpis.unpaidTotal + (kpis.partialPaidTotal ? 0 : 0) === 0
        ? 100
        : Math.min(
            100,
            Math.round(
              (kpis.paidTotal /
                Math.max(
                  1,
                  kpis.netRevenue > 0 ? kpis.netRevenue : kpis.paidTotal + kpis.unpaidTotal + (kpis.partialPaidTotal ? 0 : 0),
                )) *
                10000,
            ) / 100,
          )
    kpis.topTour =
      Array.from(tourAgg.values()).sort((a, b) => b.revenue - a.revenue).map((t) => ({ ...t, tourCode: t.code, code: undefined as any }))[0] ||
      null

    const revenueLine: AdminLinePoint[] = Array.from(buckets.values()).map((x) => ({
      key: x.dateKey,
      label: buckets.size <= 14 ? x.label : WEEKDAY_LABELS[(new Date(x.dateKey)).getDay()] || x.label,
      value: x.value,
    }))

    const tourTypeSlices: AdminDonutSlice[] = Array.from(categoryAgg.entries()).map(([label, value]) => {
      const rule = TOUR_TYPE_META.find((r) => r.label === label)
      return { label, value, color: rule?.color || '#2563eb' }
    })
    if (tourTypeSlices.length === 0) tourTypeSlices.push({ label: 'Trong nước', value: 1, color: '#2563eb' })

    const paymentMethodSlices: AdminDonutSlice[] = Array.from(paymentMethodAgg.entries()).map(([key, value]) => ({
      label: PAYMENT_META[key as Booking['paymentMethod']].label,
      value,
      color: PAYMENT_META[key as Booking['paymentMethod']].color,
    }))
    if (paymentMethodSlices.length === 0)
      paymentMethodSlices.push({ label: PAYMENT_META.bank_transfer.label, value: 1, color: PAYMENT_META.bank_transfer.color })

    const regionRevenueBars: AdminBarRow[] = Array.from(regionAgg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value], idx) => ({
        label,
        value,
        color: ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#0ea5e9', '#f43f5e'][idx % 6],
      }))

    const monthly: MonthlyAggRow[] = Array.from(monthlyMap.values())
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((r) => ({
        ...r,
        aov: r.completedCount === 0 ? 0 : r.revenue / r.completedCount,
        cancellationRate: r.bookingCount === 0 ? 0 : (r.cancelledCount / r.bookingCount) * 100,
      }))
    // Fill missing months for current year
    if (monthly.length > 0 && monthly.length < 12) {
      const currentYear = new Date().getFullYear()
      const existingKeys = new Set(monthly.map((m) => m.key))
      for (let i = 0; i < 12; i += 1) {
        const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`
        if (!existingKeys.has(key)) {
          monthly.push({
            key,
            label: `T${String(i + 1).padStart(2, '0')}/${currentYear}`,
            bookingCount: 0,
            completedCount: 0,
            cancelledCount: 0,
            revenue: 0,
            passengerTotal: 0,
            aov: 0,
            cancellationRate: 0,
          })
        }
      }
      monthly.sort((a, b) => a.key.localeCompare(b.key))
    }

    outstandingList.sort((a, b) => b.overdueDays - a.overdueDays || b.outstandingAmount - a.outstandingAmount)

    return {
      period: { fromISO: toISO(from), toISO: toISO(to), preset },
      kpis,
      revenueLine,
      tourTypeSlices,
      paymentMethodSlices,
      regionRevenueBars,
      monthly,
      outstanding: outstandingList.slice(0, 30),
    }
  }

  async getBookingsReport(input: ReportBookingsFilterInput): Promise<ReportBookingsResponse> {
    const { from, to, preset: realPreset } = this.resolvePeriod(input.preset, input.fromISO, input.toISO)
    const now = new Date()

    const page = Math.max(1, Math.floor(input.page ?? 1))
    const pageSize = Math.max(1, Math.min(500, Math.floor(input.pageSize ?? 25)))
    const sort = input.sort ?? 'createdAt_desc'
    const groupKey: ReportBookingsGroupKey = input.groupBy ?? 'none'

    const bookingFilter: Record<string, unknown> = {
      createdAt: { $gte: from, $lte: to },
    }

    if (input.scopeToOwner && input.userId) {
      bookingFilter.createdBy = input.userId
    } else if (Array.isArray(input.createdByStaffIds) && input.createdByStaffIds.length > 0) {
      const ids = input.createdByStaffIds
        .filter((x) => x && Types.ObjectId.isValid(x))
        .map((x) => new Types.ObjectId(x))
      if (ids.length > 0) bookingFilter.createdBy = { $in: ids }
    }

    if (Array.isArray(input.statuses) && input.statuses.length > 0) {
      bookingFilter.status = { $in: input.statuses }
    }
    if (Array.isArray(input.paymentStatuses) && input.paymentStatuses.length > 0) {
      bookingFilter.paymentStatus = { $in: input.paymentStatuses }
    }
    if (Array.isArray(input.paymentMethods) && input.paymentMethods.length > 0) {
      bookingFilter.paymentMethod = { $in: input.paymentMethods }
    }

    if (Array.isArray(input.tourIds) && input.tourIds.length > 0) {
      const tids = input.tourIds
        .filter((x) => x && Types.ObjectId.isValid(x))
        .map((x) => new Types.ObjectId(x))
      if (tids.length > 0) bookingFilter.tourId = { $in: tids }
    }

    const departureFilter: Record<string, unknown> = {}
    if (input.departureFromISO) {
      const d = parseDateSafe(input.departureFromISO)
      if (d) departureFilter.$gte = startOfDay(d)
    }
    if (input.departureToISO) {
      const d = parseDateSafe(input.departureToISO)
      if (d) departureFilter.$lte = endOfDay(d)
    }
    if (Object.keys(departureFilter).length > 0) bookingFilter.departureDate = departureFilter

    if (typeof input.minAmount === 'number' && !Number.isNaN(input.minAmount) && typeof input.maxAmount === 'number' && !Number.isNaN(input.maxAmount)) {
      bookingFilter.totalAmount = { $gte: input.minAmount, $lte: input.maxAmount }
    } else if (typeof input.minAmount === 'number' && !Number.isNaN(input.minAmount)) {
      bookingFilter.totalAmount = { $gte: input.minAmount }
    } else if (typeof input.maxAmount === 'number' && !Number.isNaN(input.maxAmount)) {
      bookingFilter.totalAmount = { $lte: input.maxAmount }
    }

    if (input.searchKeyword && input.searchKeyword.trim().length > 0) {
      const kw = input.searchKeyword.trim()
      bookingFilter.$or = [
        { code: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { 'contact.name': { $regex: kw, $options: 'i' } },
        { 'contact.phone': { $regex: kw, $options: 'i' } },
        { 'contact.email': { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { 'tourSnapshot.title': { $regex: kw, $options: 'i' } },
        { 'tourSnapshot.code': { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
      ]
    }

    const hasPassengerFilter = Array.isArray(input.passengerTypes) && input.passengerTypes.length > 0
    const hasTourCategoryFilter = typeof input.tourTypeCategory === 'string' && input.tourTypeCategory !== 'all' && input.tourTypeCategory.length > 0

    const leanBookings: any[] = await this.bookingModel.find(bookingFilter).sort({ createdAt: -1 }).lean().limit(5000).exec()
    const tourIds = new Set<string>()
    const userIds = new Set<string>()
    for (const b of leanBookings) {
      if (b.tourId) tourIds.add(String(b.tourId))
      if (b.createdBy) userIds.add(String(b.createdBy))
    }

    const [toursRaw, usersRaw] = await Promise.all([
      tourIds.size > 0 ? this.tourModel.find({ _id: { $in: Array.from(tourIds).map((id) => new Types.ObjectId(id)) } }).lean().exec() : [],
      userIds.size > 0 ? this.userModel.find({ _id: { $in: Array.from(userIds).map((id) => new Types.ObjectId(id)) } }).select('_id name email phone role').lean().exec() : [],
    ] as any)

    const tourMap = new Map<string, any>()
    for (const t of toursRaw) tourMap.set(String(t._id), t)
    const userMap = new Map<string, any>()
    for (const u of usersRaw) userMap.set(String(u._id), u)

    const rowsPre: Array<ReportBookingsRow & { _sortCreatedAt: Date; _sortDeparture: Date; _sortAmount: number }> = []

    for (const b of leanBookings) {
      const tour = b.tourId ? (tourMap.get(String(b.tourId)) || null) : null
      const tourTitle = b.tourSnapshot?.title || tour?.title || 'Tour chưa xác định'
      const tourCode = b.tourSnapshot?.code || tour?.code || null
      const { category } = this.classifyTour(tour, tourCode, tourTitle)
      const region = this.inferRegion(tour, tourCode, tourTitle)

      if (hasTourCategoryFilter && input.tourTypeCategory && input.tourTypeCategory !== 'all' && category !== input.tourTypeCategory) continue

      const adultCount = Number(b.adultCount ?? 0) || 0
      const childCount = Number(b.childCount ?? 0) || 0
      const infantCount = Number(b.infantCount ?? 0) || 0
      const passengerCount = adultCount + childCount + infantCount

      if (hasPassengerFilter) {
        const wanted = new Set(input.passengerTypes || [])
        const hasNL = wanted.has('NL')
        const hasTE = wanted.has('TE')
        const hasEB = wanted.has('EB')
        const matchesType =
          (hasNL && adultCount > 0) ||
          (hasTE && childCount > 0) ||
          (hasEB && infantCount > 0) ||
          (Array.isArray(b.passengers) && b.passengers.some((p: any) => p && wanted.has(p.type)))
        if (!matchesType) continue
      }

      const totalAmount = Number(b.totalAmount ?? 0) || 0
      let paidAmount = 0
      if (b.paymentStatus === 'paid') paidAmount = totalAmount
      else if (b.paymentStatus === 'partial') paidAmount = Math.round(totalAmount * 0.5)
      else paidAmount = 0
      const outstandingAmount = Math.max(0, totalAmount - paidAmount)
      const holdsUntil = b.holdsUntil ? new Date(b.holdsUntil) : null
      const overdueDays =
        outstandingAmount > 0 && holdsUntil && holdsUntil.getTime() < now.getTime()
          ? Math.floor((now.getTime() - holdsUntil.getTime()) / 86_400_000)
          : 0

      const staff = b.createdBy ? userMap.get(String(b.createdBy)) : null
      rowsPre.push({
        id: String(b._id),
        code: String(b.code || ''),
        customerName: b.contact?.name || 'Khách lẻ',
        customerPhone: b.contact?.phone || '',
        customerEmail: b.contact?.email || null,
        passengerCount,
        passengerAdult: adultCount,
        passengerChild: childCount,
        passengerInfant: infantCount,
        tourId: b.tourId ? String(b.tourId) : null,
        tourCode,
        tourTitle,
        tourTypeCategory: category,
        region,
        departureDateISO: toISO(new Date(b.departureDate)),
        createdAtISO: toISO(new Date(b.createdAt)),
        createdByStaffId: b.createdBy ? String(b.createdBy) : null,
        createdByStaffName: staff?.name || null,
        status: b.status,
        paymentStatus: b.paymentStatus,
        paymentMethod: b.paymentMethod,
        subtotalAmount: Number(b.subtotalAmount ?? 0) || 0,
        surchargeAmount: Number(b.surchargeAmount ?? 0) || 0,
        vatAmount: Number(b.vatAmount ?? 0) || 0,
        totalAmount,
        paidAmount,
        outstandingAmount,
        holdsUntilISO: holdsUntil ? toISO(holdsUntil) : null,
        overdueDays,
        notes: b.notes || null,
        _sortCreatedAt: new Date(b.createdAt),
        _sortDeparture: new Date(b.departureDate),
        _sortAmount: totalAmount,
      })
    }

    // Apply sort (memory sort 5000 is fine)
    rowsPre.sort((a, b) => {
      switch (sort) {
        case 'createdAt_asc':
          return a._sortCreatedAt.getTime() - b._sortCreatedAt.getTime()
        case 'createdAt_desc':
          return b._sortCreatedAt.getTime() - a._sortCreatedAt.getTime()
        case 'totalAmount_asc':
          return a._sortAmount - b._sortAmount
        case 'totalAmount_desc':
          return b._sortAmount - a._sortAmount
        case 'departureDate_asc':
          return a._sortDeparture.getTime() - b._sortDeparture.getTime()
        case 'departureDate_desc':
          return b._sortDeparture.getTime() - a._sortDeparture.getTime()
      }
      return 0
    })

    // Summary
    const summary: ReportBookingsSummary = {
      bookingCountAll: rowsPre.length,
      totalAmount: rowsPre.reduce((acc, r) => acc + r.totalAmount, 0),
      paidAmount: rowsPre.reduce((acc, r) => acc + r.paidAmount, 0),
      outstandingAmount: rowsPre.reduce((acc, r) => acc + r.outstandingAmount, 0),
      overdueAmount: rowsPre.reduce((acc, r) => (r.overdueDays > 0 ? acc + r.outstandingAmount : acc), 0),
      completedCount: rowsPre.filter((r) => r.status === 'completed').length,
      cancelledCount: rowsPre.filter((r) => r.status === 'cancelled').length,
      passengerTotal: rowsPre.reduce((acc, r) => acc + r.passengerCount, 0),
    }

    // Group rows
    const groupRowsMap = new Map<string, ReportBookingsGroupRow>()
    if (groupKey !== 'none') {
      for (const r of rowsPre) {
        let key: string
        let label: string
        switch (groupKey) {
          case 'month_created': {
            const d = r._sortCreatedAt
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
            label =
              ({
                new: 'Đơn mới',
                pending: 'Chờ xử lý',
                confirmed: 'Đã xác nhận',
                in_progress: 'Đang thực hiện',
                completed: 'Hoàn thành',
                cancelled: 'Đã hủy',
              } as Record<string, string>)[r.status] || r.status
            break
          case 'payment_status':
            key = r.paymentStatus
            label =
              ({
                unpaid: 'Chưa thanh toán',
                partial: 'Thanh toán 1 phần',
                paid: 'Đã thanh toán đủ',
              } as Record<string, string>)[r.paymentStatus] || r.paymentStatus
            break
          default:
            key = 'all'
            label = 'Tất cả'
        }
        const cur = groupRowsMap.get(key) || {
          key,
          label,
          bookingCount: 0,
          passengerTotal: 0,
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          aov: 0,
          completedCount: 0,
          cancelledCount: 0,
        }
        cur.bookingCount += 1
        cur.passengerTotal += r.passengerCount
        cur.totalAmount += r.totalAmount
        cur.paidAmount += r.paidAmount
        cur.outstandingAmount += r.outstandingAmount
        if (r.status === 'completed') cur.completedCount += 1
        if (r.status === 'cancelled') cur.cancelledCount += 1
        groupRowsMap.set(key, cur)
      }
      for (const g of groupRowsMap.values()) {
        g.aov = g.bookingCount === 0 ? 0 : g.totalAmount / g.bookingCount
      }
    }
    const groupRows = Array.from(groupRowsMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

    // Pagination
    const totalRows = rowsPre.length
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const start = (page - 1) * pageSize
    const pageRows = rowsPre.slice(start, start + pageSize).map(({ _sortCreatedAt: _a, _sortDeparture: _b, _sortAmount: _c, ...rest }) => rest as ReportBookingsRow)

    return {
      period: { fromISO: toISO(from), toISO: toISO(to), preset: realPreset },
      summary,
      groupRows,
      groupKey,
      rows: pageRows,
      page,
      pageSize,
      totalRows,
      totalPages,
      sort,
    }
  }
}
