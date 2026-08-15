import type { NestMiddleware } from '@nestjs/common'
import type { Request, Response } from 'express'
import { httpRequestCount, httpRequestDurationMs } from './metrics'
import { sendTelegramDevOnCall } from './telegram-alert.service'

const UUID_V4 = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/
const MONGO_OID = /^[0-9a-fA-F]{24}$/
const NUMERIC = /^\d+$/

export function wildCardifyPath(rawPath: string): string {
  if (!rawPath) return '/'
  const parts = rawPath.split('/').filter(Boolean)
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i]
    if (UUID_V4.test(p)) parts[i] = ':uuid'
    else if (MONGO_OID.test(p)) parts[i] = ':id'
    else if (NUMERIC.test(p)) parts[i] = ':n'
  }
  return '/' + parts.join('/')
}

function bookingThresholdMs(): number {
  const v = Number(process.env.APM_P95_BOOKING_THRESHOLD_MS ?? 200)
  return Number.isFinite(v) && v > 0 ? v : 200
}

export class ApmResponseTimeMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: (error?: any) => void) {
    const start = process.hrtime.bigint()
    const originalSend = res.send.bind(res)
    let sizeBytes = 0
    ;(res as any).send = function patchedSend(this: Response, chunk: any): Response {
      if (typeof chunk === 'string') sizeBytes += Buffer.byteLength(chunk, 'utf8')
      else if (Buffer.isBuffer(chunk)) sizeBytes += chunk.length
      else if (chunk && typeof chunk === 'object') {
        try { sizeBytes += Buffer.byteLength(JSON.stringify(chunk), 'utf8') } catch { /* ignore */ }
      }
      return originalSend.apply(this, arguments as any)
    }
    res.once('finish', () => {
      const end = process.hrtime.bigint()
      const durationMs = Number(end - start) / 1e6
      const method = req.method || 'GET'
      const route = wildCardifyPath(req.baseUrl || req.route?.path || req.path || '/')
      const status = res.statusCode || 0
      const statusFamily = `${String(status).charAt(0)}xx`
      try { httpRequestCount.labels(method, route, String(status)).inc(1) } catch { /* ignore */ }
      try { httpRequestDurationMs.labels(method, route, statusFamily).observe(durationMs) } catch { /* ignore */ }
      if (process.env.NODE_ENV === 'development') {
        const line = JSON.stringify({ t: Date.now(), m: method, r: route, s: status, ms: Math.round(durationMs), b: sizeBytes })
        try { process.stdout.write(line + '\n') } catch { /* ignore */ }
      }
      if (/^\/api\/bookings(\/|$)/.test(route) && method !== 'OPTIONS' && status >= 200 && status < 500) {
        if (durationMs > bookingThresholdMs()) {
          const key = `p95_booking:${method}:${route}`
          const pct = Math.max(1, Math.round(durationMs / bookingThresholdMs() * 100))
          void sendTelegramDevOnCall({
            alertKey: key,
            severity: pct >= 300 ? 'CRITICAL' : 'WARNING',
            title: `API /bookings P95 vượt ngưỡng ${bookingThresholdMs()}ms`,
            body: [
              `route: ${method} ${route}`,
              `duration: ${Math.round(durationMs)}ms (${pct}% ngưỡng)`,
              `status: ${status}`,
              `bytes: ${sizeBytes}`,
              `ua: ${String(req.headers['user-agent'] ?? '').slice(0, 120) || 'n/a'}`,
              `ip: ${String((req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'n/a').slice(0, 64)}`,
            ].join('\n'),
          })
        }
      }
    })
    next()
  }
}
