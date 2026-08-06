import { apiFetch } from '@/lib/api'

export type PublicBannerTargetType = 'none' | 'internal' | 'external'

export type PublicBanner = {
  id: string
  title: string | null
  imageUrl: string
  targetType: PublicBannerTargetType
  targetValue: string | null
  openInNewTab: boolean
  order: number
  startAt: string | null
  endAt: string | null
  updatedAt: string | null
}

export async function getPublicBanners() {
  return apiFetch<{ items: PublicBanner[] }>('/banners')
}

