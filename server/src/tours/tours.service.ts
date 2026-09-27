import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'

import { Tour, TourDeparture, TourDocument, TourDepartureStatus, TourReview } from './tour.schema'

function toDate(input: string) {
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map((x) => parseInt(x, 10))
    const localNoon = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0)
    if (Number.isNaN(localNoon.getTime())) return null
    return localNoon
  }
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function toNumberOrNull(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null
}

function computeDiscount(price: number | null, originalPrice: number | null): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null
  if (typeof originalPrice !== 'number' || !Number.isFinite(originalPrice) || originalPrice <= price) return null
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100)
  if (pct <= 0) return null
  return pct
}

function applyDiscountToPrice(originalPrice: number | null, discountPercent: number | null): number | null {
  if (typeof originalPrice !== 'number' || !Number.isFinite(originalPrice) || originalPrice <= 0) return null
  if (typeof discountPercent !== 'number' || !Number.isFinite(discountPercent) || discountPercent <= 0) return null
  const factor = 1 - Math.min(100, Math.max(0, discountPercent)) / 100
  const raw = originalPrice * factor
  return Math.max(0, Math.round(raw / 1000) * 1000)
}

function normalizeDeparture(d: any): TourDeparture | null {
  const date = typeof d?.departureDate === 'string' ? toDate(d.departureDate) : d?.departureDate instanceof Date ? d.departureDate : null
  if (!date) return null

  const standardText = typeof d?.standardText === 'string' ? d.standardText.trim() : null
  const discountInput = toNumberOrNull(d?.discountPercent)
  const originalPriceAdult = toNumberOrNull(d?.originalPriceAdult)
  const originalPriceChild = toNumberOrNull(d?.originalPriceChild)
  const originalPriceInfant = toNumberOrNull(d?.originalPriceInfant)
  const priceAdultRaw = typeof d?.priceAdult === 'number' ? d.priceAdult : 0
  const priceChildRaw = toNumberOrNull(d?.priceChild)
  const priceInfantRaw = toNumberOrNull(d?.priceInfant)

  let priceAdult: number = priceAdultRaw
  let priceChild: number | null = priceChildRaw
  let priceInfant: number | null = priceInfantRaw
  let discountPercent: number | null = discountInput
  if (typeof discountPercent === 'number' && discountPercent > 0) {
    priceAdult = applyDiscountToPrice(originalPriceAdult ?? null, discountPercent) ?? priceAdultRaw
    priceChild = applyDiscountToPrice(originalPriceChild ?? null, discountPercent) ?? priceChildRaw
    priceInfant = applyDiscountToPrice(originalPriceInfant ?? null, discountPercent) ?? priceInfantRaw
  } else {
    discountPercent = computeDiscount(priceAdultRaw, originalPriceAdult)
  }
  const seatsTotal = typeof d?.seatsTotal === 'number' ? d.seatsTotal : 0
  const seatsAvailable = typeof d?.seatsAvailable === 'number' ? d.seatsAvailable : 0
  const status: TourDepartureStatus =
    d?.status === 'open' || d?.status === 'closed' || d?.status === 'cancelled' || d?.status === 'soldout'
      ? d.status
      : 'open'

  return {
    departureDate: date,
    standardText,
    priceAdult,
    priceChild,
    priceInfant,
    originalPriceAdult,
    originalPriceChild,
    originalPriceInfant,
    discountPercent,
    seatsTotal,
    seatsAvailable,
    status,
  }
}

function isDepartureBookable(d: TourDeparture) {
  if (d.status === 'closed' || d.status === 'cancelled' || d.status === 'soldout') return false
  return (typeof d.seatsAvailable === 'number' ? d.seatsAvailable : 0) > 0
}

function computeNextDeparture(t: { departures?: TourDeparture[] }) {
  const now = new Date()
  const ds = Array.isArray(t.departures) ? t.departures : []
  const valid = ds
    .filter((d) => d?.departureDate instanceof Date && !Number.isNaN(d.departureDate.getTime()))
    .filter(isDepartureBookable)
    .filter((d) => d.departureDate.getTime() >= now.getTime())
    .sort((a, b) => a.departureDate.getTime() - b.departureDate.getTime())

  const next = valid[0] ?? null
  return next
}

