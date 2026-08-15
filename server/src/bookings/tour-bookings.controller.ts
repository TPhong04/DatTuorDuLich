import { BadRequestException, Body, Controller, Param, Post, NotFoundException, ForbiddenException } from '@nestjs/common'
import { Types } from 'mongoose'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger'

import { Booking } from './booking.schema'
import { BookingsService } from './bookings.service'
import { createBookingDto } from './dto'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { JwtPayload } from '../auth/auth.types'
// #region debug-point booking-create-500
import { dbg } from '../_dbg'
// #endregion

@ApiTags('Bookings')
@Controller('tours')
export class TourBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post(':slug/bookings')
  @ApiSecurity('xsrfToken')
  @ApiBearerAuth('bearerJwt')
  @ApiOperation({
    summary: 'Tạo đặt tour cho khách (public / anonymous / customer đã login)',
    description:
      "QA: Endpoint tạo đặt chỗ (booking). Hỗ trợ 2 chế độ auth: (A) không token → booking.createdBy=null nhưng vẫn ghi contact email/phone (query MY Bookings sẽ match bằng email/phone). (B) Có Bearer accessToken → booking.createdBy=userId (hiển thị trong /me/bookings). Bắt buộc X-XSRF-TOKEN header (CSRF double submit) vì non-GET. Validation: phone regex VN, total pax ≥1 và ≤20, passengers.length phải khớp adult+child+infant, agreeTerms=true, departureId phải tồn tại + seatsAvailable≥pax (atomic check). Trả 201 Created: booking id, code BK-VNEX-YYYYMMDD-XXX, status='new', paymentStatus='unpaid' (nếu paymentMethod='hold').",
  })
  @ApiParam({ name: 'slug', description: 'Slug của tour (lấy từ GET /tours/:slug).', example: 'tour-ha-long-2n1d-du-thuyen-5-sao' })
  @ApiBody({
    description: 'Payload tạo booking (zod createBookingDto). Lưu ý: passengers phải đủ NL+TE+EB và đúng số lượng type.',
    schema: {
      type: 'object',
      required: ['departureId', 'adultCount', 'childCount', 'infantCount', 'contact', 'passengers', 'agreeTerms'],
      properties: {
        departureId: {
          type: 'string',
          example: '67f2a8b3c4d5e6f7a8b9c0ee',
          description: 'ID của đợt khởi hành (lấy từ GET /tours/:slug → tour.departures[].id).',
        },
        adultCount: { type: 'integer', minimum: 0, default: 1, example: 2, description: 'Số người lớn (≥13 tuổi) - mã NL.' },
        childCount: { type: 'integer', minimum: 0, default: 0, example: 1, description: 'Số trẻ em (2-12 tuổi) - mã TE.' },
        infantCount: { type: 'integer', minimum: 0, default: 0, example: 0, description: 'Số em bé (<2 tuổi) - mã EB.' },
        contact: {
          type: 'object',
          required: ['name', 'phone'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 120, example: 'Nguyễn Thị Liên', description: 'Họ tên người liên hệ đặt tour.' },
            phone: {
              type: 'string',
              minLength: 8,
              maxLength: 30,
              example: '0909123456',
              description:
                'Số điện thoại Việt Nam hợp lệ: đầu 09x/08x/07x/05x/03x (di động) hoặc 02xx (cố vấn). Có thể viết có dấu cách / gạch ngang (system sẽ clean).',
            },
            email: { type: 'string', nullable: true, format: 'email', maxLength: 200, example: 'lien.nguyen@email.vn', description: 'Email liên hệ (optional, có thể null/""), dùng để truy vết booking khi chưa login.' },
            address: { type: 'string', nullable: true, maxLength: 260, example: 'Số 123, Đường Nguyễn Huệ, Quận 1, TP.HCM', description: 'Địa chỉ người liên hệ (optional).' },
          },
        },
        passengers: {
          type: 'array',
          description: 'Danh sách hành khách phải có length = adultCount+childCount+infantCount, đúng từng type NL/TE/EB.',
          items: {
            type: 'object',
            required: ['fullName', 'type'],
            properties: {
              fullName: { type: 'string', minLength: 1, maxLength: 120, example: 'Nguyễn Văn Khánh' },
              type: { type: 'string', enum: ['NL', 'TE', 'EB'], description: 'NL=người lớn (≥13t), TE=trẻ em (2-12t), EB=em bé <2t.' },
              birthDate: { type: 'string', nullable: true, format: 'date-time', example: '2010-05-20T12:00:00.000Z', description: 'Ngày sinh (recommended để system auto-validate age vs type).' },
              gender: { type: 'string', nullable: true, enum: ['male', 'female', 'other'] },
              idCard: { type: 'string', nullable: true, maxLength: 30, example: '012345678901', description: 'CCCD/CMND/Hộ chiếu (hiển thị ở manifest bay nếu có).' },
              notes: { type: 'string', nullable: true, maxLength: 500, example: 'Ăn chay, dịp tôm.' },
            },
          },
          example: [
            { fullName: 'Nguyễn Văn Khánh', type: 'NL', birthDate: '1990-04-15T12:00:00.000Z', gender: 'male', idCard: '012345678901', notes: 'Ở trên giường dưới, cần gối thêm.' },
            { fullName: 'Nguyễn Thị Liên', type: 'NL', birthDate: '1992-08-20T12:00:00.000Z', gender: 'female', idCard: '012345678902', notes: '' },
            { fullName: 'Nguyễn Minh An', type: 'TE', birthDate: '2015-03-10T12:00:00.000Z', gender: 'female', idCard: null, notes: 'Cầm bánh, uống sữa không đường.' },
          ],
        },
        notes: { type: 'string', nullable: true, maxLength: 1000, example: 'Yêu cầu xe 9 chỗ, cần hướng dẫn viên nói tiếng Anh.', description: 'Ghi chú chung cho booking (customer -> staff nhìn thấy).' },
        surcharges: {
          type: 'array',
          default: [],
          description: 'Các phụ thu thêm (xe riêng, phòng đơn, tour riêng,...). Mặc định mảng rỗng.',
          items: {
            type: 'object',
            required: ['label', 'quantity', 'unitPrice'],
            properties: {
              label: { type: 'string', minLength: 1, maxLength: 160, example: 'Upgrade phòng đơn supplement' },
              quantity: { type: 'integer', minimum: 0, example: 2 },
              unitPrice: { type: 'number', minimum: 0, example: 500000 },
              note: { type: 'string', nullable: true, maxLength: 300, example: '2 khách NL' },
            },
          },
        },
        paymentMethod: { type: 'string', enum: ['hold', 'bank_transfer', 'online'], default: 'hold', description: "hold = giữ chỗ rồi thanh toán sau (15 phút), bank_transfer = chọn phương thức chuyển khoản, online = thanh toán online (có thể partial)." },
        agreeTerms: { type: 'boolean', example: true, description: 'Bắt buộc = true: khách đã đọc và đồng ý Điều khoản & Chính sách hủy tour của VNExplorer.' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description:
      '201 Created: Booking tạo thành công! Trả booking công khai: code (BK-VNEX-YYYYMMDD-XXX), status=new, holdsUntil (TTL 15 phút), totalAmount, passenger list. Nếu paymentMethod=hold → giữ chỗ auto-release sau 15 phút nếu không thanh toán cọc.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation dữ liệu không hợp lệ (phone sai regex, pax=0, exceed 12 chỗ, passengers khớp type, agreeTerms=false, departureId không tồn tại, seatsAvailable không đủ,...).',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc token hết hạn (chỉ áp dụng nếu gửi Bearer token).' })
  @ApiResponse({
    status: 404,
    description: 'Không tìm thấy tour theo slug HOẶC tour chưa được isPublished=true HOẶC departureId không nằm trong tour đó.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Conflict: vượt chỗ (có user khác vừa đặt trong cùng request → atomic seats lock thất bại) / duplicate booking code / hold timeout concurrent request.',
  })
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
