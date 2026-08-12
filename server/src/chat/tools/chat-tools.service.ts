import { Injectable } from '@nestjs/common'
import { FunctionDeclaration } from '@google/genai'
// TODO: import đúng service thật của bạn (đổi tên/path cho khớp project)
// import { TourService } from '../../tours/tour.service'
// import { BookingService } from '../../bookings/booking.service'

/**
 * Định nghĩa các "tools" (functions) mà Gemini được phép gọi.
 * Format functionDeclarations theo chuẩn @google/genai.
 */
export const CHAT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'searchTours',
    description:
      'Tìm kiếm tour du lịch theo từ khóa, địa điểm, hoặc khoảng giá. Dùng khi khách hỏi về tour, địa điểm du lịch.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa hoặc tên địa điểm, ví dụ "Đà Lạt", "Phú Quốc"' },
        minPrice: { type: 'number', description: 'Giá tối thiểu (VNĐ), optional' },
        maxPrice: { type: 'number', description: 'Giá tối đa (VNĐ), optional' },
      },
      required: ['keyword'],
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
    // private readonly tourService: TourService,
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

  // Nhận Record<string, any> thay vì type cụ thể để khớp với args truyền từ execute().
  // Bên trong hàm, đọc field ra và ép kiểu khi cần dùng.
  private async searchTours(args: Record<string, any>) {
    const keyword = args.keyword as string
    const minPrice = args.minPrice as number | undefined
    const maxPrice = args.maxPrice as number | undefined

    // TODO: thay bằng query thật, ví dụ:
    // return this.tourService.search({ keyword, minPrice, maxPrice, take: 5 })
    return {
      results: [
        { id: 'demo-1', name: `Tour ${keyword} 3N2Đ`, price: 2990000, available: true },
      ],
      note: 'DEMO DATA — nối vào TourService thật để lấy dữ liệu chính xác',
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