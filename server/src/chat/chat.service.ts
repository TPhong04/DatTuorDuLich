import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { GoogleGenAI, Content, Part } from '@google/genai'
import { ChatSession, ChatStatus, ChatClosedReason } from './schemas/chat-session.schema'
import { ChatMessage, ChatRole } from './schemas/chat-message.schema'
import { ChatToolsService, CHAT_TOOL_DECLARATIONS } from './tools/chat-tools.service'
import {
  SendMessageDto,
  ListSessionsDto,
  GetSessionDetailDto,
  SubmitRatingDto,
  UpdateSessionStatusDto,
  AssignSessionDto,
  TransferSessionDto,
  ChatStatsDto,
} from './chat.dto'
import { NotificationsService, CreateNotificationInput } from '../notifications/notifications.service'
import { UsersService } from '../users/users.service'
import { ChatGateway } from './chat.gateway'
import { UserRole } from '../users/user-role'

const SYSTEM_PROMPT = `Bạn là trợ lý ảo thân thiện của VietNam Explore - nền tảng đặt tour du lịch.

PHONG CÁCH:
- Trả lời tự nhiên, gần gũi, bằng tiếng Việt. Có thể trò chuyện phiếm (chào hỏi, hỏi thăm, hỏi kiến thức chung, hỏi về thời tiết/địa điểm du lịch nói chung...) một cách bình thường như một trợ lý thân thiện, không cần escalate chỉ vì câu hỏi không liên quan trực tiếp đến đặt tour.
- Khi trò chuyện phiếm, có thể khéo léo gợi ý quay lại chủ đề tour/du lịch nếu phù hợp, nhưng không bắt buộc.

QUY TẮC VỀ DỮ LIỆU TOUR:
- Khi khách hỏi về tour, danh mục, lịch trình, giá, ngày khởi hành, chỗ còn trống... LUÔN dùng tool (searchTours, getTourDetail, checkAvailability, getBookingStatus) để lấy dữ liệu thật từ hệ thống. KHÔNG bịa giá, ngày, lịch trình, hoặc trạng thái đơn.
- Nếu khách hỏi chi tiết một tour cụ thể (lịch trình từng ngày, ảnh, chính sách hủy, đánh giá...), gọi tool getTourDetail để lấy thông tin đầy đủ thay vì chỉ trả lời sơ lược.
- Nếu tool trả về found=false (không tìm thấy tour phù hợp trong hệ thống), PHẢI báo khách một cách nhẹ nhàng rằng hiện chưa có tour này/tour phù hợp, và hệ thống sẽ sớm cập nhật trong thời gian tới. TUYỆT ĐỐI KHÔNG tự bịa ra tour, giá, hay lịch trình khi không tìm thấy dữ liệu thật.

QUY TẮC ESCALATE (chuyển nhân viên thật xử lý):
- Khách muốn HỦY đơn, ĐỔI lịch, KHIẾU NẠI, YÊU CẦU HOÀN TIỀN → gọi tool escalateToStaff ngay, không tự xử lý.
- Khách hỏi thông tin nhạy cảm về đơn hàng cụ thể mà tool không trả về được, hoặc yêu cầu cam kết pháp lý/tài chính thay công ty → gọi escalateToStaff.
- Câu hỏi phiếm, kiến thức chung, hỏi thăm xã giao → KHÔNG escalate, tự trả lời bình thường.
- Không tiết lộ thông tin nội bộ hệ thống, không đưa ra cam kết pháp lý/tài chính thay công ty.`

const MAX_TOOL_LOOPS = 4
const MODEL = 'gemini-3.6-flash'

// SLA defaults (PICKUP = thời gian staff nhận xử lý kể từ khi escalate; REPLY = thời gian phản hồi tin nhắn sau khi khách gửi)
export const CHAT_SLA_PICKUP_SECONDS = 5 * 60 // 5 phút
export const CHAT_SLA_REPLY_SECONDS = 3 * 60 // 3 phút