function computeSummary(t: any) {
  const next = computeNextDeparture(t)
  const departures: TourDeparture[] = Array.isArray(t.departures) ? t.departures : []
  const prices: number[] = []
  let seats = 0
  let bestDiscountPct: number | null = null
  let bestDiscountOriginal: number | null = null
  let bestDiscountPrice: number | null = null
  for (const d of departures) {
    if (typeof d.priceAdult === 'number' && d.priceAdult > 0) prices.push(d.priceAdult)
    if (typeof d.seatsAvailable === 'number') seats += d.seatsAvailable
    if (typeof d.discountPercent === 'number' && d.discountPercent > 0) {
      if (bestDiscountPct == null || d.discountPercent > bestDiscountPct) {
        bestDiscountPct = d.discountPercent
        bestDiscountPrice = typeof d.priceAdult === 'number' && d.priceAdult > 0 ? d.priceAdult : bestDiscountPrice
        bestDiscountOriginal =
          typeof d.originalPriceAdult === 'number' && d.originalPriceAdult > 0
            ? d.originalPriceAdult
            : bestDiscountOriginal
      }
    }
  }
  const priceTableRows = Array.isArray(t.priceTable) ? t.priceTable : []
  for (const r of priceTableRows) {
    if (typeof r?.amount === 'number' && r.amount > 0) prices.push(r.amount)
  }
  const priceFrom = prices.length ? Math.min(...prices) : null
  const originalPriceFrom = bestDiscountOriginal
  const discountFrom = bestDiscountPct
  const seatsAvailable = seats > 0 ? seats : null
  return {
    nextDepartureDate: next?.departureDate ?? null,
    nextDepartureStandardText: next?.standardText ?? null,
    nextDeparturePriceAdult: next?.priceAdult ?? null,
    nextDepartureOriginalPriceAdult: next?.originalPriceAdult ?? null,
    nextDepartureDiscountPercent: next?.discountPercent ?? discountFrom ?? null,
    priceFrom,
    originalPriceFrom,
    discountFrom,
    seatsAvailable,
  }
}

@Injectable()
export class ToursService {
  constructor(@InjectModel(Tour.name) private readonly tours: Model<TourDocument>) {}

  async listPublic(): Promise<any[]> {
    const items = await this.tours
      .find({ isPublished: true })
      .sort({ updatedAt: -1 })
      .lean()
      .exec()

    return items
      .map((t: any) => {
        const summary = computeSummary(t)
        return {
          ...t,
          ...summary,
        }
      })
      .sort((a: any, b: any) => {
        const ad = a?.nextDepartureDate ? new Date(a.nextDepartureDate).getTime() : Number.POSITIVE_INFINITY
        const bd = b?.nextDepartureDate ? new Date(b.nextDepartureDate).getTime() : Number.POSITIVE_INFINITY
        return ad - bd
      })
  }

  async listRelated(slug: string, limit = 4): Promise<any[]> {
    const base = await this.tours.findOne({ slug, isPublished: true }).lean().exec()
    const region = typeof base?.region === 'string' ? base.region : null
    const categories = Array.isArray(base?.categories) ? base.categories : []
    const themes = Array.isArray(base?.themes) ? base.themes : []

    const match: any = { isPublished: true, slug: { $ne: slug } }
    if (region || categories.length || themes.length) {
      match.$or = []
      if (region) match.$or.push({ region })
      if (categories.length) match.$or.push({ categories: { $in: categories } })
      if (themes.length) match.$or.push({ themes: { $in: themes } })
    }

    const items = await this.tours.find(match).sort({ updatedAt: -1 }).limit(Math.max(limit, 4)).lean().exec()
    return items.map((t) => ({ ...t, ...computeSummary(t) }))
  }

  async findPublicBySlug(slug: string): Promise<any> {
    const found = await this.tours.findOne({ slug, isPublished: true }).lean().exec()
    if (!found) throw new NotFoundException('Không tìm thấy tour')
    return { ...found, ...computeSummary(found) }
  }

  async listAdmin(): Promise<any[]> {
    const items = await this.tours.find().sort({ updatedAt: -1 }).lean().exec()
    return items.map((t) => ({ ...t, ...computeSummary(t) }))
  }

  async findByIdAdmin(id: string): Promise<any> {
    const found = await this.tours.findById(id).lean().exec()
    if (!found) throw new NotFoundException('Không tìm thấy tour')
    return found
  }

