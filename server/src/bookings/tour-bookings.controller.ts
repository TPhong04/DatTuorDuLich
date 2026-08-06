import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common'
import { Types } from 'mongoose'

import { Booking } from './booking.schema'
import { BookingsService } from './bookings.service'
import { createBookingDto } from './dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
// #region debug-point booking-create-500
import { dbg } from '../_dbg'
// #endregion

@Controller('tours')
export class TourBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':slug/bookings')
  async create(
    @Param('slug') slug: string,
    @Body() body: any,
    @CurrentUser() user?: JwtPayload,
  ) {
    // #region debug-point booking-create-500
    await dbg('ctrl.in', { slug, userId: user?.sub ?? null, bodyKeys: Object.keys(body || {}), hasAgree: Boolean(body?.agreeTerms), depId: body?.departureId ?? null, pax: { a: body?.adultCount, c: body?.childCount, i: body?.infantCount }, passengersN: body?.passengers?.length ?? -1 })
    // #endregion
    const parsed = createBookingDto.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues[0]
      const message = first ? `${first.path.join('.') || 'Dữ liệu'}: ${first.message}` : 'Dữ liệu đặt tour không hợp lệ'
      // #region debug-point booking-create-500
      await dbg('ctrl.zod_fail', { message, issues: parsed.error.issues })
      // #endregion
      throw new BadRequestException(message)
    }
    try {
      const created = await this.bookingsService.createBookingForTour(slug, parsed.data, user?.sub ? Types.ObjectId.createFromHexString(String(user.sub)) : null)
      // #region debug-point booking-create-500
      await dbg('ctrl.ok', { code: created.code, id: created._id?.toString?.() })
      // #endregion
      return this.toPublic(created)
    } catch (err: any) {
      // #region debug-point booking-create-500
      await dbg('ctrl.err', { name: err?.name, status: err?.status, message: String(err?.message ?? err), stack: String(err?.stack ?? '').slice(0, 500) })
      // #endregion
      throw err
    }
  }

  toPublic(b: any) {
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
      holdsUntil: b.holdsUntil ? new Date(b.holdsUntil).toISOString() : null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
    }
  }
}
