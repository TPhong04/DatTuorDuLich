import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { ChatController } from './chat.controller'
import { ChatService } from './chat.service'
import { ChatToolsService } from './tools/chat-tools.service'
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema'
import { ChatMessage, ChatMessageSchema } from './schemas/chat-message.schema'

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatToolsService],
  exports: [ChatService],
})
export class ChatModule {}