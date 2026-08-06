import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error'

type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastApi = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timersRef = useRef<Map<string, number>>(new Map())

  const remove = useCallback((id: string) => {
    const timer = timersRef.current.get(id)
    if (timer) {
      window.clearTimeout(timer)
      timersRef.current.delete(id)
    }
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = createId()
      setToasts((prev) => [...prev, { id, variant, message }])
      const timer = window.setTimeout(() => remove(id), 3500)
      timersRef.current.set(id, timer)
    },
    [remove],
  )

  const api = useMemo<ToastApi>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] w-full -translate-x-1/2 px-4">
        <div className="mx-auto w-fit space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ring-1',
              t.variant === 'success' && 'bg-emerald-600 text-white ring-emerald-600/30',
              t.variant === 'error' && 'bg-orange-600 text-white ring-orange-600/30',
            )}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="leading-snug">{t.message}</div>
              <button
                className="rounded-lg px-2 py-1 text-white/90 hover:bg-white/10"
                onClick={() => remove(t.id)}
                type="button"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