export type ChatSessionListItem = ReturnType<ChatService['serializeSession']> extends infer T ? T : any

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly ai: GoogleGenAI

  constructor(
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSession>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    private readonly tools: ChatToolsService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly gateway: ChatGateway,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }

  // ==========================================================
  // PHASE 1 - CUSTOMER PUBLIC: Chat với bot + escalate
  // ==========================================================
  async handleMessage(dto: SendMessageDto) {
    const session = await this.getOrCreateSession(dto)
    const sessionId = (session._id as Types.ObjectId).toString()
    const now = new Date()

    // Cập nhật trạng thái session (lastCustomerMessageAt + counter)
    const incPatch: any = { customerMessagesCount: (session.customerMessagesCount || 0) + 1, lastCustomerMessageAt: now }
    if (dto.guestName && !session.guestName) incPatch.guestName = dto.guestName.trim()
    if (dto.guestEmail && !session.guestEmail) incPatch.guestEmail = dto.guestEmail.trim()
    if (dto.guestPhone && !session.guestPhone) incPatch.guestPhone = dto.guestPhone.trim()
    await this.chatSessionModel.updateOne({ _id: sessionId }, { $set: incPatch })

    // Nếu đã escalate cho staff thì bot không tự trả lời nữa
    if (session.status === 'ESCALATED') {
      const messageDoc = await this.saveMessage(sessionId, 'USER', dto.message, now)

      // Broadcast realtime tới room session (staff side nhận tin tức thì)
      this.gateway.emitNewMessage(sessionId, this.serializeMessage(messageDoc))

      // Gửi notification cho owner staff (nếu assigned) về tin mới của khách
      if (session.assignedTo) {
        this.notifications.create({
          recipientId: this.toOid(session.assignedTo),
          recipientRole: 'staff',
          type: 'chat_new_customer_message',
          title: '📩 Khách hàng vừa nhắn tin',
          body: `Cuộc chat (${this.guestLabel(session)}) vừa gửi tin nhắn: "${this.truncate(dto.message, 80)}"`,
          channels: ['in_app'],
          actionUrl: `/admin/customer-chat/${sessionId}`,
          entityType: 'chat_session',
          entityId: sessionId,
          priority: 'medium',
          now,
        }).catch((e) => this.logger.warn(`Notif failed: ${(e as Error).message}`))
      } else {
        // CHƯA CÓ OWNER: gửi broad cho tất cả staff/admin có 1 cuộc chat chưa nhận có tin mới
        this.broadcastStaffNotification({
          type: 'chat_new_customer_message',
          title: '📩 Chat chờ nhận xử lý - có tin mới',
          body: `Khách ${this.guestLabel(session)} gửi: "${this.truncate(dto.message, 70)}". Nhấn vào để nhận xử lý.`,
          actionUrl: `/admin/customer-chat/${sessionId}`,
          entityType: 'chat_session',
          entityId: sessionId,
          priority: 'high',
          now,
        }).catch((e) => this.logger.warn(`Broad notif failed: ${(e as Error).message}`))
      }

      return {
        sessionId,
        status: 'ESCALATED' as ChatStatus,
        reply: 'Yêu cầu của bạn đang được nhân viên hỗ trợ xử lý, vui lòng chờ trong giây lát.',
        assignedStaffName: await this.assignedStaffName(session.assignedTo),
      }
    }

    await this.saveMessage(sessionId, 'USER', dto.message, now)

    const contents: Content[] = await this.getHistoryForModel(sessionId)

    let loops = 0
    let escalated = false
    let escalationReason = ''

    while (loops < MAX_TOOL_LOOPS) {
      loops++
      let response
      try {
        response = await this.callGeminiWithRetry(contents)
      } catch (err) {
        this.logger.error(`Gemini API error: ${(err as Error).message}`)
        const friendly = this.isRateLimitError(err)
          ? 'Hệ thống đang có nhiều người hỏi cùng lúc, bạn vui lòng đợi khoảng 1 phút rồi gửi lại tin nhắn nhé.'
          : 'Xin lỗi, hệ thống đang gặp sự cố. Bạn vui lòng thử lại sau ít phút.'
        const m = await this.saveMessage(sessionId, 'ASSISTANT', friendly)
        this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
        return { sessionId, status: session.status, reply: friendly }
      }

      const functionCalls = response.functionCalls ?? []
      if (functionCalls.length === 0) {
        const reply = response.text ?? 'Xin lỗi, tôi chưa có câu trả lời phù hợp.'
        const m = await this.saveMessage(sessionId, 'ASSISTANT', reply)
        this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
        return { sessionId, status: session.status, reply }
      }

      const modelParts: Part[] = response.candidates?.[0]?.content?.parts ?? []
      contents.push({ role: 'model', parts: modelParts })

      const responseParts: Part[] = []
      for (const call of functionCalls) {
        const args = call.args ?? {}
        const result = await this.tools.execute(call.name!, args)
        if (call.name === 'escalateToStaff') {
          escalated = true
          escalationReason = (args as any).reason ?? 'Khách yêu cầu hỗ trợ thêm'
        }
        responseParts.push({
          functionResponse: { name: call.name!, response: { result } },
        })
        await this.saveToolCall(sessionId, call.name!, args, result)
      }

      contents.push({ role: 'user', parts: responseParts })

      if (escalated) {
        await this.doEscalate(sessionId, session, escalationReason, null, now)
        const reply = `Mình đã chuyển yêu cầu của bạn cho nhân viên hỗ trợ (lý do: ${escalationReason}). Bạn vui lòng chờ trong giây lát nhé.`
        const m = await this.saveMessage(sessionId, 'ASSISTANT', reply)
        this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
        return {
          sessionId,
          status: 'ESCALATED' as ChatStatus,
          reply,
          assignedStaffName: null,
        }
      }
    }

    // Vượt quá tool loop -> an toàn escalate
    const fallbackReason = 'Cần nhân viên hỗ trợ yêu cầu này'
    await this.doEscalate(sessionId, session, fallbackReason, null, now)
    const fallback = 'Xin lỗi, mình cần nhân viên hỗ trợ thêm cho yêu cầu này. Bạn vui lòng chờ trong giây lát.'
    const m = await this.saveMessage(sessionId, 'ASSISTANT', fallback)
    this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
    return { sessionId, status: 'ESCALATED' as ChatStatus, reply: fallback, assignedStaffName: null }
  }

  // ==========================================================
  // PHASE 1 - STAFF / ADMIN APIs
  // ==========================================================

  async listSessions(q: ListSessionsDto, actor: { sub: string; role: UserRole }) {
    const page = Math.max(1, Math.floor(q.page ?? 1))
    const limit = Math.min(100, Math.max(1, Math.floor(q.limit ?? 20)))
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.status) filter.status = q.status
    if (q.onlyUnassigned) filter.assignedTo = null
    else if (q.assignedTo) filter.assignedTo = this.toOid(q.assignedTo)
    // Staff chỉ xem được của họ, admin xem toàn bộ
    if (actor.role === 'staff') {
      // Staff không lọc hard thì mặc định chỉ thấy assignedTo = chính mình HOẶC assignedTo = null (chờ nhận)
      if (!q.assignedTo && !q.onlyUnassigned) {
        filter.$or = [{ assignedTo: this.toOid(actor.sub) }, { assignedTo: null, status: 'ESCALATED' }]
      }
    }
    if (q.search && q.search.trim()) {
      const rgx = { $regex: q.search.trim(), $options: 'i' }
      filter.$or = [{ guestName: rgx }, { guestEmail: rgx }, { guestPhone: rgx }, { escalationReason: rgx }]
    }

    const sortBy: string = q.sortBy || 'lastCustomerMessageAt'
    const sortOrderVal = q.sortOrder === 'asc' ? 1 : -1
    const sort = { [sortBy]: sortOrderVal, updatedAt: -1 }

    const [items, total] = await Promise.all([
      this.chatSessionModel.find(filter).sort(sort as any).skip(skip).limit(limit).lean().exec(),
      this.chatSessionModel.countDocuments(filter).exec(),
    ])

    let itemsSerialized = items.map((x) => this.serializeSession(x))
    if (q.slaBreachedOnly) itemsSerialized = itemsSerialized.filter((s: any) => s.slaStatus !== 'within_sla')

    return { items: itemsSerialized, total, page, limit }
  }

  async getSessionDetail(q: GetSessionDetailDto, actor?: { sub: string; role: UserRole }) {
    const session = await this.chatSessionModel.findById(q.sessionId).lean().exec()
    if (!session) throw new NotFoundException('Không tìm thấy session')

    // Staff chỉ xem được của họ hoặc assignedTo=null (để nhận xử lý)
    if (actor && actor.role === 'staff') {
      const assignee = String(session.assignedTo || '')
      if (assignee && assignee !== actor.sub) throw new ForbiddenException('Bạn không có quyền xem session này.')
    }

    const messageLimit = Math.min(500, Math.max(1, Math.floor(q.messageLimit ?? 200)))
    const messages = await this.chatMessageModel
      .find({ sessionId: session._id })
      .sort({ createdAt: 1 })
      .limit(messageLimit)
      .lean()
      .exec()

    const assignedStaff = session.assignedTo ? await this.users.findById(this.toOid(session.assignedTo).toHexString()) : null

    return {
      session: this.serializeSession(session, { assignedStaffName: assignedStaff ? assignedStaff.name : null }),
      messages: messages.map((m) => this.serializeMessage(m)),
    }
  }

  async staffReply(sessionId: string, message: string, staffUserId: string) {
    const now = new Date()
    const session = await this.chatSessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')

    // Nếu session chưa ESCALATED → tự động escalate (staff muốn can thiệp chat BOT)
    let autoEscalated = false
    if (session.status === 'BOT') {
      session.status = 'ESCALATED'
      session.escalationReason = session.escalationReason ?? 'Nhân viên chủ động hỗ trợ khách'
      session.escalatedAt = now
      autoEscalated = true
    }
    if (session.status === 'CLOSED') throw new BadRequestException('Session đã đóng, không thể trả lời. Mở lại session trước.')

    let isFirstResponse = false
    // Nếu chưa có owner → claim luôn (tự gán người reply là owner)
    if (!session.assignedTo) {
      session.assignedTo = this.toOid(staffUserId)
      session.assignedAt = now
    }
    // Đặt firstResponseAt (lần đầu staff reply)
    if (session.status === 'ESCALATED' && !session.firstResponseAt) {
      session.firstResponseAt = now
      if (session.escalatedAt) {
        session.firstResponseSeconds = Math.max(0, Math.floor((now.getTime() - new Date(session.escalatedAt).getTime()) / 1000))
      }
      isFirstResponse = true
    }

    session.staffMessagesCount = (session.staffMessagesCount || 0) + 1
    session.lastStaffMessageAt = now
    await session.save()

    const m = await this.saveMessage(sessionId, 'STAFF', message, now)

    // Broadcast realtime tới room (customer widget nhận tin ngay lập tức)
    this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
    // Cập nhật session realtime (assignedTo, status changed)
    this.gateway.emitSessionUpdated(sessionId, {
      status: session.status,
      assignedTo: session.assignedTo,
      assignedAt: session.assignedAt,
      firstResponseAt: session.firstResponseAt,
      firstResponseSeconds: session.firstResponseSeconds,
      assignedStaffName: (await this.users.findById(staffUserId))?.name ?? null,
    })

    if (autoEscalated) {
      this.notifications.create({
        recipientId: this.toOid(staffUserId),
        recipientRole: (await this.users.findById(staffUserId))?.role === 'admin' ? 'admin' : 'staff',
        type: 'chat_assigned_staff',
        title: '📞 Bạn đã chủ động nhận hỗ trợ khách hàng',
        body: `Cuộc chat khách ${this.guestLabel(session)} đã được bạn nhận xử lý.`,
        channels: ['in_app'],
        actionUrl: `/admin/customer-chat/${sessionId}`,
        entityType: 'chat_session',
        entityId: sessionId,
        now,
      }).catch(() => {})
    } else if (isFirstResponse) {
      // Optional: mark something
    }
    return { sessionId, reply: message }
  }

  async assignSession(dto: AssignSessionDto, actor: { sub: string; role: UserRole }, now = new Date()) {
    if (actor.role !== 'admin') throw new ForbiddenException('Chỉ admin mới được phép giao chat cho nhân viên.')
    const session = await this.chatSessionModel.findById(dto.sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status !== 'ESCALATED' && session.status !== 'BOT') {
      throw new BadRequestException('Chỉ session BOT hoặc ESCALATED mới được giao nhân viên xử lý.')
    }
    const targetStaff = await this.users.findById(dto.staffUserId)
    if (!targetStaff) throw new NotFoundException('Nhân viên không tồn tại')
    if (targetStaff.role !== 'staff' && targetStaff.role !== 'admin') {
      throw new BadRequestException('Người được giao phải là nhân viên staff hoặc admin.')
    }
    if (session.status === 'BOT') {
      session.status = 'ESCALATED'
      session.escalatedAt = session.escalatedAt ?? now
      session.escalationReason = session.escalationReason ?? 'Admin giao cho nhân viên xử lý'
    }
    session.assignedTo = this.toOid(dto.staffUserId)
    session.assignedAt = now
    await session.save()

    this.gateway.emitSessionUpdated(session.id, { assignedTo: session.assignedTo, assignedAt: session.assignedAt, assignedStaffName: targetStaff.name, status: session.status })

    await this.notifications.create({
      recipientId: this.toOid(dto.staffUserId),
      recipientRole: targetStaff.role as any,
      type: 'chat_assigned_staff',
      title: '📞 Admin giao 1 cuộc hỗ trợ khách hàng',
      body: `Bạn được giao xử lý cuộc chat khách hàng: ${this.guestLabel(session)}${dto.transferNote ? ` · Ghi chú: ${dto.transferNote}` : ''}.\nLý do escalate: ${session.escalationReason || '—'}`,
      channels: ['in_app', 'email'],
      actionUrl: `/admin/customer-chat/${session.id}`,
      entityType: 'chat_session',
      entityId: session.id,
      priority: 'high',
      senderUserId: this.toOid(actor.sub),
      now,
    })
    return this.serializeSession(session, { assignedStaffName: targetStaff.name })
  }

  async claimSession(sessionId: string, actor: { sub: string; role: UserRole }) {
    if (actor.role !== 'staff' && actor.role !== 'admin') throw new ForbiddenException('Thiếu quyền.')
    const session = await this.chatSessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.assignedTo) throw new BadRequestException('Session đã có người nhận. Vui lòng refresh.')
    if (session.status === 'CLOSED') throw new BadRequestException('Session đã đóng, không thể nhận.')
    const now = new Date()
    const staff = await this.users.findById(actor.sub)
    if (session.status === 'BOT') {
      session.status = 'ESCALATED'
      session.escalatedAt = now
      session.escalationReason = 'Nhân viên tự nhận hỗ trợ khách'
    }
    session.assignedTo = this.toOid(actor.sub)
    session.assignedAt = now
    await session.save()

    this.gateway.emitSessionUpdated(session.id, { assignedTo: session.assignedTo, assignedAt: session.assignedAt, assignedStaffName: staff?.name ?? null, status: session.status })
    return this.serializeSession(session, { assignedStaffName: staff?.name ?? null })
  }

  async updateStatus(dto: UpdateSessionStatusDto, actor: { sub: string; role: UserRole }, now = new Date()) {
    const session = await this.chatSessionModel.findById(dto.sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    session.status = dto.status
    if (dto.status === 'CLOSED') {
      session.closedAt = now
      session.closedReason = (dto.closedReason ?? (actor.role === 'admin' ? 'admin_closed' : actor.role === 'staff' ? 'staff_closed' : 'unknown')) as ChatClosedReason
      session.closedByStaffId = this.toOid(actor.sub)
    } else {
      session.closedAt = null
      session.closedReason = null
      session.closedByStaffId = null
    }
    await session.save()
    this.gateway.emitSessionUpdated(session.id, { status: session.status, closedAt: session.closedAt, closedReason: session.closedReason })
    return this.serializeSession(session)
  }

  async escalateByStaff(sessionId: string, reason: string, actor: { sub: string; role: UserRole }, now = new Date()) {
    if (actor.role !== 'staff' && actor.role !== 'admin') throw new ForbiddenException('Thiếu quyền.')
    const session = await this.chatSessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status === 'ESCALATED') return this.serializeSession(session)
    session.status = 'ESCALATED'
    session.escalationReason = reason
    session.escalatedAt = now
    session.escalatedByStaffId = this.toOid(actor.sub)
    await session.save()
    const ser = this.serializeSession(session)
    this.gateway.emitSessionUpdated(sessionId, { status: 'ESCALATED', escalatedAt: now, escalationReason: reason })
    // Broadcast notif staff/admin
    await this.broadcastStaffNotification({
      type: 'chat_escalated',
      title: '🔔 Nhân viên escalate 1 cuộc chat',
      body: `Người dùng ${actor.role} tự escalate cuộc chat khách ${this.guestLabel(session)}: ${this.truncate(reason, 80)}`,
      actionUrl: `/admin/customer-chat/${sessionId}`,
      entityType: 'chat_session',
      entityId: sessionId,
      priority: 'high',
      now,
    })
    return ser
  }

  // ==========================================================
  // PHASE 2 - Transfer + SLA + Dashboard KPI
  // ==========================================================

  async transferSession(dto: TransferSessionDto, actor: { sub: string; role: UserRole }, now = new Date()) {
    if (actor.role !== 'admin' && actor.role !== 'staff') throw new ForbiddenException('Thiếu quyền.')
    const session = await this.chatSessionModel.findById(dto.sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status === 'CLOSED') throw new BadRequestException('Session đã đóng.')
    // Staff chỉ chuyển các chat của mình thôi, admin được phép tất cả
    if (actor.role === 'staff' && String(session.assignedTo ?? '') !== actor.sub) {
      throw new ForbiddenException('Bạn chỉ được chuyển giao các chat bạn đang nhận xử lý.')
    }
    const target = await this.users.findById(dto.toStaffUserId)
    if (!target || (target.role !== 'staff' && target.role !== 'admin')) throw new BadRequestException('Nhân viên đích không hợp lệ.')
    session.assignedTo = this.toOid(dto.toStaffUserId)
    session.assignedAt = now
    await session.save()
    this.gateway.emitSessionUpdated(session.id, { assignedTo: session.assignedTo, assignedAt: now, assignedStaffName: target.name })

    // Notify staff mới nhận
    await this.notifications.create({
      recipientId: this.toOid(dto.toStaffUserId),
      recipientRole: target.role as any,
      type: 'chat_assigned_staff',
      title: '🔄 Chuyển giao hỗ trợ khách hàng',
      body: `Cuộc chat khách ${this.guestLabel(session)} được ${actor.role === 'admin' ? 'Admin' : 'Nhân viên'} chuyển giao cho bạn.${dto.reason ? `\nLý do: ${dto.reason}` : ''}`,
      channels: ['in_app', 'email'],
      actionUrl: `/admin/customer-chat/${session.id}`,
      entityType: 'chat_session',
      entityId: session.id,
      priority: 'high',
      senderUserId: this.toOid(actor.sub),
      now,
    })
    return this.serializeSession(session, { assignedStaffName: target.name })
  }

  async chatDashboardStats(q: ChatStatsDto) {
    // Trả về các số liệu cho card dashboard Admin Home
    const { from, to } = this.rangeFromDto(q)
    const createdFilter: any = {}
    if (from) createdFilter.createdAt = { $gte: from }
    if (to) {
      if (!createdFilter.createdAt) createdFilter.createdAt = {}
      createdFilter.createdAt.$lte = to
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      pendingPickup,       // ESCALATED chưa có owner (chờ nhân viên nhận)
      inProgress,          // đã có owner, chưa closed
      todayClosed,
      total,
      breachedToday,
    ] = await Promise.all([
      this.chatSessionModel.countDocuments({ status: 'ESCALATED', assignedTo: null, ...(from || to ? createdFilter : {}) }).exec(),
      this.chatSessionModel.countDocuments({ status: 'ESCALATED', assignedTo: { $ne: null }, ...(from || to ? createdFilter : {}) }).exec(),
      this.chatSessionModel.countDocuments({ status: 'CLOSED', closedAt: { $gte: todayStart } }).exec(),
      this.chatSessionModel.countDocuments({ ...(from || to ? createdFilter : {}) }).exec(),
      this.chatSessionModel.aggregate<any>([
        { $match: { status: { $in: ['ESCALATED'] }, escalatedAt: { $ne: null } } },
        {
          $project: {
            _id: 1,
            escalatedAt: 1,
            firstResponseAt: 1,
            lastCustomerMessageAt: 1,
            lastStaffMessageAt: 1,
            assignedTo: 1,
          }
        },
        { $limit: 1000 },
      ]).exec().then((rows: any[]) => {
        const nowT = Date.now()
        return rows.filter((r) => {
          // Breach pickup: escalated + chưa firstResponse + quá 5phút
          if (!r.firstResponseAt && r.escalatedAt) {
            const diff = (nowT - new Date(r.escalatedAt).getTime()) / 1000
            if (diff > CHAT_SLA_PICKUP_SECONDS) return true
          }
          return false
        }).length
      }),
    ])

    // TB first response của các session đã đóng trong ngày hôm nay
    const avgFirstResponse = await this.chatSessionModel.aggregate<any>([
      { $match: { status: 'CLOSED', firstResponseSeconds: { $gte: 0 } } },
      ...(from || to ? [{ $match: { closedAt: { $gte: from, $lte: to } } }] : [{ $match: { closedAt: { $gte: todayStart } } }]),
      { $group: { _id: null, avg: { $avg: '$firstResponseSeconds' }, total: { $sum: 1 } } },
      { $limit: 1 },
    ]).exec()

    // Top 5 nhân viên đóng nhiều nhất hôm nay
    const topStaffRows = await this.chatSessionModel.aggregate<any>([
      { $match: { status: 'CLOSED', closedByStaffId: { $ne: null } } },
      ...(from || to ? [{ $match: { closedAt: { $gte: from, $lte: to } } }] : [{ $match: { closedAt: { $gte: todayStart } } }]),
      { $group: { _id: '$closedByStaffId', closed: { $sum: 1 } } },
      { $sort: { closed: -1 } },
      { $limit: 5 },
    ]).exec()
    const topStaff: Array<{ staffId: string; staffName: string | null; closed: number }> = []
    for (const r of topStaffRows) {
      const u = await this.users.findById(r._id)
      topStaff.push({ staffId: r._id, staffName: u?.name ?? null, closed: r.closed })
    }

    // TB rating stars các session đã được rating trong khoảng
    const avgRating = await this.chatSessionModel.aggregate<any>([
      { $match: { ratingStars: { $gte: 1, $lte: 5 } } },
      ...(from || to ? [{ $match: { ratedAt: { $gte: from, $lte: to } } }] : []),
      { $group: { _id: null, avg: { $avg: '$ratingStars' }, total: { $sum: 1 } } },
      { $limit: 1 },
    ]).exec()

    return {
      pendingPickup,
      inProgress,
      todayClosed,
      total,
      breachedToday,
      avgFirstResponseSeconds: avgFirstResponse?.[0]?.avg ?? null,
      avgFirstResponseHuman: avgFirstResponse?.[0]?.avg ? this.humanDuration(Math.round(avgFirstResponse[0].avg)) : '—',
      avgRating: avgRating?.[0]?.avg ?? null,
      ratedCount: avgRating?.[0]?.total ?? 0,
      topStaff,
      range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
    }
  }

  async staffKpi(staffUserId: string, q: ChatStatsDto) {
    const { from, to } = this.rangeFromDto(q)
    const baseMatchAssigned = { assignedTo: this.toOid(staffUserId) } as any
    if (from) baseMatchAssigned.assignedAt = { $gte: from }
    if (to) baseMatchAssigned.assignedAt = baseMatchAssigned.assignedAt ? { ...baseMatchAssigned.assignedAt, $lte: to } : { $lte: to }

    const [
      assignedCount,
      closedCount,
      avgFirst,
      avgRating,
      breachedPickup,
      breachedReply,
    ] = await Promise.all([
      this.chatSessionModel.countDocuments(baseMatchAssigned).exec(),
      this.chatSessionModel.countDocuments({ assignedTo: this.toOid(staffUserId), status: 'CLOSED', ...(from || to ? { closedAt: { $gte: from, $lte: to } } : {}) }).exec(),
      this.chatSessionModel.aggregate<any>([
        { $match: { assignedTo: this.toOid(staffUserId), firstResponseSeconds: { $gte: 0 } } },
        ...(from || to ? [{ $match: { firstResponseAt: { $gte: from, $lte: to } } }] : []),
        { $group: { _id: null, avg: { $avg: '$firstResponseSeconds' }, n: { $sum: 1 } } },
        { $limit: 1 },
      ]).exec(),
      this.chatSessionModel.aggregate<any>([
        { $match: { assignedTo: this.toOid(staffUserId), ratingStars: { $gte: 1, $lte: 5 } } },
        ...(from || to ? [{ $match: { ratedAt: { $gte: from, $lte: to } } }] : []),
        { $group: { _id: null, avg: { $avg: '$ratingStars' }, n: { $sum: 1 } } },
        { $limit: 1 },
      ]).exec(),
      this.chatSessionModel.countDocuments({
        assignedTo: this.toOid(staffUserId),
        status: { $in: ['ESCALATED', 'CLOSED'] },
        firstResponseAt: { $ne: null },
        firstResponseSeconds: { $gt: CHAT_SLA_PICKUP_SECONDS },
        ...(from || to ? { escalatedAt: { $gte: from, $lte: to } } : {}),
      }).exec(),
      Promise.resolve(0), // TODO: breachedReply sẽ tính aggregate (tin khách gửi -> staff reply), để phase sau
    ])

    return {
      staffUserId,
      range: { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null },
      assignedCount,
      closedCount,
      avgFirstResponseSeconds: avgFirst?.[0]?.avg ?? null,
      avgFirstResponseHuman: avgFirst?.[0]?.avg ? this.humanDuration(Math.round(avgFirst[0].avg)) : null,
      avgRating: avgRating?.[0]?.avg ?? null,
      ratedCount: avgRating?.[0]?.n ?? 0,
      breachedPickupCount: breachedPickup,
      breachedReplyCount: breachedReply,
    }
  }

  // ==========================================================
  // PHASE 3 - Rating + Thank You Voucher + Auto Close
  // ==========================================================

  async submitRating(dto: SubmitRatingDto, now = new Date()) {
    const session = await this.chatSessionModel.findById(dto.sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (dto.guestEmail && session.guestEmail && dto.guestEmail.trim().toLowerCase() !== session.guestEmail.trim().toLowerCase()) {
      throw new BadRequestException('Email xác nhận không khớp.')
    }
    if (session.ratingStars) throw new BadRequestException('Session đã được đánh giá trước đó.')
    session.ratingStars = dto.ratingStars
    session.ratingComment = dto.ratingComment?.trim() || null
    session.ratedAt = now
    await session.save()
    this.gateway.emitSessionUpdated(session.id, { ratingStars: dto.ratingStars, ratingComment: session.ratingComment, ratedAt: now })

    // Notify staff assigned
    if (session.assignedTo) {
      const staff = await this.users.findById(this.toOid(session.assignedTo).toHexString())
      this.notifications.create({
        recipientId: this.toOid(session.assignedTo),
        recipientRole: staff?.role === 'admin' ? 'admin' : 'staff',
        type: 'chat_rating_received',
        title: '⭐ Khách hàng đánh giá cuộc chat của bạn',
        body: `Khách ${this.guestLabel(session)} đánh giá ${dto.ratingStars}⭐${dto.ratingComment ? `\nBình luận: ${dto.ratingComment}` : ''}`,
        channels: ['in_app'],
        actionUrl: `/admin/customer-chat/${session.id}`,
        entityType: 'chat_session',
        entityId: session.id,
        priority: 'medium',
        now,
      }).catch(() => {})
    }
    // Notify admin tổng thể
    this.broadcastStaffNotification({
      type: 'chat_rating_received',
      title: '⭐ Đánh giá mới từ khách hàng',
      body: `Khách ${this.guestLabel(session)} ⭐${dto.ratingStars}${dto.ratingComment ? `: ${this.truncate(dto.ratingComment, 70)}` : ''}`,
      actionUrl: `/admin/customer-chat/${session.id}`,
      entityType: 'chat_session',
      entityId: session.id,
      priority: 'low',
      now,
      onlyAdmin: true,
    }).catch(() => {})
    return { ok: true, ratingStars: dto.ratingStars }
  }

  /**
   * Close các session đã hơn 24h không có hoạt động (chạy cron job hoặc gọi thủ công hàng ngày)
   */
  async closeIdleSessionsOlderThan24h(now = new Date()) {
    const cutoff = new Date(now.getTime() - 24 * 3600 * 1000)
    const docs = await this.chatSessionModel.find({
      status: { $ne: 'CLOSED' },
      updatedAt: { $lt: cutoff },
    }).select('_id').lean().exec()
    let closed = 0
    for (const d of docs) {
      try {
        await this.chatSessionModel.updateOne({ _id: d._id }, {
          $set: { status: 'CLOSED', closedAt: now, closedReason: 'customer_idle_timeout' },
        })
        this.gateway.emitSessionUpdated(d._id, { status: 'CLOSED', closedAt: now, closedReason: 'customer_idle_timeout' })
        closed++
      } catch (_) { /* ignore */ }
    }
    return { closed, totalScanned: docs.length }
  }

  /**
   * Gửi cảm ơn + mã giảm giá 5% cho các khách đã đóng chat hơn 24 giờ & chưa nhận voucher (voucher -> có thể tích hợp promotions sau)
   * Phase 3 - demo, chưa tích hợp thật với promotions module.
   */
  async sendThankYouForClosedChats(now = new Date()) {
    const from24hAgo = new Date(now.getTime() - 24 * 3600 * 1000)
    const from48hAgo = new Date(now.getTime() - 48 * 3600 * 1000)
    const rows = await this.chatSessionModel.find({
      status: 'CLOSED',
      closedAt: { $gte: from48hAgo, $lte: from24hAgo },
      guestEmail: { $ne: null },
      closedReason: { $nin: ['auto_closed_24h', 'customer_idle_timeout'] },
    }).lean().exec()
    let sent = 0
    for (const r of rows) {
      if (!r.guestEmail) continue
      try {
        await this.notifications.create({
          recipientId: r.userId ? this.toOid(r.userId) : new Types.ObjectId(),
          recipientRole: 'customer',
          type: 'chat_rating_received', // tạm dùng, nhưng thực tế nên tạo mới chat_thankyou_voucher -> để tùy chỉnh sau, PHASE 3 tạm.
          title: '🙏 Cảm ơn bạn đã trải nghiệm dịch vụ hỗ trợ của VietNam Explorer!',
          body: `Xin chào ${this.guestLabel(r)},\nCảm ơn bạn đã sử dụng chat hỗ trợ của VietNam Explorer!\n🎁 Nhân dịp này chúng tôi gửi bạn mã giảm giá 5%: VNEX-CS5P17.\nÁp dụng cho booking tour hoặc thuê xe trong 7 ngày tới.`,
          channels: ['email'],
          entityType: 'chat_session',
          entityId: r._id,
          actionUrl: `/`,
          priority: 'low',
          now,
        })
        sent++
      } catch (_) { /* ignore */ }
    }
    return { sent, eligible: rows.length, voucherCode: 'VNEX-CS5P17' }
  }

  // ==========================================================
  // Helpers
  // ==========================================================

  private async doEscalate(sessionId: string, session: ChatSession, reason: string, escalatedByStaffId: string | null, now: Date) {
    const patch: any = {
      status: 'ESCALATED' as ChatStatus,
      escalationReason: reason,
      escalatedAt: now,
    }
    if (escalatedByStaffId) patch.escalatedByStaffId = this.toOid(escalatedByStaffId)
    await this.chatSessionModel.updateOne({ _id: sessionId }, { $set: patch })
    this.gateway.emitSessionUpdated(sessionId, { status: 'ESCALATED', escalatedAt: now, escalationReason: reason })

    // Gửi broad notif cho staff + admin
    await this.broadcastStaffNotification({
      type: 'chat_escalated',
      title: '🔔 Yêu cầu hỗ trợ khách hàng mới cần xử lý',
      body: `Lý do: ${reason}\nKhách: ${this.guestLabel(session)}${session.guestPhone ? ` · SĐT: ${session.guestPhone}` : ''}\nVui lòng vào trang quản lý chat để nhận xử lý trong vòng 5 phút.`,
      actionUrl: `/admin/customer-chat?onlyUnassigned=1`,
      entityType: 'chat_session',
      entityId: sessionId,
      priority: 'urgent',
      now,
    })
  }

  private async broadcastStaffNotification(input: Omit<CreateNotificationInput, 'recipientId' | 'recipientRole'> & { onlyAdmin?: boolean }) {
    const role = input.onlyAdmin ? 'admin' : undefined
    const { items } = await this.users.adminListUsers({ role: role as any, page: 1, limit: 500 })
    const results: any[] = []
    for (const u of items) {
      if (u.role !== 'admin' && u.role !== 'staff') continue
      if (!u.isActive) continue
      results.push(this.notifications.create({
        recipientId: this.toOid(u._id ?? u.id),
        recipientRole: u.role as any,
        ...input,
      } as CreateNotificationInput).catch((e) => this.logger.warn(`notif to ${u._id} failed: ${(e as Error).message}`)))
    }
    await Promise.all(results)
  }

  private toOid(v: any): Types.ObjectId {
    if (!v) return new Types.ObjectId()
    return v instanceof Types.ObjectId ? v : new Types.ObjectId(String(v))
  }

  private truncate(s: string, n = 80): string {
    const t = (s || '').replace(/\s+/g, ' ').trim()
    return t.length > n ? t.slice(0, n) + '…' : t
  }

  private guestLabel(s: { guestName?: string | null; guestEmail?: string | null; guestPhone?: string | null }) {
    const parts: string[] = []
    if (s.guestName) parts.push(s.guestName)
    if (s.guestPhone) parts.push(s.guestPhone)
    if (s.guestEmail && parts.length === 0) parts.push(s.guestEmail)
    return parts.length ? parts.join(' · ') : '(Khách vãng lai)'
  }

  private async assignedStaffName(assignedTo: any): Promise<string | null> {
    if (!assignedTo) return null
    try {
      const u = await this.users.findById(this.toOid(assignedTo).toHexString())
      return u?.name ?? null
    } catch (_) { return null }
  }

  private rangeFromDto(q: ChatStatsDto) {
    const from = q.fromDate ? new Date(q.fromDate) : null
    const to = q.toDate ? new Date(q.toDate) : null
    return { from, to }
  }

  humanDuration(totalSeconds: number): string {
    if (totalSeconds == null || isNaN(totalSeconds)) return '—'
    const s = Math.max(0, Math.floor(totalSeconds))
    if (s < 60) return `${s} giây`
    const m = Math.floor(s / 60), sec = s % 60
    if (m < 60) return `${m} phút${sec ? ' ' + sec + 's' : ''}`
    const h = Math.floor(m / 60), min = m % 60
    return `${h} giờ${min ? ' ' + min + 'phút' : ''}`
  }

  /**
   * Tính toán SLA status cho 1 session
   */
  computeSlaStatus(session: ChatSession | any): 'within_sla' | 'breached_pickup' | 'breached_reply' | 'unknown' {
    try {
      const nowT = Date.now()
      if (session.status !== 'ESCALATED') return 'within_sla'
      if (!session.escalatedAt) return 'unknown'
      const escAt = new Date(session.escalatedAt).getTime()
      const firstAt = session.firstResponseAt ? new Date(session.firstResponseAt).getTime() : null

      // Breach pickup: chưa có firstResponseAt và quá 5phút kể từ escalated
      if (!firstAt) {
        if (nowT - escAt > CHAT_SLA_PICKUP_SECONDS * 1000) return 'breached_pickup'
        return 'within_sla'
      }
      // Breach reply: cuối cùng khách gửi tin và cuối cùng staff trả lời gap > 3phút
      if (session.lastCustomerMessageAt && session.lastStaffMessageAt) {
        const lc = new Date(session.lastCustomerMessageAt).getTime()
        const ls = new Date(session.lastStaffMessageAt).getTime()
        if (lc > ls && nowT - lc > CHAT_SLA_REPLY_SECONDS * 1000) return 'breached_reply'
      } else if (session.lastCustomerMessageAt) {
        const lc = new Date(session.lastCustomerMessageAt).getTime()
        if (nowT - lc > CHAT_SLA_REPLY_SECONDS * 1000) return 'breached_reply'
      }
      return 'within_sla'
    } catch { return 'unknown' }
  }

  private serializeSession(session: ChatSession | any, extra: { assignedStaffName?: string | null } = {}): any {
    const sla = this.computeSlaStatus(session)
    return {
      id: (session._id ?? session.id)?.toString?.() ?? session.id,
      userId: session.userId ? String(session.userId) : null,
      guestName: session.guestName ?? null,
      guestEmail: session.guestEmail ?? null,
      guestPhone: session.guestPhone ?? null,
      status: session.status,
      assignedTo: session.assignedTo ? String(session.assignedTo) : null,
      assignedAt: session.assignedAt ?? null,
      assignedStaffName: extra.assignedStaffName ?? (session.assignedTo ? null : null),
      escalationReason: session.escalationReason ?? null,
      escalatedAt: session.escalatedAt ?? null,
      escalatedByStaffId: session.escalatedByStaffId ? String(session.escalatedByStaffId) : null,
      firstResponseAt: session.firstResponseAt ?? null,
      firstResponseSeconds: session.firstResponseSeconds ?? null,
      firstResponseHuman: session.firstResponseSeconds != null ? this.humanDuration(session.firstResponseSeconds) : null,
      lastCustomerMessageAt: session.lastCustomerMessageAt ?? null,
      lastStaffMessageAt: session.lastStaffMessageAt ?? null,
      ratingStars: session.ratingStars ?? null,
      ratingComment: session.ratingComment ?? null,
      ratedAt: session.ratedAt ?? null,
      closedAt: session.closedAt ?? null,
      closedReason: session.closedReason ?? null,
      closedByStaffId: session.closedByStaffId ? String(session.closedByStaffId) : null,
      customerMessagesCount: session.customerMessagesCount ?? 0,
      staffMessagesCount: session.staffMessagesCount ?? 0,
      botMessagesCount: session.botMessagesCount ?? 0,
      slaStatus: sla,
      slaBreached: sla === 'breached_pickup' || sla === 'breached_reply',
      slaLabel:
        sla === 'breached_pickup' ? `Quá ${Math.round(CHAT_SLA_PICKUP_SECONDS / 60)}ph nhận xử lý` :
          sla === 'breached_reply' ? `Quá ${Math.round(CHAT_SLA_REPLY_SECONDS / 60)}ph phản hồi` :
            sla === 'within_sla' ? 'Trong SLA' : 'Không xác định',
      slaWaitSeconds:
        sla === 'breached_pickup' && session.escalatedAt && !session.firstResponseAt
          ? Math.max(0, Math.floor((Date.now() - new Date(session.escalatedAt).getTime()) / 1000))
          : null,
      createdAt: session.createdAt ?? null,
      updatedAt: session.updatedAt ?? null,
    }
  }

  private serializeMessage(m: ChatMessage | any): any {
    return {
      id: (m._id ?? m.id)?.toString?.() ?? m.id,
      sessionId: String(m.sessionId),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt ?? null,
      toolCalls: m.toolCalls ?? null,
      toolResult: m.toolResult ?? null,
      senderStaffId: null, // phase 3: có thể save staffId gốc; hiện tại dùng role STAFF để check
    }
  }

  private async getOrCreateSession(dto: SendMessageDto) {
    if (dto.sessionId) {
      const existing = await this.chatSessionModel.findById(dto.sessionId)
      if (existing) {
        // Cập nhật userId nếu có truyền (ví dụ: customer login và đồng bộ)
        if (dto.userId && !existing.userId) {
          existing.userId = this.toOid(dto.userId)
          await existing.save()
        }
        return existing
      }
    }
    return this.chatSessionModel.create({
      userId: dto.userId ? this.toOid(dto.userId) : null,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      guestPhone: dto.guestPhone,
      status: 'BOT',
      customerMessagesCount: 0,
      staffMessagesCount: 0,
      botMessagesCount: 0,
    })
  }

  private async saveMessage(sessionId: string, role: ChatRole, content: string, createdAt?: Date): Promise<ChatMessage> {
    const patch: any = { sessionId: this.toOid(sessionId), role, content }
    if (createdAt) patch.createdAt = createdAt
    const doc = new this.chatMessageModel(patch)
    await doc.save()
    if (role === 'ASSISTANT') {
      await this.chatSessionModel.updateOne({ _id: sessionId }, { $inc: { botMessagesCount: 1 } })
    }
    return doc
  }

  private async saveToolCall(sessionId: string, toolName: string, args: any, result: any) {
    return this.chatMessageModel.create({
      sessionId: this.toOid(sessionId),
      role: 'ASSISTANT',
      content: `[gọi tool: ${toolName}]`,
      toolCalls: args,
      toolResult: result,
    })
  }

  private async callGeminiWithRetry(contents: Content[], attempt = 1): Promise<any> {
    try {
      return await this.ai.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }],
          temperature: 0.3,
        },
      })
    } catch (err) {
      if (attempt < 2 && this.isRateLimitError(err)) {
        await new Promise((r) => setTimeout(r, 2000))
        return this.callGeminiWithRetry(contents, attempt + 1)
      }
      throw err
    }
  }

  private isRateLimitError(err: unknown): boolean {
    const msg = (err as Error)?.message ?? ''
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')
  }

  private async getHistoryForModel(sessionId: string, limit = 20): Promise<Content[]> {
    const rows = await this.chatMessageModel
      .find({ sessionId: this.toOid(sessionId), role: { $in: ['USER', 'ASSISTANT', 'STAFF'] } })
      .sort({ createdAt: 1 })
      .limit(limit)

    return rows.map((r) => ({
      role: r.role === 'USER' ? 'user' : 'model',
      parts: [{ text: r.content }],
    }))
  }
}
