import { useMemo } from 'react'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type BookingPax = { adult: number; child: number; infant: number }
type BookingDraft = {
  tourSlug: string | null
  departureId: string | null
  pax: BookingPax
  createdAt: number
} & Record<string, unknown>

const STORAGE_KEY = 'vnex_booking_draft_v1'
const HOLD_TTL_MS = 15 * 60 * 1000

type BookingWizardContextValue = {
  draft: BookingDraft
  setTourSlug: (slug: string) => void
  setDepartureId: (id: string) => void
  setPax: (pax: Partial<BookingPax>) => void
  resetDraft: (opts?: { tourSlug?: string | null; departureId?: string | null }) => void
  hasValidDraft: boolean
  totalPax: number
}

const BookingWizardContext = createContext<BookingWizardContextValue | null>(null)

function loadDraftOrFallback(): BookingDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BookingDraft
      if (parsed && typeof parsed === 'object' && typeof parsed.createdAt === 'number') {
        if (Date.now() - Number(parsed.createdAt) <= HOLD_TTL_MS) {
          return parsed
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { tourSlug: null, departureId: null, pax: { adult: 1, child: 0, infant: 0 }, createdAt: Date.now() }
}

export function BookingWizardProvider({ children, initialTourSlug, initialDepartureId }: { children: ReactNode; initialTourSlug?: string | null; initialDepartureId?: string | null }) {
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const base = loadDraftOrFallback()
    const slug = initialTourSlug ?? base.tourSlug
    const depId = initialDepartureId ?? base.departureId
    if (slug !== base.tourSlug || depId !== base.departureId) {
      const next = { ...base, tourSlug: slug ?? null, departureId: depId ?? null, createdAt: Date.now() }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    }
    return base
  })

  useEffect(() => {
    const id = window.setInterval(() => {
      setDraft((prev) => {
        if (Date.now() - Number(prev.createdAt) > HOLD_TTL_MS) {
          const next = { tourSlug: prev.tourSlug, departureId: prev.departureId, pax: { adult: 1, child: 0, infant: 0 }, createdAt: Date.now() }
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
          return next
        }
        return prev
      })
    }, 10_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)) } catch { /* ignore */ } }, [draft])

  const value = useMemo<BookingWizardContextValue>(() => {
    const totalPax = Number(draft.pax?.adult || 0) + Number(draft.pax?.child || 0) + Number(draft.pax?.infant || 0)
    const hasValidDraft = !!draft.tourSlug && !!draft.departureId && totalPax > 0 && totalPax <= 20
    return {
      draft,
      setTourSlug: (slug) => setDraft((d) => ({ ...d, tourSlug: slug, createdAt: Date.now() })),
      setDepartureId: (id) => setDraft((d) => ({ ...d, departureId: id, createdAt: Date.now() })),
      setPax: (p) => setDraft((d) => ({ ...d, pax: { ...d.pax, ...p }, createdAt: Date.now() })),
      resetDraft: (opts) => setDraft(() => {
        const next: BookingDraft = {
          tourSlug: opts?.tourSlug ?? null,
          departureId: opts?.departureId ?? null,
          pax: { adult: 1, child: 0, infant: 0 },
          createdAt: Date.now(),
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      }),
      hasValidDraft,
      totalPax,
    }
  }, [draft])

  return <BookingWizardContext.Provider value={value}>{children}</BookingWizardContext.Provider>
}

export function useBookingWizard() {
  const ctx = useContext(BookingWizardContext)
  if (!ctx) throw new Error('Bạn cần mở trang đặt tour trước khi dùng wizard.')
  return ctx
}

export type { BookingPax, BookingDraft }
