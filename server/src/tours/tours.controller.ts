import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common'

import { ToursService } from './tours.service'
import { createTourReviewDto } from './dto'

function toPublicTourCard(t: any) {
  return {
    id: t._id?.toString?.() ?? t.id,
    title: t.title,
    slug: t.slug,
    code: t.code ?? null,
    type: t.type,
    region: t.region ?? null,
    categories: Array.isArray(t.categories) ? t.categories : [],
    themes: Array.isArray(t.themes) ? t.themes : [],
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    departureFrom: t.departureFrom ?? null,
    transportText: t.transportText ?? null,
    hotelText: t.hotelText ?? null,
    coverImageUrl: t.coverImageUrl ?? null,
    highlights: Array.isArray(t.highlights) ? t.highlights : [],
    tags: Array.isArray(t.tags) ? t.tags : [],
    totalBookings: typeof t.totalBookings === 'number' ? t.totalBookings : 0,
    avgRating: typeof t.avgRating === 'number' ? t.avgRating : null,
    reviewCount: typeof t.reviewCount === 'number' ? t.reviewCount : 0,
    priceFrom: typeof t.priceFrom === 'number' ? t.priceFrom : null,
    originalPriceFrom: typeof t.originalPriceFrom === 'number' ? t.originalPriceFrom : null,
    discountFrom: typeof t.discountFrom === 'number' ? t.discountFrom : null,
    nextDepartureDate: t.nextDepartureDate ? new Date(t.nextDepartureDate).toISOString() : null,
    nextDepartureStandardText: t.nextDepartureStandardText ?? null,
    nextDeparturePriceAdult: typeof t.nextDeparturePriceAdult === 'number' ? t.nextDeparturePriceAdult : null,
    nextDepartureOriginalPriceAdult:
      typeof t.nextDepartureOriginalPriceAdult === 'number' ? t.nextDepartureOriginalPriceAdult : null,
    nextDepartureDiscountPercent:
      typeof t.nextDepartureDiscountPercent === 'number' ? t.nextDepartureDiscountPercent : null,
    seatsAvailable: typeof t.seatsAvailable === 'number' ? t.seatsAvailable : null,
    isPublished: Boolean(t.isPublished),
  }
}

function toPublicTourDetail(t: any) {
  const rawReviews = Array.isArray(t.reviews) ? t.reviews : []
  const publicReviews = rawReviews
    .filter((r: any) => r?.approved === true)
    .map((r: any) => ({
      name: r.name,
      rating: typeof r.rating === 'number' ? r.rating : 5,
      content: typeof r.content === 'string' ? r.content : '',
      imageUrls: Array.isArray(r.imageUrls) ? r.imageUrls : [],
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    }))
  return {
    ...toPublicTourCard(t),
    galleryImageUrls: Array.isArray(t.galleryImageUrls) ? t.galleryImageUrls : [],
    summary: t.summary ?? null,
    minGuests: typeof t.minGuests === 'number' ? t.minGuests : null,
    maxGuests: typeof t.maxGuests === 'number' ? t.maxGuests : null,
    videoUrl: t.videoUrl ?? null,
    itinerary: Array.isArray(t.itinerary)
      ? t.itinerary.map((d: any) => ({
          label: d?.label ?? '',
          title: d?.title ?? '',
          meals: Array.isArray(d?.meals) ? d.meals : [],
          content: typeof d?.content === 'string' ? d.content : '',
          attractions: Array.isArray(d?.attractions) ? d.attractions : [],
          accommodationText: d?.accommodationText ?? null,
        }))
      : [],
    priceTable: Array.isArray(t.priceTable) ? t.priceTable : [],
    surcharges: Array.isArray(t.surcharges) ? t.surcharges : [],
    departures: Array.isArray(t.departures)
      ? t.departures.map((d: any, idx: number) => {
          const idRaw = d?._id?.toString?.() ?? d?.id ?? String(idx)
          return {
            id: idRaw,
            departureDate: d?.departureDate ? new Date(d.departureDate).toISOString() : null,
            standardText: d?.standardText ?? null,
            priceAdult: d?.priceAdult ?? 0,
            priceChild: d?.priceChild ?? null,
            priceInfant: d?.priceInfant ?? null,
            originalPriceAdult: typeof d?.originalPriceAdult === 'number' ? d.originalPriceAdult : null,
            originalPriceChild: typeof d?.originalPriceChild === 'number' ? d.originalPriceChild : null,
            originalPriceInfant: typeof d?.originalPriceInfant === 'number' ? d.originalPriceInfant : null,
            discountPercent: typeof d?.discountPercent === 'number' ? d.discountPercent : null,
            seatsTotal: d?.seatsTotal ?? 0,
            seatsAvailable: d?.seatsAvailable ?? 0,
            status:
              d?.status === 'open' || d?.status === 'closed' || d?.status === 'cancelled' || d?.status === 'soldout'
                ? d.status
                : 'open',
          }
        })
      : [],
    faq: Array.isArray(t.faq) ? t.faq : [],
    seo: {
      metaTitle: t?.seo?.metaTitle ?? null,
      metaDescription: t?.seo?.metaDescription ?? null,
      canonicalUrl: t?.seo?.canonicalUrl ?? null,
      ogImageUrl: t?.seo?.ogImageUrl ?? null,
    },
    includedText: t.includedText ?? null,
    excludedText: t.excludedText ?? null,
    childPolicyText: t.childPolicyText ?? null,
    cancelPolicyText: t.cancelPolicyText ?? null,
    noteText: t.noteText ?? null,
    pickupPoints: Array.isArray(t.pickupPoints) ? t.pickupPoints : [],
    reviews: publicReviews,
  }
}

@Controller('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  async list(@Query('q') q?: string, @Query('region') region?: string, @Query('tag') tag?: string) {
    let items = await this.tours.listPublic()
    if (region) items = items.filter((t) => t.region === region)
    if (tag) items = items.filter((t) => Array.isArray(t.tags) && t.tags.includes(tag))
    if (q && q.trim()) {
      const kw = q.trim().toLowerCase()
      items = items.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(kw) ||
          (t.summary || '').toLowerCase().includes(kw) ||
          Array.isArray(t.highlights) && t.highlights.some((h: string) => h.toLowerCase().includes(kw)),
      )
    }
    return { items: items.map(toPublicTourCard) }
  }

  @Get(':slug')
  async get(@Param('slug') slug: string) {
    const t = await this.tours.findPublicBySlug(slug)
    const related = await this.tours.listRelated(slug, 4)
    return {
      tour: toPublicTourDetail(t),
      related: related.map(toPublicTourCard),
    }
  }

  @Post(':slug/reviews')
  async addReview(@Param('slug') slug: string, @Body() body: any) {
    const parsed = createTourReviewDto.safeParse(body ?? {})
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      throw new BadRequestException(first ? `${first.path.join('.')}: ${first.message}` : 'Dữ liệu không hợp lệ')
    }
    const saved = await this.tours.addPublicReview(slug, parsed.data)
    const detail = toPublicTourDetail(saved)
    return {
      ok: true,
      message: 'Cảm ơn bạn đã đánh giá! Nội dung sẽ được duyệt trước khi hiển thị.',
      approvedCount: detail.reviewCount,
      avgRating: detail.avgRating,
    }
  }
}

