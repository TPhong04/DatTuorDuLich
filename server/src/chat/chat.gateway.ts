import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as crypto from 'crypto'
import { corsOriginCallback, parseCorsOrigins } from '../security/cors.helpers'
import { ChatSession } from './schemas/chat-session.schema'

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
    // ✅ M1: Nhất quán với NotificationGateway - dùng helper chuẩn
    //    Merge CORS từ 3 env: CORS_ORIGINS (toàn cục) + WEB_PUBLIC_URL (widget khách) + ADMIN_PANEL_URL (admin/staff)
    origin: corsOriginCallback([
      ...parseCorsOrigins(process.env.CORS_ORIGINS),
      ...(process.env.WEB_PUBLIC_URL ? parseCorsOrigins(process.env.WEB_PUBLIC_URL) : []),
      ...(process.env.ADMIN_PANEL_URL ? parseCorsOrigins(process.env.ADMIN_PANEL_URL) : []),
    ]),
    credentials: true,
  },
  pingTimeout: 60000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(ChatGateway.name)

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSession>,
  ) {}

  // ============ Helpers guest token HMAC (nhất quán với chat.controller.ts assertOwnership) ============
  private getGuestSecret(): string {
    return process.env.CHAT_GUEST_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET || 'fallback-changeme-in-env'
  }
  private computeGuestToken(sessionId: string, createdAtISO: string | null | Date): string {
    const ts = createdAtISO ? String(new Date(createdAtISO).getTime()) : '0'
    return crypto
      .createHmac('sha256', this.getGuestSecret())
      .update(`${sessionId}:${ts}`)
      .digest('hex')
      .slice(0, 32)
  }
  private toOid(id: string | Types.ObjectId): Types.ObjectId {
    return id instanceof Types.ObjectId ? id : new Types.ObjectId(id)
  }

  // ============ AUD-CR2: Core ownership check cho mọi người muốn join room s:{sessionId} ============
  private async canJoinSessionRoom(params: {
    sessionId: string
    clientData: { userId?: string; role?: string; guestToken?: string; guestEmail?: string; guestPhone?: string }
  }): Promise<{ ok: boolean; reason?: string; session?: any }> {
    const { sessionId, clientData } = params
    const session = await this.chatSessionModel
      .findById(sessionId)
      .select('_id userId assignedTo guestEmail guestPhone createdAt status guestName')
      .lean()
      .exec()
    if (!session) return { ok: false, reason: 'session not found' }
    const sessAny = session as any

    // Case 1: Caller = STAFF / ADMIN (có JWT token trong handshake → role gắn vào client.data)
    if (clientData.role === 'staff' || clientData.role === 'admin') {
      // Admin: mọi chat được phép join (bảo mật 2 lớp role admin không spoof vì lấy từ JWT verify)
      if (clientData.role === 'admin') return { ok: true, session }
      // Staff: chỉ join room mình đang sở hữu (assignedTo == caller) HOẶC assignedTo = null (chưa ai nhận → staff có thể claim sau)
      const callerUid = clientData.userId
      if (!callerUid) return { ok: false, reason: 'missing staff userId' }
      const assigned = sessAny.assignedTo ? String(this.toOid(sessAny.assignedTo).toHexString()) : null
      if (!assigned || assigned === String(callerUid)) return { ok: true, session }
      return { ok: false, reason: 'Bạn không sở hữu chat này, không được join room.' }
    }

    // Case 2: Caller = USER ĐĂNG NHẬP (role=customer)
    if (clientData.role === 'customer' && clientData.userId) {
      const owner = sessAny.userId ? String(this.toOid(sessAny.userId).toHexString()) : null
      if (owner && owner === String(clientData.userId)) return { ok: true, session }
      return { ok: false, reason: 'Bạn không sở hữu session này.' }
    }

    // Case 3: Caller = GUEST vãng lai (anonymous, không JWT → role='guest')
    //   → 3 cách verify (nhất quán assertOwnershipOrThrow ở chat.controller.ts):
    //     (a) guestToken HMAC khớp
    //     (b) guestEmail cung cấp == lưu
    //     (c) guestPhone cung cấp == lưu
    const storedEmail = String(sessAny.guestEmail || '').trim().toLowerCase()
    const storedPhone = String(sessAny.guestPhone || '').trim()
    const inEmail = clientData.guestEmail?.trim().toLowerCase() || ''
    const inPhone = clientData.guestPhone?.trim() || ''
    if (clientData.guestToken) {
      const expected = this.computeGuestToken(sessionId, (sessAny as any).createdAt as Date | string)
      if (clientData.guestToken === expected) return { ok: true, session }
    }
    if (storedEmail && inEmail && inEmail === storedEmail) return { ok: true, session }
    if (storedPhone && inPhone && inPhone === storedPhone) return { ok: true, session }
    return { ok: false, reason: 'Khách không xác minh được chủ sở hữu session (cần email/sđt/guest token khớp).' }
  }

  async handleConnection(client: Socket) {
    // Guest không cần token vẫn được phép connect (khách vãng lai chat widget)
    // Nhưng NẾU có token → PHẢI verify chữ ký + hạn dùng (không chỉ decode base64 như trước)
    const handshakeAuth = (client.handshake.auth || {}) as { token?: string }
    const queryToken = (client.handshake.query || {}).token as string | undefined
    const token = handshakeAuth.token || queryToken
    let userId: string | null = null
    let role: string | null = null
    if (token) {
      try {
        const decoded: any = await this.jwtService.verifyAsync(token, {
          secret: process.env.JWT_ACCESS_SECRET,
        })
        if (decoded && typeof decoded === 'object' && decoded.sub) {
          userId = String(decoded.sub)
          role = String(decoded.role || 'customer')
          ;(client.data as any).userId = userId
          ;(client.data as any).role = role
          client.join(`u:${userId}`)
        }
      } catch (err) {
        // ❌ Token HỎNG / HẾT HẠN / SAI CHỮ KÝ: KHÔNG được join với vai trò cũ.
        // Không silently downgrade thành guest (tránh hack giả danh staff cũ rồi nghe WS)
        // Disconnect rõ ràng để client biết và re-login nếu cần.
        this.logger.warn(`WS chat reject bad token: id=${client.id} err=${(err as Error).message}`)
        client.emit('chat:error', {
          message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.',
          code: 'INVALID_TOKEN',
        })
        client.disconnect(true)
        return
      }
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
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      sessionId?: string
      guestToken?: string
      guestEmail?: string
      guestPhone?: string
    },
  ) {
    if (!payload?.sessionId) return { ok: false, error: 'sessionId required' }
    const sid = String(payload.sessionId).trim()
    if (!/^[0-9a-fA-F]{24}$/.test(sid)) return { ok: false, error: 'sessionId invalid' }

    const canJoin = await this.canJoinSessionRoom({
      sessionId: sid,
      clientData: {
        userId: (client.data as any).userId,
        role: (client.data as any).role,
        guestToken: payload.guestToken,
        guestEmail: payload.guestEmail,
        guestPhone: payload.guestPhone,
      },
    })
    if (!canJoin.ok) {
      this.logger.warn(`WS join-room REJECT: cid=${client.id} role=${(client.data as any).role} sid=${sid} err=${canJoin.reason}`)
      return { ok: false, error: canJoin.reason || 'bạn không có quyền join room này.' }
    }
    client.join(`s:${sid}`)
    this.logger.debug(`WS join-room OK: cid=${client.id} role=${(client.data as any).role} joined=s:${sid}`)
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
