import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { UserRole } from '../users/user-role'
import { ChatService } from './chat.service'
import { sendMessageDto, staffReplyDto, submitRatingDto, updateSessionStatusDto, sessionGetDetailDto } from './chat.dto'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  private actor(user: JwtPayload): { sub: string; role: UserRole } {
    const uid = (user as any).id || (user as any).sub || ''
    const role = ((user as any).role as UserRole) || 'staff'
    return { sub: uid, role }
  }

  @Post('message')
  async sendMessage(@Body() body: unknown) {
    const dto = sendMessageDto.parse(body)
    return this.chatService.handleMessage(dto)
  }

  @Get('sessions/:id')
  async getSessionInfo(@Param('id') id: string) {
    const dto = sessionGetDetailDto.parse({ sessionId: id })
    return this.chatService.getSessionDetail(dto, undefined)
  }

  @Post('rating')
  async submitRating(@Body() body: unknown) {
    const dto = submitRatingDto.parse(body)
    return this.chatService.submitRating(dto)
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
