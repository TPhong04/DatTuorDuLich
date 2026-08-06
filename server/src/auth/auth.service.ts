import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'

import { UsersService } from '../users/users.service'
import { JwtPayload } from './auth.types'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: { name: string; email: string; password: string }) {
    const existing = await this.usersService.findByEmail(input.email)
    if (existing) {
      throw new ConflictException('Email đã tồn tại')
    }

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.usersService.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'customer',
    })
    return { user }
  }

  async forgotPasswordCheck(email: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) return { ok: false }
    if (user.isActive === false) return { ok: false }
    const last = (user as any).passwordResetAt ? new Date((user as any).passwordResetAt) : null
    if (last) {
      const diffMs = Date.now() - last.getTime()
      if (diffMs < 60_000) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - diffMs) / 1000)) }
      }
    }
    return { ok: true }
  }

  async forgotPasswordReset(input: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(input.email)
    if (!user) return { ok: false }
    if (user.isActive === false) return { ok: false }
    const last = (user as any).passwordResetAt ? new Date((user as any).passwordResetAt) : null
    if (last) {
      const diffMs = Date.now() - last.getTime()
      if (diffMs < 60_000) {
        return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - diffMs) / 1000)) }
      }
    }

    const passwordHash = await bcrypt.hash(input.password, 10)
    await this.usersService.setPasswordHash(user.id, passwordHash)
    await this.usersService.setRefreshTokenHash(user.id, null)
    await this.usersService.setPasswordResetAt(user.id, new Date())
    return { ok: true }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(input.email)
    if (!user) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu')
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('Tài khoản đã bị khóa')
    }

    const ok = await bcrypt.compare(input.password, user.passwordHash)
    if (!ok) {
      throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu')
    }

    const tokens = await this.signTokens({ sub: user.id, email: user.email, role: user.role })
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash)

    return { user, tokens }
  }

  async logout(userId: string) {
    await this.usersService.setRefreshTokenHash(userId, null)
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId)
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ')
    }
    if (user.isActive === false) {
      throw new UnauthorizedException('Tài khoản đã bị khóa')
    }

    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash)
    if (!ok) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ')
    }

    const tokens = await this.signTokens({ sub: user.id, email: user.email, role: user.role })
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash)

    return { user, tokens }
  }

  private async signTokens(payload: JwtPayload) {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET')
    const accessExpiresIn = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN')
    const refreshExpiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: accessExpiresIn as unknown as never,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn as unknown as never,
      }),
    ])

    return { accessToken, refreshToken }
  }
}
