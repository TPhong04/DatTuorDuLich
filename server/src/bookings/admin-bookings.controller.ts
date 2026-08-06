import { Body, Controller, Get, NotFoundException, Param, Patch, Query, UseGuards } from '@nestjs/common'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { BookingsService } from './bookings.service'
import { listBookingsQueryDto, updateBookingStatusDto } from './dto'

@Controller('admin/bookings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin', 'staff')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  async list(@Query() query: any) {
    const parsed = listBookingsQueryDto.safeParse(query)
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 }
    const res = await this.bookingsService.adminListBookings(q)
    return {
      items: res.items.map((b: any) => this.adminItem(b)),
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    }
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const b = await this.bookingsService.findByCodeOrId(id)
    return this.adminItem(b)
  }

  @Patch(':id/status')
  async patchStatus(@Param('id') id: string, @Body() body: any) {
    const parsed = updateBookingStatusDto.safeParse(body)
    if (!parsed.success) {
      throw new NotFoundException('Dữ liệu trạng thái không hợp lệ')
    }
    const b = await this.bookingsService.updateStatus(id, parsed.data)
    return this.adminItem(b)
  }

  adminItem(b: any) {
    return {
      id: b._id?.toString?.() ?? b.id,
      code: b.code,
      status: b.status,
      tour: {
        title: b.tourSnapshot?.title ?? null,
        slug: b.tourSnapshot?.slug ?? null,
        code: b.tourSnapshot?.code ?? null,
        coverImageUrl: b.tourSnapshot?.coverImageUrl ?? null,
        durationDays: typeof b.tourSnapshot?.durationDays === 'number' ? b.tourSnapshot.durationDays : null,
        durationNights: typeof b.tourSnapshot?.durationNights === 'number' ? b.tourSnapshot.durationNights : null,
      },
      tourId: b.tourId?.toString?.() ?? b.tourId ?? null,
      departureId: b.departureId?.toString?.() ?? b.departureId ?? null,
      departureDate: b.departureDate ? new Date(b.departureDate).toISOString() : null,
      departureStandardText: b.departureStandardText ?? null,
      adultCount: Number(b.adultCount || 0),
      childCount: Number(b.childCount || 0),
      infantCount: Number(b.infantCount || 0),
      priceAdultSnapshot: typeof b.priceAdultSnapshot === 'number' ? b.priceAdultSnapshot : null,
      priceChildSnapshot: typeof b.priceChildSnapshot === 'number' ? b.priceChildSnapshot : null,
      priceInfantSnapshot: typeof b.priceInfantSnapshot === 'number' ? b.priceInfantSnapshot : null,
      contact: {
        name: b.contact?.name ?? '',
        phone: b.contact?.phone ?? '',
        email: b.contact?.email ?? null,
        address: b.contact?.address ?? null,
      },
      passengers: Array.isArray(b.passengers) ? b.passengers.map((p: any) => ({
        fullName: p?.fullName ?? '',
        type: p?.type ?? 'NL',
        birthDate: p?.birthDate ? new Date(p.birthDate).toISOString() : null,
        gender: p?.gender ?? null,
        idCard: p?.idCard ?? null,
        notes: p?.notes ?? null,
      })) : [],
      notes: b.notes ?? null,
      surcharges: Array.isArray(b.surcharges) ? b.surcharges.map((s: any) => ({
        label: s?.label ?? '',
        quantity: Number(s?.quantity || 0),
        unitPrice: Number(s?.unitPrice || 0),
        note: s?.note ?? null,
      })) : [],
      subtotalAmount: Number(b.subtotalAmount || 0),
      surchargeAmount: Number(b.surchargeAmount || 0),
      vatAmount: Number(b.vatAmount || 0),
      totalAmount: Number(b.totalAmount || 0),
      currency: b.currency ?? 'VND',
      paymentMethod: b.paymentMethod ?? 'hold',
      paymentStatus: b.paymentStatus ?? 'unpaid',
      adminNote: b.adminNote ?? null,
      createdBy: b.createdBy?.toString?.() ?? b.createdBy ?? null,
      holdsUntil: b.holdsUntil ? new Date(b.holdsUntil).toISOString() : null,
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt).toISOString() : null,
      confirmedAt: b.confirmedAt ? new Date(b.confirmedAt).toISOString() : null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null,
    }
  }
}
