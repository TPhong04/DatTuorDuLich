import { z } from 'zod'

export const VIETNAM_PHONE_REGEX =
  /^(?:\+84|84|0)(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9]|2[0-9]{2})\d{6,7}$/

export const cleanPhoneForValidation = (raw: string): string =>
  String(raw || '').replace(/[^\d+]/g, '').replace(/^00/, '+')

export const isValidVietnamPhone = (raw: string): boolean => {
  const cleaned = cleanPhoneForValidation(raw)
  if (!cleaned) return false
  if (VIETNAM_PHONE_REGEX.test(cleaned)) return true
  const digitsOnly = cleaned.replace(/\D+/g, '')
  if (digitsOnly.length >= 9 && digitsOnly.length <= 11 && /^[0-9]+$/.test(digitsOnly)) return true
  return false
}

export const passengerTypeSchema = z
  .enum(['NL', 'TE', 'EB'])
  .describe(
    'Loại hành khách: NL = Người lớn (≥13 tuổi), TE = Trẻ em (2-12 tuổi), EB = Em bé (<2 tuổi, không chiếm ghế ngồi riêng).',
  )
export const bookingGenderSchema = z
  .enum(['male', 'female', 'other'])
  .describe('Giới tính hành khách: male = Nam, female = Nữ, other = Khác / Không muốn tiết lộ.')
export const bookingPaymentMethodSchema = z
  .enum(['hold', 'bank_transfer', 'online'])
  .describe(
    'Phương thức thanh toán đã chọn: hold = giữ chỗ (thanh toán sau 15 phút, mặc định), bank_transfer = chọn chuyển khoản ngân hàng, online = thanh toán qua cổng online (VNPay / MOMO / OnePay / Stripe...).',
  )

export const passengerSchema = z.object({
  fullName: z
    .string()
    .min(1)
    .max(120)
    .describe(
      '[Passenger] Họ và tên hành khách (đúng như CMND/CCCD/Hộ chiếu, tối đa 120 ký tự).',
    ),
  type: passengerTypeSchema.describe('[Passenger] Loại hành khách (NL / TE / EB).'),
  birthDate: z
    .string()
    .nullish()
    .transform((v) => (v ? new Date(v) : null))
    .describe(
      '[Passenger] Ngày sinh hành khách (recommended để system tự validate độ tuổi với NL/TE/EB, tính phí vé đúng quy định ngành du lịch VN).',
    ),
  gender: bookingGenderSchema.nullish().default(null).describe('[Passenger] Giới tính hành khách (optional).'),
  idCard: z
    .string()
    .max(30)
    .nullish()
    .default(null)
    .describe(
      '[Passenger] Số CCCD / CMND / Hộ chiếu hành khách (nếu có). Hiển thị ở manifest bay / check-in khách sạn 5 sao.',
    ),
  notes: z
    .string()
    .max(500)
    .nullish()
    .default(null)
    .describe('[Passenger] Ghi chú riêng cho từng hành khách (ăn chay, dị ứng thực phẩm, yêu cầu ghế cửa sổ, cần nệm em bé, v.v.). Tối đa 500 ký tự.'),
})

export const surchargeLineSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(160)
    .describe(
      '[Surcharge line] Tên mục phụ thu / thêm dịch vụ (VD: Upgrade phòng đơn, Xe 9 chỗ riêng, Hướng dẫn viên tiếng Anh, Thêm bảo hiểm du lịch quốc tế...). Tối đa 160 ký tự.',
    ),
  quantity: z
    .number()
    .int()
    .min(0)
    .describe('[Surcharge line] Số lượng (số khách / số đêm / số lượng unit). Integer ≥0.'),
  unitPrice: z
    .number()
    .min(0)
    .describe('[Surcharge line] Đơn giá / 1 unit (VNĐ, không âm). ≥0.'),
  note: z
    .string()
    .max(300)
    .nullish()
    .default(null)
    .describe('[Surcharge line] Ghi chú chi tiết mục phụ thu (optional, 300 ký tự max).'),
})

