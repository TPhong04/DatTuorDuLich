import { BadRequestException, Body, Controller, Get, Param, Post, Query, NotFoundException } from '@nestjs/common'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger'

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
    // Gộp toàn bộ ảnh gallery của tour để FE hiển thị lưới nhiều ảnh trên card,
    // không chỉ mỗi ảnh cover. Dữ liệu gốc nằm ở field galleryImageUrls trong DB
    // (giống mục "Gallery" trong trang Admin sửa tour).
    imageUrls: Array.isArray(t.galleryImageUrls) ? t.galleryImageUrls : [],
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

@ApiTags('Tours Public')
@Controller('tours')
export class ToursController {
  constructor(private readonly tours: ToursService) {}

  @Get()
  @ApiOperation({
    summary: 'Liệt kê danh sách tour công khai (published)',
    description:
      'QA: Endpoint công khai không cần auth. Trả mảng items[] dạng tourCard (gọn nhẹ: title, slug, cover, priceFrom, nextDeparture, seatsAvailable). Hỗ trợ 3 query filter: q (tìm kiếm fulltext title/summary/highlights), region (lọc theo miền/địa phương: Mien-Bac / Mien-Trung / Mien-Nam / Phu-Quoc / Da-Nang), tag (lọc theo tag như "biển" "núi" "địa trung ẩm thực"). Không phân trang, trả toàn bộ published.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Từ khóa tìm kiếm: title, summary, highlights (case-insensitive contains)', example: 'Hạ Long' })
  @ApiQuery({ name: 'region', required: false, description: 'Lọc theo region tour (cột region trong Tour)', example: 'Mien-Bac' })
  @ApiQuery({ name: 'tag', required: false, description: 'Lọc theo tag nằm trong mảng tags (tour.tags includes)', example: 'biển' })
  @ApiQuery({ name: 'transport', required: false, description: 'Lọc theo phương tiện: bus (Xe/Limousine) hoặc flight (Máy bay) - match nội dung field transportText', example: 'flight' })
  @ApiResponse({
    status: 200,
    description: '200 OK: Mảng danh sách tourCard công khai (chỉ isPublished=true).',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '67f2a8b3c4d5e6f7a8b9c0d1' },
              title: { type: 'string', example: 'Tour Hạ Long 2N1Đ - Du thuyền 5 sao' },
              slug: { type: 'string', example: 'tour-ha-long-2n1d-du-thuyen-5-sao' },
              code: { type: 'string', nullable: true, example: 'HAL-001' },
              type: { type: 'string', enum: ['retail', 'group'], example: 'retail' },
              region: { type: 'string', nullable: true, example: 'Mien-Bac' },
              categories: { type: 'array', items: { type: 'string' }, example: ['Du lịch biển', 'Du lịch nghỉ dưỡng'] },
              themes: { type: 'array', items: { type: 'string' } },
              durationDays: { type: 'number', example: 2 },
              durationNights: { type: 'number', example: 1 },
              departureFrom: { type: 'string', nullable: true, example: 'Hà Nội' },
              transportText: { type: 'string', nullable: true, example: 'Xe limousine 9 chỗ + Du thuyền' },
              hotelText: { type: 'string', nullable: true, example: 'Ở du thuyền cabin biển hướng' },
              coverImageUrl: { type: 'string', nullable: true, example: '/uploads/tours/halong-cover.jpg' },
              imageUrls: { type: 'array', items: { type: 'string' }, example: ['/uploads/tours/halong-1.jpg', '/uploads/tours/halong-2.jpg'] },
              highlights: { type: 'array', items: { type: 'string' }, example: ['Cảnh quan Vịnh Hạ Long di sản', 'Du thuyền 5 sao', 'Kayak hang Sửng Sốt'] },
              tags: { type: 'array', items: { type: 'string' }, example: ['biển', 'vinh-di-san', 'di-san-thien-nhien'] },
              totalBookings: { type: 'number', example: 1247 },
              avgRating: { type: 'number', nullable: true, example: 4.8 },
              reviewCount: { type: 'number', example: 312 },
              priceFrom: { type: 'number', example: 2490000 },
              originalPriceFrom: { type: 'number', nullable: true, example: 2990000 },
              discountFrom: { type: 'number', nullable: true, example: 16 },
              nextDepartureDate: { type: 'string', nullable: true, format: 'date-time', example: '2025-12-25T12:00:00.000Z' },
              nextDepartureStandardText: { type: 'string', nullable: true, example: 'Thứ 7, Chủ Nhật hàng tuần' },
              nextDeparturePriceAdult: { type: 'number', nullable: true, example: 2490000 },
              nextDepartureOriginalPriceAdult: { type: 'number', nullable: true, example: 2990000 },
              nextDepartureDiscountPercent: { type: 'number', nullable: true, example: 16 },
              seatsAvailable: { type: 'number', nullable: true, example: 18 },
              isPublished: { type: 'boolean', example: true },
            },
          },
        },
      },
    },
  })
  async list(
    @Query('q') q?: string,
    @Query('region') region?: string,
    @Query('tag') tag?: string,
    @Query('transport') transport?: string,
  ) {
    let items = await this.tours.listPublic()
    if (region) items = items.filter((t) => t.region === region)
    if (tag) items = items.filter((t) => Array.isArray(t.tags) && t.tags.includes(tag))
    if (transport) {
      const tLower = transport.trim().toLowerCase()
      items = items.filter((t) => {
        const tt = (t.transportText || '').toLowerCase()
        if (tLower === 'flight') {
          return tt.includes('máy bay') || tt.includes('may bay') || tt.includes('flight') || tt.includes('vé máy bay') || tt.includes('ve may bay')
        }
        if (tLower === 'bus') {
          const hasFlight = tt.includes('máy bay') || tt.includes('may bay') || tt.includes('flight')
          const hasBus = tt.includes('xe') || tt.includes('limousine') || tt.includes('ô tô') || tt.includes('o to') || tt.includes('bus') || tt.includes('coach')
          return hasBus && !hasFlight
        }
        return tt.includes(tLower)
      })
    }
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
  @ApiOperation({
    summary: 'Chi tiết tour theo slug (công khai)',
    description:
      'QA: Lấy thông tin đầy đủ của 1 tour: gallery, itinerary (ngày 1..N), priceTable, surcharges, departures list (id, date, price, seats), faq, pickupPoints, reviews (chỉ approved). Quan trọng: field departures[].id dùng để gọi POST /tours/:slug/bookings (truyền departureId).',
  })
  @ApiParam({ name: 'slug', description: 'Slug tour (duy nhất trong bảng tours). VD: tour-ha-long-2n1d-du-thuyen-5-sao', example: 'tour-ha-long-2n1d-du-thuyen-5-sao' })
  @ApiResponse({
    status: 200,
    description: '200 OK: Thông tin chi tiết tour + mảng related tours liên quan (cùng region hoặc cùng category).',
  })
  @ApiResponse({
    status: 404,
    description: '404 Not Found: Không tìm thấy tour với slug đã cho HOẶC tour chưa được xuất bản (isPublished=false).',
  })
  async get(@Param('slug') slug: string) {
    const t = await this.tours.findPublicBySlug(slug)
    if (!t) throw new NotFoundException('Không tìm thấy tour')
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
