import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
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
  UpdateGuestInfoDto,
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
// ✅ A2: Giới hạn thời gian chờ tối đa cho 1 lượt gọi Gemini API (phòng mạng chậm / Google treo → user không chờ lâu)
const GEMINI_CALL_TIMEOUT_MS = 20_000
// Thời gian retry lại sau khi gặp rate limit
const GEMINI_RATE_LIMIT_RETRY_MS = 1_500
// Thời gian giới hạn toàn bộ loop AI (all tool loops) → nếu vượt quá → escalate ngay, không đợi
const OVERALL_AI_TIMEOUT_MS = 45_000

// Classify lỗi Gemini trả về → loại message tương ứng cho khách
type GeminiErrorKind =
  | 'api_key_missing_or_invalid'
  | 'timeout'
  | 'rate_limit'
  | 'auth_permission_denied'
  | 'network_or_server'
  | 'unknown'

// SLA defaults (PICKUP = thời gian staff nhận xử lý kể từ khi escalate; REPLY = thời gian phản hồi tin nhắn sau khi khách gửi)
export const CHAT_SLA_PICKUP_SECONDS = 5 * 60 // 5 phút
export const CHAT_SLA_REPLY_SECONDS = 3 * 60 // 3 phút

export type ChatSessionListItem = ReturnType<ChatService['serializeSession']> extends infer T ? T : any

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly ai: GoogleGenAI
  /**
   * ✅ H4: Cache ghi nhớ các session đã emit cảnh báo breached (để không emit spam cùng 1 thông báo mỗi 30s)
   *   Key = `${sessionId}:${breachedType}`
   */
  private readonly breachNotifCache = new Map<string, number>()

  constructor(
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSession>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    private readonly tools: ChatToolsService,
    private readonly notifications: NotificationsService,
    private readonly users: UsersService,
    private readonly gateway: ChatGateway,
  ) {
    // ✅ A3 + A4: Pre-validate GEMINI API key ở constructor (early warn + log chi tiết dev không phải đợi request đi mới biết)
    const k = (process.env.GEMINI_API_KEY || '').trim()
    if (!k) {
      this.logger.error(`[CHAT-AI] ⚠️  ENV GEMINI_API_KEY KHÔNG ĐƯỢC CẤU HÌNH. AI BOT SẼ LUÔN BỊ LỖI VÀ TỰ ESCALATE CHO NHÂN VIÊN. Cần set env GEMINI_API_KEY trong file .env backend.`)
    } else if (k.length < 20 || k.includes('your-key') || k.includes('xxx') || k.includes('YOUR_')) {
      this.logger.warn(`[CHAT-AI] ⚠️  ENV GEMINI_API_KEY trông như placeholder (${k.length} ký tự, prefix '${k.slice(0, 5)}...'). AI có thể trả về lỗi PermissionDenied. Hãy kiểm tra key thật từ Google AI Studio.`)
    } else {
      this.logger.log(`[CHAT-AI] ✅ Đã khởi tạo GoogleGenAI client, model=${MODEL}. Key prefix '${k.slice(0, 6)}...' OK.`)
    }
    this.ai = new GoogleGenAI({ apiKey: k })
  }

  // ✅ A2: Promise generic timeout wrapper - reject sau ms miliseconds nếu promise gốc chưa resolve
  private promiseWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let timer: any
    const timeoutP = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error(`GEMINI_TIMEOUT_${label}_${ms}ms`)), ms)
    })
    return Promise.race([p, timeoutP]).finally(() => clearTimeout(timer))
  }

  // ✅ A3: Phân loại chi tiết lỗi Gemini trả về → trả kind rõ ràng để handle riêng
  private classifyGeminiError(err: unknown): GeminiErrorKind {
    const msg = String((err as any)?.message ?? (err as any)?.error?.message ?? err).toLowerCase()
    if (msg.includes('api key') || msg.includes('api_key') || msg.includes('authentication') || msg.includes('invalid_argument') && msg.includes('key') || !process.env.GEMINI_API_KEY?.trim()) {
      return 'api_key_missing_or_invalid'
    }
    if (msg.includes('gemini_timeout') || msg.includes('timeout') || msg.includes('deadline_exceeded')) {
      return 'timeout'
    }
    if (this.isRateLimitError(err)) return 'rate_limit'
    if (msg.includes('permission') || msg.includes('403') || msg.includes('401') || msg.includes('unauthorized') || msg.includes('denied')) {
      return 'auth_permission_denied'
    }
    if (msg.includes('network') || msg.includes('econnreset') || msg.includes('enotfound') || msg.includes('etimedout') || msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504') || msg.includes('server')) {
      return 'network_or_server'
    }
    return 'unknown'
  }

  // ✅ A4: Friendly message cho khách theo từng loại lỗi (rõ ràng, không câu chung chung "hệ thống gặp sự cố")
  private aiFailureToCustomerMessage(kind: GeminiErrorKind): string {
    switch (kind) {
      case 'api_key_missing_or_invalid':
        return '⚠️ Bot AI tạm thời đang bảo trì cấu hình. Mình đã chuyển cuộc hội thoại này cho bộ phận CSKH để nhân viên hỗ trợ bạn trực tiếp trong vòng 5 phút nhé. Xin lỗi vì sự bất tiện này 🙏'
      case 'timeout':
        return '⏳ Bot đang phản hồi lâu hơn dự kiến do có nhiều khách cùng chat. Mình đã chuyển yêu cầu của bạn sang nhân viên hỗ trợ trong giây lát. Bạn vui lòng chờ ít phút nhé 😊'
      case 'rate_limit':
        return '📶 Hiện tại có quá nhiều khách hàng sử dụng bot cùng lúc (quá tải). Mình đã chuyển bạn vào hàng đợi nhân viên, sẽ có người liên hệ ngay ạ.'
      case 'auth_permission_denied':
        return '🔐 Bot tạm thời không thể truy cập dữ liệu. Mình đã nhắc nhân viên CSKH hỗ trợ bạn trực tiếp, bạn vui lòng chờ ít phút ạ 🙇'
      case 'network_or_server':
        return '🌐 Có lỗi đường truyền tới hệ thống AI. Mình đã chuyển yêu cầu sang nhân viên, sẽ có người phản hồi bạn nhanh nhất có thể ạ.'
      case 'unknown':
      default:
        return '🤖 Mình chưa trả lời được ngay. Không sao, mình đã nhắn tin nhắc nhân viên hỗ trợ bạn trong 5 phút nhé.'
    }
  }

  /**
   * ✅ H4: Cron 30 giây quét toàn bộ session ESCALATED → tự kiểm tra SLA và cập nhật realtime
   *   - Gọi computeSlaStatus() với current time mới nhất
   *   - Nếu phát hiện breach (chưa từng emit) → emit WS `chat:session-updated` để badge đỏ xuất hiện tự động
   *   - Đồng thời push in-app notification khẩn cấp cho nhân viên owner (nếu có)
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async cronRecheckAndBroadcastSlaBreaches() {
    try {
      if (!process.env || process.env['DISABLE_CHAT_SLA_CRON'] === '1') return
      const nowT = Date.now()
      // Quét các session ESCALATED chưa đóng, có escalatedAt hợp lệ
      const sessions = await this.chatSessionModel
        .find({
          status: 'ESCALATED',
          escalatedAt: { $ne: null },
        })
        .select(
          '_id assignedTo escalatedAt firstResponseAt lastCustomerMessageAt lastStaffMessageAt status userId guestName',
        )
        .lean()
        .exec()

      for (const session of sessions) {
        const before = this.computeSlaStatus(session as any)
        const after = this.computeSlaStatus(session as any) // compute đúng với nowT = Date.now() internal
        // Trường hợp đặc biệt: force kiểm tra với giờ hiện tại
        const fakeNow = {
          ...session,
          __forceNowT: nowT,
        }
        const slaFinal = this.computeSlaStatus({
          ...fakeNow,
          status: session.status,
          escalatedAt: session.escalatedAt,
          firstResponseAt: session.firstResponseAt,
          lastCustomerMessageAt: session.lastCustomerMessageAt,
          lastStaffMessageAt: session.lastStaffMessageAt,
        } as any)

        if (slaFinal === 'breached_pickup' || slaFinal === 'breached_reply') {
          // ✅ Idempotent: chỉ emit 1 lần / 1 loại breach (mỗi 10 phút mới cảnh báo lại)
          const cacheKey = `${String(session._id)}:${slaFinal}`
          const lastEmitted = this.breachNotifCache.get(cacheKey) ?? 0
          if (nowT - lastEmitted < 10 * 60 * 1000) continue
          this.breachNotifCache.set(cacheKey, nowT)
          // Làm sạch cache nếu quá 24h không emit
          if (this.breachNotifCache.size > 5000) this.breachNotifCache.clear()

          const breachedLabel =
            slaFinal === 'breached_pickup'
              ? `Quá ${Math.round(CHAT_SLA_PICKUP_SECONDS / 60)}ph nhận xử lý`
              : `Quá ${Math.round(CHAT_SLA_REPLY_SECONDS / 60)}ph phản hồi`
          const patch: any = {
            slaStatus: slaFinal,
            slaBreached: true,
            slaLabel: breachedLabel,
            slaWaitSeconds:
              slaFinal === 'breached_pickup' && session.escalatedAt && !session.firstResponseAt
                ? Math.max(0, Math.floor((nowT - new Date(session.escalatedAt).getTime()) / 1000))
                : null,
          }
          this.gateway.emitSessionUpdated(String(session._id), patch)

          // Đồng thời push NOTIF cho staff owner (nếu assignedTo có)
          try {
            if (session.assignedTo) {
              const title =
                slaFinal === 'breached_pickup'
                  ? '🔴 SLA: Chưa nhận xử lý chat khách'
                  : '🔴 SLA: Chưa phản hồi tin nhắn khách'
              const body =
                slaFinal === 'breached_pickup'
                  ? `Cuộc chat của khách ${(session as any).guestName ? (session as any).guestName : 'vãng lai'} đã quá ${Math.round(CHAT_SLA_PICKUP_SECONDS / 60)}ph chưa được bạn nhận xử lý. Hãy vào nhận ngay.`
                  : `Khách gửi tin nhắn đã quá ${Math.round(CHAT_SLA_REPLY_SECONDS / 60)}ph chưa được bạn trả lời. Hãy phản hồi ngay.`
              await this.notifications.create({
                recipientId: this.toOid(session.assignedTo),
                recipientRole: 'staff',
                type: slaFinal === 'breached_pickup' ? 'chat_sla_pickup_breached' : 'chat_sla_reply_breached',
                title,
                body,
                actionUrl: `/admin/customer-chat/${session._id}`,
                entityType: 'chat_session',
                entityId: String(session._id),
                priority: 'urgent',
                now: new Date(nowT),
              } as CreateNotificationInput)
            } else {
              // Chưa assign → broad cho toàn bộ staff/admin cảnh báo 1 cuộc chat rảnh chưa ai nhận đã breach
              await this.broadcastStaffNotification({
                type: 'chat_sla_pickup_breached_unassigned',
                title: '🔴 SLA KHẨN CẤP: Chat chờ nhận đã quá hạn',
                body: `Cuộc chat khách ${(session as any).guestName ? (session as any).guestName : 'vãng lai'} đã quá ${Math.round(CHAT_SLA_PICKUP_SECONDS / 60)}ph chưa ai nhận xử lý. Hãy vào nhận ngay để đảm bảo SLA.`,
                actionUrl: `/admin/customer-chat/${session._id}`,
                entityType: 'chat_session',
                entityId: String(session._id),
                priority: 'urgent',
                now: new Date(nowT),
              }).catch((e) => this.logger.warn(`Broad SLA unassigned failed: ${(e as Error).message}`))
            }
          } catch (e) {
            this.logger.warn(`SLA notif push failed: ${(e as Error).message}`)
          }
          this.logger.debug(`[SLA] ${slaFinal} session=${session._id} broadcast + push`)
        }
      }
    } catch (err) {
      this.logger.warn(`[SLA] cronRecheckAndBroadcastSlaBreaches failed: ${(err as Error).message}`)
    }
  }

  // ==========================================================
  // PHASE 1 - CUSTOMER PUBLIC: Chat với bot + escalate
  // ==========================================================
  async handleMessage(dto: SendMessageDto) {
    const session = await this.getOrCreateSession(dto)
    const sessionId = (session._id as Types.ObjectId).toString()
    const now = new Date()

    // ✅ AI-2: Dùng MongoDB atomic $inc cho counter (tránh race condition 2 tin đồng thời cùng update dùng $set cũ value)
    //    + tách riêng $set cho các field chỉ cập nhật 1 lần (guestName/guestEmail/guestPhone)
    const incOps: Record<string, any> = { customerMessagesCount: 1 }
    const setOnlyOnce: Record<string, any> = { lastCustomerMessageAt: now }
    if (dto.guestName && !session.guestName) setOnlyOnce.guestName = dto.guestName.trim()
    if (dto.guestEmail && !session.guestEmail) setOnlyOnce.guestEmail = dto.guestEmail.trim()
    if (dto.guestPhone && !session.guestPhone) setOnlyOnce.guestPhone = dto.guestPhone.trim()
    // Atomic update: $inc + $set chạy cùng 1 truy vấn, MongoDB độc lập tăng counter tự động khóa row
    await this.chatSessionModel.updateOne(
      { _id: sessionId },
      {
        $inc: incOps,
        $set: setOnlyOnce,
      },
    )

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

    // ✅ A2 + A4: Early guard - nếu KEY invalid → skip hoàn toàn AI loop, trực tiếp escalate 0s delay (không cho user chờ 20s rồi mới báo lỗi)
    const apiKeyOk = Boolean((process.env.GEMINI_API_KEY || '').trim()) && !(process.env.GEMINI_API_KEY as string).includes('xxx')
    const aiStartedAt = Date.now()
    if (!apiKeyOk) {
      this.logger.error(`[CHAT-AI] [S=${sessionId}] Bỏ qua loop AI vì GEMINI_API_KEY chưa cấu hình hợp lệ → escalate cho nhân viên ngay.`)
      const fallbackReason = `Bot AI bị tạm ngưng do lỗi cấu hình`
      await this.doEscalate(sessionId, session, fallbackReason, null, now)
      const friendly = this.aiFailureToCustomerMessage('api_key_missing_or_invalid')
      const m = await this.saveMessage(sessionId, 'ASSISTANT', friendly)
      this.gateway.emitNewMessage(sessionId, this.serializeMessage(m))
      return { sessionId, status: 'ESCALATED' as ChatStatus, reply: friendly, assignedStaffName: null }
    }

    // (b) Khởi tạo vòng lặp AI + helper escalate dùng chung (bỏ trùng 4 chỗ)
    let loops = 0
    let escalated = false
    let escalationReason = ''
    const initHistory: any[] = []
    const sessAny = session as any
    if (sessAny.aiHistory && Array.isArray(sessAny.aiHistory) && sessAny.aiHistory.length > 0) {
      initHistory.push(...(sessAny.aiHistory as any[]))
    }
    const customerPrompt = `Khách: ${dto.message}`
    initHistory.push({
      role: 'user',
      parts: [{ text: customerPrompt }],
    })
    const contents: any[] = [...initHistory]

    // Helper DRY: TẤT CẢ path escalate đều dùng này → KHÔNG bỏ sót push notif cho staff nữa
    const escalateWithPushNotif = async (reason: string, fallbackMessageForCustomer: string) => {
      await this.doEscalate(sessionId, session, reason, null, now)
      // Luôn luôn push notif cho staff (tất cả case escalate từ AI path - không bỏ sót)
      try {
        await this.broadcastStaffNotification({
          type: session.assignedTo ? 'chat_new_customer_message' : 'chat_sla_pickup_breached_unassigned',
          priority: 'high',
          title: session.assignedTo ? '📩 Khách hàng chờ phản hồi - AI đã escalate' : '🤖 AI BOT ĐÃ TỰ ESCALATE - khách chờ hỗ trợ',
          body: `Lý do: ${this.truncate(reason, 110)} - Khách ${this.guestLabel(session)} hỏi: "${this.truncate(dto.message, 60)}"`,
          actionUrl: `/admin/customer-chat/${sessionId}`,
          entityType: 'chat_session',
          entityId: sessionId,
          now,
        })
      } catch (e) {
        this.logger.warn(`Escalate from AI path push notif failed: ${(e as Error).message}`)
      }
      if (fallbackMessageForCustomer?.trim()) {
        const fm = await this.saveMessage(sessionId, 'ASSISTANT', fallbackMessageForCustomer.trim())
        this.gateway.emitNewMessage(sessionId, this.serializeMessage(fm))
      }
    }

    while (loops < MAX_TOOL_LOOPS) {
      loops++
      // ✅ A2: Giới hạn TỔNG thời gian xử lý AI (sum tất cả tool loops) ≤ 45s
      if (Date.now() - aiStartedAt > OVERALL_AI_TIMEOUT_MS) {
        this.logger.warn(`[CHAT-AI] [S=${sessionId}] ⏱ Tổng thời gian AI vượt quá ${OVERALL_AI_TIMEOUT_MS}ms → escalate nhân viên.`)
        escalationReason = `Bot phản hồi quá lâu (>${Math.round(OVERALL_AI_TIMEOUT_MS / 1000)}s), tự động chuyển nhân viên`
        break
      }
      let response
      try {
        response = await this.callGeminiWithRetry(contents)
      } catch (err) {
        const kind = this.classifyGeminiError(err)
        this.logger.error(`[CHAT-AI] [S=${sessionId}] ❌ Loop=${loops} AI failed kind=${kind}: ${(err as Error).message}`)
        // ✅ A3 + A4: TẤT CẢ loại lỗi (trừ rate-limit đã retry 2 lần rồi) → tự ĐỔI TRẠNG THÁI ESCALATED luôn
        //    + ghi chi tiết reason (không để session status=OPEN nhưng bot chết)
        //    + push notif URGENT cho staff (lỗi AI → khách chờ)
        escalationReason = `AI bot gặp lỗi loại ${kind}: ${this.truncate(String((err as Error).message || ''), 80)}`
        const friendly = this.aiFailureToCustomerMessage(kind)
        await escalateWithPushNotif(escalationReason, friendly)
        return { sessionId, status: 'ESCALATED' as ChatStatus, reply: friendly, assignedStaffName: null }
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
        // ✅ AI-0: WRAP tools.execute với try-catch riêng từng tool (1 tool fail → không sập toàn loop)
        let result: any
        try {
          result = await this.tools.execute(call.name!, args)
        } catch (toolErr) {
          const toolErrMsg = (toolErr as Error)?.message || String(toolErr)
          this.logger.error(`[CHAT-AI] [S=${sessionId}] ❌ Tool ${call.name} THREW ERROR: ${toolErrMsg}`)
          // Tool lỗi → đánh dấu cần escalate (đừng sập cả loop AI), trả kết quả lỗi định dạng cho Gemini biết tool thất bại
          escalated = true
          escalationReason = `Tool ${call.name} bị lỗi: ${this.truncate(toolErrMsg, 90)}`
          result = {
            needEscalate: true,
            escalateReason: escalationReason,
            fallbackMessage: '⚠️ Xin lỗi, tính năng tra cứu này hiện đang tạm khóa. Mình đã báo đội ngũ kỹ thuật và chuyển bạn cho nhân viên hỗ trợ trực tiếp nhé 🙏',
            error: true,
            toolName: call.name,
          }
          // Đồng thời lưu 1 tin SYSTEM tool fail cho staff xem chi tiết (không show cho khách)
          await this.saveMessage(sessionId, 'SYSTEM', `[Tool log: ${call.name}] THẤT BẠI: ${this.truncate(toolErrMsg, 220)}`, now, { system: true })
        }
        if (call.name === 'escalateToStaff') {
          escalated = true
          escalationReason = (args as any).reason ?? 'Khách yêu cầu hỗ trợ thêm'
        }
        // ✅ H3: Tool trả về needEscalate=true (getBookingStatus/checkAvailability không nối được service thật)
        //     → tự động escalate thay vì chờ Gemini vòng 2
        if (result && typeof result === 'object' && (result as any).needEscalate === true) {
          escalated = true
          const r = result as any
          escalationReason = r.escalateReason
            ?? `Bot không thể xử lý ${call.name} yêu cầu của khách (cần nhân viên)`
          if (r.fallbackMessage && typeof r.fallbackMessage === 'string') {
            // Gửi luôn fallback message thân thiện cho khách (thay vì chờ nhân viên)
            const fmM = await this.saveMessage(sessionId, 'ASSISTANT', String(r.fallbackMessage))
            this.gateway.emitNewMessage(sessionId, this.serializeMessage(fmM))
          }
        }
        responseParts.push({
          functionResponse: { name: call.name!, response: { result } },
        })
        await this.saveToolCall(sessionId, call.name!, args, result)
      }

      contents.push({ role: 'user', parts: responseParts })

      if (escalated) {
        const reply = `Mình đã chuyển yêu cầu của bạn cho nhân viên hỗ trợ (lý do: ${escalationReason}). Bạn vui lòng chờ trong giây lát nhé.`
        await escalateWithPushNotif(escalationReason, reply)
        return {
          sessionId,
          status: 'ESCALATED' as ChatStatus,
          reply,
          assignedStaffName: null,
        }
      }
    }

    // Vượt quá tool loop (MAX_TOOL_LOOPS) HOẶC break do tổng timeout 45s
    // ✅ AI-1: Trước đây KHÔNG push notif → sửa dùng escalateWithPushNotif như mọi case khác
    const fallbackReason = escalationReason || 'Cần nhân viên hỗ trợ yêu cầu này (vượt giới hạn tool AI / timeout)'
    const fallback = 'Xin lỗi, mình cần nhân viên hỗ trợ thêm cho yêu cầu này. Bạn vui lòng chờ trong giây lát.'
    await escalateWithPushNotif(fallbackReason, fallback)
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

    let itemsSerialized: any[]
    let total: number

    // ✅ L5: Fix sai logic slaBreachedOnly filter SAU khi limit 20 → bỏ sót breached chat ở page sau.
    //    Chia 2 path:
    //    - Path 1 (nhanh): slaBreachedOnly=false → find + skip/limit như cũ (90% case thường dùng)
    //    - Path 2 (chính xác): slaBreachedOnly=true → Aggregate tính breach như M4, $match breached=true rồi sort+skip+limit
    if (!q.slaBreachedOnly) {
      const [rawItems, totalVal] = await Promise.all([
        this.chatSessionModel.find(filter).sort(sort as any).skip(skip).limit(limit).lean().exec(),
        this.chatSessionModel.countDocuments(filter).exec(),
      ])
      itemsSerialized = await Promise.all(rawItems.map((x) => this.serializeSession(x)))
      total = totalVal
    } else {
      const breachStage = {
        $cond: {
          if: { $eq: ['$status', 'CLOSED'] },
          then: false, // CLOSED ko tính breach trong list
          else: {
            $cond: {
              if: {
                $and: [
                  { $eq: ['$status', 'ESCALATED'] },
                  { $ne: ['$escalatedAt', null] },
                  { $eq: ['$firstResponseAt', null] },
                  { $gt: [{ $subtract: ['$$NOW', '$escalatedAt'] }, CHAT_SLA_PICKUP_SECONDS * 1000] },
                ],
              },
              then: true, // breach pickup
              else: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$firstResponseAt', null] },
                      { $ne: ['$lastCustomerMessageAt', null] },
                      {
                        $or: [
                          { $gt: ['$lastCustomerMessageAt', { $ifNull: ['$lastStaffMessageAt', new Date(0)] }] },
                          { $eq: ['$lastStaffMessageAt', null] },
                        ],
                      },
                      { $gt: [{ $subtract: ['$$NOW', '$lastCustomerMessageAt'] }, CHAT_SLA_REPLY_SECONDS * 1000] },
                    ],
                  },
                  then: true, // breach reply
                  else: false,
                },
              },
            },
          },
        },
      }
      const basePipeline: any[] = [
        { $match: filter },
        { $project: { doc: '$$ROOT', breached: breachStage } },
        { $match: { breached: true } },
      ]
      // Count total records match (trước skip limit)
      const [countRow] = await this.chatSessionModel.aggregate<any>([
        ...basePipeline,
        { $count: 'count' },
      ]).exec()
      total = countRow?.count ?? 0

      const rawRows = await this.chatSessionModel.aggregate<any>([
        ...basePipeline,
        { $replaceRoot: { newRoot: '$doc' } }, // restore toàn bộ document cho serializeSession
        { $sort: sort as any },
        { $skip: skip },
        { $limit: limit },
      ]).exec()
      itemsSerialized = await Promise.all(rawRows.map((x) => this.serializeSession(x)))
    }

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
      session: await this.serializeSession(session, { assignedStaffName: assignedStaff ? assignedStaff.name : null }),
      messages: messages.map((m) => this.serializeMessage(m)),
    }
  }

  async staffReply(sessionId: string, message: string, staffUserId: string) {
    const now = new Date()
    const session = await this.chatSessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')

    // ✅ AUD-CR1: KIỂM TRA OWNERSHIP — KHÔNG cho staff khác reply chat KHÔNG của mình (trừ ADMIN quyền hệ thống)
    const caller = await this.users.findById(staffUserId)
    if (!caller) throw new ForbiddenException('Tài khoản nhân viên không tồn tại.')
    const callerRole = ((caller as any).role as UserRole) || 'staff'
    const assignedOid = session.assignedTo ? String(this.toOid(session.assignedTo).toHexString()) : null
    const callerOid = String(this.toOid(staffUserId).toHexString())
    if (callerRole !== 'admin') {
      // Có người khác đã sở hữu → chặn hoàn toàn (chỉ assigned owner hoặc admin được reply)
      if (assignedOid && assignedOid !== callerOid) {
        throw new ForbiddenException(
          `Bạn không sở hữu chat này (đang được nhân viên khác xử lý). Vui lòng không can thiệp chat của đồng nghiệp.`,
        )
      }
    }

    // Nếu session chưa ESCALATED → tự động escalate (staff muốn can thiệp chat BOT)
    let autoEscalated = false
    if (session.status === 'BOT') {
      session.status = 'ESCALATED'
      session.escalationReason = session.escalationReason ?? 'Nhân viên chủ động hỗ trợ khách'
      session.escalatedAt = now
      // ✅ H2: Đánh dấu auto-escalate (không đưa vào avg firstResponse KPI)
      ;(session as any).autoEscalatedByStaff = true
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
    const firstResponsePatch: Record<string, any> = {}
    if (session.status === 'ESCALATED' && !session.firstResponseAt) {
      firstResponsePatch.firstResponseAt = now
      if (session.escalatedAt) {
        if ((session as any).autoEscalatedByStaff) {
          firstResponsePatch.firstResponseSeconds = null
        } else {
          firstResponsePatch.firstResponseSeconds = Math.max(
            0,
            Math.floor((now.getTime() - new Date(session.escalatedAt).getTime()) / 1000),
          )
        }
      }
      isFirstResponse = true
    }

    // ✅ AI-2: Thay vì `session.save()` (không atomic) → dùng updateOne atomic $set + $inc
    //   - Tất cả session field được update (status, assignedTo, escalated, firstResponseAt...)
    //   - staffMessagesCount dùng $inc 1 đơn vị (không race condition)
    const atomicPatch: Record<string, any> = {
      lastStaffMessageAt: now,
      ...(autoEscalated
        ? {
            status: 'ESCALATED',
            escalatedAt: now,
            escalationReason: session.escalationReason ?? 'Nhân viên chủ động hỗ trợ khách',
            autoEscalatedByStaff: true,
          }
        : {}),
      ...(session.assignedTo ? {} : { assignedTo: this.toOid(staffUserId), assignedAt: now }),
      ...firstResponsePatch,
    }
    await this.chatSessionModel.updateOne(
      { _id: sessionId },
      {
        $set: atomicPatch,
        $inc: { staffMessagesCount: 1 },
      },
    )
    // Đồng bộ lại object session cho các chỗ tham chiếu sau (serialization, notif create etc)
    Object.assign(session, atomicPatch, {
      staffMessagesCount: (session.staffMessagesCount || 0) + 1,
    })

    const m = await this.saveMessage(sessionId, 'STAFF', message, now, { createdByStaffId: staffUserId })

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
    return await this.serializeSession(session, { assignedStaffName: targetStaff.name })
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
    return await this.serializeSession(session, { assignedStaffName: staff?.name ?? null })
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
    return await this.serializeSession(session)
  }

  async escalateByStaff(sessionId: string, reason: string, actor: { sub: string; role: UserRole }, now = new Date()) {
    if (actor.role !== 'staff' && actor.role !== 'admin') throw new ForbiddenException('Thiếu quyền.')
    const session = await this.chatSessionModel.findById(sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status === 'ESCALATED') return await this.serializeSession(session)
    session.status = 'ESCALATED'
    session.escalationReason = reason
    session.escalatedAt = now
    session.escalatedByStaffId = this.toOid(actor.sub)
    await session.save()
    const ser = await this.serializeSession(session)
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
    return await this.serializeSession(session, { assignedStaffName: target.name })
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
      // ✅ M4: Breach pickup/reply TÍNH BẰNG AGGREGATE (hỗ trợ N triệu records, không giới hạn 1000)
      //    Loại bỏ $limit 1000 JS duyệt filter → dùng $expr + $cond tính breach
      this.chatSessionModel.aggregate<any>([
        { $match: { status: { $in: ['ESCALATED'] }, escalatedAt: { $ne: null } } },
        {
          $project: {
            _id: 1,
            breached: {
              $cond: {
                if: {
                  // CASE 1: chưa có firstResponse → kiểm tra breach pickup (> 5 phút kể từ escalatedAt)
                  $and: [
                    { $eq: ['$firstResponseAt', null] },
                    { $gt: [{ $subtract: ['$$NOW', '$escalatedAt'] }, CHAT_SLA_PICKUP_SECONDS * 1000] },
                  ],
                },
                then: true,
                // CASE 2: đã reply ít nhất 1 lần → kiểm tra breach reply (> 3 phút kể từ tin KH cuối chưa trả lời)
                else: {
                  $cond: {
                    if: {
                      $and: [
                        { $ne: ['$lastCustomerMessageAt', null] },
                        // lastCustomer nằm SAU lastStaff (hoặc chưa có lastStaff) → chưa trả lời tin KH cuối
                        {
                          $or: [
                            { $gt: ['$lastCustomerMessageAt', { $ifNull: ['$lastStaffMessageAt', new Date(0)] }] },
                            { $eq: ['$lastStaffMessageAt', null] },
                          ],
                        },
                        // thời gian tính từ tin KH cuối đến bây giờ > SLA_REPLY_SECONDS
                        { $gt: [{ $subtract: ['$$NOW', '$lastCustomerMessageAt'] }, CHAT_SLA_REPLY_SECONDS * 1000] },
                      ],
                    },
                    then: true,
                    else: false,
                  },
                },
              },
            },
          },
        },
        { $match: { breached: true } },
        { $count: 'count' },
      ]).exec().then((rows: any[]) => (rows[0]?.count ?? 0)),
    ])

    // TB first response của các session đã đóng trong ngày hôm nay
    // ✅ H2: Bỏ qua các session autoEscalatedByStaff=true (staff chủ động can thiệp chat BOT → firstResponse không có ý nghĩa KPI)
    const avgFirstResponse = await this.chatSessionModel.aggregate<any>([
      { $match: { status: 'CLOSED', firstResponseSeconds: { $ne: null, $gte: 0 }, autoEscalatedByStaff: { $ne: true } } },
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
        // ✅ H2: Staff KPI avgFirstResponse cũng lọc bỏ autoEscalatedByStaff (tương tự dashboard)
        { $match: { assignedTo: this.toOid(staffUserId), firstResponseSeconds: { $ne: null, $gte: 0 }, autoEscalatedByStaff: { $ne: true } } },
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
      // ✅ M5: breachedReplyCount KHÔNG hardcode 0 nữa
      // Tính bằng ChatMessage aggregate: mỗi lần customer gửi tin -> staff reply đó, nếu gap > 180s → breach 1 lần
      this.chatMessageModel.aggregate<any>([
        // 1) B1: Lọc những tin KHỎI tạo ra trong phạm vi staff này, có createdAt đúng khoảng thời gian
        {
          $match: {
            role: 'CUSTOMER' as any,
            $or: [{ system: { $ne: true } }, { system: null }],
            ...(from || to ? { createdAt: { $gte: from, ...(to ? { $lte: to } : {}) } } : {}),
          },
        },
        // 2) Tìm tin NHÂN VIÊN (role STAFF) sắp tới trong cùng sessionId, ngay sau tin customer đó
        {
          $lookup: {
            from: 'chat_messages',
            let: { sId: '$sessionId', custAt: '$createdAt' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$sessionId', '$$sId'] },
                      { $gt: ['$createdAt', '$$custAt'] },
                      { $or: [{ $eq: ['$role', 'STAFF'] }, { $eq: ['$role', 'ASSISTANT_STAFF'] }] },
                    ],
                  },
                },
              },
              { $sort: { createdAt: 1 } },
              { $limit: 1 },
              { $project: { createdAt: 1, createdByStaffId: 1 } },
            ],
            as: 'staffReply',
          },
        },
        { $unwind: { path: '$staffReply', preserveNullAndEmptyArrays: false } },
        // 3) Kiểm tra: staff reply đó có thuộc staff đang tính KPI không?
        //    Option A: tạo tin có createdByStaffId == staffUserId
        //    Option B (backup): tìm session nào assignedTo staffUserId (bảo toàn nếu field createdByStaffId null ở dữ liệu cũ)
        {
          $lookup: {
            from: 'chat_sessions',
            let: { sessId: '$sessionId' },
            pipeline: [
              { $match: { $expr: { $eq: ['$_id', '$$sessId'] } } },
              { $project: { assignedTo: 1, _id: 0 } },
              { $limit: 1 },
            ],
            as: 'sessionOwner',
          },
        },
        { $unwind: { path: '$sessionOwner', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $expr: {
              $or: [
                { $eq: ['$staffReply.createdByStaffId', this.toOid(staffUserId)] },
                { $eq: ['$sessionOwner.assignedTo', this.toOid(staffUserId)] },
              ],
            },
          },
        },
        // 4) Tính thời gian chờ (replySeconds) và đếm số lượng lớn hơn SLA_REPLY_SECONDS
        {
          $project: {
            _id: 0,
            replySeconds: {
              $divide: [{ $subtract: ['$staffReply.createdAt', '$createdAt'] }, 1000],
            },
          },
        },
        { $match: { replySeconds: { $gt: CHAT_SLA_REPLY_SECONDS } } },
        { $count: 'count' },
      ]).exec().then((rows: any[]) => (rows[0]?.count ?? 0)),
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

  // ✅ M2: Phương thức cập nhật thông tin khách vãng lai - lưu vào session fields, KHÔNG tạo ChatMessage mới
  async updateGuestInfo(dto: UpdateGuestInfoDto, now = new Date()) {
    const session = await this.chatSessionModel.findById(dto.sessionId)
    if (!session) throw new NotFoundException('Session không tồn tại')
    if (session.status === 'CLOSED') {
      throw new BadRequestException('Session đã đóng, không thể cập nhật thông tin khách nữa.')
    }
    let changed = false
    if (dto.guestName && !session.guestName) {
      session.guestName = dto.guestName.trim()
      changed = true
    }
    if (dto.guestEmail && !session.guestEmail) {
      session.guestEmail = dto.guestEmail.trim()
      changed = true
    }
    if (dto.guestPhone && !session.guestPhone) {
      session.guestPhone = dto.guestPhone.trim()
      changed = true
    }
    if (!changed) {
      return {
        updated: false,
        session: await this.serializeSession(session),
      }
    }
    await session.save()
    const serSession = await this.serializeSession(session)
    // ✅ Emit realtime để staff bên AdminChatDetail thấy ngay thông tin khách đã cập nhật (không cần F5)
    this.gateway.emitSessionUpdated(session.id, {
      guestName: serSession.guestName,
      guestEmail: serSession.guestEmail,
      guestPhone: serSession.guestPhone,
    })
    return {
      updated: true,
      session: serSession,
    }
  }

  async submitRating(dto: SubmitRatingDto, now = new Date()) {
    // Kiểm tra session tồn tại + guestEmail match (email sai → throw trước)
    const checkSession = await this.chatSessionModel
      .findById(dto.sessionId)
      .select('_id guestEmail assignedTo ratingStars guestName guestPhone userId escalatedAt status')
      .exec()
    if (!checkSession) throw new NotFoundException('Session không tồn tại')
    if (
      dto.guestEmail &&
      checkSession.guestEmail &&
      dto.guestEmail.trim().toLowerCase() !== checkSession.guestEmail.trim().toLowerCase()
    ) {
      throw new BadRequestException('Email xác nhận không khớp.')
    }

    // ✅ AUD-H1: Dùng findOneAndUpdate ATOMIC thay vì findById + if(ratingStars?) throw + save()
    //   → Chống race-condition 2 request đồng thời cùng đọc ratingStars=null → cả 2 pass → ghi 2 lần (double notif)
    //   Condition: _id = dto.sessionId VÀ ratingStars = null (hoặc undefined) → set 1 lần DUY NHẤT atomic
    const atomicUpdated = await this.chatSessionModel.findOneAndUpdate(
      { _id: dto.sessionId, ratingStars: null },
      {
        $set: {
          ratingStars: dto.ratingStars,
          ratingComment: dto.ratingComment?.trim() || null,
          ratedAt: now,
        },
      },
      { new: true, runValidators: true, select: '_id ratingStars ratingComment ratedAt assignedTo guestName guestEmail guestPhone userId escalatedAt status' },
    )

    // Không có document được update → ratingStars đã có giá trị trước đó (người dùng double click)
    if (!atomicUpdated) {
      return { ok: false, alreadyRated: true, ratingStars: (checkSession as any).ratingStars ?? dto.ratingStars, message: 'Bạn đã đánh giá cuộc chat này trước đó rồi.' }
    }
    // Đồng bộ ref downstream (giống logic cũ để notif + label)
    const session = atomicUpdated as any
    this.gateway.emitSessionUpdated(session.id, {
      ratingStars: dto.ratingStars,
      ratingComment: session.ratingComment,
      ratedAt: now,
    })

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
    // ✅ H5: Loop qua tất cả các trang users (không dừng ở 500 người đầu tiên)
    //    - page size = 200 nhỏ gọn để query DB không nặng
    //    - kết quả allRecipients = gộp hết tất cả staff/admin active
    const allRecipients: any[] = []
    let page = 1
    while (true) {
      const { items, total }: any = await this.users.adminListUsers({
        role: role as any,
        page,
        limit: 200,
      })
      if (!Array.isArray(items) || items.length === 0) break
      allRecipients.push(...items)
      // Dừng sớm: trang này không đủ 200 hay đã vượt qua total
      if (items.length < 200) break
      if (typeof total === 'number' && allRecipients.length >= total) break
      page++
      if (page > 500) {
        this.logger.warn(`[broadcastStaffNotif] looped 50k+ users unexpectedly, stop to avoid infinite loop`)
        break
      }
    }

    const results: any[] = []
    for (const u of allRecipients) {
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

  private async serializeSession(session: ChatSession | any, extra: { assignedStaffName?: string | null } = {}): Promise<any> {
    const sla = this.computeSlaStatus(session)
    // ✅ C3 Fix: Fallback đúng nghĩa nếu caller chưa truyền assignedStaffName
    //    extra.assignedStaffName có giá trị → dùng (performance)
    //    không có extra nhưng session.assignedTo có giá trị → query DB lấy tên staff
    //    không có assignedTo → null (chưa phân công)
    let fallbackStaffName: string | null = null
    if (extra.assignedStaffName === undefined || extra.assignedStaffName === null) {
      if (session.assignedTo) {
        fallbackStaffName = await this.assignedStaffName(session.assignedTo)
      }
    } else {
      fallbackStaffName = extra.assignedStaffName
    }
    return {
      id: (session._id ?? session.id)?.toString?.() ?? session.id,
      userId: session.userId ? String(session.userId) : null,
      guestName: session.guestName ?? null,
      guestEmail: session.guestEmail ?? null,
      guestPhone: session.guestPhone ?? null,
      status: session.status,
      assignedTo: session.assignedTo ? String(session.assignedTo) : null,
      assignedAt: session.assignedAt ?? null,
      assignedStaffName: fallbackStaffName,
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

  private async saveMessage(
    sessionId: string,
    role: ChatRole,
    content: string,
    createdAt?: Date,
    opts?: { system?: boolean; createdByStaffId?: string | Types.ObjectId | null },
  ): Promise<ChatMessage> {
    const patch: any = {
      sessionId: this.toOid(sessionId),
      role,
      content,
      system: Boolean(opts?.system),
    }
    if (createdAt) patch.createdAt = createdAt
    if (opts?.createdByStaffId) {
      patch.createdByStaffId = this.toOid(opts.createdByStaffId as any)
    }
    const doc = new this.chatMessageModel(patch)
    await doc.save()
    // Atomic counter bot/staff/user trên session
    try {
      if (role === 'ASSISTANT') {
        await this.chatSessionModel.updateOne({ _id: sessionId }, { $inc: { botMessagesCount: 1 } })
      } else if (role === 'STAFF') {
        // Note: counter staffMessagesCount atomic được tăng ở staffReply updateOne chính (để đảm bảo 1 lần cho cả 2). Nếu saveMessage STAFF được gọi từ path khác → tăng thêm ở đây cho an toàn.
      } else if (role === 'USER') {
        // Note: customerMessagesCount đã atomic tăng ở handleMessage entry.
      }
    } catch (e) {
      this.logger.warn(`[S=${sessionId}] saveMessage atomic counter failed: ${(e as Error).message}`)
    }
    return doc
  }

  private async saveToolCall(sessionId: string, toolName: string, args: any, result: any) {
    // ✅ H1: Lưu với role = SYSTEM (ẩn đi trên UI widget khách) thay vì ASSISTANT (show như tin bot)
    //    Chỉ hiển thị cho staff/admin ở màn hình detail nếu cần debug tool-calling pipeline
    return this.chatMessageModel.create({
      sessionId: this.toOid(sessionId),
      role: 'SYSTEM',
      content: `[gọi tool: ${toolName}]`,
      toolCalls: args,
      toolResult: result,
      system: true, // AI-3b: luôn đánh dấu log tool là system ẩn trên UI widget
    })
  }

  private async callGeminiWithRetry(contents: Content[], attempt = 1): Promise<any> {
    const startedAt = Date.now()
    try {
      // ✅ A2: Wrap với timeout 20s cho từng generateContent (không cho user chờ quá lâu, dù Google có đang treo)
      const geminiResp = await this.promiseWithTimeout(
        this.ai.models.generateContent({
          model: MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_PROMPT,
            tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }],
            temperature: 0.3,
          },
        }),
        GEMINI_CALL_TIMEOUT_MS,
        `attempt_${attempt}`,
      )
      const tookMs = Date.now() - startedAt
      if (tookMs > 5000) {
        this.logger.warn(`[CHAT-AI] 🐌 Gemini generate xong trong ${tookMs}ms (trên 5s, hơi lâu).`)
      } else {
        this.logger.verbose?.(`[CHAT-AI] ✅ Gemini generate ok attempt=${attempt}, ${tookMs}ms`)
      }
      return geminiResp
    } catch (err) {
      const tookMs = Date.now() - startedAt
      const kind = this.classifyGeminiError(err)
      this.logger.warn(`[CHAT-AI] ❌ Gemini call FAILED (attempt=${attempt}, ${tookMs}ms, kind=${kind}): ${(err as Error).message}`)
      if (kind === 'rate_limit' && attempt < 2) {
        // Chỉ retry 1 lần duy nhất với rate limit (429) sau 1.5s, không retry lại với lỗi khác → giảm chờ đợi
        this.logger.warn(`[CHAT-AI] ⏱ Rate limit, retry sau ${GEMINI_RATE_LIMIT_RETRY_MS}ms (lần ${attempt + 1}/2)...`)
        await new Promise((r) => setTimeout(r, GEMINI_RATE_LIMIT_RETRY_MS))
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
