import { Controller, Get, Header, Res, Req, HttpStatus, HttpException, Injectable, Module } from '@nestjs/common'
import { InjectConnection } from '@nestjs/mongoose'
import type { Request, Response } from 'express'
import { Connection } from 'mongoose'
import { getMetricsContentType } from './metrics'

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly conn: Connection) {}

  async check() {
    const startedAt = (globalThis as any).__VNEXPLORER_STARTED_AT
      ? (globalThis as any).__VNEXPLORER_STARTED_AT as number
      : ((globalThis as any).__VNEXPLORER_STARTED_AT = Date.now())
    const uptimeSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    const checks: Array<{ name: string; status: 'ok' | 'degraded' | 'down'; detail?: unknown }> = []
    let mongoStatus: 'ok' | 'degraded' | 'down' = 'degraded'
    try {
      const state = this.conn.readyState
      if (state === 1) mongoStatus = 'ok'
      else if (state === 2) mongoStatus = 'degraded'
      else mongoStatus = 'down'
      checks.push({ name: 'mongodb', status: mongoStatus, detail: { readyState: state, host: this.conn.host ?? null, name: this.conn.name ?? null } })
    } catch (e: any) {
      checks.push({ name: 'mongodb', status: 'down', detail: String(e?.message || e).slice(0, 200) })
    }
    const memoryMb = Math.round(process.memoryUsage().heapUsed / 1048576)
    checks.push({ name: 'heap_memory_mb', status: memoryMb > 1400 ? 'degraded' : 'ok', detail: { memory_mb: memoryMb } })
    const overall = checks.every((c) => c.status === 'ok') ? 'ok' : checks.every((c) => c.status === 'down') ? 'down' : 'degraded'
    return {
      status: overall,
      version: String(process.env.SENTRY_RELEASE ?? process.env.BUILD_VERSION ?? 'dev'),
      env: process.env.NODE_ENV ?? 'development',
      startedAt,
      uptimeSeconds,
      heapUsedMb: memoryMb,
      checks,
    }
  }
}

@Controller()
export class HealthController {
  constructor(private readonly svc: HealthService) {}

  @Get('/health')
  async healthSimple(@Res() res: Response) {
    const r = await this.svc.check()
    const status = r.status === 'ok' ? 200 : r.status === 'degraded' ? 299 : 503
    return res.status(status).json(r)
  }

  @Get('/health/live')
  @Header('Cache-Control', 'no-store')
  liveCheck() {
    return { ok: true, t: Date.now(), uptime: process.uptime() }
  }

  @Get('/health/ready')
  async readyCheck(@Res() res: Response) {
    const r = await this.svc.check()
    const ok = r.checks.some((c) => c.name === 'mongodb' && c.status === 'ok')
    return res.status(ok ? 200 : 503).json({ ready: ok, ...r })
  }

  @Get('/metrics')
  @Header('Cache-Control', 'no-store')
  async metricsEndpoint(@Req() req: Request, @Res() res: Response) {
    const enabled = String(process.env.ENABLE_METRICS_ENDPOINT ?? '1') !== '0'
    if (!enabled) throw new HttpException('Metrics disabled', HttpStatus.NOT_FOUND)
    const user = String(process.env.METRICS_BASIC_AUTH_USER ?? '').trim()
    const pass = String(process.env.METRICS_BASIC_AUTH_PASS ?? '').trim()
    if (user && pass) {
      const auth = String(req.headers.authorization ?? '').trim()
      if (!auth.startsWith('Basic ')) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Prometheus scrape"')
        throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED)
      }
      try {
        const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8')
        const [u, p] = decoded.split(':')
        if (u !== user || p !== pass) {
          res.setHeader('WWW-Authenticate', 'Basic realm="Prometheus scrape"')
          throw new HttpException('Forbidden', HttpStatus.FORBIDDEN)
        }
      } catch {
        res.setHeader('WWW-Authenticate', 'Basic realm="Prometheus scrape"')
        throw new HttpException('Bad credentials', HttpStatus.UNAUTHORIZED)
      }
    }
    const { contentType, body } = await getMetricsContentType()
    res.setHeader('Content-Type', contentType)
    return res.status(200).send(body)
  }
}

@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class MonitoringModule {}
