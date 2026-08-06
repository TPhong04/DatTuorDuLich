import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { SETTINGS_VERSION_KEY, getPublicSettings, PublicSettings } from './settings'

type SettingsApi = {
  settings: PublicSettings | null
  loading: boolean
  reload: () => Promise<void>
}

const SettingsContext = createContext<SettingsApi | null>(null)

function setFavicon(url: string | null) {
  const head = document.querySelector('head')
  if (!head) return
  const icon = head.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (icon && url) {
    icon.href = url
    return
  }
  if (!icon && url) {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.href = url
    head.appendChild(link)
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const lastUpdatedAtRef = useRef<string | null>(null)

  const applySideEffects = useCallback((next: PublicSettings) => {
    const faviconUrl = typeof next.branding?.faviconUrl === 'string' ? (next.branding as any).faviconUrl : null
    if (faviconUrl) setFavicon(faviconUrl)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await getPublicSettings()
      setSettings(next)
      if (next.updatedAt) {
        lastUpdatedAtRef.current = next.updatedAt
        localStorage.setItem(SETTINGS_VERSION_KEY, next.updatedAt)
      }
      applySideEffects(next)
    } finally {
      setLoading(false)
    }
  }, [applySideEffects])

  useEffect(() => {
    reload().catch(() => null)
  }, [reload])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== SETTINGS_VERSION_KEY) return
      const next = e.newValue
      if (!next) return
      if (lastUpdatedAtRef.current && lastUpdatedAtRef.current === next) return
      reload().catch(() => null)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [reload])

  useEffect(() => {
    const onSettingsChanged = (e: Event) => {
      const updatedAt =
        e instanceof CustomEvent && (e.detail as any)?.updatedAt ? String((e.detail as any).updatedAt) : localStorage.getItem(SETTINGS_VERSION_KEY)
      if (updatedAt && lastUpdatedAtRef.current && updatedAt === lastUpdatedAtRef.current) return
      reload().catch(() => null)
    }
    window.addEventListener('settings-changed', onSettingsChanged)
    return () => window.removeEventListener('settings-changed', onSettingsChanged)
  }, [reload])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const v = localStorage.getItem(SETTINGS_VERSION_KEY)
      if (v && lastUpdatedAtRef.current && v === lastUpdatedAtRef.current) return
      reload().catch(() => null)
    }, 30000)
    return () => window.clearInterval(interval)
  }, [reload])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload().catch(() => null)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload])

  const api = useMemo<SettingsApi>(() => ({ settings, loading, reload }), [loading, reload, settings])

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>
}

export function usePublicSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('usePublicSettings must be used within SettingsProvider')
  return ctx
}
