import { BadRequestException, Body, Controller, Get, HttpCode, Post, Res, UseGuards } from '@nestjs/common'
import { Response } from 'express'
import { ZodError } from 'zod'

import { UsersService } from '../users/users.service'
import { CurrentUser } from './decorators/current-user.decorator'
import { REFRESH_TOKEN_COOKIE } from './auth.constants'
import { AuthService } from './auth.service'
import { JwtPayload } from './auth.types'
import { AccessTokenGuard } from './guards/access-token.guard'
import { RefreshTokenGuard } from './guards/refresh-token.guard'
import { forgotPasswordCheckDto, forgotPasswordResetDto, loginDto, registerDto } from './dto'

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  async register(@Body() body: unknown) {
    const dto = this.parseBody(registerDto, body)
    await this.authService.register(dto)
    return { ok: true }
  }

  @Post('login')
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const dto = this.parseBody(loginDto, body)
    const result = await this.authService.login(dto)
    this.setRefreshCookie(res, result.tokens.refreshToken)

    return {
      accessToken: result.tokens.accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        gender: result.user.gender,
        avatarUrl: result.user.avatarUrl,
        dateOfBirth: (result.user as any).dateOfBirth ?? null,
        address: (result.user as any).address ?? null,
        emergencyContact: (result.user as any).emergencyContact ?? null,
        citizenId: (result.user as any).citizenId ?? null,
        passportNumber: (result.user as any).passportNumber ?? null,
        dietary: (result.user as any).dietary ?? null,
        medicalNotes: (result.user as any).medicalNotes ?? null,
        role: result.user.role,
      },
    }
  }

  @Post('forgot-password/check')
  @HttpCode(200)
  async forgotPasswordCheck(@Body() body: unknown) {
    const dto = this.parseBody(forgotPasswordCheckDto, body)
    const result = await this.authService.forgotPasswordCheck(dto.email)
    if (!result.ok) {
      const retry = (result as any).retryAfterSeconds
      if (typeof retry === 'number' && retry > 0) {
        throw new BadRequestException(`Bạn vừa reset gần đây. Vui lòng thử lại sau ${retry}s.`)
      }
      throw new BadRequestException('Sai email hoặc tài khoản không hoạt động')
    }
    return { ok: true }
  }

  @Post('forgot-password/reset')
  @HttpCode(200)
  async forgotPasswordReset(@Body() body: unknown) {
    const dto = this.parseBody(forgotPasswordResetDto, body)
    const result = await this.authService.forgotPasswordReset(dto)
    if (!result.ok) {
      const retry = (result as any).retryAfterSeconds
      if (typeof retry === 'number' && retry > 0) {
        throw new BadRequestException(`Bạn vừa reset gần đây. Vui lòng thử lại sau ${retry}s.`)
      }
      throw new BadRequestException('Sai email hoặc tài khoản không hoạt động')
    }
    return { ok: true }
  }

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.usersService.findById(user.sub)
    if (!dbUser) return null
    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      gender: dbUser.gender,
      avatarUrl: dbUser.avatarUrl,
      dateOfBirth: (dbUser as any).dateOfBirth ?? null,
      address: (dbUser as any).address ?? null,
      emergencyContact: (dbUser as any).emergencyContact ?? null,
      citizenId: (dbUser as any).citizenId ?? null,
      passportNumber: (dbUser as any).passportNumber ?? null,
      dietary: (dbUser as any).dietary ?? null,
      medicalNotes: (dbUser as any).medicalNotes ?? null,
      role: dbUser.role,
    }
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@CurrentUser() user: JwtPayload & { refreshToken: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refresh(user.sub, user.refreshToken)
    this.setRefreshCookie(res, result.tokens.refreshToken)

    return {
      accessToken: result.tokens.accessToken,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        gender: result.user.gender,
        avatarUrl: result.user.avatarUrl,
        dateOfBirth: (result.user as any).dateOfBirth ?? null,
        address: (result.user as any).address ?? null,
        emergencyContact: (result.user as any).emergencyContact ?? null,
        citizenId: (result.user as any).citizenId ?? null,
        passportNumber: (result.user as any).passportNumber ?? null,
        dietary: (result.user as any).dietary ?? null,
        medicalNotes: (result.user as any).medicalNotes ?? null,
        role: result.user.role,
      },
    }
  }

  @UseGuards(AccessTokenGuard)
  @Post('logout')
  async logout(@CurrentUser() user: JwtPayload, @Res({ passthrough: true }) res: Response) {
    await this.authService.logout(user.sub)
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/auth/refresh' })
    return { ok: true }
  }

  private parseBody<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException('Dữ liệu không hợp lệ')
      }
      throw e
    }
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/auth/refresh',
    })
  }
}
