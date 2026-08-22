import 'reflect-metadata'

import * as Sentry from '@sentry/node'
import { HttpException, HttpStatus } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { getConnectionToken } from '@nestjs/mongoose'
import type { Connection } from 'mongoose'
import cookieParser from 'cookie-parser'
import * as express from 'express'
import { randomUUID } from 'node:crypto'
import { basename, join } from 'node:path'
import { ZodError } from 'zod'

import { AppModule } from './app.module'
import { ensureMongooseIndexes, formatIndexReportForBanner } from './database/index-sync'
import { applySentryErrorHandler, applySentryRequestHandler, setupSentryNode } from './monitoring/sentry.setup'
import { corsOriginCallback, parseCorsOrigins } from './security/cors.helpers'
import { setupOpenApiAndSwagger } from './swagger/swagger.setup'

async function tryKillPortOnWindows(port: number): Promise<{ killed: boolean; pids: number[]; err?: string }> {
  try {
    if (process.platform !== 'win32') return { killed: false, pids: [] }
    const { execSync } = await import('node:child_process')
    const netstatCmd = `netstat -ano 2>$null | findstr ":${port} " | findstr /R /C:"LISTENING" /C:"TIME_WAIT"`
    let output = ''
    try {
      output = execSync(netstatCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 5000 }) || ''
    } catch {
      return { killed: false, pids: [] }
    }
    const pidsSet = new Set<number>()
    const lines = String(output || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    for (const line of lines) {
      const parts = line.split(/\s+/)
      const last = parts[parts.length - 1]
      if (/^\d+$/.test(last)) {
        const pid = parseInt(last, 10)
        if (pid > 0 && pid < 0x7fffffff) pidsSet.add(pid)
      }
    }
    const pids = Array.from(pidsSet)
    if (pids.length === 0) return { killed: false, pids: [] }
    for (const pid of pids) {
      try {
        execSync(`taskkill /F /PID ${pid} /T 2>&1`, { stdio: 'ignore', timeout: 5000 })
      } catch {
        /* ignore per-pid taskkill error */
      }
    }
    let waitMs = 200
    for (let i = 0; i < 8; i += 1) {
      await new Promise((r) => setTimeout(r, waitMs))
      let stillPresent = false
      try {
        const check = execSync(netstatCmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', timeout: 3000 }) || ''
        stillPresent = check.trim().length > 0
      } catch {
        stillPresent = false
      }
      if (!stillPresent) break
      waitMs = Math.min(800, waitMs * 2)
    }
    return { killed: true, pids }
  } catch (e: any) {
    return { killed: false, pids: [], err: String(e?.message || e) }
  }
}

async function listenWithFallback(app: { listen(port: number): Promise<any> }, startPort: number, maxAttempts = 10, allowPortBump = true): Promise<{ port: number; bumpedFrom: number | null; killedZombiePids: number[] }> {
  let killedZombiePids: number[] = []
  let bumpedFrom: number | null = null
  for (let attempt = 0; attempt < Math.max(1, maxAttempts); attempt += 1) {
    const port = startPort + (allowPortBump ? attempt : 0)
    try {
      await app.listen(port)
      return { port, bumpedFrom, killedZombiePids }
    } catch (err: any) {
      const msg = String(err?.message || err || '')
      if (!/EADDRINUSE/.test(msg)) throw err
      if (attempt === 0) {
        const res = await tryKillPortOnWindows(startPort)
        if (res.killed && res.pids.length) killedZombiePids = res.pids
        try {
          await app.listen(startPort)
          return { port: startPort, bumpedFrom: null, killedZombiePids }
        } catch (err2: any) {
          const msg2 = String(err2?.message || err2 || '')
          if (!/EADDRINUSE/.test(msg2)) throw err2
        }
        bumpedFrom = startPort
      }
      if (!allowPortBump) throw err
    }
  }
  throw new Error(`Port ${startPort}-${startPort + maxAttempts - 1} all in use, cannot start Nest server.`)
}

async function bootstrap() {
  const sentryResult = setupSentryNode()
  ;(globalThis as any).__VNEXPLORER_STARTED_AT = Date.now()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true })
  app.use(cookieParser())
  app.use((req: any, _res: any, next: any) => {
    req.id = String(req.headers['x-request-id'] ?? randomUUID())
    const start = process.hrtime.bigint()
    req._startedAtNano = start
    next()
  })
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')))
  app.use('/pdfs', express.static(join(process.cwd(), 'pdfs'), {
    maxAge: '31536000',
    setHeaders(res, filePath) {
      if (filePath.endsWith('.pdf')) {
        res.setHeader('Content-Disposition', `attachment; filename="${basename(filePath)}"`)
      }
    },
  }))
  applySentryRequestHandler(app)

  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGINS)
  app.enableCors({
    origin: corsOriginCallback(allowedOrigins),
    credentials: true,
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Accept',
      'Content-Type',
      'Authorization',
      'X-XSRF-TOKEN',
      'X-Requested-With',
      'Origin',
      'X-File-Name',
      'X-File-Size',
      'X-Request-ID',
    ],
    exposedHeaders: ['Content-Disposition', 'X-Total-Count', 'X-Page', 'X-Request-ID'],
    maxAge: 86400,
  })

  app.setGlobalPrefix('api')

  const swaggerInfo = setupOpenApiAndSwagger(app)

  app.useGlobalFilters({
    catch(err: any, host: any) {
      const ctx = host.switchToHttp()
      const res = ctx.getResponse()
      const req = ctx.getRequest()
      let status = HttpStatus.INTERNAL_SERVER_ERROR
      let message = 'Internal server error'
      let details: unknown = null
      if (err instanceof HttpException) {
        status = err.getStatus()
        const r: any = err.getResponse()
        if (typeof r === 'string') message = r
        else if (r && typeof r.message === 'string') message = r.message
        else if (r && Array.isArray(r.message)) message = r.message.filter((x: any) => typeof x === 'string').join(' · ') || String(r.error || 'Bad Request')
        else if (r && r.error) message = String(r.error)
        details = typeof r === 'object' && r ? r : null
      } else if (err instanceof ZodError) {
        status = HttpStatus.BAD_REQUEST
        const first = err.issues[0]
        message = first ? `${first.path.join('.') || 'Dữ liệu'}: ${first.message}` : 'Dữ liệu không hợp lệ'
        details = err.issues
      } else if (err && typeof err === 'object' && (err.status || err.statusCode)) {
        status = Number(err.status || err.statusCode || 500)
        if (typeof err.message === 'string') message = err.message
      } else if (typeof err?.message === 'string') {
        message = /EADDRINUSE|ECONNREFUSED|ECONNRESET/.test(err.message) ? 'Hệ thống đang bận, vui lòng thử lại sau.' : 'Internal server error'
      }
      const is5xx = status >= 500
      const captureExceptionEnabled = Sentry.isInitialized() && (is5xx || (status === 400 && !(err instanceof ZodError)))
      if (captureExceptionEnabled) {
        try {
          Sentry.withScope((scope) => {
            scope.setContext('request', {
              request_id: req?.id ?? null,
              method: req?.method ?? null,
              url: req?.url ?? null,
              route_path: req?.route?.path ?? null,
              ip: req?.ip ?? (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? null,
              user_agent: String(req?.headers?.['user-agent'] ?? '').slice(0, 200) || null,
            })
            if (req?.user && typeof req.user === 'object') {
              const u = req.user as { sub?: unknown; id?: unknown; email?: unknown; role?: unknown }
              scope.setUser({
                id: String(u.sub ?? u.id ?? ''),
                email: typeof u.email === 'string' ? u.email : undefined,
                role: typeof u.role === 'string' ? u.role : undefined,
              })
            }
            scope.setTag('http_status', String(status))
            scope.setTag('http_method', String(req?.method || 'UNKNOWN'))
            scope.setTag('is_http_exception', String(err instanceof HttpException))
            if (req?._startedAtNano) {
              const durNano = Number(process.hrtime.bigint() - req._startedAtNano) / 1e6
              scope.setExtra('http_request_duration_ms', Math.round(durNano))
            }
            Sentry.captureException(err instanceof Error ? err : new Error(String(err?.message || err || 'UnknownException')), {
              level: is5xx ? 'error' : 'warning',
            })
          })
        } catch {
          /* ignore sentry capture error */
        }
      }
      const payload: any = { statusCode: status, message, details, path: req?.url ?? null, requestId: req?.id ?? null }
      try { if (res.setHeader && req?.id) res.setHeader('X-Request-ID', req.id) } catch {}
      try { res.status(status).type('application/json').send(payload) } catch (_) { try { res.end(JSON.stringify(payload)) } catch {} }
    },
  })

  applySentryErrorHandler(app)

  const startPort = Number(process.env.PORT ?? 4000)
  const allowPortBump = String(process.env.SERVER_ALLOW_PORT_BUMP ?? '1') !== '0'
  const { port, bumpedFrom, killedZombiePids } = await listenWithFallback(app, startPort, 10, allowPortBump)
  const url = await app.getUrl()
  let indexReport: string[] = []
  try {
    const conn = app.get<Connection>(getConnectionToken())
    if (conn) {
      const r = await ensureMongooseIndexes(conn)
      indexReport = formatIndexReportForBanner(r)
    }
  } catch (e: any) {
    indexReport = [`🗂️  Mongo indexes sync skipped: ${String(e?.message || e).slice(0, 120)}`]
  }
  const banner: string[] = []
  banner.push(`🚀 VietNam Explorer Server ready on: ${url}`)
  banner.push(`   API prefix: /api`)
  banner.push(`   Health: /health  |  Live: /health/live  |  Ready: /health/ready  |  Prometheus metrics: /metrics`)
  for (const l of indexReport) banner.push(l)
  if (sentryResult.enabled) banner.push(`🛰️  Sentry Node APM: enabled (env=${process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'dev'})`)
  else banner.push(`🛰️  Sentry Node APM: disabled (SENTRY_DSN_API empty - set .env to enable)`)
  if (swaggerInfo && (swaggerInfo as any).enabled) {
    const paths = (swaggerInfo as any).paths ?? ['/api/swagger-ui', '/api/reference']
    banner.push(`📖  Swagger UI:       ${url}/api/swagger-ui`)
    banner.push(`📖  Scalar Reference: ${url}${paths[1] ?? '/api/reference'}`)
  } else {
    banner.push(`📖  Swagger UI:       disabled (set SWAGGER_ENABLED=1 to enable OpenAPI 3.1 docs)`)
  }
  if (killedZombiePids.length > 0) {
    banner.push(`🧹 Auto cleaned zombie processes on port ${bumpedFrom ?? startPort}: PID ${killedZombiePids.join(', ')}`)
  }
  if (bumpedFrom !== null && bumpedFrom !== port) {
    banner.push(`⚠️  Port ${bumpedFrom} was busy → Binded to fallback port ${port}. Please update frontend VITE_API_BASE_URL to http://localhost:${port}/api`)
  }
  try { console.log('\n' + banner.join('\n') + '\n') } catch {}
}

bootstrap()
