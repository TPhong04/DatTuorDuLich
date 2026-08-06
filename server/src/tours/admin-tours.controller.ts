import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { createTourDto, updateTourDto } from './dto'
import { ToursService } from './tours.service'

function toAdminTour(t: any) {
  return {
    id: t._id?.toString?.() ?? t.id,
    title: t.title,
    slug: t.slug,
    code: t.code ?? null,
    type: t.type,
    departureFrom: t.departureFrom ?? null,
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    transportText: t.transportText ?? null,
    hotelText: t.hotelText ?? null,
    region: t.region ?? null,
    categories: Array.isArray(t.categories) ? t.categories : [],
    themes: Array.isArray(t.themes) ? t.themes : [],
    minGuests: typeof t.minGuests === 'number' ? t.minGuests : null,
    maxGuests: typeof t.maxGuests === 'number' ? t.maxGuests : null,
    videoUrl: t.videoUrl ?? null,
    coverImageUrl: t.coverImageUrl ?? null,
    galleryImageUrls: Array.isArray(t.galleryImageUrls) ? t.galleryImageUrls : [],
    highlights: Array.isArray(t.highlights) ? t.highlights : [],
    summary: t.summary ?? null,
    totalBookings: typeof t.totalBookings === 'number' ? t.totalBookings : 0,
    avgRating: typeof t.avgRating === 'number' ? t.avgRating : null,
    reviewCount: typeof t.reviewCount === 'number' ? t.reviewCount : 0,
    isPublished: Boolean(t.isPublished),
    tags: Array.isArray(t.tags) ? t.tags : [],
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
    priceTable: Array.isArray(t.priceTable)
      ? t.priceTable.map((r: any) => ({
          label: typeof r?.label === 'string' ? r.label : '',
          value: typeof r?.value === 'string' ? r.value : '',
          amount: typeof r?.amount === 'number' ? r.amount : null,
        }))
      : [],
    surcharges: Array.isArray(t.surcharges)
      ? t.surcharges.map((r: any) => ({
          label: typeof r?.label === 'string' ? r.label : '',
          value: typeof r?.value === 'string' ? r.value : '',
          amount: typeof r?.amount === 'number' ? r.amount : null,
        }))
      : [],
    departures: Array.isArray(t.departures)
      ? t.departures.map((d: any) => {
          const rawDate = d?.departureDate
          const iso = (() => {
            if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
              const y = rawDate.getFullYear()
              const m = String(rawDate.getMonth() + 1).padStart(2, '0')
              const day = String(rawDate.getDate()).padStart(2, '0')
              return `${y}-${m}-${day}`
            }
            if (typeof rawDate === 'string') {
              if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate
              const parsed = new Date(rawDate)
              if (!Number.isNaN(parsed.getTime())) {
                const y = parsed.getFullYear()
                const m = String(parsed.getMonth() + 1).padStart(2, '0')
                const day = String(parsed.getDate()).padStart(2, '0')
                return `${y}-${m}-${day}`
              }
            }
            return null
          })()
          return {
            departureDate: iso,
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
            meals: Array.isArray(d?.meals) ? d.meals.filter((x: any) => typeof x === 'string') : [],
            attractions: Array.isArray(d?.attractions) ? d.attractions.filter((x: any) => typeof x === 'string') : [],
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
    reviews: Array.isArray(t.reviews)
      ? t.reviews.map((r: any) => ({
          name: typeof r?.name === 'string' ? r.name : '',
          email: typeof r?.email === 'string' ? r.email : null,
          phone: typeof r?.phone === 'string' ? r.phone : null,
          rating: typeof r?.rating === 'number' ? r.rating : 0,
          content: typeof r?.content === 'string' ? r.content : '',
          imageUrls: Array.isArray(r?.imageUrls) ? r.imageUrls : [],
          approved: Boolean(r?.approved),
          createdAt: r?.createdAt ? new Date(r.createdAt).toISOString() : null,
        }))
      : [],
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
  }
}

@Controller('admin/tours')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminToursController {
  constructor(
    private readonly tours: ToursService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  async list() {
    const items = await this.tours.listAdmin()
    return { items: items.map(toAdminTour) }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const found = await this.tours.findByIdAdmin(id)
    return toAdminTour(found)
  }

  @Post()
  async create(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(createTourDto, body)
    const existing = await this.tours.findBySlugAdmin(dto.slug)
    if (existing) throw new BadRequestException('Slug đã tồn tại')
    const created = await this.tours.create(dto)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.tour.create',
      entityType: 'tour',
      entityId: created.id,
      meta: { tour: toAdminTour(created) },
    })
    return toAdminTour(created)
  }

  @Patch(':id')
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(updateTourDto, body)
    const updated = await this.tours.update(id, dto)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.tour.update',
      entityType: 'tour',
      entityId: id,
      meta: { patch: dto },
    })
    return toAdminTour(updated)
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    const removed = await this.tours.remove(id)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.tour.delete',
      entityType: 'tour',
      entityId: id,
      meta: { tour: toAdminTour(removed) },
    })
    return { ok: true }
  }

  private parse<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) throw new BadRequestException('Dữ liệu không hợp lệ')
      throw e
    }
  }
}
