import { z } from 'zod'

export const registerDto = z.object({
  name: z.string().min(1).describe('Họ tên hiển thị của user (tối thiểu 1 ký tự).'),
  email: z.string().email().describe('Email đăng ký tài khoản (định dạng RFC 5322).'),
  password: z.string().min(6).describe('Mật khẩu tài khoản (tối thiểu 6 ký tự).'),
})

export type RegisterDto = z.infer<typeof registerDto>

export const loginDto = z.object({
  email: z
    .string()
    .email()
    .describe('[Auth Login Step1] Email đăng nhập tài khoản (ví dụ: customer@vnexplorer.vn).'),
  password: z
    .string()
    .min(1)
    .describe('[Auth Login Step1] Mật khẩu tài khoản (không rỗng, tối thiểu 1 ký tự).'),
})

export type LoginDto = z.infer<typeof loginDto>

export const loginStep2Dto = z.object({
  stepToken: z
    .string()
    .min(20)
    .describe(
      '[Auth Login Step2] JWT ngắn hạn (TTL ~10 phút) nhận từ POST /auth/login response khi totpRequired=true. Dạng: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.step2-token...',
    ),
  code: z
    .string()
    .min(6)
    .max(20)
    .describe(
      '[Auth Login Step2] Mã TOTP 6 số (độ dài 6-20 ký tự) từ Google Authenticator / Authy / 1Password / Microsoft Authenticator. Hệ thống chấp nhận drift ±1 (90 giây tolerance).',
    ),
})

export type LoginStep2Dto = z.infer<typeof loginStep2Dto>

export const forgotPasswordCheckDto = z.object({
  email: z
    .string()
    .email()
    .describe('[Forgot Password Step 1 - Check] Email tài khoản cần khôi phục mật khẩu.'),
})

export type ForgotPasswordCheckDto = z.infer<typeof forgotPasswordCheckDto>

export const forgotPasswordResetDto = z.object({
  email: z
    .string()
    .email()
    .describe('[Forgot Password Step 2 - Reset] Email tài khoản khôi phục mật khẩu.'),
  password: z
    .string()
    .min(6)
    .describe('[Forgot Password Step 2 - Reset] Mật khẩu mới (tối thiểu 6 ký tự).'),
})

export type ForgotPasswordResetDto = z.infer<typeof forgotPasswordResetDto>
