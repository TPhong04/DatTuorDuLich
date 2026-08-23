import { z } from 'zod'

// MongoDB ObjectId: chuỗi hex 24 ký tự
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ')

// ============== CUSTOMER PUBLIC ==============

export const sendMessageDto = z.object({
  sessionId: objectIdSchema.optional(), // nếu chưa có => tạo session mới
  message: z.string().min(1).max(2000),
  guestName: z.string().min(1).max(100).optional(),
  guestEmail: z.string().email().max(150).optional(),
  guestPhone: z.string().min(8).max(20).optional(),
  userId: objectIdSchema.optional(), // nếu khách đã đăng nhập (backend sẽ verify với access token hoặc để trống nếu public client)
})
export type SendMessageDto = z.infer<typeof sendMessageDto>

export const sessionGetDetailDto = z.object({
  sessionId: objectIdSchema,
  // optional: guest verify (khách vãng lai có thể lấy chi tiết session bằng sessionId)
})
export type SessionGetDetailDto = z.infer<typeof sessionGetDetailDto>

export const submitRatingDto = z.object({
  sessionId: objectIdSchema,
  ratingStars: z.number().int().min(1).max(5),
  ratingComment: z.string().max(1000).optional(),
  guestEmail: z.string().email().optional(), // xác nhận để đánh giá
})
export type SubmitRatingDto = z.infer<typeof submitRatingDto>

// ============== STAFF / ADMIN ==============

export const staffReplyDto = z.object({
  sessionId: objectIdSchema,
  message: z.string().min(1).max(4000),
})
export type StaffReplyDto = z.infer<typeof staffReplyDto>

export const updateSessionStatusDto = z.object({
  sessionId: objectIdSchema,
  status: z.enum(['BOT', 'ESCALATED', 'CLOSED']),
  closedReason: z.enum(['resolved_by_staff', 'resolved_by_bot', 'customer_idle_timeout', 'staff_closed', 'admin_closed', 'auto_closed_24h', 'unknown']).optional(),
})
export type UpdateSessionStatusDto = z.infer<typeof updateSessionStatusDto>

export const assignSessionDto = z.object({
  sessionId: objectIdSchema,
  staffUserId: objectIdSchema, // id staff được giao
  transferNote: z.string().max(500).optional(),
})
export type AssignSessionDto = z.infer<typeof assignSessionDto>

export const claimSessionDto = z.object({
  sessionId: objectIdSchema,
})
export type ClaimSessionDto = z.infer<typeof claimSessionDto>

export const listSessionsDto = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  status: z.enum(['BOT', 'ESCALATED', 'CLOSED']).optional(),
  assignedTo: objectIdSchema.optional(),
  search: z.string().max(100).optional(), // search theo guestName / guestEmail / escalationReason
  sortBy: z.enum(['lastCustomerMessageAt', 'escalatedAt', 'createdAt', 'updatedAt']).default('lastCustomerMessageAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  onlyUnassigned: z.coerce.boolean().default(false).optional(),
  slaBreachedOnly: z.coerce.boolean().default(false).optional(),
})
export type ListSessionsDto = z.infer<typeof listSessionsDto>

export const getSessionDetailDto = z.object({
  sessionId: objectIdSchema,
  messageLimit: z.coerce.number().int().min(1).max(500).default(200).optional(),
})
export type GetSessionDetailDto = z.infer<typeof getSessionDetailDto>

export const escalateByStaffDto = z.object({
  sessionId: objectIdSchema,
  reason: z.string().min(1).max(300),
})
export type EscalateByStaffDto = z.infer<typeof escalateByStaffDto>

export const transferSessionDto = z.object({
  sessionId: objectIdSchema,
  toStaffUserId: objectIdSchema,
  reason: z.string().max(500).optional(),
})
export type TransferSessionDto = z.infer<typeof transferSessionDto>

export const chatStatsDto = z.object({
  fromDate: z.string().datetime({ offset: true }).optional(),
  toDate: z.string().datetime({ offset: true }).optional(),
})
export type ChatStatsDto = z.infer<typeof chatStatsDto>
