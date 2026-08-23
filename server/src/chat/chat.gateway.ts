import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger, UseGuards } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { Types } from 'mongoose'

/**
 * Chat Gateway - WebSocket realtime 2 chiều
 * - Namespace: /chat   (giống pattern NotificationsGateway đang dùng /notifications)
 *
 * Events:
 *  Client (staff/customer) -> Server:
 *    - 'chat:join-room' { sessionId }                => join 1 room theo session để nhận tin
 *    - 'chat:customer-typing' { sessionId }          => gửi staff là khách đang gõ
 *    - 'chat:staff-typing'    { sessionId }          => gửi khách là nhân viên đang gõ
 *
 *  Server -> Client:
 *    - 'chat:new-message'       { sessionId, message }  => tin nhắn mới (USER/STAFF/ASSISTANT/SYSTEM)
 *    - 'chat:session-updated'   { sessionId, patch }    => status, assignedTo, rating thay đổi
 *    - 'chat:customer-typing'   { sessionId }
 *    - 'chat:staff-typing'      { sessionId }
 *    - 'chat:error'             { message }
 */
@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: '*', // TODO: giới hạn theo env
    credentials: true,
  },
  pingTimeout: 60000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(ChatGateway.name)

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket) {
    // Không throw ở đây, để client public (guest) vẫn connect được
    const handshakeAuth = (client.handshake.auth || {}) as { token?: string }
    const queryToken = (client.handshake.query || {}).token as string | undefined
    const token = handshakeAuth.token || queryToken
    let userId: string | null = null
    let role: string | null = null
    if (token) {
      try {
        const decoded: any = this.jwtService.decode(token)
        if (decoded && typeof decoded === 'object' && decoded.sub) {
          userId = String(decoded.sub)
          role = String(decoded.role || 'customer')
          ;(client.data as any).userId = userId
          ;(client.data as any).role = role
          client.join(`u:${userId}`)
        }
      } catch (_) { /* ignore bad token - guest */ }
    }
    if (!userId) {
      ;(client.data as any).role = 'guest'
    }
    this.logger.debug(`WS chat connect: id=${client.id} role=${(client.data as any).role} uid=${userId || 'guest'}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS chat disconnect: id=${client.id}`)
  }

  // ==================== SUBSCRIBERS ====================

  @SubscribeMessage('chat:join-room')
  async joinRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId?: string }) {
    if (!payload?.sessionId) return { ok: false, error: 'sessionId required' }
    const sid = String(payload.sessionId).trim()
    if (!/^[0-9a-fA-F]{24}$/.test(sid)) return { ok: false, error: 'sessionId invalid' }
    client.join(`s:${sid}`)
    return { ok: true, joined: `s:${sid}` }
  }

  @SubscribeMessage('chat:customer-typing')
  async broadcastCustomerTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId?: string }) {
    if (!payload?.sessionId) return
    const room = `s:${String(payload.sessionId)}`
    client.to(room).emit('chat:customer-typing', { sessionId: payload.sessionId, at: Date.now() })
    return { ok: true }
  }

  @SubscribeMessage('chat:staff-typing')
  async broadcastStaffTyping(@ConnectedSocket() client: Socket, @MessageBody() payload: { sessionId?: string }) {
    if (!payload?.sessionId) return
    const room = `s:${String(payload.sessionId)}`
    client.to(room).emit('chat:staff-typing', { sessionId: payload.sessionId, at: Date.now() })
    return { ok: true }
  }

  // ==================== BROADCAST HELPERS (gọi từ ChatService) ====================

  /**
   * Gửi tin nhắn mới tới tất cả client đã join room session (cả staff và customer widget)
   */
  emitNewMessage(sessionId: Types.ObjectId | string, message: any) {
    const sid = sessionId instanceof Types.ObjectId ? sessionId.toHexString() : String(sessionId)
    this.server.to(`s:${sid}`).emit('chat:new-message', { sessionId: sid, message, at: Date.now() })
  }

  /**
   * Thông báo cập nhật thông tin session (status/assignedTo/rating...) tới các client join room
   */
  emitSessionUpdated(sessionId: Types.ObjectId | string, patch: Record<string, any>) {
    const sid = sessionId instanceof Types.ObjectId ? sessionId.toHexString() : String(sessionId)
    this.server.to(`s:${sid}`).emit('chat:session-updated', { sessionId: sid, patch, at: Date.now() })
  }

  /**
   * Gửi 1 sự kiện đến user cụ thể (dùng room `u:{userId}`) - staff/admin
   */
  emitToUser(userId: Types.ObjectId | string, event: string, payload: any) {
    const uid = userId instanceof Types.ObjectId ? userId.toHexString() : String(userId)
    this.server.to(`u:${uid}`).emit(event, { ...payload, at: Date.now() })
  }

  /**
   * Gửi 1 thông báo error trực tiếp cho 1 socket
   */
  emitError(clientId: string, message: string) {
    if (clientId) this.server.to(clientId).emit('chat:error', { message, at: Date.now() })
  }
}
