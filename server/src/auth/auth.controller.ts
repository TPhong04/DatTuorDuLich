import { BadRequestException, Body, Controller, Get, HttpCode, Post, Res, UseGuards, Headers } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { Response } from 'express'
import { ZodError } from 'zod'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBody,
  ApiBearerAuth,
} from '@nestjs/swagger'

import { UsersService } from '../users/users.service'
import { CurrentUser } from './decorators/current-user.decorator'
import { REFRESH_TOKEN_COOKIE, XSRF_COOKIE } from './auth.constants'
import { AuthService } from './auth.service'
import { JwtPayload } from './auth.types'
import { AccessTokenGuard } from './guards/access-token.guard'
import { RefreshTokenGuard } from './guards/refresh-token.guard'
import { forgotPasswordCheckDto, forgotPasswordResetDto, loginDto, loginStep2Dto, registerDto } from './dto'

const XSRF_TTL_MS = 2 * 60 * 60 * 1000

@ApiTags('Auth')
@ApiSecurity('xsrfToken')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get('csrf-token')
  async issueCsrfToken(@Res({ passthrough: true }) res: Response) {
    const token = randomBytes(32).toString('hex')
    res.cookie(XSRF_COOKIE, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: String(process.env.NODE_ENV) === 'production',
      path: '/',
      maxAge: XSRF_TTL_MS,
    })
    return { ok: true, xsrfToken: token, expiresInMs: XSRF_TTL_MS }
  }

  @Post('register')
  async register(@Body() body: unknown) {
    const dto = this.parseBody(registerDto, body)
    await this.authService.register(dto)
    return { ok: true }
  }

  @Post('login')
  @ApiOperation({
    summary: 'Đăng nhập bước 1 (email + password)',
    description:
      'QA: Endpoint xác thực bước 1. Nhập email/password. Nếu user bật 2FA TOTP → trả totpRequired=true + stepToken để gọi bước 2. Nếu không bật 2FA → trả luôn accessToken + set refresh cookie. Rate limit: 5 lần/phút. Cần X-XSRF-TOKEN header (CSRF double submit).',
  })
  @ApiBody({
    description: 'Payload đăng nhập email + mật khẩu',
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: {
          type: 'string',
          format: 'email',
          example: 'customer@vnexplorer.vn',
          description: 'Email đăng ký tài khoản',
        },
        password: {
          type: 'string',
          minLength: 6,
          example: 'Demo@123456',
          description: 'Mật khẩu tài khoản (min 6 ký tự)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      '200 OK: 2 trường hợp — (A) totpRequired=true: cần gọi POST /auth/2fa/login-step2 với stepToken + mã TOTP. (B) totpRequired=false: trả accessToken + user info đã đăng nhập.',
    schema: {
      oneOf: [
        {
          type: 'object',
          description: 'Trường hợp 2FA TOTP đang bật → cần bước 2',
          properties: {
            totpRequired: { type: 'boolean', enum: [true], example: true },
            stepToken: {
              type: 'string',
              example:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.step2-token-placeholder-xxxxxxxxxxxxxxxx',
              description: 'JWT ngắn hạn dùng cho bước 2 (TTL ~10 phút)',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '67f2a8b3c4d5e6f7a8b9c0d1' },
                email: { type: 'string', example: 'customer@vnexplorer.vn' },
                role: { type: 'string', enum: ['customer', 'staff', 'admin'], example: 'customer' },
                name: { type: 'string', example: 'Nguyễn Văn A' },
                totpEnabled: { type: 'boolean', example: true },
              },
            },
          },
          required: ['totpRequired', 'stepToken', 'user'],
        },
        {
          type: 'object',
          description: 'Trường hợp không bật 2FA → đăng nhập thành công ngay',
          properties: {
            totpRequired: { type: 'boolean', enum: [false], example: false },
            accessToken: {
              type: 'string',
              example:
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token-placeholder-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
              description: 'JWT access token dùng cho @ApiBearerAuth bearerJwt',
            },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string', example: '67f2a8b3c4d5e6f7a8b9c0d1' },
                name: { type: 'string', example: 'Nguyễn Văn A' },
                email: { type: 'string', example: 'customer@vnexplorer.vn' },
                phone: { type: 'string', nullable: true, example: '0901234567' },
                gender: { type: 'string', nullable: true, enum: ['male', 'female', 'other'] },
                avatarUrl: { type: 'string', nullable: true, example: '/uploads/avatars/xxx.jpg' },
                dateOfBirth: { type: 'string', nullable: true, format: 'date-time' },
                address: { type: 'string', nullable: true },
                emergencyContact: { type: 'string', nullable: true },
                citizenId: { type: 'string', nullable: true },
                passportNumber: { type: 'string', nullable: true },
                dietary: { type: 'string', nullable: true },
                medicalNotes: { type: 'string', nullable: true },
                role: { type: 'string', enum: ['customer', 'staff', 'admin'], example: 'customer' },
                totpEnabled: { type: 'boolean', example: false },
              },
            },
          },
          required: ['totpRequired', 'accessToken', 'user'],
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation dữ liệu không hợp lệ (email sai format, password rỗng, v.v.)',
  })
  @ApiResponse({
    status: 401,
    description: '401 Unauthorized: Sai email / mật khẩu HOẶC tài khoản bị khóa / chưa xác minh email.',
  })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests: vượt giới hạn 5 lần đăng nhập / phút (throttler login).',
  })
  async login(@Body() body: unknown, @Res({ passthrough: true }) res: Response, @Headers('x-xsrf-token') _xsrf: string | undefined) {
    const dto = this.parseBody(loginDto, body)
    const result = await this.authService.login(dto)
    if (result.totpRequired) {
      return {
        totpRequired: true,
        stepToken: (result as any).stepToken,
        user: {
          id: String((result.user._id as any)?.toString() ?? result.user.id),
          email: result.user.email,
          role: result.user.role,
          name: result.user.name,
          totpEnabled: true,
        },
      }
    }
    this.setRefreshCookie(res, (result as any).tokens.refreshToken)
    return {
      totpRequired: false,
      accessToken: (result as any).tokens.accessToken,
      user: {
        id: String((result.user._id as any)?.toString() ?? result.user.id),
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
        totpEnabled: !!result.user.totpEnabled,
      },
    }
  }

  @Post('2fa/login-step2')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Đăng nhập bước 2 - Xác minh TOTP 6 số',
    description:
      'QA: Sau khi bước 1 trả totpRequired=true → lấy stepToken + nhập mã 6 số từ Google Authenticator (TOTP). Trả accessToken + set refresh cookie HttpOnly. Rate limit: 6 lần/phút. Cần X-XSRF-TOKEN header.',
  })
  @ApiBody({
    description: 'Payload xác minh bước 2 TOTP',
    schema: {
      type: 'object',
      required: ['stepToken', 'code'],
      properties: {
        stepToken: {
          type: 'string',
          minLength: 20,
          example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.step2-token-placeholder-xxxxxxxxxxxxxxxx',
          description: 'stepToken nhận từ endpoint /auth/login (bước 1) khi totpRequired=true',
        },
        code: {
          type: 'string',
          minLength: 6,
          maxLength: 20,
          example: '123456',
          description: 'Mã TOTP 6 số từ Google Authenticator / Authy (hiệu lực ~30 giây)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '200 OK: Xác minh TOTP thành công. Trả accessToken + thông tin user + set refresh cookie HttpOnly path=/api/auth/refresh.',
    schema: {
      type: 'object',
      properties: {
        totpRequired: { type: 'boolean', enum: [false], example: false },
        accessToken: {
          type: 'string',
          example:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access-token-after-2fa-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '67f2a8b3c4d5e6f7a8b9c0d1' },
            name: { type: 'string', example: 'Nguyễn Văn A' },
            email: { type: 'string', example: 'customer@vnexplorer.vn' },
            phone: { type: 'string', nullable: true, example: '0901234567' },
            gender: { type: 'string', nullable: true, enum: ['male', 'female', 'other'] },
            avatarUrl: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['customer', 'staff', 'admin'], example: 'customer' },
            totpEnabled: { type: 'boolean', example: true },
          },
        },
      },
      required: ['totpRequired', 'accessToken', 'user'],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Validation không hợp lệ: stepToken <20 ký tự, code <6 hoặc >20 ký tự HOẶC stepToken đã hết hạn / sai format JWT.',
  })
  @ApiResponse({
    status: 401,
    description: '401 Unauthorized: Sai mã TOTP (drift ±1 chấp nhận) HOẶC stepToken không khớp user / đã dùng.',
  })
  @ApiResponse({ status: 429, description: 'Too Many Requests: vượt 6 lần / phút.' })
  async totpLoginStep2(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const dto = this.parseBody(loginStep2Dto, body)
    const result = await this.authService.totpLoginStep2(dto)
    this.setRefreshCookie(res, result.tokens.refreshToken)
    return {
      totpRequired: false as const,
      accessToken: result.tokens.accessToken,
      user: {
        id: String((result.user._id as any)?.toString() ?? result.user.id),
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        gender: result.user.gender,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
        totpEnabled: !!result.user.totpEnabled,
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

  @ApiBearerAuth('bearerJwt')
  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.usersService.findById(user.sub)
    if (!dbUser) return null
    return {
      id: String((dbUser._id as any)?.toString() ?? dbUser.id),
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
      totpEnabled: !!dbUser.totpEnabled,
    }
  }

  @UseGuards(AccessTokenGuard)
  @Post('2fa/setup')
  @HttpCode(200)
  async totpSetup(@CurrentUser() user: JwtPayload) {
    return this.authService.totpSetup(user.sub)
  }

  @UseGuards(AccessTokenGuard)
  @Post('2fa/enable')
  @HttpCode(200)
  async totpEnable(@CurrentUser() user: JwtPayload, @Body() body: any) {
    const code = String(body?.code ?? '')
    return this.authService.totpEnable(user.sub, code)
  }

  @UseGuards(AccessTokenGuard)
  @Post('2fa/disable')
  @HttpCode(200)
  async totpDisable(@CurrentUser() user: JwtPayload, @Body() body: any) {
    const password = String(body?.password ?? '')
    return this.authService.totpDisable(user.sub, password)
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@CurrentUser() user: JwtPayload & { refreshToken: string }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.refresh(user.sub, user.refreshToken)
    this.setRefreshCookie(res, result.tokens.refreshToken)

    return {
      accessToken: result.tokens.accessToken,
      user: {
        id: String((result.user._id as any)?.toString() ?? result.user.id),
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
      if (e instanceof ZodError) throw new BadRequestException('Dữ liệu không hợp lệ')
      throw e
    }
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: String(process.env.NODE_ENV) === 'production',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
  }
}
