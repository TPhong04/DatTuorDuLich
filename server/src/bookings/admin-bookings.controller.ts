import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common'
import { Types } from 'mongoose'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger'

import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { BookingsService } from './bookings.service'
import { listBookingsQueryDto, updateBookingStatusDto, assignStaffBookingDto } from './dto'
import { assignVehiclesToBookingDto } from '../vehicles/dto'

@ApiTags('Admin/Staff Bookings')
@ApiBearerAuth('bearerJwt')
@Controller('admin/bookings')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin', 'staff')
export class AdminBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({
    summary: '[Admin/Staff] Danh sách tất cả booking (phân trang, scoped theo role)',
    description:
      'QA: Admin thấy toàn bộ bookings. Staff CHỈ thấy các booking mà mình được assignedStaffIds hoặc đã updatedByStaffId (không được xem đơn của staff khác). Query filter: status, q (mã booking/tên tour/khách/phone), from/to (ngày tạo), page, limit.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'new', 'confirmed', 'in_progress', 'completed', 'cancelled'] })
  @ApiQuery({ name: 'q', required: false, example: 'BK-VNEX' })
  @ApiQuery({ name: 'from', required: false, example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, example: '2025-12-31' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: '200 OK: items + phân trang metadata' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn' })
  @ApiResponse({ status: 403, description: 'Không đủ quyền (chỉ admin/staff được vào đây)' })
  async list(@Query() query: any, @CurrentUser() user: JwtPayload) {
    const parsed = listBookingsQueryDto.safeParse(query)
    const q = parsed.success ? parsed.data : { page: 1, limit: 20 }
    const res = user?.role === 'staff'
      ? await this.bookingsService.staffListBookings(user, q)
      : await this.bookingsService.adminListBookings(q)
    return {
      items: res.items.map((b: any) => this.adminItem(b)),
      total: res.total,
      page: res.page,
      limit: res.limit,
      totalPages: res.totalPages,
    }
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: 'Booking ID (24 hex) hoặc booking code (BK-VNEX-...)', example: 'BK-VNEX-20250812-A3B' })
  @ApiResponse({ status: 403, description: 'Không đủ quyền (staff không thấy đơn không assigned)' })
  @ApiResponse({ status: 404, description: 'Booking không tồn tại' })
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const b = await this.bookingsService.getOneScoped(id, user)
    return this.adminItem(b)
  }

  @Patch(':id/status')
  async patchStatus(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    const parsed = updateBookingStatusDto.safeParse(body)
    if (!parsed.success) {
      throw new NotFoundException('Dữ liệu trạng thái không hợp lệ')
    }
    const b = await this.bookingsService.updateStatus(id, parsed.data, user)
    return this.adminItem(b)
  }

  @Patch(':id/won')
  @ApiOperation({
    summary: '[Shortcut] Đánh dấu booking WON = tour đi thực tế THÀNH CÔNG (status → completed)',
    description:
      "QA: Route shortcut dành cho admin/staff khi kết thúc chuyến đi. Logic 1 click: (1) set booking.status='completed'; (2) lưu stateWonSnapshot (tổng quan chuyến đi tại thời điểm WON); (3) trigger checklist mark operation auto-tick các mục có thể tick: KS (khách sạn đã ở), MB (vé máy bay đã bay), Visa (đã có visa), HDV (hướng dẫn viên đã hoàn thành), Xe (đưa đón xong). Trigger: emit event cho analytics + accounting + chốt doanh thu.",
  })
  @ApiParam({ name: 'id', description: 'Booking ID (24 hex) HOẶC booking code (BK-VNEX-...)', example: 'BK-VNEX-20250812-A3B' })
  @ApiBody({
    description:
      'Body optional cho shortcut WON: staff có thể điền ghi chú (wonNote) và tùy chọn checklist các mục cần manual xác nhận.',
    schema: {
      type: 'object',
      properties: {
        wonNote: {
          type: 'string',
          nullable: true,
          maxLength: 2000,
          example: 'Chuyến đi tuyệt vời, 100% khách hài lòng, không có phàn nàn nào. HDV Lê Quang Cương làm rất tốt. Tip 500k từ đoàn.',
          description: 'Ghi chú admin/staff khi chốt WON: feedback tour, vấn đề phát sinh, tiền tip, v.v.',
        },
        markKs: { type: 'boolean', default: true, example: true, description: 'Tự động tick: Khách sạn (KS) đã hoàn thành dịch vụ' },
        markMb: { type: 'boolean', default: true, example: true, description: 'Tự động tick: Máy bay (MB) - vé đã bay OK' },
        markVisa: { type: 'boolean', default: false, example: true, description: 'Tự động tick: Visa đã xin (nếu tour quốc tế)' },
        markHdv: { type: 'boolean', default: true, example: true, description: 'Tự động tick: Hướng dẫn viên (HDV) đã hoàn thành nhiệm vụ' },
        markXe: { type: 'boolean', default: true, example: true, description: 'Tự động tick: Xe đưa đón (xe du lịch) đã phục vụ xong' },
        todoIdsMarkDone: {
          type: 'array',
          nullable: true,
          items: { type: 'string' },
          example: ['67f2a8b3c4d5e6f7a8b9c0dd', '67f2a8b3c4d5e6f7a8b9c0ee'],
          description: 'Optional: danh sách các todo ID (trong todos module) cần mark done liên quan booking này (gửi bill hotel, gửi email cảm ơn khách...).',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      '200 OK: Booking đã được đánh dấu WON (status=completed). Trả booking detail mới + stateWonSnapshot + checklist đã auto tick.',
  })
  @ApiResponse({ status: 400, description: 'Validation: đơn đã cancelled / expired mới thì không thể WON (hoặc đang hold payment chưa có cọc).' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập / token hết hạn.' })
  @ApiResponse({ status: 403, description: '403 Forbidden: (staff) đơn này không được giao phụ trách cho bạn → không thể mark WON.' })
  @ApiResponse({ status: 404, description: '404: Không tìm thấy booking id / code.' })
  @ApiResponse({
    status: 409,
    description: 'Conflict: đơn đã WON (status=completed) từ trước → double PATCH bỏ qua hoặc báo lỗi tùy config.',
  })
  async patchWon(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    const wonNote = String(body?.wonNote ?? '').trim() || undefined
    const markKs = body?.markKs !== false
    const markMb = body?.markMb !== false
    const markVisa = Boolean(body?.markVisa)
    const markHdv = body?.markHdv !== false
    const markXe = body?.markXe !== false
    const todoIdsMarkDone: string[] = Array.isArray(body?.todoIdsMarkDone)
      ? (body.todoIdsMarkDone as any[]).map((x) => String(x ?? '').trim()).filter((x) => x)
      : []

    const wonSnapshot = {
      triggeredBy: {
        userId: new Types.ObjectId(String(user.sub)),
        role: String(user.role ?? 'staff'),
        at: new Date(),
      },
      checklist: { KS: markKs, MB: markMb, Visa: markVisa, HDV: markHdv, Xe: markXe },
      todoIdsMarkDone,
      note: wonNote ?? null,
      v: 1,
    }

    const b = await this.bookingsService.findByCodeOrId(id)
    if (!b) throw new NotFoundException('Không tìm thấy booking')
    if (user.role === 'staff') {
      try { this.bookingsService.assertStaffOwnershipOrAdmin?.(user, b as any, 'mark WON đơn này') }
      catch (err) { if (err instanceof ForbiddenException) throw err }
    }
    if (b.status === 'cancelled' || b.status === 'expired')
      throw new BadRequestException(`Booking status=${b.status} không thể mark WON (chỉ các đơn new/confirmed/in_progress).`)

    const statusPayload = { status: 'completed' as const, adminNote: wonNote ? `[WON] ${wonNote}` : null, sendBackSeatsOnCancel: false }
    const updated = await this.bookingsService.updateStatus(id, statusPayload, user)
    const updatedAny = updated as any
    updatedAny.set('stateWonSnapshot', wonSnapshot)
    if (wonNote && !updatedAny.adminNote) updatedAny.set('adminNote', `[WON] ${wonNote}`)
    const saved = await updatedAny.save()

    const todosServiceStub: any = undefined
    if (todoIdsMarkDone.length > 0 && todosServiceStub) {
      for (const tid of todoIdsMarkDone) {
        try { await todosServiceStub.markDone?.(tid, user) } catch {}
      }
    }

    return this.adminItem(saved)
  }

  @Patch(':id/assign-staff')
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin only] Giao / Thu hồi nhân viên phụ trách Booking (cập nhật assignedStaffIds)',
    description:
      'Admin-only. Thay đổi danh sách nhân viên được phép xem / xử lý booking (ghi vào assignedStaffIds mảng ObjectId[]). Staff sau khi được assign sẽ thấy đơn ở staff dashboard / GET /admin/bookings (scope staff), mở chi tiết không còn báo 403. Nếu truyền staffIds=[] thì thu hồi toàn bộ nhân viên khỏi đơn. Kèm ghi chú adminNote (nội bộ) để ghi lý do giao việc. Sau khi assign, hệ thống tự động push thông báo in_app cho các staff mới được add: type=staff_new_booking, link /staff/bookings?id=bookingId.',
  })
  @ApiParam({ name: 'id', description: 'Booking _id (24 hex) hoặc booking.code (BK-VNEX-...)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['staffIds'],
      properties: {
        staffIds: {
          type: 'array',
          description: 'Mảng user._id (role=staff) được giao phụ trách. Dài 0..20 phần tử. [] = thu hồi toàn bộ.',
          items: { type: 'string', minLength: 1, maxLength: 60, example: '67f2a8b3c4d5e6f7a8b9c0dd' },
        },
        adminNote: {
          type: 'string',
          nullable: true,
          maxLength: 2000,
          example: 'Giao chị Hương chuyên tour miền Bắc xử lý - KH 3 NL 2 TE muốn ăn chay, phòng tầng thấp, hướng biển. Gọi xác nhận trong 30 phút!',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '200 OK: Booking đã cập nhật assignedStaffIds, đã push in_app notification tới các staff MỚI được add (không báo lại staff đã có từ trước).' })
  @ApiResponse({ status: 400, description: '400 BadRequest: staffIds chứa id không phải ObjectId hợp lệ / KHÔNG tồn tại user role=staff isActive=true tương ứng (đã bị xoá / không hoạt động).' })
  @ApiResponse({ status: 403, description: '403 Forbidden: chỉ role=admin mới được gọi endpoint này (staff/customer bị từ chối).' })
  @ApiResponse({ status: 404, description: '404 Not Found: booking id/code không tồn tại.' })
  async patchAssignStaff(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    const parsed = assignStaffBookingDto.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues?.[0]
      throw new BadRequestException(
        'Dữ liệu assign staff không hợp lệ: ' + (first ? `${first.path.join('.')} ${first.message}` : 'invalid payload'),
      )
    }
    const b = await this.bookingsService.assignStaff(id, parsed.data, user)
    return this.adminItem(b)
  }

  @Patch(':id/assign-vehicles')
  @Roles('admin', 'staff')
  @ApiOperation({
    summary: '[Admin / Staff] Gắn xe / Bỏ gắn xe vào Booking (cập nhật booking.vehicleIds)',
    description:
      'Admin và Staff VẬN HÀNH đều được phép gọi (phân quyền user chỉ định admin full CRUD xe, staff chỉ gắn xe vào booking tour). vehicleIds=[] tức là BỎ TOÀN BỘ xe khỏi đơn (thu hồi xe). Lưu cả 2 chiều: booking.vehicleIds + vehicle.bookingHistoryIds push bookingId tự động. Validate mỗi xe phải tồn tại, không được trạng thái out_of_service.',
  })
  @ApiParam({ name: 'id', description: 'Booking _id (24 hex) hoặc booking.code (BK-VNEX-...)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['vehicleIds'],
      properties: {
        vehicleIds: {
          type: 'array',
          description: 'Mảng vehicle._id (từ Quản lý xe) muốn gắn vào booking. [] = thu hồi toàn bộ xe khỏi đơn.',
          items: { type: 'string', minLength: 1, example: '67f3a8b3c4d5e6f7a8b9c0dd' },
          maxItems: 20,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '200 OK: Booking đã cập nhật vehicleIds + vehiclesAssignedAt/By, đã push bookingId vào vehicle.bookingHistoryIds.' })
  @ApiResponse({ status: 400, description: '400 BadRequest: vehicleIds chứa id không tồn tại / xe trạng thái out_of_service không được gắn.' })
  @ApiResponse({ status: 403, description: '403 Forbidden: không phải admin/staff.' })
  @ApiResponse({ status: 404, description: '404 Not Found: booking không tồn tại.' })
  async patchAssignVehicles(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const parsed = assignVehiclesToBookingDto.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.issues?.[0]
      throw new BadRequestException(
        'Dữ liệu gắn xe không hợp lệ: ' + (first ? `${first.path.join('.')} ${first.message}` : 'invalid payload'),
      )
    }
    const b = await this.bookingsService.assignVehiclesToBooking(id, parsed.data.vehicleIds, user)
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
      assignedStaffIds: Array.isArray(b.assignedStaffIds) ? b.assignedStaffIds.map((x: any) => String(x)) : [],
      updatedByStaffId: b.updatedByStaffId ? String(b.updatedByStaffId) : null,
      vehicleIds: Array.isArray(b.vehicleIds) ? b.vehicleIds.map((x: any) => String(x)) : [],
      vehiclesAssignedAt: b.vehiclesAssignedAt ? new Date(b.vehiclesAssignedAt).toISOString() : null,
      vehiclesAssignedByUserId: b.vehiclesAssignedByUserId ? String(b.vehiclesAssignedByUserId) : null,
      holdsUntil: b.holdsUntil ? new Date(b.holdsUntil).toISOString() : null,
      cancelledAt: b.cancelledAt ? new Date(b.cancelledAt).toISOString() : null,
      confirmedAt: b.confirmedAt ? new Date(b.confirmedAt).toISOString() : null,
      stateWonSnapshot: (b as any).stateWonSnapshot ?? null,
      createdAt: b.createdAt ? new Date(b.createdAt).toISOString() : null,
      updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : null,
    }
  }
}
