import { z } from 'zod'

// MongoDB ObjectId: chuỗi hex 24 ký tự (KHÔNG phải UUID)
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID không hợp lệ')

// Khách gửi tin nhắn (theo đúng style Zod bạn đang dùng trong admin-users.controller.ts)
export const sendMessageDto = z.object({
  sessionId: objectIdSchema.optional(), // nếu chưa có => tạo session mới
  message: z.string().min(1).max(2000),
  guestName: z.string().min(1).optional(),
  guestEmail: z.string().email().optional(),
})
export type SendMessageDto = z.infer<typeof sendMessageDto>

// Staff trả lời thủ công khi đã escalate
export const staffReplyDto = z.object({
  sessionId: objectIdSchema,
  message: z.string().min(1).max(2000),
})
export type StaffReplyDto = z.infer<typeof staffReplyDto>

// Staff đóng / nhận session
export const updateSessionStatusDto = z.object({
  sessionId: objectIdSchema,
  status: z.enum(['BOT', 'ESCALATED', 'CLOSED']),
})
export type UpdateSessionStatusDto = z.infer<typeof updateSessionStatusDto>