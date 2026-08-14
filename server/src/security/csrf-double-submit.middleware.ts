import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NextFunction, Request, Response } from 'express'

const CSRF_STATE_MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])
const CSRF_SKIP_PATH_PREFIXES = [
  '/api/payments/webhook/',
  '/api/public/payments/',
]

@Injectable()
export class CsrfDoubleSubmitMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    if (!CSRF_STATE_MUTATING_METHODS.has(req.method)) return next()
    const path = req.baseUrl + (req.url || '')
    if (CSRF_SKIP_PATH_PREFIXES.some((p) => path.startsWith(p))) return next()

    const cookieToken = (req.cookies?.XSRF_TOKEN as string | undefined) || null
    const headerToken = (req.headers['x-xsrf-token'] as string | undefined) || null

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token bị thiếu (cần cả cookie + header X-XSRF-TOKEN)')
    }
    if (cookieToken.length < 16 || headerToken.length < 16) {
      throw new ForbiddenException('CSRF token không hợp lệ (quá ngắn)')
    }
    if (cookieToken.length !== headerToken.length) {
      throw new ForbiddenException('CSRF token không khớp')
    }
    let diff = 0
    for (let i = 0; i < cookieToken.length; i += 1) {
      diff |= (cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i))
    }
    if (diff !== 0) {
      throw new ForbiddenException('CSRF token không khớp, vui lòng refresh trang và thử lại.')
    }
    next()
  }
}
