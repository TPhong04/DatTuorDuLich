import { z } from 'zod'

const dateDto = z
  .string()
  .trim()
  .min(1)
  .refine((v) => !Number.isNaN(Date.parse(v)))
  .transform((v) => new Date(v))

export const bannerTargetTypeDto = z.enum(['none', 'internal', 'external'])

const bannerBaseDto = z.object({
  title: z.string().trim().min(1).nullable().optional(),
  imageUrl: z.string().trim().min(1),
  targetType: bannerTargetTypeDto.optional(),
  targetValue: z.string().trim().min(1).nullable().optional(),
  openInNewTab: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startAt: dateDto.nullable().optional(),
  endAt: dateDto.nullable().optional(),
})

export const createBannerDto = bannerBaseDto.superRefine((data, ctx) => {
  const type = data.targetType ?? 'none'
  const value = data.targetValue ?? null

  if (type === 'none') return
  if (!value) {
    ctx.addIssue({ code: 'custom', message: 'Thiếu đường dẫn banner', path: ['targetValue'] })
    return
  }
  if (type === 'internal' && !value.startsWith('/')) {
    ctx.addIssue({ code: 'custom', message: 'Link nội bộ phải bắt đầu bằng /', path: ['targetValue'] })
  }
  if (type === 'external' && !/^https?:\/\//i.test(value)) {
    ctx.addIssue({ code: 'custom', message: 'Link ngoài phải bắt đầu bằng http:// hoặc https://', path: ['targetValue'] })
  }
})

export type CreateBannerDto = z.infer<typeof createBannerDto>

export const updateBannerDto = bannerBaseDto.partial().superRefine((data, ctx) => {
  if (data.targetType && data.targetType === 'internal') {
    const v = data.targetValue
    if (typeof v === 'string' && v && !v.startsWith('/')) {
      ctx.addIssue({ code: 'custom', message: 'Link nội bộ phải bắt đầu bằng /', path: ['targetValue'] })
    }
  }
  if (data.targetType && data.targetType === 'external') {
    const v = data.targetValue
    if (typeof v === 'string' && v && !/^https?:\/\//i.test(v)) {
      ctx.addIssue({ code: 'custom', message: 'Link ngoài phải bắt đầu bằng http:// hoặc https://', path: ['targetValue'] })
    }
  }
})

export type UpdateBannerDto = z.infer<typeof updateBannerDto>

export const reorderBannersDto = z.object({
  ids: z.array(z.string().trim().min(1)).min(1),
})

export type ReorderBannersDto = z.infer<typeof reorderBannersDto>

