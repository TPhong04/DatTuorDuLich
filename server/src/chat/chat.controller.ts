import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { ChatService } from './chat.service'
import { sendMessageDto, staffReplyDto, updateSessionStatusDto } from './chat.dto'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Endpoint công khai - khách chưa đăng nhập vẫn chat được
  @Post('message')
  async sendMessage(@Body() body: unknown) {
    const dto = sendMessageDto.parse(body) // throws ZodError -> Nest exception filter xử lý, giống pattern hiện có
    return this.chatService.handleMessage(dto)
  }

  // Staff/Admin trả lời thủ công khi session đã ESCALATED
  @Post('staff-reply')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('staff', 'admin')
  async staffReply(@Body() body: unknown, @CurrentUser() user: JwtPayload) {
    const dto = staffReplyDto.parse(body)
    return this.chatService.staffReply(dto.sessionId, dto.message, user.sub)
  }

  // Staff/Admin đổi trạng thái session (nhận xử lý / đóng)
  @Patch('session-status')
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles('staff', 'admin')
  async updateStatus(@Body() body: unknown) {
    const dto = updateSessionStatusDto.parse(body)
    return this.chatService.updateStatus(dto.sessionId, dto.status)
  }
}