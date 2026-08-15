import * as Sentry from '@sentry/node'
import type { NestExpressApplication } from '@nestjs/platform-express'

export type SentryInitResult = { enabled: boolean; dsn?: string }

export function setupSentryNode(): SentryInitResult {
  const dsn = String(process.env.SENTRY_DSN_API ?? '').trim()
  if (!dsn || /<yourPublicKey>/.test(dsn)) {
    return { enabled: false }
  }
  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.3)
  const environment = String(process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development')
  const release = String(process.env.SENTRY_RELEASE ?? process.env.BUILD_VERSION ?? 'vnexplorer-api@dev')
  try {
    Sentry.init({
      dsn,
      environment,
      release,
      tracesSampleRate: Number.isFinite(tracesSampleRate) && tracesSampleRate >= 0 ? Math.min(1, tracesSampleRate) : 0.1,
      normalizeDepth: 10,
      maxBreadcrumbs: 80,
      ignoreErrors: [
        /Non-Error promise rejection captured/i,
        /Nest can't resolve dependencies of the .*Service/,
        /AbortError/i,
        /TimeoutError/i,
      ],
      beforeSend(event, hint) {
        try {
          const ex = hint?.originalException
          if (ex && typeof ex === 'object' && (ex as any).status === 401) return null
          if (ex && typeof ex === 'object' && (ex as any).status === 403) return null
          if (ex && typeof ex === 'object' && (ex as any).status === 404) return null
          if (ex && typeof ex === 'object' && (ex as any).status === 429) return null
        } catch {
          /* ignore */
        }
        return event
      },
    })
    ;(Sentry as any)._vnexplorer_enabled = true
  } catch (e: any) {
    try { console.error('[monitoring:sentry] init failed:', String(e?.message || e)) } catch {}
    return { enabled: false }
  }
  return { enabled: true, dsn }
}

export function applySentryRequestHandler(_app: NestExpressApplication) {
  /* v8 SDK tự động instrument request context nếu dùng Express integration;
   * chúng ta không dùng legacy Sentry.Handlers nữa vì đã removed ở v8+ */
}

export function applySentryErrorHandler(_app: NestExpressApplication) {
  /* Global Exception Filter tự gọi Sentry.captureException nên không cần middleware handler ở v8 */
}