  async create(input: any) {
    const doc = await this.tours.create({
      ...input,
      departures: (Array.isArray(input?.departures) ? input.departures : []).map(normalizeDeparture).filter(Boolean),
    })
    return doc
  }

  async update(id: string, patch: any) {
    const nextPatch: any = { ...patch }
    if ('departures' in nextPatch) {
      nextPatch.departures = (Array.isArray(patch?.departures) ? patch.departures : []).map(normalizeDeparture).filter(Boolean)
    }

    const updated = await this.tours.findByIdAndUpdate(id, nextPatch, { new: true }).exec()
    if (!updated) throw new NotFoundException('Không tìm thấy tour')
    return updated
  }

  async remove(id: string) {
    const removed = await this.tours.findByIdAndDelete(id).exec()
    if (!removed) throw new NotFoundException('Không tìm thấy tour')
    return removed
  }

  async findBySlugAdmin(slug: string) {
    return this.tours.findOne({ slug }).exec()
  }

  computeRatingFromReviews(reviews: TourReview[] | undefined | null) {
    const rs = Array.isArray(reviews) ? reviews : []
    const approved = rs.filter((r) => r?.approved === true && typeof r.rating === 'number')
    const count = approved.length
    const avg =
      count > 0
        ? approved.reduce((sum, r) => sum + (r.rating || 0), 0) / count
        : null
    return {
      reviewCount: count,
      avgRating: avg == null ? null : Math.round(avg * 10) / 10,
    }
  }

  async listDepartures(opts: {
    tab?: 'month' | 'week' | 'all' | 'low_stock' | 'soldout' | 'soon_24h'
    monthISO?: string | null
    q?: string | null
    skip?: number
    limit?: number
  }) {
    const tab = opts.tab ?? 'month'
    const skip = Math.max(0, Number(opts.skip) || 0)
    const limit = Math.min(200, Math.max(1, Number(opts.limit) || 50))
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart.getTime() + 86400000)

