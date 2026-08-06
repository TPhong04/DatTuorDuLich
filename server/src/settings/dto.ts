import { z } from 'zod'

const uploadsUrl = z.string().regex(/^\/uploads\/.+$/)
const absoluteUrl = z.string().url()
const urlOrNull = z.union([absoluteUrl, uploadsUrl]).nullable().optional()

export const companySettingsDto = z.object({
  name: z.string().min(1).optional(),
  slogan: z.string().optional(),
  address: z.string().optional(),
  hotline: z.string().optional(),
  email: z.string().email().optional(),
  workingHours: z.string().optional(),
  socials: z
    .object({
      facebook: z.string().url().optional(),
      youtube: z.string().url().optional(),
      tiktok: z.string().url().optional(),
    })
    .partial()
    .optional(),
})

export const brandingSettingsDto = z.object({
  logoHeaderUrl: urlOrNull,
  logoFooterUrl: urlOrNull,
  faviconUrl: urlOrNull,
  topbarText: z.string().optional(),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
})

export const homeSettingsDto = z.object({
  heroTitle: z.string().optional(),
  heroSubtitle: z.string().optional(),
  showQuickSearch: z.boolean().optional(),
  featuredTags: z.array(z.string().min(1)).optional(),
  featuredDestinations: z.array(z.string().min(1)).optional(),
})

export const bookingSettingsDto = z.object({
  defaultStatus: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
  holdMinutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
  cancelPolicyText: z.string().optional(),
})

export const paymentSettingsDto = z.object({
  enableDeposit: z.boolean().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  paymentGuideText: z.string().optional(),
})

export const notificationsSettingsDto = z.object({
  enableInApp: z.boolean().optional(),
  enableEmail: z.boolean().optional(),
  enableSms: z.boolean().optional(),
  enableZalo: z.boolean().optional(),
  templates: z
    .object({
      bookingCreated: z.string().optional(),
      bookingConfirmed: z.string().optional(),
      bookingCancelled: z.string().optional(),
      groupTourQuoteSent: z.string().optional(),
    })
    .partial()
    .optional(),
})

export const securitySettingsDto = z.object({
  loginMaxAttempts: z.number().int().min(1).max(20).optional(),
  loginLockMinutes: z.number().int().min(0).max(60 * 24).optional(),
  auditRetentionDays: z.number().int().min(0).max(3650).optional(),
})

export const integrationsSettingsDto = z.object({
  publicBaseUrl: z.string().url().optional(),
  emailProvider: z.enum(['smtp', 'none']).optional(),
  smsProvider: z.enum(['none', 'twilio', 'other']).optional(),
  zaloProvider: z.enum(['none', 'zalo_oa']).optional(),
})

export const masterDataSettingsDto = z.object({
  destinations: z.array(z.string().min(1)).optional(),
  departureFrom: z.array(z.string().min(1)).optional(),
  transportTypes: z.array(z.string().min(1)).optional(),
  tags: z.array(z.string().min(1)).optional(),
})

export type CompanySettingsDto = z.infer<typeof companySettingsDto>
export type BrandingSettingsDto = z.infer<typeof brandingSettingsDto>
export type HomeSettingsDto = z.infer<typeof homeSettingsDto>
export type BookingSettingsDto = z.infer<typeof bookingSettingsDto>
export type PaymentSettingsDto = z.infer<typeof paymentSettingsDto>
export type NotificationsSettingsDto = z.infer<typeof notificationsSettingsDto>
export type SecuritySettingsDto = z.infer<typeof securitySettingsDto>
export type IntegrationsSettingsDto = z.infer<typeof integrationsSettingsDto>
export type MasterDataSettingsDto = z.infer<typeof masterDataSettingsDto>
