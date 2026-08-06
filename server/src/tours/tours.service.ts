import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

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
