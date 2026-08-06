import 'reflect-metadata'

import { HttpException, HttpStatus } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import cookieParser from 'cookie-parser'
import * as express from 'express'
import { join } from 'node:path'
import { ZodError } from 'zod'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true })
  app.use(cookieParser())
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')))

  app.enableCors({
    origin: true,
    credentials: true,
  })

  app.setGlobalPrefix('api')

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
      const payload: any = { statusCode: status, message, details, path: req?.url ?? null }
      try { res.status(status).type('application/json').send(payload) } catch (_) { try { res.end(JSON.stringify(payload)) } catch {} }
    },
  })

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port)
}

bootstrap()

