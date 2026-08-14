import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
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
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
import { BookingsService } from './bookings.service'
import { listBookingsQueryDto } from './dto'

@ApiTags('My Bookings')
@ApiBearerAuth('bearerJwt')
@Controller('me')
@UseGuards(AccessTokenGuard)
export class MeBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  @ApiOperation({
    summary: 'Danh sách đặt tour của tôi (phân trang)',
    description:
      "QA: Lấy danh sách booking của user đang đăng nhập (createdBy=userId) HOẶC trùng email/phone trong contact (nếu khách vãng lai tạo booking rồi mới đăng nhập). Hỗ trợ filter theo status (pending/new/confirmed/in_progress/completed/cancelled), phân trang page/limit. Không trả bookings của người khác (chủ sở hữu = JWT sub).",
  })
  @ApiQuery({ name: 'page', required: false, description: 'Trang hiện tại (bắt đầu từ 1). Default 1.', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: 'Số item/trang, 5-100. Default 20.', example: 20 })
  @ApiQuery({ name: 'status', required: false, description: 'Lọc theo booking status', enum: ['pending', 'new', 'confirmed', 'in_progress', 'completed', 'cancelled'] })
  @ApiQuery({ name: 'q', required: false, description: 'Tìm fulltext: mã booking, tên tour, tên khách, số điện thoại', example: 'Hạ Long' })
  @ApiQuery({ name: 'from', required: false, description: 'Ngày tạo booking ≥ ISO date (YYYY-MM-DD).', example: '2025-01-01' })
  @ApiQuery({ name: 'to', required: false, description: 'Ngày tạo booking ≤ ISO date (YYYY-MM-DD).', example: '2025-12-31' })
  @ApiResponse({
    status: 200,
    description: '200 OK: Trả danh sách bookings (items) + metadata phân trang (total, page, limit, totalPages).',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc Bearer token hết hạn / sai.' })
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

  @Patch('bookings/:id/cancel')
  @ApiOperation({
    summary: 'Hủy đơn đặt tour của tôi (chỉ chủ sở hữu)',
    description:
      'QA: Khách hàng tự hủy booking (PATCH status = cancelled). Endpoint chỉ cho phép chủ sở hữu (createdBy=JWT.sub) HOẶC email/phone contact khớp với user đang login. Kiểm tra quyền: nếu không phải chủ đơn → 403 Forbidden. Service tự trả lại seatsAvailable cho departure (mặc định sendBackSeatsOnCancel=true). Nếu đơn đã completed / confirmed quá hạn hủy policy → 400 hoặc 409 (tùy nghiệp vụ).',
  })
  @ApiParam({ name: 'id', description: 'Booking ID (24 hex) HOẶC booking code (BK-VNEX-...)', example: '67f2a8b3c4d5e6f7a8b9c0aa' })
  @ApiBody({
    description: 'Body tùy chọn: ghi chú lý do hủy (adminNote).',
    schema: {
      type: 'object',
      properties: {
        cancelReason: { type: 'string', nullable: true, maxLength: 1000, example: 'Lịch công tác đột xuất, không đi được.', description: 'Lý do hủy từ phía khách hàng (optional).' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '200 OK: Đơn đã cập nhật status = cancelled. Trả booking detail sau khi hủy (cancelledAt, trả lại chỗ).',
  })
  @ApiResponse({ status: 400, description: 'Validation không hợp lệ: id không đúng format / đơn đã completed không cho hủy. ' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn.' })
  @ApiResponse({ status: 403, description: '403 Forbidden: Không phải chủ sở hữu đơn này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking theo id / code.' })
  @ApiResponse({ status: 409, description: 'Conflict: Đơn đang trong quá trình thanh toán online / hold timeout / trạng thái không cho hủy.' })
  async cancelMyBooking(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    const cancelReasonRaw = String(body?.cancelReason ?? '').trim()
    const cancelReason = cancelReasonRaw ? cancelReasonRaw : null
    try {
      const result = await this.bookingsService.updateStatus(
        id,
        { status: 'cancelled', adminNote: cancelReason, sendBackSeatsOnCancel: true },
        user,
      )
      return {
        ok: true,
        id: result._id?.toString?.() ?? result.id,
        code: result.code,
        status: result.status,
        cancelledAt: (result as any).cancelledAt ? new Date((result as any).cancelledAt).toISOString() : null,
      }
    } catch (err: any) {
      if (err instanceof ForbiddenException) throw err
      if (err instanceof NotFoundException) throw err
      if (err instanceof BadRequestException) throw err
      throw err
    }
  }

  @Post('bookings/:id/payment-bank-transfer')
  @ApiOperation({
    summary: 'Khách nộp bằng chứng thanh toán chuyển khoản ngân hàng (bank transfer)',
    description:
      "QA: Khách hàng chọn hình thức thanh toán chuyển khoản → điền thông tin: bankCode (VCB/TCB/MB/VPBank/BIDV...), transferAmount (phải > 0 và = tổng cọc / toàn bộ tour), transferAt (thời gian khách ghi nhận đã chuyển), referenceNo (mã tham chiếu 21 ký tự ở cuối phiếu chuyển khoản / nội dung chuyển khoản). Cần field totalAmount required > 0 (check trùng với booking.totalAmount hoặc cọc tối thiểu). System cập nhật booking: paymentMethod='bank_transfer', paymentStatus='pending_bank_transfer' (chờ nhân viên đối soát). Không cần XSRF ở My Bookings (bảo vệ bằng AccessTokenGuard đã là POST) — có thể thêm nếu cần nhưng Swagger chỉ cần bearerJwt.",
  })
  @ApiParam({ name: 'id', description: 'Booking ID (24 hex) HOẶC booking code (BK-VNEX-...).', example: 'BK-VNEX-20250812-A3B' })
  @ApiBody({
    description: 'Payload ghi nhận chứng từ chuyển khoản ngân hàng từ khách hàng.',
    schema: {
      type: 'object',
      required: ['bankCode', 'transferAmount', 'transferAt', 'referenceNo', 'totalAmount'],
      properties: {
        bankCode: {
          type: 'string',
          minLength: 2,
          maxLength: 20,
          example: 'VCB',
          description:
            'Mã ngân hàng VN: VCB=Vietcombank, TCB=Techcombank, MB=MBBank, VPBank=VPBank, BIDV=BIDV, ACB=ACB, VIB=VIB, SHB=SHB, AgriBank=Agribank, Sacombank=STB, Eximbank=EIB,...',
        },
        transferAmount: {
          type: 'number',
          minimum: 1,
          example: 1245000,
          description: 'Số tiền khách thực tế chuyển (VND, nguyên dương > 0). QA assertion: transferAmount >= min_deposit(30%) và <= totalAmount+1000 (chấp nhận làm tròn nhỏ).',
        },
        transferAt: {
          type: 'string',
          format: 'date-time',
          example: '2025-08-12T09:34:15.000Z',
          description: 'Thời gian trên màn hình app ngân hàng/phiếu in ấn ghi nhận khách đã chuyển (ISO 8601). Tốt nhất là giờ GMT+7 chuyển về UTC.',
        },
        referenceNo: {
          type: 'string',
          minLength: 4,
          maxLength: 60,
          example: 'VCB.20250812.093415.TRANFER.BOOKING.BKVNEX20250812A3B',
          description: 'Mã tham chiếu đối soát (tra cứu trên internet banking / SOAP): mã giao dịch 21 số cuối + nội dung chuyển khoản.',
        },
        totalAmount: {
          type: 'number',
          minimum: 1,
          example: 4980000,
          description: 'Tổng số tiền booking (bắt buộc >0) — để double check backend so với booking.totalAmount (khách không thể submit sai số).',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      '201 Created: Ghi nhận chứng từ thanh toán thành công. paymentStatus=pending_bank_transfer (chờ nhân viên đối soát). Trả paymentRecord + booking snapshot. Gửi thông báo email + in_app cho KH và admin/staff.',
  })
  @ApiResponse({ status: 400, description: 'Validation không hợp lệ: totalAmount=0, transferAmount<=0, bankCode rỗng, referenceNo trống, transferAt format sai HOẶC totalAmount không khớp booking.totalAmount ( lệch quá ±5% ).' })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn.' })
  @ApiResponse({ status: 403, description: '403 Forbidden: Không phải chủ sở hữu booking này.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy booking id / code.' })
  @ApiResponse({ status: 409, description: 'Conflict: Đơn này đã paid (không cho submit bank transfer nữa) HOẶC đã có referenceNo trùng (double submit).' })
  async submitBankTransfer(@Param('id') id: string, @Body() body: any, @CurrentUser() user: JwtPayload) {
    const booking = await this.bookingsService.findByCodeOrId(id)
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt')
    const createdByStr = booking.createdBy ? String(booking.createdBy) : ''
    const isOwner = createdByStr === String(user.sub)
    if (!isOwner) {
      const emailMatch = booking.contact?.email && (String(booking.contact.email).toLowerCase() === String((user as any).email ?? '').toLowerCase())
      const phoneMatch =
        booking.contact?.phone &&
        String(booking.contact.phone).replace(/\D+/g, '') === String((user as any).phone ?? '').replace(/\D+/g, '')
      if (!emailMatch && !phoneMatch) throw new ForbiddenException('Bạn không có quyền thanh toán cho đơn này')
    }

    const rawBankCode = String(body?.bankCode ?? '').trim()
    const transferAmount = Number(body?.transferAmount ?? 0)
    const transferAtRaw = body?.transferAt
    const referenceNo = String(body?.referenceNo ?? '').trim()
    const totalAmountSubmitted = Number(body?.totalAmount ?? 0)

    if (!rawBankCode || rawBankCode.length < 2 || rawBankCode.length > 20)
      throw new BadRequestException('bankCode: mã ngân hàng 2-20 ký tự')
    if (!(transferAmount > 0))
      throw new BadRequestException('transferAmount: số tiền chuyển phải lớn hơn 0 (VND)')
    if (!transferAtRaw || Number.isNaN(new Date(String(transferAtRaw)).getTime()))
      throw new BadRequestException('transferAt: thời gian chuyển khoản phải là ISO date-time hợp lệ')
    if (!referenceNo || referenceNo.length < 4)
      throw new BadRequestException('referenceNo: mã tham chiếu đối soát tối thiểu 4 ký tự')
    if (!(totalAmountSubmitted > 0))
      throw new BadRequestException('totalAmount: tổng tiền booking phải > 0 (bắt buộc submit lại để double-check)')

    const bookingTotal = Number(booking.totalAmount || 0)
    const tolerance = Math.max(5000, bookingTotal * 0.05)
    if (Math.abs(totalAmountSubmitted - bookingTotal) > tolerance)
      throw new BadRequestException(
        `totalAmount (${totalAmountSubmitted.toLocaleString('vi-VN')}đ) lệch quá nhiều so với booking (${bookingTotal.toLocaleString('vi-VN')}đ). Vui lòng kiểm tra lại.`,
      )

    try {
      booking.set('paymentMethod', 'bank_transfer')
      booking.set('paymentStatus', 'pending_bank_transfer')
      const meta: any = (booking as any).paymentBankTransferMeta ?? {}
      const nextItem = {
        bankCode: rawBankCode,
        transferAmount,
        transferAt: new Date(String(transferAtRaw)),
        referenceNo,
        totalAmountSubmitted,
        submittedBy: Types.ObjectId.createFromHexString(String(user.sub)),
        submittedAt: new Date(),
      }
      booking.set('paymentBankTransferMeta', {
        ...meta,
        last: nextItem,
        history: Array.isArray(meta.history) ? [...meta.history, nextItem] : [nextItem],
      })
      const saved = await booking.save()
      try { await (this.bookingsService as any).emitBookingStatusChanged?.('pending_bank_transfer' as any, saved) } catch {}
      return {
        ok: true,
        paymentStatus: 'pending_bank_transfer',
        paymentRecord: nextItem,
        booking: {
          id: saved._id?.toString?.() ?? saved.id,
          code: saved.code,
          totalAmount: Number(saved.totalAmount || 0),
          paymentMethod: saved.paymentMethod,
          paymentStatus: saved.paymentStatus,
        },
      }
    } catch (err: any) {
      if ((String(err?.message ?? err) || '').toLowerCase().includes('duplicate'))
        throw new BadRequestException('referenceNo đã được ghi nhận trước đó (double submit)')
      throw err
    }
  }
}
