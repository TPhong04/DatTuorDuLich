import { z } from 'zod'
import { POST_CATEGORIES, POST_STATUSES } from '../post.schema'

const nonEmptyString = (min = 1, max = 400) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z.string().min(min).max(max),
  )
const nullableString = (max = 2000) =>
  z.preprocess(
    (v) => (v === '' || v === undefined ? null : typeof v === 'string' ? v : null),
    z.string().max(max).nullable().optional(),
  )
const isoDate = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : new Date(String(v))),
  z.date().nullable().optional(),
)
const idList = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length > 0) : []),
  z.array(z.string().min(1)),
)

export const createPostDto = z.object({
  title: nonEmptyString(3, 220),
  slug: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.string().min(3).max(260).regex(/^[a-z0-9-]+$/, 'Slug chỉ cho phép ký tự a-z 0-9 và dấu gạch ngang'),
  ).optional().or(z.literal('')),
  category: z.enum(POST_CATEGORIES as [string, ...string[]]),
  tags: z.preprocess((v) => (Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : []), z.array(z.string().max(60))).optional(),
  relatedTourIds: idList.optional(),
  excerpt: nullableString(420),
  content: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : String(v)), z.string().nullable().optional()),
  coverImageUrl: nullableString(600),
  status: z.enum(POST_STATUSES as [string, ...string[]]).optional(),
  scheduledAt: isoDate,
  seoTitle: nullableString(140),
  seoDescription: nullableString(320),
  isPinned: z.boolean().optional(),
  sourceUrl: nullableString(600),
  sourceName: nullableString(220),
})
export type CreatePostDto = z.infer<typeof createPostDto>

export const updatePostDto = createPostDto.partial()
export type UpdatePostDto = z.infer<typeof updatePostDto>

export const patchPostPermissionsDto = z.object({
  canStaffEdit: z.boolean(),
  canStaffDelete: z.boolean(),
})
export type PatchPostPermissionsDto = z.infer<typeof patchPostPermissionsDto>

export const publishPostDto = z.object({
  status: z.enum(POST_STATUSES as [string, ...string[]]),
})
export type PublishPostDto = z.infer<typeof publishPostDto>

export const importRssFeedsDto = z.object({
  feeds: z
    .preprocess(
      (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(',').filter(Boolean) : []),
      z.array(z.string().url().max(600)).max(10),
    )
    .optional(),
  createAs: z.enum(['pending', 'draft']).optional(),
})
export type ImportRssFeedsDto = z.infer<typeof importRssFeedsDto>
