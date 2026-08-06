import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { Types } from 'mongoose'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { BookingsService } from './bookings.service'
import { listBookingsQueryDto } from './dto'

@Controller('me')
@UseGuards(AccessTokenGuard)
export class MeBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  async listMyBookings(@CurrentUser() user: JwtPayload, @Query() query: any) {
    const parsed = listBookingsQueryDto.safeParse(query)
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 }
    const res = await this.bookingsService.listMyBookings(Types.ObjectId.createFromHexString(String(user.sub)), q)
    return {
      items: res.items.map((b: any) => ({
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
        totalAmount: Number(b.totalAmount || 0),
        paymentMethod: b.paymentMethod ?? 'hold',
        paymentStatus: b.paymentStatus ?? 'unpaid',
        createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      })),
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    }
  }
}