export const createBookingDto = z
  .object({
    departureId: z
      .string()
      .min(1)
      .describe(
        '[Create Booking] ID của đợt khởi hành trong tour (lấy từ GET /tours/:slug → field tour.departures[].id: ObjectId 24 hex hoặc numeric idx). System sẽ validate dep tồn tại bên trong tour.slug đã cho.',
      ),
    adultCount: z
      .number()
      .int()
      .min(0)
      .default(1)
      .describe(
        '[Create Booking] Số lượng người lớn (NL ≥13 tuổi). Integer ≥0. Tổng adult+child+infant phải ≥1 và ≤20 (đoàn lớn >20 vui lòng tạo GTR = Group Tour Request).',
      ),
    childCount: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('[Create Booking] Số lượng trẻ em (TE 2-12 tuổi). Integer ≥0. TE thường = 70%~85% giá NL.'),
    infantCount: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('[Create Booking] Số lượng em bé (EB <2 tuổi). Integer ≥0. EB thường không chiếm ghế, chỉ thu phí dịch vụ (thường 10-25% NL).'),
    contact: z.object({
      name: z
        .string()
        .min(1)
        .max(120)
        .describe(
          '[Booking Contact] Họ tên người liên hệ chính (người đặt tour, nhận hóa đơn, xác nhận thông tin). 1-120 ký tự.',
        ),
      phone: z
        .string()
        .min(8)
        .max(30)
        .refine((val) => isValidVietnamPhone(val), {
          message:
            'Số điện thoại không hợp lệ. Số Việt Nam hợp lệ bắt đầu bằng 0 / +84 và có 9-10 chữ số (di động 09x, 08x, 07x, 05x, 03x; cố vấn 02xx).',
        })
        .transform((val) => cleanPhoneForValidation(val))
        .describe(
          '[Booking Contact] Số điện thoại người liên hệ (bắt buộc). Regex: VIETNAM_PHONE_REGEX - system sẽ clean (bỏ dấu cách, dấu gạch ngang). 8-30 ký tự raw. Hỗ trợ +84 / 84 prefix quốc tế.',
        ),
      email: z
        .union([z.string().max(200).email(), z.string().length(0), z.null()])
        .transform((v) => (v === '' || v == null ? null : v))
        .default(null)
        .describe(
          '[Booking Contact] Email liên hệ (optional, 200 ký tự max). Quan trọng: nếu khách chưa login mà dùng email này → sau này login với email trùng sẽ thấy booking ở /me/bookings (match resolver).',
        ),
      address: z
        .string()
        .max(260)
        .nullish()
        .default(null)
        .describe('[Booking Contact] Địa chỉ nơi ở của người liên hệ (optional, 260 ký tự max). Dùng cho giao dịch hóa đơn VAT nếu cần.'),
    }),
    passengers: z
      .array(passengerSchema)
      .describe(
        '[Create Booking] Danh sách hành khách (array). System superRefine: passengers.length PHẢI = adultCount + childCount + infantCount, và số lượng từng type NL/TE/EB phải khớp chính xác với count. Sai → 400 Validation error.',
      ),
    notes: z
      .string()
      .max(1000)
      .nullish()
      .default(null)
      .describe(
        '[Create Booking] Ghi chú chung từ phía khách hàng (customer → staff nhìn thấy). 1000 ký tự max. VD: "Yêu cầu xe sạch, không hút thuốc, hướng dẫn viên giỏi tiếng Nhật."',
      ),
    surcharges: z
      .array(surchargeLineSchema)
      .default([])
      .describe(
        '[Create Booking] Các dòng phụ thu / thêm dịch vụ (array surchargeLine). Mặc định [] (rỗng). System cộng dồn vào surchargeAmount rồi cộng vào totalAmount cuối booking.',
      ),
    vehicleRequest: z
      .object({
        enabled: z.boolean().default(false),
        vehicleType: z.string().max(80).nullish().default(null),
        vehicleClass: z.string().max(80).nullish().default(null),
        seatCountMin: z.coerce.number().int().min(1).max(60).nullish().default(null),
        vehicleCount: z.coerce.number().int().min(1).max(20).optional().default(1),
        withDriver: z.boolean().optional().default(true),
        pickupLocation: z.string().max(400).nullish().default(null),
        returnLocation: z.string().max(400).nullish().default(null),
        notes: z.string().max(2000).nullish().default(null),
      })
      .nullable()
      .optional()
      .default(null)
      .describe(
        '[Luồng B - Thuê xe kèm Tour] Thông tin khách yêu cầu thuê xe kèm theo tour (nhân viên vận hành sẽ dựa trên đây tạo Hợp đồng thuê xe gắn bookingId).',
      ),
    paymentMethod: bookingPaymentMethodSchema
      .default('hold')
      .describe(
        '[Create Booking] Phương thức thanh toán chọn lúc đặt. hold = giữ chỗ (15 phút rồi thanh toán cọc sau), bank_transfer = khách chọn chuyển khoản sớm, online = redirect cổng thanh toán (chưa implement full).',
      ),
    agreeTerms: z
      .boolean()
      .refine((v) => v === true, {
        message: 'Vui lòng đồng ý điều khoản & chính sách hủy tour',
      })
      .describe(
        '[Create Booking] Bắt buộc = true: Khách đã đọc checkboxes đồng ý Điều khoản dịch vụ & Chính sách hủy / hoàn tiền của VNExplorer (liên quan luật Nghệ Thuật & Du Lịch Việt Nam).',
      ),
  })
  .superRefine((val, ctx) => {
    const total = val.adultCount + val.childCount + val.infantCount
    if (total <= 0)
      ctx.addIssue({
        code: 'custom',
        message: 'Cần ít nhất 1 hành khách (NL/TE/EB).',
        path: ['adultCount'],
      })
    if (total > 20)
      ctx.addIssue({
        code: 'custom',
        message: '1 lần đặt tối đa 20 hành khách (đoàn lớn vui lòng liên hệ).',
        path: ['adultCount'],
      })
    if (val.passengers.length !== total) {
      ctx.addIssue({
        code: 'custom',
        message: `Số hành khách danh sách (${val.passengers.length}) phải khớp với tổng NL+TE+EB (${total}).`,
        path: ['passengers'],
      })
    }
    const counts: Record<string, number> = { NL: 0, TE: 0, EB: 0 }
    for (const p of val.passengers) counts[p.type] = (counts[p.type] || 0) + 1
    if (counts.NL !== val.adultCount)
      ctx.addIssue({
        code: 'custom',
        message: `Số hành khách loại NL phải khớp với adultCount=${val.adultCount} (hiện có ${counts.NL}).`,
        path: ['passengers'],
      })
    if (counts.TE !== val.childCount)
      ctx.addIssue({
        code: 'custom',
        message: `Số hành khách loại TE phải khớp với childCount=${val.childCount} (hiện có ${counts.TE}).`,
        path: ['passengers'],
      })
    if (counts.EB !== val.infantCount)
      ctx.addIssue({
        code: 'custom',
        message: `Số hành khách loại EB phải khớp với infantCount=${val.infantCount} (hiện có ${counts.EB}).`,
        path: ['passengers'],
      })
  })

