import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { MongooseModule } from '@nestjs/mongoose'
import { ChatController } from './chat.controller'
import { AdminChatController } from './admin-chat.controller'
import { ChatService } from './chat.service'
import { ChatToolsService } from './tools/chat-tools.service'
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema'
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema'
import { ChatGateway } from './chat.gateway'
import { Tour, TourSchema } from '../tours/tour.schema'
import { NotificationsModule } from '../notifications/notifications.module'
import { UsersModule } from '../users/users.module'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Tour.name, schema: TourSchema },
    ]),
    NotificationsModule,
    UsersModule,
    JwtModule.register({}), // dùng decode token, secret JWT lấy từ env ở auth module khi verify, nhưng JwtService cần register ở đây cho gateway decode
  ],
  controllers: [ChatController, AdminChatController],
  providers: [ChatService, ChatToolsService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
