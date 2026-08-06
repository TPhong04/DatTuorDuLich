import { z } from 'zod'

export const registerDto = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
})

export type RegisterDto = z.infer<typeof registerDto>

export const loginDto = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type LoginDto = z.infer<typeof loginDto>

export const forgotPasswordCheckDto = z.object({
  email: z.string().email(),
})

export type ForgotPasswordCheckDto = z.infer<typeof forgotPasswordCheckDto>

export const forgotPasswordResetDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export type ForgotPasswordResetDto = z.infer<typeof forgotPasswordResetDto>
