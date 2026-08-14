import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'

function publicBypassUrl(urlPath: string): boolean {
  if (!urlPath) return true
  if (urlPath.startsWith('/api/auth/csrf-token')) return true
  if (urlPath.startsWith('/api/auth/register')) return true
  if (urlPath.startsWith('/api/auth/login')) return true
  if (urlPath.startsWith('/api/auth/2fa/login-step2')) return true
  if (urlPath.startsWith('/api/auth/forgot-password/')) return true
  if (urlPath.startsWith('/api/auth/refresh')) return true
  if (urlPath.startsWith('/api/payments/webhook/')) return true
  if (urlPath.startsWith('/api/public/')) return true
  if (urlPath.startsWith('/api/tours/')) return true
  if (urlPath.startsWith('/api/posts/')) return true
  if (urlPath.startsWith('/api/banners/')) return true
  if (urlPath.startsWith('/api/reviews/public')) return true
  if (urlPath.startsWith('/api/uploads/')) return true
  if (urlPath.startsWith('/api/group-tour-requests')) {
    if (!urlPath.includes('/admin') && !urlPath.includes('/staff')) return true
    return false
  }
  const matchTourBooking = /^\/api\/tours\/[^/]+\/bookings/.test(urlPath)
  if (matchTourBooking) return true
  return false
}

const NO_2FA_MSG_STEP2 = 'Cần nhập mã 2FA (6 số trên Google Authenticator) hoặc mã dự phòng để hoàn tất đăng nhập. Vui lòng gọi POST /api/auth/2fa/login-step2.'

@Injectable()
export class TwoFactorRequiredForPrivilegedRolesGuard implements CanActivate {
  private readonly enforce2FA: boolean

  constructor(
    private readonly reflector: Reflector,
    config: ConfigService,
  ) {
    const disabled = String(config.get<string>('TOTP_DISABLE_ENFORCEMENT') ?? '0')
    this.enforce2FA = disabled === '1' ? false : true
  }

  canActivate(context: ExecutionContext): boolean {
    if (!this.enforce2FA) return true

    const req = context.switchToHttp().getRequest()
    const user: any = req?.user || req?.jwtUser || null
    if (!user || !user.role || user.role === 'customer') return true

    const path = String(req?.originalUrl || req?.url || '') as string
    if (publicBypassUrl(path)) return true

    if (path.startsWith('/api/auth/2fa/') || path.startsWith('/api/auth/me') || path.startsWith('/api/auth/logout')) return true
    if (path.startsWith('/api/users/me') || path.startsWith('/api/notifications/me')) return true

    if (user.role !== 'admin' && user.role !== 'staff') return true

    const totpEnabled = Boolean(user.totpEnabled)
    const tfv = Boolean(user.tfv)
    if (totpEnabled && !tfv) throw new ForbiddenException(NO_2FA_MSG_STEP2)
    return true
  }
}
