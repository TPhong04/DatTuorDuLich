import { useMemo } from 'react'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type BookingPax = { adult: number; child: number; infant: number }
type BookingDraftGroup = {
  isGroupTour: boolean
  companyName: string | null
  contactPerson: string | null
  contactRole: string | null
  uploadedListFileUrl: string | null
  note: string | null
}
type BookingDraft = {
  tourSlug: string | null
  departureId: string | null
  pax: BookingPax
  seatsAvailableLimit: number | null
  group: BookingDraftGroup
  createdAt: number
} & Record<string, unknown>

const STORAGE_KEY = 'vnex_booking_draft_v1'
const HOLD_TTL_MS = 15 * 60 * 1000

const DEFAULT_GROUP: BookingDraftGroup = {
  isGroupTour: false,
  companyName: null,
  contactPerson: null,
  contactRole: null,
  uploadedListFileUrl: null,
  note: null,
}

type BookingWizardContextValue = {
  draft: BookingDraft
  setTourSlug: (slug: string) => void
  setDepartureId: (id: string) => void
  setSeatsAvailableLimit: (n: number | null) => void
  setPax: (pax: Partial<BookingPax>) => void
  setGroup: (g: Partial<BookingDraftGroup>) => void
  resetDraft: (opts?: { tourSlug?: string | null; departureId?: string | null }) => void
  hasValidDraft: boolean
  totalPax: number
  remainingPaxCap: number
}

const BookingWizardContext = createContext<BookingWizardContextValue | null>(null)

function loadDraftOrFallback(): BookingDraft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as BookingDraft
      if (parsed && typeof parsed === 'object' && typeof parsed.createdAt === 'number') {
        if (Date.now() - Number(parsed.createdAt) <= HOLD_TTL_MS) {
          if (!parsed.group) parsed.group = { ...DEFAULT_GROUP }
          if (typeof (parsed as any).seatsAvailableLimit === 'undefined') (parsed as any).seatsAvailableLimit = null
          return parsed
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { tourSlug: null, departureId: null, pax: { adult: 1, child: 0, infant: 0 }, seatsAvailableLimit: null, group: { ...DEFAULT_GROUP }, createdAt: Date.now() }
}

export function BookingWizardProvider({ children, initialTourSlug, initialDepartureId }: { children: ReactNode; initialTourSlug?: string | null; initialDepartureId?: string | null }) {
  const [draft, setDraft] = useState<BookingDraft>(() => {
    const base = loadDraftOrFallback()
    const slug = initialTourSlug ?? base.tourSlug
    const depId = initialDepartureId ?? base.departureId
    if (slug !== base.tourSlug || depId !== base.departureId) {
      const next = { ...base, tourSlug: slug ?? null, departureId: depId ?? null, seatsAvailableLimit: null, createdAt: Date.now(), group: { ...DEFAULT_GROUP, ...(base.group || {}) } }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    }
    return base
  })

  useEffect(() => {
    const id = window.setInterval(() => {
      setDraft((prev) => {
        if (Date.now() - Number(prev.createdAt) > HOLD_TTL_MS) {
          const next: BookingDraft = { tourSlug: prev.tourSlug, departureId: prev.departureId, pax: { adult: 1, child: 0, infant: 0 }, seatsAvailableLimit: prev.seatsAvailableLimit ?? null, group: { ...DEFAULT_GROUP }, createdAt: Date.now() }
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
    const baseTotal = Number(draft.pax?.adult || 0) + Number(draft.pax?.child || 0) + Number(draft.pax?.infant || 0)
    const isGroup = Boolean(draft.group?.isGroupTour)
    const maxPax = isGroup ? 500 : 20
    const hardCap = typeof draft.seatsAvailableLimit === 'number'
      ? Math.min(maxPax, Math.max(0, draft.seatsAvailableLimit))
      : maxPax
    const totalPax = Math.min(baseTotal, hardCap)
    const remainingPaxCap = Math.max(0, hardCap - totalPax)
    const hasValidDraft = !!draft.tourSlug && !!draft.departureId && totalPax > 0 && totalPax <= hardCap
    const clampPax = (p: BookingPax): BookingPax => {
      const cap = hardCap
      let a = Math.max(0, Number(p.adult) || 0)
      let c = Math.max(0, Number(p.child) || 0)
      let i = Math.max(0, Number(p.infant) || 0)
      let total = a + c + i
      if (total > cap && cap > 0) {
        const over = total - cap
        if (i >= over) { i -= over }
        else { const rem = over - i; i = 0; if (c >= rem) { c -= rem } else { const rem2 = rem - c; c = 0; a = Math.max(0, a - rem2) } }
      }
      return { adult: a, child: c, infant: i }
    }
    return {
      draft,
      setTourSlug: (slug) => setDraft((d) => ({ ...d, tourSlug: slug, createdAt: Date.now() })),
      setDepartureId: (id) => setDraft((d) => ({ ...d, departureId: id, seatsAvailableLimit: null, createdAt: Date.now() })),
      setSeatsAvailableLimit: (n) => setDraft((d) => {
        const limit = typeof n === 'number' ? Math.max(0, Math.floor(n)) : null
        const nextPax = (() => {
          if (limit === null) return d.pax
          const cap = Math.min(maxPax, Math.max(0, limit))
          const cp = clampPax({ ...d.pax })
          const t = cp.adult + cp.child + cp.infant
          if (t <= cap) return cp
          let a = cp.adult, c = cp.child, i = cp.infant
          let over = t - cap
          if (i >= over) { i -= over } else { const rem = over - i; i = 0; if (c >= rem) { c -= rem } else { const rem2 = rem - c; c = 0; a = Math.max(0, a - rem2) } }
          return { adult: a, child: c, infant: i }
        })()
        return { ...d, seatsAvailableLimit: limit, pax: nextPax, createdAt: Date.now() }
      }),
      setPax: (p) => setDraft((d) => {
        const merged = { ...d.pax, ...p }
        const clamped = clampPax(merged)
        return { ...d, pax: clamped, createdAt: Date.now() }
      }),
      setGroup: (g) => setDraft((d) => ({ ...d, group: { ...d.group, ...g }, createdAt: Date.now() })),
      resetDraft: (opts) => setDraft(() => {
        const next: BookingDraft = {
          tourSlug: opts?.tourSlug ?? null,
          departureId: opts?.departureId ?? null,
          pax: { adult: 1, child: 0, infant: 0 },
          seatsAvailableLimit: null,
          group: { ...DEFAULT_GROUP },
          createdAt: Date.now(),
        }
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        return next
      }),
      hasValidDraft,
      totalPax,
      remainingPaxCap,
    }
  }, [draft])

  return <BookingWizardContext.Provider value={value}>{children}</BookingWizardContext.Provider>
}

export function useBookingWizard() {
  const ctx = useContext(BookingWizardContext)
  if (!ctx) throw new Error('Bạn cần mở trang đặt tour trước khi dùng wizard.')
  return ctx
}

export type { BookingPax, BookingDraft, BookingDraftGroup }