    // Date range theo tab
    let dateMatch: any = null
    switch (tab) {
      case 'week': {
        const dayOfWeek = todayStart.getDay() // 0 CN..6 T7 (VN đầu tuần Thứ 2: lùi (dayOfWeek+6)%7
        const offset = (dayOfWeek + 6) % 7
        const weekStart = new Date(todayStart.getTime() - offset * 86400000)
        const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)
        dateMatch = { $gte: weekStart, $lt: weekEnd }
        break
      }
      case 'soon_24h': {
        dateMatch = { $gte: now, $lt: new Date(now.getTime() + 86400000) }
        break
      }
      case 'month':
      default: {
        // Mặc định: tháng hiện tại, nếu có monthISO (YYYY-MM) thì dùng
        let y = now.getFullYear()
        let m = now.getMonth()
        if (opts.monthISO && /^\d{4}-\d{2}$/.test(opts.monthISO)) {
          const [ys, ms] = opts.monthISO.split('-')
          y = parseInt(ys, 10)
          m = parseInt(ms, 10) - 1
        }
        const monthStart = new Date(y, m, 1)
        const nextMonthStart = new Date(y, m + 1, 1)
        dateMatch = { $gte: monthStart, $lt: nextMonthStart }
        break
      }
      case 'all': {
        dateMatch = null
        break
      }
    }

    const pipeline: any[] = []
    // Stage 1: search theo tour (title/slug/code/region) trước khi $unwind (để giảm docs)
    if (opts.q?.trim()) {
      const q = opts.q.trim()
      const qRe = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      pipeline.push({
        $match: {
          $or: [{ title: qRe }, { slug: qRe }, { code: qRe }, { region: qRe }, { themes: qRe }, { categories: qRe }],
        },
      })
    }
    pipeline.push({
      $project: {
        _id: 1,
        title: 1,
        slug: 1,
        code: 1,
        region: 1,
        durationDays: 1,
        durationNights: 1,
        departureFrom: 1,
        coverImageUrl: 1,
        isPublished: 1,
        departures: 1,
      },
    })
    pipeline.push({ $unwind: { path: '$departures', includeArrayIndex: 'depIdx' } })

    // Stage dateMatch sau khi $unwind (hoặc trước cũng được, pipeline tối ưu đã push match)
    if (dateMatch) pipeline.push({ $match: { 'departures.departureDate': dateMatch } })

    // Tab đặc biệt (sau khi có dep object)
    switch (tab) {
      case 'soldout':
        pipeline.push({
          $match: {
            $or: [
              { 'departures.status': 'soldout' },
              { $expr: { $lte: ['$departures.seatsAvailable', 0] } },
            ],
          },
        })
        break
      case 'low_stock':
        pipeline.push({
          $match: {
            'departures.status': { $nin: ['cancelled', 'closed', 'soldout'] },
            $expr: {
              $and: [
                { $gt: ['$departures.seatsTotal', 0] },
                { $lte: [{ $divide: ['$departures.seatsAvailable', '$departures.seatsTotal'] }, 0.15] },
              ],
            },
          },
        })
        break
    }

    // Sort theo ngày đi tăng dần (sớm nhất đầu)
    pipeline.push({ $sort: { 'departures.departureDate': 1 } })

    // Count tổng (phục vụ pagination): $facet
    pipeline.push({
      $facet: {
        rows: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: 'total' }],
      },
    })

    const [res] = await this.tours.aggregate(pipeline).exec()
    const rows = (res?.rows ?? []) as any[]
    const total = Number(res?.meta?.[0]?.total ?? 0)

    const items = rows.map((r: any) => {
      const dep = r.departures ?? {}
      const seatsTotal = Number(dep.seatsTotal || 0)
      const seatsAvailable = Math.min(seatsTotal, Math.max(0, Number(dep.seatsAvailable || 0)))
      const fillRate = seatsTotal > 0 ? seatsAvailable / seatsTotal : 0
      let status: TourDepartureStatus = dep.status
      if (!status || !['open', 'closed', 'cancelled', 'soldout'].includes(status)) {
        if (seatsAvailable <= 0) status = 'soldout'
        else status = 'open'
      }
      // Derived badges
      const depDate = dep.departureDate instanceof Date ? dep.departureDate : new Date(dep.departureDate as any)
      const within24h = depDate.getTime() > now.getTime() && depDate.getTime() <= now.getTime() + 86400000
      const depPast = depDate.getTime() < todayStart.getTime()
      const depNow = depDate.getTime() >= todayStart.getTime() && depDate.getTime() < todayEnd.getTime()

      return {
        id: String(dep._id?.toString?.() ?? dep._id ?? r.depIdx ?? ''),
        depIdx: Number(r.depIdx),
        tourId: String(r._id.toString()),
        tourTitle: r.title ?? '',
        tourSlug: r.slug ?? '',
        tourCode: r.code ?? null,
        tourRegion: r.region ?? null,
        durationDays: Number(r.durationDays ?? 1),
        durationNights: Number(r.durationNights ?? 0),
        departureFrom: r.departureFrom ?? null,
        coverImageUrl: r.coverImageUrl ?? null,
        isTourPublished: Boolean(r.isPublished),
        departureDateISO: depDate.toISOString(),
        standardText: dep.standardText ?? null,
        priceAdult: Number(dep.priceAdult || 0),
        priceChild: typeof dep.priceChild === 'number' ? dep.priceChild : null,
        priceInfant: typeof dep.priceInfant === 'number' ? dep.priceInfant : null,
        originalPriceAdult: typeof dep.originalPriceAdult === 'number' ? dep.originalPriceAdult : null,
        discountPercent: typeof dep.discountPercent === 'number' ? dep.discountPercent : null,
        seatsTotal,
        seatsBooked: seatsTotal - seatsAvailable,
        seatsAvailable,
        fillRatePct: seatsTotal > 0 ? Math.round((1 - fillRate) * 100) : 0,
        status,
        badgeWithin24h: within24h && !depPast,
        badgeIsToday: depNow,
        badgePast: depPast,
      }
    })

    return { items, total, skip, limit }
  }

  async patchDeparture(depIdHex: string, patch: {
    priceAdult?: number
    priceChild?: number | null
    priceInfant?: number | null
    originalPriceAdult?: number | null
    discountPercent?: number | null
    seatsTotal?: number
    seatsAvailable?: number
    status?: TourDepartureStatus
    standardText?: string | null
    departureDate?: string | null
  }) {
    if (!depIdHex) throw new BadRequestException('Missing departure id')
    // Step 1: Tìm tour chứa departure._id
    const tour = await this.tours
      .findOne({ 'departures._id': new Types.ObjectId(depIdHex) })
      .select('_id departures')
      .exec()
    if (!tour) throw new NotFoundException('Không tìm thấy departure')
    const deps = Array.isArray((tour as any).departures) ? (tour as any).departures : []
    const depIdx = deps.findIndex((d: any) => String(d._id?.toString?.() ?? d._id) === depIdHex)
    if (depIdx < 0) throw new NotFoundException('departure không nằm trong tour')

    const current = deps[depIdx] as TourDeparture
    // Tính toán normalize 1 phần departure (giống normalizeDeparture nhưng chỉ patch field được cung cấp)
    const next: any = { ...current }
    if ('departureDate' in patch) {
      const d = patch.departureDate ? toDate(String(patch.departureDate)) : null
      if (!d) throw new BadRequestException('departureDate không hợp lệ (YYYY-MM-DD)')
      next.departureDate = d
    }
    if ('standardText' in patch) next.standardText = patch.standardText ? String(patch.standardText).trim() : null
    if ('priceAdult' in patch) next.priceAdult = Math.max(0, Number(patch.priceAdult) || 0)
    if ('priceChild' in patch) next.priceChild = patch.priceChild == null ? null : Math.max(0, Number(patch.priceChild) || 0)
    if ('priceInfant' in patch) next.priceInfant = patch.priceInfant == null ? null : Math.max(0, Number(patch.priceInfant) || 0)
    if ('originalPriceAdult' in patch) next.originalPriceAdult = patch.originalPriceAdult == null ? null : Math.max(0, Number(patch.originalPriceAdult) || 0)
    if ('discountPercent' in patch) next.discountPercent = patch.discountPercent == null ? null : Math.min(100, Math.max(0, Number(patch.discountPercent) || 0))
    // Tự apply lại giá discount (như normalizeDeparture): nếu discountPercent>0 + originalPriceAdult thì tính giá khuyến mãi
    if (typeof next.discountPercent === 'number' && next.discountPercent > 0 && typeof next.originalPriceAdult === 'number' && next.originalPriceAdult > 0) {
      next.priceAdult = applyDiscountToPrice(next.originalPriceAdult ?? null, next.discountPercent) ?? next.priceAdult
      next.priceChild = applyDiscountToPrice(next.originalPriceChild ?? null, next.discountPercent) ?? next.priceChild
      next.priceInfant = applyDiscountToPrice(next.originalPriceInfant ?? null, next.discountPercent) ?? next.priceInfant
    }
    if ('seatsTotal' in patch) next.seatsTotal = Math.max(0, Math.floor(Number(patch.seatsTotal) || 0))
    if ('seatsAvailable' in patch) next.seatsAvailable = Math.min(Math.max(0, next.seatsTotal || 0), Math.max(0, Math.floor(Number(patch.seatsAvailable) || 0)))
    if ('status' in patch) {
      next.status = ['open', 'closed', 'cancelled', 'soldout'].includes(patch.status as any) ? (patch.status as TourDepartureStatus) : 'open'
    }

    // Atomic update vào đúng idx
    const setPatch: any = {}
    Object.keys(next).forEach((k) => {
      setPatch[`departures.${depIdx}.${k}`] = (next as any)[k]
    })
    const updated = await this.tours.findByIdAndUpdate(tour._id, { $set: setPatch }, { new: true }).exec()
    if (!updated) throw new NotFoundException('Không tìm thấy tour')
    return {
      ok: true,
      tourId: String(updated._id),
      depId: depIdHex,
      depIdx,
    }
  }

  async addPublicReview(slug: string, payload: { name: string; email?: string | null; phone?: string | null; rating: number; content: string; imageUrls?: string[] }) {
    const tour = await this.tours.findOne({ slug }).exec()
    if (!tour) throw new NotFoundException('Không tìm thấy tour')
    const newReview: TourReview = {
      name: payload.name,
      email: payload.email ? `${payload.email}`.trim() : null,
      phone: payload.phone ? `${payload.phone}`.trim() : null,
      rating: payload.rating,
      content: payload.content,
      imageUrls: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
      approved: false,
      createdAt: new Date(),
    }
    tour.reviews = [newReview, ...(Array.isArray(tour.reviews) ? tour.reviews : [])]
    const recalc = this.computeRatingFromReviews(tour.reviews)
    tour.reviewCount = recalc.reviewCount
    tour.avgRating = recalc.avgRating
    await tour.save()
    return tour.toObject()
  }
}
