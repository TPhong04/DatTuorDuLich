import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { FilterQuery, Model } from 'mongoose'
import { FunctionDeclaration } from '@google/genai'
import { Tour, TourDocument } from '../../tours/tour.schema'
// TODO: nếu bạn có sẵn TourService/BookingService riêng thì có thể dùng thay cho query trực tiếp Model ở đây
// import { BookingService } from '../../bookings/booking.service'

/**
 * Định nghĩa các "tools" (functions) mà Gemini được phép gọi.
 * Format functionDeclarations theo chuẩn @google/genai.
 */
export const CHAT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'searchTours',
    description:
      'Tìm danh sách tour du lịch theo từ khóa, địa điểm, chủ đề, hoặc khoảng giá. Dùng khi khách hỏi chung chung về tour/địa điểm ("có tour Đà Lạt không", "tour biển giá dưới 3 triệu"...). Trả về danh sách rút gọn, không có lịch trình chi tiết.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa, tên địa điểm, hoặc chủ đề, ví dụ "Đà Lạt", "Phú Quốc", "biển"' },
        minPrice: { type: 'number', description: 'Giá tối thiểu (VNĐ), optional' },
        maxPrice: { type: 'number', description: 'Giá tối đa (VNĐ), optional' },
      },
      required: ['keyword'],
    },
  },
  {
    name: 'getTourDetail',
    description:
      'Lấy thông tin CHI TIẾT ĐẦY ĐỦ của một tour cụ thể (lịch trình từng ngày, giá theo ngày khởi hành, chỗ còn trống, chính sách hủy, đánh giá, điểm đón...). Dùng khi khách hỏi sâu về một tour cụ thể sau khi đã biết tên/slug tour, hoặc khách nêu đích danh tên tour. Nếu hệ thống KHÔNG có tour này, tool sẽ trả về found=false — khi đó phải báo khách là hiện chưa có tour này và sẽ sớm cập nhật, KHÔNG được bịa thông tin.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Tên tour hoặc slug tour, ví dụ "Đà Lạt 3N2Đ" hoặc "da-lat-3n2d"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'getBookingStatus',
    description:
      'Tra cứu trạng thái đơn đặt tour theo mã đơn. Dùng khi khách hỏi "đơn của tôi tới đâu rồi", "đã thanh toán chưa"...',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        bookingCode: { type: 'string', description: 'Mã đơn đặt tour, ví dụ BK20260811001' },
      },
      required: ['bookingCode'],
    },
  },
  {
    name: 'checkAvailability',
    description: 'Kiểm tra tour còn chỗ trống cho ngày cụ thể hay không.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        tourId: { type: 'string' },
        date: { type: 'string', description: 'Định dạng YYYY-MM-DD' },
      },
      required: ['tourId', 'date'],
    },
  },
  {
    name: 'escalateToStaff',
    description:
      'Chuyển cuộc hội thoại cho nhân viên xử lý. CHỈ dùng khi: khách yêu cầu hủy/đổi đơn, khiếu nại, hoàn tiền, hoặc yêu cầu vượt quá khả năng trả lời của bot.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: 'Lý do ngắn gọn để staff nắm bối cảnh' },
      },
      required: ['reason'],
    },
  },
]

@Injectable()
export class ChatToolsService {
  private readonly logger = new Logger(ChatToolsService.name)
  constructor(
    @InjectModel(Tour.name) private readonly tourModel: Model<TourDocument>,
    // private readonly bookingService: BookingService,
  ) {}

  /**
   * Thực thi tool theo tên + arguments mà Gemini trả về.
   * Đây là nơi RÀNG BUỘC NGHIỆP VỤ THẬT — Gemini chỉ được đọc dữ liệu,
   * không được tự ý sửa/xóa/hủy đơn ở đây.
   */
  async execute(toolName: string, args: Record<string, any>) {
    // ✅ AI-4: Wrapper tổng quát try-catch cho tất cả tools.
    //   - Nếu 1 tool nào đó throw lỗi bất kỳ → trả về format chuẩn { needEscalate, error, fallbackMessage }
    //   - Log chi tiết tên tool + args (cắt ngắn để không lộ secret)
    try {
      switch (toolName) {
        case 'searchTours':
          return this.searchTours(args)
        case 'getTourDetail':
          return this.getTourDetail(args)
        case 'getBookingStatus':
          return this.getBookingStatus(args)
        case 'checkAvailability':
          return this.checkAvailability(args)
        case 'escalateToStaff':
          // Không cần làm gì ở đây — ChatService sẽ đọc tool call này
          // và tự đổi status session sang ESCALATED
          return { escalated: true, reason: args.reason }
        default:
          this.logger.warn(`[TOOL:${toolName}] Unknown tool name requested by Gemini`)
          return {
            needEscalate: true,
            escalateReason: `Yêu cầu tool không hỗ trợ: ${toolName}`,
            fallbackMessage: `🙇 Xin lỗi, tính năng ${toolName} hiện không hỗ trợ. Mình đã chuyển đội ngũ hỗ trợ giúp bạn.`,
            error: `Unknown tool: ${toolName}`,
          }
      }
    } catch (err) {
      const msg = (err as Error)?.message ?? String(err)
      // Không throw nữa → trả về format chuẩn escalate cho ChatService xử lý
      this.logger.error(`[TOOL:${toolName}] ❌ THREW ERROR inside execute switch: ${msg}`)
      return {
        needEscalate: true,
        escalateReason: `Tool ${toolName} internal error: ${msg.slice(0, 120)}`,
        fallbackMessage: '⚠️ Xin lỗi, có lỗi tạm thời khi tra cứu dữ liệu. Mình đã nhắc đội ngũ kỹ thuật + chuyển nhân viên hỗ trợ trực tiếp cho bạn nhé 🙏',
        error: msg,
      }
    }
  }

