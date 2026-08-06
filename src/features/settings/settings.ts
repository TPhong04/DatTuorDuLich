import { apiFetch } from '@/lib/api'

export type PublicSettings = {
  company: Record<string, unknown>
  branding: Record<string, unknown>
  home: Record<string, unknown>
  booking: Record<string, unknown>
  payment: Record<string, unknown>
  notifications: Record<string, unknown>
  security: Record<string, unknown>
  integrations: Record<string, unknown>
  masterData: Record<string, unknown>
  updatedAt?: string
}

export const SETTINGS_VERSION_KEY = 'settings_updated_at'

export async function getPublicSettings(opts?: { signal?: AbortSignal }) {
  return apiFetch<PublicSettings>('/settings', undefined, { signal: opts?.signal })
}

