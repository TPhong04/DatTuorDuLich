import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards, BadRequestException } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { UserRole } from '../users/user-role'
import { ChatService } from './chat.service'
import {
  assignSessionDto,
  claimSessionDto,
  escalateByStaffDto,
  chatStatsDto,
  getSessionDetailDto,
  listSessionsDto,
  transferSessionDto,
  updateSessionStatusDto,
} from './chat.dto'

/**
 * Admin/Staff Chat Controller
 * Tất cả endpoint đều yêu cầu role staff hoặc admin.
 * Base route: /admin/chat (như pattern admin-vehicles, admin-rentals hiện có)
 */
@Controller('admin/chat')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
export class AdminChatController {
  constructor(private readonly chat: ChatService) {}

  private actor(user: JwtPayload): { sub: string; role: UserRole } {
    const uid = (user as any).id || (user as any).sub || ''
    const role = ((user as any).role as UserRole) || 'staff'
    return { sub: uid, role }
  }

  @Get('sessions')
  async listSessions(@Query() query: unknown, @CurrentUser() user: JwtPayload) {
    const dto = listSessionsDto.parse(query || {})
    return this.chat.listSessions(dto, this.actor(user))
  }

  @Get('sessions/:id')
  async getSessionDetail(@Param('id') id: string, @Query() query: unknown, @CurrentUser() user: JwtPayload) {
    const dto = getSessionDetailDto.parse({ sessionId: id, ...(query || {}) })
    return this.chat.getSessionDetail(dto, this.actor(user))
  }

  @Post('sessions/claim')
  async claimSession(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = claimSessionDto.parse(body)
    return this.chat.claimSession(dto.sessionId, this.actor(user))
  }

  @Post('sessions/assign')
  async assignSession(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = assignSessionDto.parse(body)
    return this.chat.assignSession(dto, this.actor(user))
  }

  @Post('sessions/transfer')
  async transferSession(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = transferSessionDto.parse(body)
    return this.chat.transferSession(dto, this.actor(user))
  }

  @Patch('sessions/status')
  async updateStatus(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = updateSessionStatusDto.parse(body)
    return this.chat.updateStatus(dto, this.actor(user))
  }

  @Post('sessions/escalate')
  async escalateByStaff(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = escalateByStaffDto.parse(body)
    return this.chat.escalateByStaff(dto.sessionId, dto.reason, this.actor(user))
  }

  @Post('sessions/:id/staff-reply')
  async staffReply(@Param('id') id: string, @Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const { message } = (body as any) || {}
    if (typeof message !== 'string' || message.length < 1 || message.length > 4000) {
      // ✅ AI-5a: Dùng BadRequestException chuẩn NestJS (HTTP 400) thay vì throw Error (HTTP 500)
      throw new BadRequestException('Nội dung tin nhắn phải từ 1-4000 ký tự.')
    }
    const uid = (user as any).id || (user as any).sub || ''
    return this.chat.staffReply(id, message, uid)
  }

  // ============== PHASE 2 - Thống kê ==============

  @Get('stats/dashboard')
  @Roles('admin') // ✅ AI-5b: Staff xem KPI cá nhân thôi, chỉ ADMIN mới xem dashboard toàn hệ thống (bảo mật số liệu)
  async chatDashboardStats(@Query() query: unknown, @CurrentUser() user: JwtPayload) {
    if ((user as any).role !== 'admin') throw new ForbiddenException('Chỉ admin xem dashboard tổng hợp hệ thống.')
    const dto = chatStatsDto.parse(query || {})
    return this.chat.chatDashboardStats(dto)
  }

  @Get('stats/staff/:staffUserId')
  @Roles('staff', 'admin')
  async staffKpi(@Param('staffUserId') staffUserId: string, @Query() query: unknown, @CurrentUser() user: JwtPayload) {
    // ✅ AI-5b: Staff role chỉ xem được KPI CỦA CHÍNH HỌ; admin xem tất cả.
    const actorRole = ((user as any).role as UserRole) || 'staff'
    const actorUid = (user as any).id || (user as any).sub || ''
    if (actorRole !== 'admin' && String(staffUserId) !== String(actorUid)) {
      throw new ForbiddenException('Bạn chỉ được xem KPI của chính mình.')
    }
    const dto = chatStatsDto.parse(query || {})
    return this.chat.staffKpi(staffUserId, dto)
  }

  // ============== PHASE 3 - Actions ==============
  @Post('sessions/close-idle')
  @Roles('admin')
  async closeIdleOlderThan24h() {
    return this.chat.closeIdleSessionsOlderThan24h()
  }

  @Post('sessions/send-thankyou-voucher')
  @Roles('admin')
  async sendThankYouVouchers() {
    return this.chat.sendThankYouForClosedChats()
  }
}
