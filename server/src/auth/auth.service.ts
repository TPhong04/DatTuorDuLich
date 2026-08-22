import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'
import * as QRCode from 'qrcode'

import { UserDocument } from '../users/user.schema'
import { UsersService } from '../users/users.service'
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveKey256,
  randomBackupCodes,
  randomBase32,
  totpUri,
  totpVerify,
} from '../security/crypto.helpers'
import { JwtPayload } from './auth.types'

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private encryptionKey(): Buffer {
    const secret = this.config.getOrThrow<string>('CSRF_SECRET')
    return deriveKey256(secret, 'vnexplorer_totp_enc_salt')
  }

  async register(input: { name: string; email: string; password: string; phone?: string | null; gender?: 'male' | 'female' | 'other' | null; dateOfBirth?: string | null; citizenId?: string | null }) {
    const existing = await this.usersService.findByEmail(input.email)
    if (existing) throw new ConflictException('Email đã tồn tại')
    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.usersService.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'customer',
      phone: typeof input.phone === 'string' ? input.phone.trim() || null : (input.phone ?? null),
      gender: input.gender ?? null,
      dateOfBirth: typeof input.dateOfBirth === 'string' ? input.dateOfBirth.trim() || null : (input.dateOfBirth ?? null),
      citizenId: typeof input.citizenId === 'string' ? input.citizenId.trim() || null : (input.citizenId ?? null),
    })
    return { user }
  }

  async forgotPasswordCheck(email: string) {
    const user = await this.usersService.findByEmail(email)
    if (!user) return { ok: false }
    if (user.isActive === false) return { ok: false }
    const last = user.passwordResetAt ? new Date(user.passwordResetAt) : null
    if (last) {
      const diffMs = Date.now() - last.getTime()
      if (diffMs < 60_000) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - diffMs) / 1000)) }
    }
    return { ok: true }
  }

  async forgotPasswordReset(input: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(input.email)
    if (!user) return { ok: false }
    if (user.isActive === false) return { ok: false }
    const last = user.passwordResetAt ? new Date(user.passwordResetAt) : null
    if (last) {
      const diffMs = Date.now() - last.getTime()
      if (diffMs < 60_000) return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((60_000 - diffMs) / 1000)) }
    }
    const passwordHash = await bcrypt.hash(input.password, 10)
    await this.usersService.setPasswordHash(user.id, passwordHash)
    await this.usersService.setRefreshTokenHash(user.id, null)
    await this.usersService.setPasswordResetAt(user.id, new Date())
    return { ok: true }
  }

  async login(input: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(input.email)
    if (!user || user.isActive === false) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu')
    const ok = await bcrypt.compare(input.password, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Sai tài khoản hoặc mật khẩu')
    if (user.totpEnabled) {
      const stepToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role, step: 'totp_step1' } as JwtPayload & { step: string },
        { secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'), expiresIn: '5m' },
      )
      return { user, stepToken, totpRequired: true }
    }
    const tfv = !user.totpEnabled
    const tokens = await this.signTokens(
      { sub: user.id, email: user.email, role: user.role },
      { totpEnabled: false, tfv },
    )
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash)
    return { user, tokens, totpRequired: false }
  }

  async totpLoginStep2(input: { stepToken: string; code: string }) {
    let payload: any = null
    try {
      payload = await this.jwtService.verifyAsync(input.stepToken, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Phiên bước 1 đăng nhập hết hạn, vui lòng đăng nhập lại')
    }
    if (!payload || payload.step !== 'totp_step1') {
      throw new UnauthorizedException('Phiên bước 1 không hợp lệ')
    }
    const user = await this.usersService.findById(String(payload.sub))
    if (!user || !user.totpEnabled) throw new UnauthorizedException('Tài khoản không hợp lệ')

    const decrypted = this.decryptTotpSecret(user)
    if (!decrypted) throw new ForbiddenException('Khóa 2FA không thể đọc')
    const codeClean = input.code.replace(/\s+/g, '').toUpperCase()

    let valid = false
    if (/^[A-F0-9]{6}-[A-F0-9]{6}$/.test(codeClean)) {
      valid = await this.usersService.consumeTotpBackupCode(user.id, codeClean)
      if (!valid) throw new UnauthorizedException('Mã dự phòng 2FA không đúng hoặc đã dùng')
    } else {
      if (!/^\d{6}$/.test(codeClean)) throw new BadRequestException('Mã OTP phải gồm 6 chữ số')
      valid = totpVerify(codeClean, decrypted, { window: 1 })
      if (!valid) throw new UnauthorizedException('Mã OTP 2FA không đúng, kiểm tra lại Google Authenticator')
    }
    const tokens = await this.signTokens(
      { sub: user.id, email: user.email, role: user.role },
      { totpEnabled: !!user.totpEnabled, tfv: true },
    )
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash)
    return { user, tokens }
  }

  async totpSetup(userSub: string) {
    const user = await this.usersService.findById(userSub)
    if (!user) throw new UnauthorizedException('Tài khoản không hợp lệ')
    if (user.totpEnabled && user.totpSecretEncrypted) {
      throw new ConflictException('2FA đã bật. Vui lòng tắt 2FA trước khi cài đặt lại')
    }
    const secretBase32 = randomBase32(20)
    const issuer = this.config.get<string>('TOTP_ISSUER') || 'VietNam Explorer'
    const otpAuth = totpUri(secretBase32, user.email, issuer)
    const qrPng = await QRCode.toDataURL(otpAuth, { margin: 1, width: 260, color: { dark: '#0f172a', light: '#ffffff' } })
    const secretEncrypted = aesGcmEncrypt(secretBase32, this.encryptionKey())
    const backupPlain = randomBackupCodes(6)
    const backupHashed = await Promise.all(backupPlain.map((c) => bcrypt.hash(c.toUpperCase(), 10)))
    await this.usersService.setTotp(user.id, { enabled: false, secretEncrypted, backupCodes: backupHashed })
    return {
      secretBase32,
      otpAuthUrl: otpAuth,
      qrDataUrl: qrPng,
      backupCodesUnmasked: backupPlain,
      issuer,
      email: user.email,
    }
  }

  async totpEnable(userSub: string, code: string) {
    const user = await this.usersService.findById(userSub)
    if (!user) throw new UnauthorizedException('Tài khoản không hợp lệ')
    if (user.totpEnabled) throw new ConflictException('2FA đã bật')
    const secret = this.decryptTotpSecret(user)
    if (!secret) throw new BadRequestException('Chưa chạy bước Setup 2FA (thiếu secret), vui lòng GET /auth/2fa/setup trước')
    const codeClean = String(code || '').replace(/\s+/g, '')
    if (!/^\d{6}$/.test(codeClean)) throw new BadRequestException('Mã OTP phải gồm 6 chữ số')
    const valid = totpVerify(codeClean, secret, { window: 1 })
    if (!valid) throw new BadRequestException('Mã OTP không đúng, kiểm tra lại Google Authenticator')
    await this.usersService.setTotp(user.id, { enabled: true })
    return { ok: true, enabled: true }
  }

  async totpDisable(userSub: string, password: string) {
    const user = await this.usersService.findById(userSub)
    if (!user) throw new UnauthorizedException('Tài khoản không hợp lệ')
    const ok = await bcrypt.compare(password || '', user.passwordHash)
    if (!ok) throw new ForbiddenException('Mật khẩu xác nhận không đúng để tắt 2FA')
    await this.usersService.setTotp(user.id, { enabled: false, secretEncrypted: null, backupCodes: [] })
    return { ok: true, disabled: true }
  }

  private decryptTotpSecret(user: UserDocument): string | null {
    if (!user.totpSecretEncrypted) return null
    return aesGcmDecrypt(user.totpSecretEncrypted, this.encryptionKey())
  }

  async logout(userId: string) {
    await this.usersService.setRefreshTokenHash(userId, null)
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId)
    if (!user || !user.refreshTokenHash || user.isActive === false) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ')
    }
    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash)
    if (!ok) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ')
    const tfv = !user.totpEnabled
    const tokens = await this.signTokens(
      { sub: user.id, email: user.email, role: user.role },
      { totpEnabled: !!user.totpEnabled, tfv },
    )
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, 10)
    await this.usersService.setRefreshTokenHash(user.id, refreshTokenHash)
    return { user, tokens }
  }

  private async signTokens(payload: JwtPayload, opts?: { totpEnabled?: boolean; tfv?: boolean }) {
    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET')
    const accessExpiresIn = this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN')
    const refreshExpiresIn = this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN')

    const extra = { totpEnabled: !!opts?.totpEnabled, tfv: !!opts?.tfv }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...payload, ...extra }, { secret: accessSecret, expiresIn: accessExpiresIn as unknown as never }),
      this.jwtService.signAsync({ ...payload, ...extra }, { secret: refreshSecret, expiresIn: refreshExpiresIn as unknown as never }),
    ])
    return { accessToken, refreshToken }
  }
}