export const updateBookingStatusDto = z.object({
  status: z
    .enum(['new', 'confirmed', 'in_progress', 'completed', 'cancelled'])
    .describe(
      '[Admin Update Booking Status] Trạng thái tiếp theo của booking: new = mới tạo (chờ xác nhận), confirmed = admin/staff đã xác nhận booking, in_progress = tour đang diễn ra (đang đi), completed = tour đi xong (WON), cancelled = khách/admin hủy (trả lại chỗ).',
    ),
  adminNote: z
    .string()
    .max(1000)
    .nullish()
    .default(null)
    .describe(
      '[Admin Update Booking Status] Ghi chú từ admin/staff (khách không thấy nếu không expose). 1000 ký tự max. VD: "Xác nhận cọc 30% theo TK VCB xxx, khách hài lòng."',
    ),
  sendBackSeatsOnCancel: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      '[Admin Update Booking Status, chỉ khi status=cancelled] Mặc định true: trả lại seatsAvailable cho departure tour sau khi hủy. Set=false trong case đặc biệt (hủy do lỗi customer quá hạn, doanh thu đã ghi nhận, không trả chỗ lại inventory).',
    ),
})

export const listBookingsQueryDto = z.object({
  status: z
    .enum(['pending', 'new', 'confirmed', 'in_progress', 'completed', 'cancelled'])
    .optional()
    .describe(
      '[List Bookings Filter] Lọc theo booking.status. pending = trạng thái đặc biệt (trong GTR module). Các trạng thái thường: new/confirmed/in_progress/completed/cancelled.',
    ),
  from: z
    .string()
    .nullish()
    .describe(
      '[List Bookings Filter] Ngày tạo booking ≥ (YYYY-MM-DD, inclusive). Query MongoDB: $gte new Date(from).',
    ),
  to: z
    .string()
    .nullish()
    .describe(
      '[List Bookings Filter] Ngày tạo booking ≤ (YYYY-MM-DD, inclusive; system cộng thêm 23:59:59.999 để cover full ngày cuối).',
    ),
  q: z
    .string()
    .max(100)
    .nullish()
    .describe(
      '[List Bookings Fulltext Search] Tìm kiếm case-insensitive contains regex trên: booking.code, tourSnapshot.title (tên tour), contact.name, contact.phone, contact.email. 100 ký tự max.',
    ),
  page: z
    .coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe('[List Bookings Pagination] Số trang hiện tại (bắt đầu = 1). Integer ≥1. Default 1. (Auto coerce string→number từ HTTP query string).'),
  limit: z
    .coerce
    .number()
    .int()
    .min(5)
    .max(100)
    .optional()
    .default(20)
    .describe(
      '[List Bookings Pagination] Số item / trang. Integer 5-100 (min=5 để không quá ít, max=100 để không OOM / response lớn). Default 20. (Auto coerce string→number từ HTTP query string).',
    ),
})

export const assignStaffBookingDto = z.object({
  staffIds: z
    .array(z.string().min(1).max(60))
    .min(0)
    .max(20)
    .describe(
      '[Admin Assign Staff Booking] Danh sách User ID (role=staff) được giao phụ trách đơn. Truyền [] (mảng rỗng) để BỎ giao toàn bộ nhân viên khỏi đơn. Mỗi phần tử: ObjectId 24 hex hoặc dạng khác được Types.ObjectId accept (tối đa 60 ký tự). Max 20 nhân viên / 1 booking.',
    ),
  adminNote: z
    .string()
    .max(2000)
    .nullish()
    .default(null)
    .describe(
      '[Admin Assign Staff Booking] Ghi chú nội bộ admin kèm theo hành động giao việc (VD: "Chị Hương chuyên tour miền Bắc - khách 3 người lớn 2 TE muốn ăn chay, phòng tầng thấp, hướng biển."). Max 2000 chars.',
    ),
})

export type CreateBookingPayload = z.infer<typeof createBookingDto>
export type UpdateBookingStatusPayload = z.infer<typeof updateBookingStatusDto>
export type ListBookingsQuery = z.infer<typeof listBookingsQueryDto>
export type AssignStaffBookingPayload = z.infer<typeof assignStaffBookingDto>
