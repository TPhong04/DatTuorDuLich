import { Injectable } from '@nestjs/common'
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
        return { error: `Unknown tool: ${toolName}` }
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
    const bookingCode = args.bookingCode as string

    // TODO: return this.bookingService.findByCode(bookingCode)
    return {
      bookingCode,
      status: 'CONFIRMED',
      note: 'DEMO DATA — nối vào BookingService thật',
    }
  }

  private async checkAvailability(args: Record<string, any>) {
    const tourId = args.tourId as string
    const date = args.date as string

    // TODO: return this.tourService.checkAvailability(tourId, date)
    return { tourId, date, available: true, slotsLeft: 8 }
  }
}