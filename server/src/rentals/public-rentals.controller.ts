import { BadRequestException, Body, Controller, Get, Ip, Post, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Request } from 'express'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { PublicCreateInquiryDto, publicCreateInquiryDto } from './dto'
import { RentalsService } from './rentals.service'

@ApiTags('Public / Customer Rentals (Cho thuê xe khách hàng)')
@Controller('rentals')
export class PublicRentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Post('inquiries')
  @ApiOperation({ summary: 'KHách hàng gửi yêu cầu thuê xe (Luồng A - public không cần login)' })
  async createInquiryPublic(
    @Body() body: unknown,
    @Ip() ip: string | undefined,
    @Req() req: Request,
  ) {
    const parsed = publicCreateInquiryDto.safeParse(body as PublicCreateInquiryDto)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new BadRequestException(`${first?.path?.join('.') || 'payload'}: ${first?.message || 'Dữ liệu không hợp lệ'}`)
    }
    const user = (req as any).user as JwtPayload | undefined
    const actor = user ? { id: user.sub, role: user.role } : undefined
    const dto = parsed.data
    const days = Math.max(1, Math.round((dto.returnDateTime.getTime() - dto.pickupDateTime.getTime()) / (1000 * 60 * 60 * 24)))
    return this.rentals.createInquiry(
      {
        code: undefined,
        status: 'pending',
        source: 'website',
        bookingId: dto.bookingId ?? undefined,
        customerUserId: user?.sub ?? undefined,
        customerName: dto.customerName.trim(),
        customerPhone: dto.customerPhone.trim(),
        customerEmail: dto.customerEmail ?? null,
        citizenId: dto.citizenId ?? null,
        customerAddress: dto.customerAddress ?? null,
        preferredVehicleType: (dto.vehicleType as any) ?? null,
        preferredVehicleClass: (dto.vehicleClass as any) ?? null,
        seatCountMin: typeof dto.seatCountMin === 'number' && dto.seatCountMin > 0 ? dto.seatCountMin : null,
        pickupDateTime: dto.pickupDateTime,
        pickupLocation: dto.pickupLocation.trim(),
        returnDateTime: dto.returnDateTime,
        returnLocation: dto.returnLocation.trim(),
        rentalDays: (typeof days === 'number' && days > 0) ? days : (typeof dto.rentalDays === 'number' && dto.rentalDays > 0 ? dto.rentalDays : undefined),
        withDriver: typeof dto.withDriver === 'boolean' ? dto.withDriver : true,
        passengerCount: Math.max(1, Number(dto.passengerCount ?? 1)),
        luggageCount: Number(dto.luggageCount ?? 0) || 0,
        selfDriveRequirePapers: (typeof dto.withDriver === 'boolean' && dto.withDriver) ? false : true,
        routeNotes: dto.routeNotes ?? null,
        specialRequests: dto.specialRequests ?? null,
        ownerStaffId: undefined,
      },
      actor,
    )
  }

  @Get('vehicle-options')
  @ApiOperation({ summary: 'Lấy loại xe + class + bảng giá tham khảo (public FE dùng để giới thiệu) - aggregation từ database thực tế admin cập nhật' })
  async vehicleOptions() {
    return this.rentals.aggregatePublicVehicleOptions()
  }

  /* ===== Customer logged in: xem yêu cầu / HĐ của tôi ===== */
  @UseGuards(AccessTokenGuard)
  @Get('my/inquiries')
  @ApiOperation({ summary: 'Khách xem các yêu cầu thuê xe của tôi' })
  async myInquiries(@CurrentUser() u: JwtPayload) {
    const res = await this.rentals.listInquiries({
      page: 1, limit: 100, customerUserId: u.sub,
    } as any)
    return res
  }

  @UseGuards(AccessTokenGuard)
  @Get('my/contracts')
  @ApiOperation({ summary: 'Khách xem các hợp đồng thuê xe của tôi' })
  async myContracts(@CurrentUser() u: JwtPayload) {
    const res = await this.rentals.listContracts({
      page: 1, limit: 100, customerUserId: u.sub,
    } as any)
    return res
  }
}
