import { z } from 'zod'
import { REVIEW_STATUSES } from '../review.schema'

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
const urlList = z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.length > 0).slice(0, 6) : []),
  z.array(z.string().max(600)).max(6),
)
const csvOrList = z.preprocess(
  (v) => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.length > 0)
    if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
    return []
  },
  z.array(z.string().max(40)).max(50),
)

export const createReviewDto = z.object({
  bookingId: z.string().min(3, 'bookingId bắt buộc'),
  rating: z.number().int().min(1).max(5),
  title: nullableString(120),
  content: nonEmptyString(10, 2000),
  images: urlList.optional(),
})
export type CreateReviewDto = z.infer<typeof createReviewDto>

export const updateReviewDto = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: nullableString(120),
  content: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : String(v).trim()),
    z.string().min(10).max(2000).optional(),
  ),
  images: urlList.optional(),
})
export type UpdateReviewDto = z.infer<typeof updateReviewDto>

export const setReviewStatusDto = z.object({
  status: z.enum(REVIEW_STATUSES as [string, ...string[]]),
})
export type SetReviewStatusDto = z.infer<typeof setReviewStatusDto>

export const patchReviewPermissionsDto = z.object({
  requireStaffRemoval: z.boolean().optional(),
  canStaffDelete: z.boolean().optional(),
  canStaffEdit: z.boolean().optional(),
})
export type PatchReviewPermissionsDto = z.infer<typeof patchReviewPermissionsDto>

export const reportReviewDto = z.object({
  reason: nonEmptyString(3, 80),
  detail: nullableString(600),
})
export type ReportReviewDto = z.infer<typeof reportReviewDto>

export const staffReplyReviewDto = z.object({
  content: nonEmptyString(5, 2000),
})
export type StaffReplyReviewDto = z.infer<typeof staffReplyReviewDto>

export const adminReplyReviewDto = z.object({
  content: nonEmptyString(5, 2000),
})
export type AdminReplyReviewDto = z.infer<typeof adminReplyReviewDto>

export const listReviewsQueryDto = z.object({
  tourId: z.preprocess((v) => (typeof v === 'string' && v.length ? v : null), z.string().nullable().optional()),
  tourSlug: nullableString(220),
  rating: z.preprocess((v) => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).max(5).nullable().optional()),
  status: z.preprocess(
    (v) => {
      if (Array.isArray(v)) return v.map(String).filter(Boolean)
      if (typeof v === 'string') return v.split(',').map((s) => s.trim()).filter(Boolean)
      return null
    },
    z.array(z.enum(REVIEW_STATUSES as [string, ...string[]])).nullable().optional(),
  ),
  customerId: z.preprocess((v) => (typeof v === 'string' && v.length ? v : null), z.string().nullable().optional()),
  isReported: z.preprocess((v) => (v === '' ? null : v === 'true' ? true : v === 'false' ? false : null), z.boolean().nullable().optional()),
  requireStaffRemoval: z.preprocess((v) => (v === '' ? null : v === 'true' ? true : v === 'false' ? false : null), z.boolean().nullable().optional()),
  onlyMine: z.preprocess((v) => (v === 'true' ? true : false), z.boolean().optional()),
  sort: z.preprocess(
    (v) => {
      if (typeof v === 'string' && ['newest', 'oldest', 'rating_desc', 'rating_asc', 'most_liked', 'most_reported'].includes(v)) return v
      return 'newest'
    },
    z.enum(['newest', 'oldest', 'rating_desc', 'rating_asc', 'most_liked', 'most_reported']).optional(),
  ),
  page: z.preprocess((v) => Math.max(1, Number(v) || 1), z.number().int().min(1)),
  pageSize: z.preprocess((v) => Math.min(200, Math.max(1, Number(v) || 10)), z.number().int().min(1).max(200)),
  ids: csvOrList.optional(),
  search: z.preprocess((v) => (typeof v === 'string' && v.trim().length ? v.trim() : null), z.string().max(220).nullable().optional()),
})
export type ListReviewsQueryDto = z.infer<typeof listReviewsQueryDto>

export const bulkReviewActionDto = z.object({
  ids: csvOrList,
  action: z.enum(['hide', 'publish', 'delete', 'assign_staff', 'unassign_staff']),
})
export type BulkReviewActionDto = z.infer<typeof bulkReviewActionDto>

export const myPendingReviewBookingsQueryDto = z.object({
  page: z.preprocess((v) => Math.max(1, Number(v) || 1), z.number().int().min(1)),
  pageSize: z.preprocess((v) => Math.min(200, Math.max(1, Number(v) || 20)), z.number().int().min(1).max(200)),
})
export type MyPendingReviewBookingsQueryDto = z.infer<typeof myPendingReviewBookingsQueryDto>
