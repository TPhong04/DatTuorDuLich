import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { GoogleGenAI, Content, Part } from '@google/genai'
import { ChatSession } from './schemas/chat-session.schema'
import { ChatMessage, ChatRole } from './schemas/chat-message.schema'
import { ChatToolsService, CHAT_TOOL_DECLARATIONS } from './tools/chat-tools.service'
import { SendMessageDto } from './chat.dto'

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

const MAX_TOOL_LOOPS = 4 // tránh loop vô hạn gọi tool
const MODEL = 'gemini-3.6-flash' // model hiện tại thay thế dòng 2.5 cũ. Free tier quota khá thấp (~5 RPM lúc mới ra mắt), có retry bên dưới để đỡ bị 429

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)
  private readonly ai: GoogleGenAI

  constructor(
    @InjectModel(ChatSession.name) private readonly chatSessionModel: Model<ChatSession>,
    @InjectModel(ChatMessage.name) private readonly chatMessageModel: Model<ChatMessage>,
    private readonly tools: ChatToolsService,
  ) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }

  async handleMessage(dto: SendMessageDto) {
    const session = await this.getOrCreateSession(dto)
    const sessionId = (session._id as Types.ObjectId).toString()

    // Nếu đã escalate cho staff thì bot không tự trả lời nữa
    if (session.status === 'ESCALATED') {
      await this.saveMessage(sessionId, 'USER', dto.message)
      return {
        sessionId,
        status: 'ESCALATED',
        reply: 'Yêu cầu của bạn đang được nhân viên hỗ trợ xử lý, vui lòng chờ trong giây lát.',
      }
    }

    await this.saveMessage(sessionId, 'USER', dto.message)

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
        await this.saveMessage(sessionId, 'ASSISTANT', friendly)
        return { sessionId, status: session.status, reply: friendly }
      }

      const functionCalls = response.functionCalls ?? []

      // Không có tool call -> đây là câu trả lời cuối cùng
      if (functionCalls.length === 0) {
        const reply = response.text ?? 'Xin lỗi, tôi chưa có câu trả lời phù hợp.'
        await this.saveMessage(sessionId, 'ASSISTANT', reply)
        return { sessionId, status: session.status, reply }
      }

      // Model trả lời kèm functionCall -> lưu lại "lượt nói" của model vào contents
      const modelParts: Part[] = response.candidates?.[0]?.content?.parts ?? []
      contents.push({ role: 'model', parts: modelParts })

      // Thực thi từng tool call, gom kết quả trả về cho model ở lượt kế tiếp
      const responseParts: Part[] = []

      for (const call of functionCalls) {
        const args = call.args ?? {}
        const result = await this.tools.execute(call.name!, args)

        if (call.name === 'escalateToStaff') {
          escalated = true
          escalationReason = (args as any).reason ?? 'Không xác định'
        }

        responseParts.push({
          functionResponse: {
            name: call.name!,
            response: { result }, // Gemini yêu cầu response là 1 object
          },
        })

        await this.saveToolCall(sessionId, call.name!, args, result)
      }

      contents.push({ role: 'user', parts: responseParts })

      if (escalated) {
        await this.chatSessionModel.updateOne({ _id: sessionId }, { status: 'ESCALATED' })

        const reply = `Mình đã chuyển yêu cầu của bạn cho nhân viên hỗ trợ (lý do: ${escalationReason}). Bạn vui lòng chờ trong giây lát nhé.`
        await this.saveMessage(sessionId, 'ASSISTANT', reply)
        return { sessionId, status: 'ESCALATED', reply }
      }
      // Không escalate -> loop tiếp để model tổng hợp câu trả lời từ tool result
    }

    // Vượt quá số lần loop cho phép -> an toàn là escalate cho staff
    await this.chatSessionModel.updateOne({ _id: sessionId }, { status: 'ESCALATED' })
    const fallback = 'Xin lỗi, mình cần nhân viên hỗ trợ thêm cho yêu cầu này. Bạn vui lòng chờ trong giây lát.'
    await this.saveMessage(sessionId, 'ASSISTANT', fallback)
    return { sessionId, status: 'ESCALATED', reply: fallback }
  }

  // ---- Staff trả lời thủ công khi đã escalate ----
  async staffReply(sessionId: string, message: string, staffUserId: string) {
    await this.chatSessionModel.updateOne({ _id: sessionId }, { assignedTo: staffUserId })
    await this.saveMessage(sessionId, 'STAFF', message)
    return { sessionId, reply: message }
  }

  async updateStatus(sessionId: string, status: 'BOT' | 'ESCALATED' | 'CLOSED') {
    return this.chatSessionModel.findByIdAndUpdate(sessionId, { status }, { new: true })
  }

  // Thử lại 1 lần nếu bị lỗi 429 (rate limit), đợi ngắn trước khi retry
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
        await new Promise((r) => setTimeout(r, 2000)) // đợi 2s rồi thử lại 1 lần
        return this.callGeminiWithRetry(contents, attempt + 1)
      }
      throw err
    }
  }

  private isRateLimitError(err: unknown): boolean {
    const msg = (err as Error)?.message ?? ''
    return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')
  }

  // ---- Helpers ----
  private async getOrCreateSession(dto: SendMessageDto) {
    if (dto.sessionId) {
      const existing = await this.chatSessionModel.findById(dto.sessionId)
      if (existing) return existing
    }
    return this.chatSessionModel.create({
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      status: 'BOT',
    })
  }

  private async saveMessage(sessionId: string, role: ChatRole, content: string) {
    return this.chatMessageModel.create({ sessionId, role, content })
  }

  private async saveToolCall(sessionId: string, toolName: string, args: any, result: any) {
    return this.chatMessageModel.create({
      sessionId,
      role: 'ASSISTANT',
      content: `[gọi tool: ${toolName}]`,
      toolCalls: args,
      toolResult: result,
    })
  }

  // Gemini dùng role 'user' / 'model' (khác OpenAI 'user' / 'assistant')
  private async getHistoryForModel(sessionId: string, limit = 20): Promise<Content[]> {
    const rows = await this.chatMessageModel
      .find({ sessionId, role: { $in: ['USER', 'ASSISTANT', 'STAFF'] } })
      .sort({ createdAt: 1 })
      .limit(limit)

    return rows.map((r) => ({
      role: r.role === 'USER' ? 'user' : 'model', // gộp STAFF vào 'model' để giữ ngữ cảnh
      parts: [{ text: r.content }],
    }))
  }
}