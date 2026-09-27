import * as crypto from 'crypto'
import { Body, Controller, ForbiddenException, Get, Headers, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { UserRole } from '../users/user-role'
import { ChatService } from './chat.service'
import { sendMessageDto, staffReplyDto, submitRatingDto, updateSessionStatusDto, sessionGetDetailDto, updateGuestInfoDto } from './chat.dto'
import { JwtService } from '@nestjs/jwt'
import { Request } from 'express'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { ChatSession } from './schemas/chat-session.schema'

/**
 * Guest token (cho khách vãng lai): tạo HMAC từ sessionId + secret để xác minh chủ sở hữu session
 * - Lưu ý: KHÔNG được hardcode secret, lấy từ env CHAT_GUEST_TOKEN_SECRET hoặc JWT secret fallback
 * - Token có hiệu lực trong 30 ngày (tính từ createdAt của session) để tránh bị lạm dụng lâu dài
 */
function getGuestSecret(): string {
  return process.env.CHAT_GUEST_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'fallback-changeme-in-env'
}
function computeGuestToken(sessionId: string, createdAtISO: string | null | Date): string {
  const ts = createdAtISO ? String(new Date(createdAtISO).getTime()) : '0'
  return crypto
    .createHmac('sha256', getGuestSecret())
    .update(`${sessionId}:${ts}`)
    .digest('hex')
    .slice(0, 32)
}

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSession>,
  ) {}

  private actor(user: JwtPayload): { sub: string; role: UserRole } {
    const uid = (user as any).id || (user as any).sub || ''
    const role = ((user as any).role as UserRole) || 'staff'
    return { sub: uid, role }
  }

  /**
   * ✅ NEW: Optional auth extractor - lấy user từ Authorization header nếu có (không throw cho guest)
   * Trả về JwtPayload | null (null = khách vãng lai, không có token)
   */
  private async tryOptionalAuthUser(@Req() req: Request): Promise<JwtPayload | null> {
    const authHeader = (req.headers.authorization ?? '') as string
    if (!authHeader.startsWith('Bearer ')) return null
    const token = authHeader.slice(7).trim()
    if (!token) return null
    try {
      const decoded = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      })
      return decoded as JwtPayload
    } catch {
      // Token sai/hết hạn → coi như không có auth (trả về guest null),
      // KHÔNG throw để endpoint public vẫn hoạt động,
      // sau đó ownership check phía dưới sẽ reject nếu session yêu cầu user đăng nhập
      return null
    }
  }

  /**
   * ✅ NEW: Kiểm tra chủ sở hữu session - NUCLEUS CHECK cho 2 endpoint public
   * Logic:
   *   - Nếu session có userId (người dùng đã đăng ký tạo ra):
   *       → yêu cầu token hợp lệ & token.sub === session.userId, nếu không FORBIDDEN
   *   - Nếu session là guest (userId = null):
   *       → kiểm tra 1 trong 3 yếu tố:
   *         (a) x-chat-guest-token khớp với HMAC được tính từ sessionId + createdAt
   *         (b) request cung cấp đúng guestEmail đã lưu trong session
   *         (c) request cung cấp đúng guestPhone đã lưu trong session
   *       → nếu không có yếu tố nào khớp → FORBIDDEN
   */
  private async assertOwnershipOrThrow(
    sessionRaw: any,
    user: JwtPayload | null,
    opts: {
      guestToken?: string
      providedEmail?: string
      providedPhone?: string
      endpointName: string
    },
  ) {
    const sessionId = String(sessionRaw._id ?? sessionRaw.id)

    if (sessionRaw.userId) {
      // Session thuộc tài khoản đăng ký
      const ownerUid = String(sessionRaw.userId)
      if (!user) {
        throw new ForbiddenException(
          `Bạn cần đăng nhập để xem/đánh giá session này.`,
        )
      }
      const callerUid = (user as any).id || (user as any).sub || ''
      if (String(callerUid) !== ownerUid) {
        throw new ForbiddenException(
          `Bạn không có quyền ${opts.endpointName} session này.`,
        )
      }
      return // OK
    }

    // ============= Guest session (userId null) =============
    const storedEmail = String(sessionRaw.guestEmail || '').trim().toLowerCase()
    const storedPhone = String(sessionRaw.guestPhone || '').trim()
    const inEmail = opts.providedEmail?.trim().toLowerCase() || ''
    const inPhone = opts.providedPhone?.trim() || ''

    // Cách 1: Guest token (HMAC) - Ưu tiên nhất
    if (opts.guestToken) {
      const expected = computeGuestToken(sessionId, sessionRaw.createdAt)
      if (opts.guestToken === expected) return // OK
    }

    // Cách 2: Email khớp (đã lưu trong session)
    if (storedEmail && inEmail && inEmail === storedEmail) return // OK

    // Cách 3: SĐT khớp (đã lưu trong session)
    if (storedPhone && inPhone && inPhone === storedPhone) return // OK

    throw new ForbiddenException(
      `Xác minh khách hàng không hợp lệ. Vui lòng cung cấp email/số điện thoại đã sử dụng khi chat hoặc tải lại trang chat.`,
    )
  }

  @Post('message')
  async sendMessage(@Body() body: unknown, @Req() req: Request) {
    const dto = sendMessageDto.parse(body)
    const user = await this.tryOptionalAuthUser(req)
    // Đồng bộ userId từ token đã đăng nhập (nếu khách đăng nhập rồi nhưng widget chưa đính kèm)
    if (user && !dto.userId) {
      ;(dto as any).userId = (user as any).id || (user as any).sub
    }
    const result = (await this.chatService.handleMessage(dto)) as any
    // ✅ Trả về guest token (HMAC) để client lưu và gửi lại ở các request sau (GET session, rating)
    //  → frontend lưu token này vào localStorage cùng sessionId
    try {
      const sess = await this.chatSessionModel.findById(result.sessionId).select('_id createdAt guestEmail guestPhone userId').lean()
      if (sess) {
        // createdAt được Mongoose tạo tự động nhờ timestamps: true (không có trong type TS khai báo field)
        ;(result as any).guestToken = computeGuestToken(String(sess._id), (sess as any).createdAt as string | Date)
      }
    } catch {
      // ignore - không ảnh hưởng nghiệp vụ chính, token chỉ là phụ trợ verify
    }
    return result
  }

  @Get('sessions/:id')
  async getSessionInfo(
    @Param('id') id: string,
    @Headers('x-chat-guest-token') guestTokenHeader: string | undefined,
    @Req() req: Request,
  ) {
    const dto = sessionGetDetailDto.parse({ sessionId: id })
    const user = await this.tryOptionalAuthUser(req)

    // Fetch session raw (trước khi serialize) để lấy userId + PII verify
    const sess = await this.chatSessionModel.findById(dto.sessionId)
      .select('_id userId guestEmail guestPhone createdAt status guestName')
      .lean()
      .exec()
    if (!sess) {
      // Giữ nguyên behavior cũ: NotFound sẽ được getSessionDetail ném sau
      return this.chatService.getSessionDetail(dto, user ? { sub: String((user as any)?.id || (user as any)?.sub || ''), role: ((user as any)?.role as any) || 'customer' } : undefined)
    }

    await this.assertOwnershipOrThrow(sess, user, {
      guestToken: guestTokenHeader,
      endpointName: 'xem chi tiết',
    })

    return this.chatService.getSessionDetail(
      dto,
      user ? { sub: String((user as any).id || (user as any).sub || ''), role: ((user as any).role as any) || 'customer' } : undefined,
    )
  }

  @Post('rating')
  async submitRating(
    @Body() body: unknown,
    @Headers('x-chat-guest-token') guestTokenHeader: string | undefined,
    @Req() req: Request,
  ) {
    const dto = submitRatingDto.parse(body)
    const user = await this.tryOptionalAuthUser(req)

    const sess = await this.chatSessionModel.findById(dto.sessionId)
      .select('_id userId guestEmail guestPhone createdAt ratingStars')
      .lean()
      .exec()
    if (!sess) {
      // Chẳng hạn NotFoundException bên dưới service sẽ ném
      return this.chatService.submitRating(dto)
    }

    await this.assertOwnershipOrThrow(sess, user, {
      guestToken: guestTokenHeader,
      providedEmail: dto.guestEmail,
      endpointName: 'đánh giá',
    })

    return this.chatService.submitRating(dto)
  }

  // ✅ M2: PATCH /chat/sessions/:id/guest-info — cập nhật thông tin khách vãng lai (không save ChatMessage)
  @Patch('sessions/:id/guest-info')
  async updateGuestInfoByCustomer(
    @Param('id') sessionId: string,
    @Body() body: unknown,
    @Headers('x-chat-guest-token') guestTokenHeader: string | undefined,
    @Req() req: Request,
  ) {
    const dto = updateGuestInfoDto.parse({ sessionId, ...(body as Record<string, unknown>) })
    const user = await this.tryOptionalAuthUser(req)

    const sess = await this.chatSessionModel.findById(dto.sessionId)
      .select('_id userId guestEmail guestPhone createdAt')
      .lean()
      .exec()
    if (!sess) {
      return this.chatService.updateGuestInfo(dto)
    }

    await this.assertOwnershipOrThrow(sess, user, {
      guestToken: guestTokenHeader,
      providedEmail: dto.guestEmail,
      endpointName: 'cập nhật thông tin khách',
    })

    return this.chatService.updateGuestInfo(dto)
  }

  // Staff/Admin trả lời thủ công khi session đã ESCALATED (giữ lại tương thích cũ, nhưng ưu tiên dùng admin/chat/sessions/:id/staff-reply từ Admin)
  @Post('staff-reply')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('staff', 'admin')
  async staffReply(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = staffReplyDto.parse(body)
    const uid = (user as any).id || (user as any).sub || ''
    return this.chatService.staffReply(dto.sessionId, dto.message, uid)
  }

  // Staff/Admin đổi trạng thái session (nhận xử lý / đóng)
  @Patch('session-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('staff', 'admin')
  async updateStatus(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = updateSessionStatusDto.parse(body)
    return this.chatService.updateStatus(dto, this.actor(user))
  }
}