  // Giá thấp nhất trong các đợt khởi hành còn mở & còn chỗ (dùng để hiển thị "giá từ...")
  private getPriceFrom(tour: TourDocument) {
    const openDepartures = (tour.departures ?? []).filter(
      (d) => d.status === 'open' && d.seatsAvailable > 0,
    )
    if (!openDepartures.length) return { priceFrom: null, nextDepartureDate: null, seatsAvailable: null }

    const cheapest = openDepartures.reduce((min, d) => (d.priceAdult < min.priceAdult ? d : min))
    const soonest = [...openDepartures].sort(
      (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime(),
    )[0]

    return {
      priceFrom: cheapest.priceAdult,
      nextDepartureDate: soonest?.departureDate ?? null,
      seatsAvailable: soonest?.seatsAvailable ?? null,
    }
  }

  private async searchTours(args: Record<string, any>) {
    const keyword = String(args.keyword ?? '').trim()
    const minPrice = typeof args.minPrice === 'number' ? args.minPrice : undefined
    const maxPrice = typeof args.maxPrice === 'number' ? args.maxPrice : undefined

    const regex = new RegExp(keyword.split(/\s+/).filter(Boolean).join('|'), 'i')

    const filter: FilterQuery<TourDocument> = {
      isPublished: true,
      $or: [
        { title: regex },
        { region: regex },
        { themes: regex },
        { categories: regex },
        { tags: regex },
        { summary: regex },
      ],
    }

    // Lấy rộng hơn 1 chút rồi lọc theo giá ở JS (vì giá nằm trong mảng departures)
    const candidates = await this.tourModel
      .find(filter)
      .sort({ totalBookings: -1, avgRating: -1 })
      .limit(20)
      .lean<TourDocument[]>()

    let results = candidates.map((tour) => {
      const priceInfo = this.getPriceFrom(tour as unknown as TourDocument)
      return {
        title: tour.title,
        slug: tour.slug,
        region: tour.region,
        themes: tour.themes,
        durationDays: tour.durationDays,
        durationNights: tour.durationNights,
        avgRating: tour.avgRating,
        reviewCount: tour.reviewCount,
        ...priceInfo,
      }
    })

    if (minPrice !== undefined) {
      results = results.filter((r) => r.priceFrom !== null && r.priceFrom >= minPrice)
    }
    if (maxPrice !== undefined) {
      results = results.filter((r) => r.priceFrom !== null && r.priceFrom <= maxPrice)
    }

    results = results.slice(0, 5)

    if (!results.length) {
      return {
        found: false,
        results: [],
        note: 'Không tìm thấy tour nào phù hợp trong hệ thống hiện tại. Hãy báo khách là hiện chưa có tour phù hợp và sẽ sớm cập nhật trong thời gian tới, không được bịa tour.',
      }
    }

    return { found: true, results }
  }

  private async getTourDetail(args: Record<string, any>) {
    const query = String(args.query ?? '').trim()
    if (!query) {
      return { found: false, note: 'Thiếu tên/slug tour để tra cứu.' }
    }

    // Ưu tiên khớp đúng slug, nếu không có thì tìm gần đúng theo title
    const bySlug = await this.tourModel
      .findOne({ slug: query.toLowerCase(), isPublished: true })
      .lean<TourDocument>()

    const tour =
      bySlug ??
      (await this.tourModel
        .findOne({ title: new RegExp(query, 'i'), isPublished: true })
        .lean<TourDocument>())

    if (!tour) {
      return {
        found: false,
        note: `Hệ thống hiện không có tour nào khớp với "${query}". Hãy báo khách là hiện chưa có tour này và sẽ sớm cập nhật trong thời gian tới, không được bịa thông tin tour.`,
      }
    }

    const priceInfo = this.getPriceFrom(tour as unknown as TourDocument)

    const upcomingDepartures = (tour.departures ?? [])
      .filter((d) => d.status === 'open')
      .sort((a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime())
      .slice(0, 5)
      .map((d) => ({
        departureDate: d.departureDate,
        priceAdult: d.priceAdult,
        priceChild: d.priceChild,
        priceInfant: d.priceInfant,
        seatsAvailable: d.seatsAvailable,
        status: d.status,
      }))

    return {
      found: true,
      title: tour.title,
      slug: tour.slug,
      summary: tour.summary,
      durationDays: tour.durationDays,
      durationNights: tour.durationNights,
      departureFrom: tour.departureFrom,
      transportText: tour.transportText,
      hotelText: tour.hotelText,
      region: tour.region,
      themes: tour.themes,
      highlights: tour.highlights,
      itinerary: tour.itinerary,
      priceTable: tour.priceTable,
      surcharges: tour.surcharges,
      upcomingDepartures,
      ...priceInfo,
      includedText: tour.includedText,
      excludedText: tour.excludedText,
      childPolicyText: tour.childPolicyText,
      cancelPolicyText: tour.cancelPolicyText,
      noteText: tour.noteText,
      pickupPoints: tour.pickupPoints,
      faq: tour.faq,
      avgRating: tour.avgRating,
      reviewCount: tour.reviewCount,
    }
  }

  private async getBookingStatus(args: Record<string, any>) {
    const bookingCode = String(args.bookingCode ?? '').trim().toUpperCase()
    if (!bookingCode) return { found: false, note: 'Thiếu mã đơn hàng để tra cứu.' }

    // ✅ H3: NỐI SERVICE THẬT (giai đoạn 1 → report nếu chưa có module thì báo rò rỉ)
    // TODO NỐI THẬT: return this.bookingsService.findByCode(bookingCode)
    // Hiện tại không hardcode "CONFIRMED" nói dối nữa, dùng cần escalate nhân viên
    return {
      bookingCode,
      found: false,
      needEscalate: true,
      escalateReason: `Bot chưa thể tra chi tiết tình trạng đơn ${bookingCode} (module Đơn hàng chưa được nối vào chat tool). Đã yêu cầu nhân viên hỗ trợ.`,
      fallbackMessage: `⚠ XIN LỖI! Hiện tôi chưa thể tra chi tiết đơn **${bookingCode}** do module Đơn hàng chưa được tích hợp.
Vui lòng giữ máy, tôi đã chuyển câu hỏi của bạn sang bộ phận Chăm sóc Khách hàng để nhân viên hỗ trợ bạn trong vòng **5 phút** ạ.
(Hệ thống đang được nâng cấp, quý khách thông cảm ạ 🙏)`,
      _status: 'BOT_NOT_CONNECTED',
    }
  }

  private async checkAvailability(args: Record<string, any>) {
    const tourId = String(args.tourId ?? '').trim()
    const date = String(args.date ?? '').trim()
    if (!tourId) return { found: false, note: 'Thiếu tour để kiểm tra.' }

    // ✅ H3: KHÔNG còn hardcode "available: true, slotsLeft: 8" nói dối nữa
    // TODO NỐI THẬT: return this.departuresService.findByTourAndDate(tourId, date)
    const tour = await this.tourModel.findById(tourId).select('title departures').lean().exec() as any
    let tourTitle: string | null = null
    let matchedDate: any = null
    if (tour) {
      tourTitle = tour.title ?? null
      if (date) {
        const ds = new Date(date).toISOString().slice(0, 10)
        matchedDate = (tour.departures ?? []).find((d: any) => {
          try { return new Date(d.departureDate).toISOString().slice(0, 10) === ds } catch { return false }
        })
      }
    }

    if (matchedDate) {
      // Có departure đúng ngày → lấy số liệu thật từ tour.departures (chắc chắn không bị nói dối)
      const status = String(matchedDate.status ?? 'unknown')
      const seats = Number(matchedDate.seatsAvailable ?? 0)
      const priceAdult = matchedDate.priceAdult ?? null
      return {
        tourId,
        date,
        tourTitle,
        available: status === 'open' && seats > 0,
        slotsLeft: seats,
        departureStatus: status,
        priceAdult,
        found: true,
      }
    }

    // Không có departure theo ngày yêu cầu / chưa nối service thật → escalate nhân viên không nói dối
    return {
      tourId,
      date,
      tourTitle,
      available: false,
      slotsLeft: 0,
      needEscalate: true,
      escalateReason: date ? `Bot chưa thể kiểm tra tình trạng còn chỗ tour ${tourTitle ?? tourId} ngày ${date}.` : `Bot chưa thể kiểm tra tình trạng còn chỗ tour ${tourTitle ?? tourId}.`,
      fallbackMessage: tourTitle
        ? `⚠ Hiện tôi mới tra được dữ liệu tour **${tourTitle}** khớp với CSDL, nhưng chưa thể kiểm tra **số lượng chỗ trống** cho ngày **${date || 'yêu cầu của bạn'}** do module Lịch trình chưa được tích hợp đầy đủ.\nVui lòng giữ máy, tôi đã chuyển yêu cầu sang bộ phận Đặt tour để nhân viên hỗ trợ bạn kiểm tra trong vòng **5 phút** ạ 🙏`
        : `⚠ Tôi chưa tìm thấy lịch trình khởi hành phù hợp với yêu cầu của bạn. Đã chuyển bạn sang nhân viên hỗ trợ trong 5 phút.`,
    }
  }
}