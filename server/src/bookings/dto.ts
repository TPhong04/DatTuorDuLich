import { z } from 'zod'

export const passengerTypeSchema = z.enum(['NL', 'TE', 'EB'])
export const bookingGenderSchema = z.enum(['male', 'female', 'other'])
export const bookingPaymentMethodSchema = z.enum(['hold', 'bank_transfer', 'online'])

export const passengerSchema = z.object({
  fullName: z.string().min(1).max(120),
  type: passengerTypeSchema,
  birthDate: z.string().nullish().transform((v) => (v ? new Date(v) : null)),
  gender: bookingGenderSchema.nullish().default(null),
  idCard: z.string().max(30).nullish().default(null),
  notes: z.string().max(500).nullish().default(null),
})

export const surchargeLineSchema = z.object({
  label: z.string().min(1).max(160),
  quantity: z.number().int().min(0),
  unitPrice: z.number().min(0),
  note: z.string().max(300).nullish().default(null),
})

export const createBookingDto = z
  .object({
    departureId: z.string().min(1),
    adultCount: z.number().int().min(0).default(1),
    childCount: z.number().int().min(0).default(0),
    infantCount: z.number().int().min(0).default(0),
    contact: z.object({
      name: z.string().min(1).max(120),
      phone: z.string().min(8).max(30),
      email: z
        .union([z.string().max(200).email(), z.string().length(0), z.null()])
        .transform((v) => (v === '' || v == null ? null : v))
        .default(null),
      address: z.string().max(260).nullish().default(null),
    }),
    passengers: z.array(passengerSchema),
    notes: z.string().max(1000).nullish().default(null),
    surcharges: z.array(surchargeLineSchema).default([]),
    paymentMethod: bookingPaymentMethodSchema.default('hold'),
    agreeTerms: z.boolean().refine((v) => v === true, { message: 'Vui lòng đồng ý điều khoản & chính sách hủy tour' }),
  })
  .superRefine((val, ctx) => {
    const total = val.adultCount + val.childCount + val.infantCount
    if (total <= 0) ctx.addIssue({ code: 'custom', message: 'Cần ít nhất 1 hành khách (NL/TE/EB).', path: ['adultCount'] })
    if (total > 20) ctx.addIssue({ code: 'custom', message: '1 lần đặt tối đa 20 hành khách (đoàn lớn vui lòng liên hệ).', path: ['adultCount'] })
    if (val.passengers.length !== total) {
      ctx.addIssue({
        code: 'custom',
        message: `Số hành khách danh sách (${val.passengers.length}) phải khớp với tổng NL+TE+EB (${total}).`,
        path: ['passengers'],
      })
    }
    const counts: Record<string, number> = { NL: 0, TE: 0, EB: 0 }
    for (const p of val.passengers) counts[p.type] = (counts[p.type] || 0) + 1
    if (counts.NL !== val.adultCount) ctx.addIssue({ code: 'custom', message: `Số hành khách loại NL phải khớp với adultCount=${val.adultCount} (hiện có ${counts.NL}).`, path: ['passengers'] })
    if (counts.TE !== val.childCount) ctx.addIssue({ code: 'custom', message: `Số hành khách loại TE phải khớp với childCount=${val.childCount} (hiện có ${counts.TE}).`, path: ['passengers'] })
    if (counts.EB !== val.infantCount) ctx.addIssue({ code: 'custom', message: `Số hành khách loại EB phải khớp với infantCount=${val.infantCount} (hiện có ${counts.EB}).`, path: ['passengers'] })
  })

export const updateBookingStatusDto = z.object({
  status: z.enum(['new', 'confirmed', 'in_progress', 'completed', 'cancelled']),
  adminNote: z.string().max(1000).nullish().default(null),
  sendBackSeatsOnCancel: z.boolean().optional().default(true),
})

export const listBookingsQueryDto = z.object({
  status: z.enum(['pending', 'new', 'confirmed', 'in_progress', 'completed', 'cancelled']).optional(),
  from: z.string().nullish(),
  to: z.string().nullish(),
  q: z.string().max(100).nullish(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(5).max(100).optional().default(20),
})

export type CreateBookingPayload = z.infer<typeof createBookingDto>
export type UpdateBookingStatusPayload = z.infer<typeof updateBookingStatusDto>
export type ListBookingsQuery = z.infer<typeof listBookingsQueryDto>
