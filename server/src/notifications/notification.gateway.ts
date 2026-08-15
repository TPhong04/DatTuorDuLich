import { Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Types } from 'mongoose'
import { corsOriginCallback, parseCorsOrigins } from '../security/cors.helpers'
import { JwtPayload } from '../auth/auth.types'
import { NotificationDocument } from './notification.schema'

interface WsSocketData {
  user?: JwtPayload
}

@WebSocketGateway({
  cors: {
    origin: corsOriginCallback(parseCorsOrigins(process.env.CORS_ORIGINS)),
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
  },
  namespace: '/notifications',
  pingInterval: 15000,
  pingTimeout: 30000,
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationGateway.name)
  @WebSocketServer() server!: Server

  private readonly connections = new Map<string, Set<string>>()

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private roomFor(userId: string | Types.ObjectId) {
    return `u:${String(userId)}`
  }

  async handleConnection(client: Socket) {
    try {
      // #region debug-point H1:cors-gateway-handleConnection-start
      ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'pre-fix', hypothesisId: 'H1', location: 'notification.gateway.ts:43', msg: '[DEBUG] ws handleConnection start', data: { origin: client.handshake.headers?.origin || null, hasAuthToken: Boolean(client.handshake.auth?.token), hasHeaderAuth: Boolean(client.handshake.headers?.authorization), hasQueryToken: Boolean(client.handshake.query?.token), serverCorsOrigin: '*' }, ts: Date.now() }) }).catch(() => { }) })();
      // #endregion
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') as string) ||
        (client.handshake.query?.token as string)
      if (!token) throw new UnauthorizedException('missing_token')
      const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET')
      const payload = this.jwtService.verifyAsync<JwtPayload>(token, { secret })
      const user = (await payload) as JwtPayload
      if (!user?.sub) throw new UnauthorizedException('invalid_token')
      ;(client.data as WsSocketData).user = user
      const room = this.roomFor(user.sub)
      await client.join(room)
      const sockets = this.connections.get(user.sub) || new Set()
      sockets.add(client.id)
      this.connections.set(user.sub, sockets)
      this.logger.verbose(`ws connected ${user.email} ${client.id}`)
      client.emit('connected', { userId: user.sub, role: user.role, serverTime: new Date().toISOString() })
    } catch (err: any) {
      this.logger.warn(`ws connect failed: ${String(err?.message || err)}`)
      client.emit('error', { code: 'UNAUTHORIZED', message: String(err?.message || err) })
      try { client.disconnect(true) } catch {}
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client.data as WsSocketData)?.user
    if (!user) return
    const sockets = this.connections.get(user.sub)
    if (sockets) {
      sockets.delete(client.id)
      if (sockets.size === 0) this.connections.delete(user.sub)
      else this.connections.set(user.sub, sockets)
    }
    this.logger.verbose(`ws disconnected ${user.email} ${client.id}`)
  }

  emitNotification(userId: string | Types.ObjectId, row: NotificationDocument) {
    const room = this.roomFor(userId)
    this.server.to(room).emit('notification.new', row)
  }

  emitBadge(userId: string | Types.ObjectId, unreadCount: number) {
    const room = this.roomFor(userId)
    this.server.to(room).emit('notification.badge', { unreadCount })
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: Socket, @MessageBody() data: unknown) {
    const user = (client.data as WsSocketData)?.user
    return { pong: true, userId: user?.sub || null, serverTime: new Date().toISOString(), echo: data }
  }
}
