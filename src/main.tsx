import * as Sentry from '@sentry/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { SettingsProvider } from './features/settings/SettingsProvider'

type ViteEnvLike = Record<string, string | undefined>

function setupSentryReact(): { enabled: boolean } {
  const env = (import.meta.env || {}) as ViteEnvLike
  const dsn = String(env.VITE_SENTRY_DSN_WEB ?? '').trim()
  if (!dsn || /<yourPublicKey>/.test(dsn)) return { enabled: false }
  const tracesSampleRate = Number(env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.2)
  const replaySampleRate = Number(env.VITE_SENTRY_REPLAY_SAMPLE_RATE ?? 0.1)
  const environment = String(env.VITE_SENTRY_ENVIRONMENT ?? env.MODE ?? 'development')
  const release = String(env.VITE_SENTRY_RELEASE ?? 'vnexplorer-web@dev')
  const sensitiveKeyPatterns = [
    /authorization/i,
    /cookie/i,
    /set-cookie/i,
    /xsrf/i,
    /csrf/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
    /password/i,
    /secret/i,
    /card[_-]?number/i,
    /cvv/i,
  ]
  function scrubValue(v: unknown, depth = 0): unknown {
    if (depth > 4) return '[Truncated depth>4]'
    if (v == null) return v
    if (typeof v === 'string') {
      if (v.length > 2000) return `[String length=${v.length} truncated]`
      return v
    }
    if (Array.isArray(v)) return v.map((x) => scrubValue(x, depth + 1))
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const isSensitive = sensitiveKeyPatterns.some((re) => re.test(k))
        if (isSensitive) {
          out[k] = typeof val === 'string' && val.length > 0 ? `[REDACTED len=${val.length}]` : '[REDACTED]'
        } else {
          out[k] = scrubValue(val, depth + 1)
        }
      }
      return out
    }
    return v
  }
  Sentry.init({
    dsn,
    environment,
    release,
    enabled: true,
    tracesSampleRate: Number.isFinite(tracesSampleRate) && tracesSampleRate >= 0 ? Math.min(1, tracesSampleRate) : 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: Number.isFinite(replaySampleRate) && replaySampleRate >= 0 ? Math.min(1, replaySampleRate) : 0,
    maxBreadcrumbs: 60,
    normalizeDepth: 8,
    attachStacktrace: true,
    beforeSend(event, _hint) {
      try {
        if (event.request?.headers) event.request.headers = scrubValue(event.request.headers) as any
        if (event.request?.cookies) event.request.cookies = scrubValue(event.request.cookies) as any
        if (event.request?.data) event.request.data = scrubValue(event.request.data) as any
        if (event.extra) event.extra = scrubValue(event.extra) as any
        if (event.contexts) event.contexts = scrubValue(event.contexts) as any
        if (event.user) {
          const u = { ...event.user }
          if (u.email && typeof u.email === 'string') {
            const [a, b] = u.email.split('@')
            if (a && b) u.email = `${a.slice(0, Math.max(1, Math.floor(a.length / 2)))}***@${b}`
          }
          if ((u as any).ip_address) delete (u as any).ip_address
          event.user = u
        }
      } catch {
        /* ignore scrub */
      }
      return event
    },
    ignoreErrors: [
      /Non-Error exception captured/,
      /ResizeObserver loop limit exceeded/i,
      /ResizeObserver loop completed with undelivered notifications/i,
      /Loading chunk .* failed/i,
      /Network Error/i,
      /Cancel rendering route/i,
      /AbortError/,
      /ChunkLoadError/,
    ],
    denyUrls: [
      /extensions\//i,
      /^chrome:\/\//i,
      /^chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
      /^edge:\/\//i,
    ],
  })
  return { enabled: true }
}

try { setupSentryReact() } catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </StrictMode>,
)
