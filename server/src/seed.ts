import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import bcrypt from 'bcryptjs'
import { Types } from 'mongoose'

import { AppModule } from './app.module'
import { BookingsService } from './bookings/bookings.service'
import { ToursService } from './tours/tours.service'
import { UsersService } from './users/users.service'
import { GroupTourRequestsService } from './group-tour-requests/group-tour-requests.service'
import { GroupTourRequestStatus, GroupTourRequestPriority } from './group-tour-requests/group-tour-request.schema'

type SeedStaff = { _id: Types.ObjectId; name: string; email: string; phone: string }

const STAFF_SEED: Array<{ name: string; email: string; phone: string; password: string }> = [
  { name: 'Phan Thị Thanh Hoài', email: 'hoai.ptt@congtydulich.vn', phone: '0913111222', password: 'Staff@12345' },
  { name: 'Trần Thế Định', email: 'dinh.tt@congtydulich.vn', phone: '0123456789', password: 'Staff@12345' },
  { name: 'Nguyễn Thị Lan Anh', email: 'lananh.nt@congtydulich.vn', phone: '0914222333', password: 'Staff@12345' },
  { name: 'Lê Hoàng Nam', email: 'nam.lh@congtydulich.vn', phone: '0915333444', password: 'Staff@12345' },
  { name: 'Hoàng Thu Trang', email: 'trang.ht@congtydulich.vn', phone: '0916444555', password: 'Staff@12345' },
]

async function seedStaff(users: UsersService): Promise<SeedStaff[]> {
  const out: SeedStaff[] = []
  for (const s of STAFF_SEED) {
    let doc = await users.findByEmail(s.email)
    if (!doc) {
      const pwHash = await bcrypt.hash(s.password, 10)
      doc = await users.createUser({
        name: s.name,
        email: s.email,
        phone: s.phone,
        passwordHash: pwHash,
        role: 'staff',
      })
    }
    out.push({
      _id: new Types.ObjectId((doc._id as any)?.toString() ?? doc.id),
      name: doc.name,
      email: doc.email,
      phone: doc.phone ?? s.phone,
    })
  }
  return out
}

async function seedGroupTourRequests(svc: GroupTourRequestsService, staffList: SeedStaff[]) {
  const count = await svc.list({ page: 1, pageSize: 1 }, null)
  if (count.total >= 5) return
  const staff = (idx: number) => staffList[idx % staffList.length]
  const mkDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString()
  const rows: Array<{
    status: GroupTourRequestStatus; priority: GroupTourRequestPriority;
    contactName: string; contactPhone: string; contactEmail: string | null; contactRole: string | null;
    companyOrGroupName: string; companyTaxCode: string | null;
    adultCount: number; childCount: number; infantCount: number;
    departureCity: string; destination: string; approximateDurationText: string;
    preferredStartDate: string | null;
    hotelClassRequested: string | null;
    servicesPreference: { needVisa: boolean; needFlight: boolean; needBus: boolean; needHotel: boolean; needMeals: boolean; needGuide: boolean };
    budgetPerPersonVnd: number | null; totalBudgetVnd: number | null;
    assignedStaff: SeedStaff | null;
    specialRequirements?: string | null;
    lastQuoteSummary?: string | null;
    quoteCount?: number;
    lostReason?: string | null;
    wonAt?: string | null;
  }> = [
    {
      status: 'quoting', priority: 'normal',
      contactName: 'Chị Nguyễn Thị Kim Oanh', contactPhone: '0909666123', contactEmail: 'oanh.kt@congtyabc.vn', contactRole: 'Trưởng phòng HCNS',
      companyOrGroupName: 'Công ty TNHH ABC (Miền Tây)', companyTaxCode: '6000999111',
      adultCount: 80, childCount: 15, infantCount: 12,
      departureCity: 'TP. Hồ Chí Minh', destination: 'Hà Nội - Ninh Bình - Sapa', approximateDurationText: '4 ngày 3 đêm',
      preferredStartDate: mkDate(30), hotelClassRequested: '4 sao',
      servicesPreference: { needVisa: false, needFlight: true, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 6500000, totalBudgetVnd: 695500000,
      assignedStaff: staff(0),
      specialRequirements: 'Cần 2 xe 45 chỗ Limousine, 30 phòng đôi + 10 phòng 3 người, ăn chay 12 người, cần phòng họp team building 1 buổi tối.',
      lastQuoteSummary: null, quoteCount: 0,
    },
    {
      status: 'contacted', priority: 'normal',
      contactName: 'Anh Trần Văn Minh', contactPhone: '0902888456', contactEmail: 'minh.tv@tnhh-xaydung.vn', contactRole: 'Phó Giám đốc',
      companyOrGroupName: 'Công ty TNHH Xây dựng Lào Cai', companyTaxCode: '3000222333',
      adultCount: 45, childCount: 10, infantCount: 8,
      departureCity: 'Hà Nội', destination: 'Lào Cai - Fansipan - Cát Cát - Hà Giang', approximateDurationText: '5 ngày 4 đêm',
      preferredStartDate: mkDate(32), hotelClassRequested: '4 sao',
      servicesPreference: { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 5500000, totalBudgetVnd: 346500000,
      assignedStaff: staff(1),
      specialRequirements: 'Thang máy khách sạn, ăn ít rau muống, cần xe 29 chỗ 2 chiếc, hỗ trợ VAT 0% xuất hóa đơn.',
      lastQuoteSummary: null, quoteCount: 0,
    },
    {
      status: 'new', priority: 'urgent',
      contactName: 'Chị Lê Thị Thúy', contactPhone: '0988123456', contactEmail: 'thuy.lt@corp-xyz.vn', contactRole: 'Giám đốc Điều hành',
      companyOrGroupName: 'Tập đoàn XYZ Group (Hà Nội)', companyTaxCode: '0100777888',
      adultCount: 50, childCount: 0, infantCount: 0,
      departureCity: 'Hà Nội', destination: 'Hạ Long Bay - Yacht Party', approximateDurationText: '2 ngày 1 đêm',
      preferredStartDate: mkDate(7), hotelClassRequested: '5 sao',
      servicesPreference: { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 4800000, totalBudgetVnd: 240000000,
      assignedStaff: null,
      specialRequirements: 'Cần du thuyền 5 sao President 12 cabin, team building tối bãi biển Tuần Châu, có live band.',
    },
    {
      status: 'negotiating', priority: 'high',
      contactName: 'Anh Đinh Hoàng Việt', contactPhone: '0977000123', contactEmail: 'viet.dh@fsoft-corp.com', contactRole: 'HR Senior Manager',
      companyOrGroupName: 'Công ty Phần mềm F-Corp', companyTaxCode: '0100456789',
      adultCount: 120, childCount: 0, infantCount: 0,
      departureCity: 'Hà Nội', destination: 'Đà Nẵng - Hội An - Bà Nà Hills', approximateDurationText: '3 ngày 2 đêm',
      preferredStartDate: mkDate(45), hotelClassRequested: '4-5 sao',
      servicesPreference: { needVisa: false, needFlight: true, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 7200000, totalBudgetVnd: 864000000,
      assignedStaff: staff(2),
      lastQuoteSummary: 'Gói 1: VJ Air + Novotel 4* + Xe 3 chiếc 45 chỗ = 7.200.000đ/khách', quoteCount: 3,
      specialRequirements: 'Checkin sớm, 2 phòng họp, dinner team building bãi biển.',
    },
    {
      status: 'won', priority: 'normal',
      contactName: 'Chị Đỗ Thị Hồng', contactPhone: '0915888999', contactEmail: 'hong.dt@thpt-chuyen-hn.edu.vn', contactRole: 'Tổ trưởng Tổ chữ thập đỏ',
      companyOrGroupName: 'Trường THPT Chuyên Hà Nội', companyTaxCode: null,
      adultCount: 30, childCount: 0, infantCount: 0,
      departureCity: 'Hà Nội', destination: 'Ninh Bình - Tràng An - Hạ Long', approximateDurationText: '3 ngày 2 đêm',
      preferredStartDate: mkDate(20), hotelClassRequested: '3 sao',
      servicesPreference: { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 2800000, totalBudgetVnd: 84000000,
      assignedStaff: staff(0),
      lastQuoteSummary: 'Đã chốt gói 3N2Đ xe 45 chỗ + KS 3 sao trung tâm = 2.800.000đ/HS', quoteCount: 2,
      wonAt: mkDate(-2),
    },
    {
      status: 'lost', priority: 'low',
      contactName: 'Anh Nguyễn Văn Thắng', contactPhone: '0903333210', contactEmail: 'thang.nv@club-runner.vn', contactRole: 'Tổ chức sự kiện',
      companyOrGroupName: 'Câu lạc bộ Chạy bộ Hanoi Runners', companyTaxCode: null,
      adultCount: 35, childCount: 5, infantCount: 0,
      departureCity: 'Hà Nội', destination: 'Mộc Châu - Sơn La', approximateDurationText: '2 ngày 1 đêm',
      preferredStartDate: mkDate(10), hotelClassRequested: 'Resort 4 sao',
      servicesPreference: { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 1800000, totalBudgetVnd: 72000000,
      assignedStaff: staff(3),
      lostReason: 'Khách chọn đối thủ cạnh tranh (Vietravel) giá thấp hơn 5% + tặng móc khoá',
    },
    {
      status: 'new', priority: 'high',
      contactName: 'Chị Ngô Thị Bích', contactPhone: '0902123456', contactEmail: 'bich.nt@family-vuong.vn', contactRole: null,
      companyOrGroupName: 'Gia đình họ Võ (90 người - 3 thế hệ)', companyTaxCode: null,
      adultCount: 60, childCount: 20, infantCount: 10,
      departureCity: 'TP. Hồ Chí Minh', destination: 'Phú Quốc - Gành Đầu - Cảng Dứa', approximateDurationText: '4 ngày 3 đêm',
      preferredStartDate: mkDate(60), hotelClassRequested: 'Resort 5 sao villa biển',
      servicesPreference: { needVisa: false, needFlight: true, needBus: true, needHotel: true, needMeals: true, needGuide: true },
      budgetPerPersonVnd: 8500000, totalBudgetVnd: 765000000,
      assignedStaff: null,
      specialRequirements: 'Cần 10 villa 3 phòng ngủ (3 thế hệ họ Võ), BBQ 2 tối, cần xe đẩy sân bay mỗi tòa nhà.',
    },
  ]
  for (let i = 0; i < rows.length; i += 1) {
    try {
      const r = rows[i]
      const created = await svc.createPublic({
        contactName: r.contactName,
        contactPhone: r.contactPhone,
        contactEmail: r.contactEmail,
        contactRole: r.contactRole,
        companyOrGroupName: r.companyOrGroupName,
        companyTaxCode: r.companyTaxCode,
        adultCount: r.adultCount,
        childCount: r.childCount,
        infantCount: r.infantCount,
        departureCity: r.departureCity,
        destination: r.destination,
        approximateDurationText: r.approximateDurationText,
        preferredStartDate: r.preferredStartDate,
        preferredEndDate: null,
        hotelClassRequested: r.hotelClassRequested,
        servicesPreference: r.servicesPreference,
        transportRequestedNotes: null,
        budgetPerPersonVnd: r.budgetPerPersonVnd,
        totalBudgetVnd: r.totalBudgetVnd,
        specialRequirements: r.specialRequirements ?? null,
        sourceChannel: 'seed_data',
      }, { createdByUserId: null, ip: '127.0.0.1' })
      const patch: any = { status: r.status, priority: r.priority }
      if (r.assignedStaff) patch.assignedStaffId = r.assignedStaff._id.toString()
      if (r.lastQuoteSummary) patch.lastQuoteSummary = r.lastQuoteSummary
      if (typeof r.quoteCount === 'number') patch.quoteCount = r.quoteCount
      if (r.lostReason) patch.lostReason = r.lostReason
      if (r.wonAt) { patch.wonAt = r.wonAt; patch.lastContactedAt = r.wonAt }
      if (patch.status === 'quoting' || patch.status === 'negotiating' || patch.status === 'won') patch.lastContactedAt = mkDate(-1)
      if (patch.status === 'contacted' || patch.status === 'new') patch.followUpAt = mkDate(1)
      const sysActor = new Types.ObjectId('000000000000000000000001')
      await svc.patch((created._id as any).toString(), patch as any, sysActor, 'admin')
    } catch (e) {
      // skip duplicates
    }
  }
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule)
  const users = app.get(UsersService)
  const tours = app.get(ToursService)
  const bookings = app.get(BookingsService)
  const groupTours = app.get(GroupTourRequestsService)

  const email = (process.env.ADMIN_EMAIL ?? '').trim()
  const password = process.env.ADMIN_PASSWORD ?? ''

  const sampleSlug = 'hcm-ninh-chu-nha-trang-vinh-nha-phu-2906'
  let existingTour = await tours.findBySlugAdmin(sampleSlug)
  if (!existingTour) {
    const tourData: any = {
      title: 'HCM - Ninh Chũ - Nha Trang - Vĩnh NHA PHU 2906',
      slug: sampleSlug,
      code: 'Noi1-4906-30072026',
      type: 'retail',
      departureFrom: 'Hồ Chí Minh',
      durationDays: 4,
      durationNights: 3,
      transportText: 'Xe du lịch đời mới Limousine 29 chỗ',
      hotelText: 'KS 4 sao (Mũi Né / Nha Trang / Ninh Hòa)',
      region: 'Miền Trung',
      categories: ['Du lịch biển', 'Tour miền Trung'],
      themes: ['Giờ chót', 'Hè 2026', 'Gia đình'],
      minGuests: 10,
      maxGuests: 29,
      videoUrl: null,
      coverImageUrl: null,
      galleryImageUrls: [],
      highlights: [
        'Vịnh Vĩnh Hy - Vịnh Nha Phu thiên nhiên hoang sơ',
        'Lặn ngắm san hô Vịnh Ninh Chữ (đảo xanh)',
        'Cáp treo vượt biển Vinpearl Land / checkin Trung tâm Thành phố',
        'Ẩm thực Nha Trang hải sản tươi ngon mỗi bữa',
      ],
      summary:
        'Tour HCM - Ninh Chữ - Nha Trang - Vịnh Vĩnh Hy 4N3Đ dành cho gia đình/nhóm bạn, lịch trình linh hoạt, ưu tiên tắm biển và nghỉ dưỡng cao cấp. Đặt giờ chót nhận ngay ưu đãi 15%.',
      totalBookings: 187,
      avgRating: 4.8,
      reviewCount: 64,
      isPublished: true,
      tags: ['hot-gio-chot', 'mua-he-2026'],
      itinerary: [
        {
          label: 'Đêm 1',
          title: 'TPHCM - Ninh Thuận (đi đêm)',
          meals: [],
          attractions: [],
          accommodationText: 'Nghỉ đêm trên xe Limousine',
          content:
            'Tối 21h00: Quý khách có mặt tại Văn phòng/Công ty du lịch (tùy điểm đón đăng ký). Xe và HDV đón đoàn, kiểm tra hành lý, giải thích lịch trình, phát túi vệ sinh, nước uống và khởi hành hướng về Ninh Thuận. Quý khách nghỉ ngơi trên xe.',
        },
        {
          label: 'Ngày 1',
          title: 'Ninh Chữ (Lặn san hô) - Vịnh Vĩnh Hy',
          meals: ['Ăn sáng buffet', 'Ăn trưa hải sản', 'Ăn tối set menu'],
          attractions: ['Vịnh Ninh Chữ', 'Đảo Tôm Hùm', 'Vịnh Vĩnh Hy', 'Biển Vĩnh Hy'],
          accommodationText: 'KS 4 sao Vĩnh Hy (Villa Sea View nếu có)',
          content:
            'Sáng 05h30: Đến Vĩnh Hy, trả phòng tắm, ăn sáng tại nhà hàng khách sạn. 08h00: Xuất phát tham quan Vịnh Ninh Chữ, lặn ngắm san hô bằng tàu đáy kính (hoặc lặn ống thở tùy chọn). Trưa: Ăn trưa hải sản tại nhà hàng ven biển Vĩnh Hy. Chiều: Checkin khách sạn, nghỉ ngơi, tự do tắm biển. Tối: Ăn tối tại nhà hàng KS, thưởng thức BBQ hải sản.',
        },
        {
          label: 'Ngày 2',
          title: 'Nha Trang City Tour + Vinpearl Harbour',
          meals: ['Ăn sáng', 'Ăn trưa', 'Ăn tối buffet'],
          attractions: ['Chùa Long Sơn', 'Bảo Tàng Ngọc Trai', 'Vinpearl Land', 'Cáp treo vượt biển'],
          accommodationText: 'KS 4 sao Nha Trang (trung tâm thành phố)',
          content:
            'Sáng: Khởi hành đến Nha Trang, tham quan Chùa Long Sơn (Bụt trắng 24m), Nhà Hát Đó, Bảo Tàng Ngọc Trai (mua sắm quà lưu niệm). Trưa: Ăn trưa nhà hàng trung tâm Nha Trang. Chiều: Qua đảo Vinpearl Land bằng Cáp Treo vượt biển, vui chơi trò chơi ở Khu vui chơi Đảo Đảo, checkin Phố Cảng Vinpearl Harbour. Tối: Buffet quốc tế tại Vinpearl Harbour, ngắm pháo hoa cuối tuần (nếu có lịch trình).',
        },
        {
          label: 'Ngày 3',
          title: 'Vịnh NHA PHU - Du thuyền 3 đảo',
          meals: ['Ăn sáng', 'Ăn trưa trên du thuyền', 'Ăn tối'],
          attractions: ['Vịnh Nha Phu', 'Đảo Khỉ', 'Đảo Mèo', 'Vườn lan Nha Phu'],
          accommodationText: 'KS 4 sao Ninh Hòa (vùng Bình Lập)',
          content:
            'Sáng 07h30: Xe đón đoàn đi Vịnh Nha Phu, lên du thuyền VIP thăm 3 đảo: Đảo Khỉ, Đảo Mèo, Vườn Lan Nha Phu. Lặn ngắm san hô, chèo sup, tắm biển, tham quan vườn lan. Trưa: Ăn trưa hải sản tươi sống ngay trên du thuyền. Chiều: Quay bến, di chuyển về khách sạn Ninh Hòa, nghỉ ngơi, tham quan khu tắm khoáng Bình Lập (tùy chọn). Tối: Ăn tối nhà hàng, thưởng thức lẩu gà lá giang / hải sản.',
        },
        {
          label: 'Ngày 4',
          title: 'Ninh Hòa - TP. Hồ Chí Minh (về đêm)',
          meals: ['Ăn sáng', 'Ăn trưa'],
          attractions: ['Chợ Ninh Hòa', 'Công viên Cái Nước (checkin nhanh)'],
          accommodationText: 'Nghỉ đêm trên xe Limousine',
          content:
            'Sáng: Trả phòng, tham quan Chợ Ninh Hòa, mua sắm đặc sản: mắm nêm, cá khô, dừa sáp. Trưa: Ăn trưa nhà hàng. 13h30: Khởi hành về lại TP. HCM. Tại các điểm dừng chân, quý khách nghỉ ngơi, ăn uống. Tối: Đến nơi, chia tay đoàn và hẹn gặp lại trong các hành trình sắp tới.',
        },
      ],
      priceTable: [
        { label: 'Người lớn (từ 10 tuổi trở lên)', amount: 2386000 },
        { label: 'Trẻ em (từ 5 đến dưới 10 tuổi)', amount: 1670200 },
        { label: 'Em bé (dưới 5 tuổi, không giường)', amount: 0 },
      ],
      surcharges: [
        { label: 'Phụ thu khách ngoại quốc (1 khách)', amount: 500000 },
        { label: 'Phụ thu phòng đơn (1 đêm)', amount: 700000 },
        { label: 'Nâng cấp KS 5 sao (toàn bộ tour)', amount: 2100000 },
      ],
      departures: [
        {
          departureDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          standardText: 'Khách sạn 4 sao (Vĩnh Hy / Nha Trang / Ninh Hòa)',
          priceAdult: 2386000,
          priceChild: 1670200,
          priceInfant: 0,
          originalPriceAdult: 2799000,
          originalPriceChild: 1999000,
          originalPriceInfant: null,
          discountPercent: 15,
          seatsTotal: 29,
          seatsAvailable: 8,
          status: 'open',
        },
        {
          departureDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          standardText: 'Khách sạn 4 sao (Tour cao cấp)',
          priceAdult: 2486000,
          priceChild: 1720200,
          priceInfant: 0,
          originalPriceAdult: 2899000,
          originalPriceChild: 2050000,
          originalPriceInfant: null,
          discountPercent: 14,
          seatsTotal: 29,
          seatsAvailable: 22,
          status: 'open',
        },
      ],
      faq: [
        {
          question: 'Tour có cần Visa / giấy tờ tùy thân gì không?',
          answer:
            'Đối với khách Việt Nam: Căn cước công dân (để nhận phòng KS). Đối với khách ngoại quốc: Hộ chiếu còn hạn tối thiểu 6 tháng, giấy phép tạm trú hợp lệ tại Việt Nam.',
        },
        {
          question: 'Khách ăn kiêng / dị ứng đồ hải sản được không?',
          answer:
            'Được. Quý khách vui lòng ghi rõ yêu cầu ăn kiêng, dị ứng hải sản / đạm động vật, đậu nành, lactose khi đăng ký tour. Nhà hàng sẽ chuẩn bị đồ ăn riêng theo yêu cầu.',
        },
        {
          question: 'Trẻ dưới 12 tuổi đi cùng có cần giường riêng không?',
          answer:
            'Trẻ từ 5-9 tuổi mặc định không giường riêng (chia giường với người lớn). Nếu cần giường bổ sung vui lòng đặt phụ thu thêm giường (700k/đêm). Trẻ trên 10 tuổi tính như người lớn.',
        },
        {
          question: 'Nếu hủy tour mức phí bao nhiêu?',
          answer:
            'Sau đăng ký 2 tiếng (đã giữ chỗ): phạt 30%. Trước ngày đi 20 ngày: phạt 50%. Trước 10-19 ngày: phạt 75%. Trước 0-10 ngày / không đến: phạt 100%.',
        },
      ],
      seo: {
        metaTitle: 'Tour HCM - Ninh Chữ - Nha Trang - Vĩnh Nha Phu 4N3Đ | Ưu đãi 15%',
        metaDescription:
          'Tour 4 ngày 3 đêm: Vịnh Ninh Chữ, Vĩnh Hy, Vinpearl Land, Vịnh Nha Phu. Xe Limousine 29 chỗ, KS 4 sao, lặn san hô, du thuyền 3 đảo. Giá 2.386.000đ, ưu đãi 15% giờ chót.',
        canonicalUrl: null,
        ogImageUrl: null,
      },
      includedText:
        '• Xe du lịch Limousine đời mới, máy lạnh, wifi, nước uống suốt hành trình.\n• HDV tiếng Việt chuyên nghiệp có kinh nghiệm.\n• 3 đêm khách sạn 4 sao theo tiêu chuẩn (2-3 khách/phòng, view biển tùy suất nhận phòng).\n• Ăn theo chương trình: 3 bữa sáng, 4 bữa trưa, 3 bữa tối (buffet / hải sản tươi / set menu).\n• Vé tàu đáy kính + du thuyền 3 đảo Vịnh Nha Phu + Cáp treo vượt biển (chiều đi - chiều về).\n• Vé tham quan các điểm trong chương trình, bảo hiểm du lịch 24/7.',
      excludedText:
        '• Chi phí cá nhân: TIP cho HDV/Tài xế (50k/ngày), đồ uống, thuê vật tư lặn/sup ngoài chương trình.\n• Giặt là, dịch vụ massage, mua sắm quà lưu niệm tại các gian hàng chợ.\n• Phụ thu phòng đơn (700.000đ/đêm), nâng cấp KS 5 sao (2.100.000đ/khách).\n• Các dịch vụ, vé tham quan không được liệt kê trong chương trình.',
      childPolicyText:
        '• Dưới 05 tuổi: MIỄN PHÍ (không vé tham quan, không giường, không bữa ăn riêng). Chi phí phát sinh trong tour tự túc.\n• 05 – dưới 10 tuổi: 70% giá người lớn (chia giường với người lớn, ăn như người lớn, vé tham quan như người lớn).\n• Từ 10 tuổi trở lên: giá như người lớn, có giường riêng (2-3 khách/phòng).\n• Trẻ sinh non / cần chăm sóc đặc biệt, vui lòng báo trước khi đăng ký để sắp xếp dịch vụ hỗ trợ.',
      cancelPolicyText:
        '• Sau đăng ký 2 tiếng (đã giữ chỗ): 30% tổng giá tour.\n• Trước ngày khởi hành ≥20 ngày: phạt 50% tổng giá tour.\n• Trước ngày khởi hành 10-19 ngày: phạt 75% tổng giá tour.\n• Trước 0-10 ngày hoặc không đến (no show): phạt 100% tổng giá tour.\n• Miễn phí hủy khi bệnh tật (có xác nhận bệnh viện chính thức 48 tiếng trước khởi hành, áp dụng với khách chưa thanh toán thêm bảo hiểm ngoài trọn gói).',
      noteText:
        '• Thứ tự điểm tham quan có thể thay đổi theo tình hình thời tiết, giao thông, tắc đường lễ hội, nhưng vẫn đảm bảo nội dung chương trình.\n• Nếu khách đi riêng, vui lòng đặt cọc trước 30% (để giữ chỗ và vé tham quan).\n• Hướng dẫn viên có quyền từ chối các yêu cầu đi lệch lịch trình ảnh hưởng tới đoàn chung.\n• Nên chuẩn bị giày dép bãi biển, kem chống nắng, mũ, thuốc cá nhân (say xe, tiêu hóa, cảm lạnh…).',
      pickupPoints: [
        { address: 'Công ty du lịch / 135 Nguyễn Thị Minh Khai, Q.3, TP. HCM', time: '21h00', note: 'Điểm đón tập trung' },
        { address: 'Ga Sài Gòn / Bến Xe Miền Đông', time: '21h20', note: 'Khách cần có mặt trước 10 phút' },
        { address: 'VivoCity / Nguyễn Văn Linh, TP. Thủ Đức', time: '21h45', note: 'Điểm đón phụ (đăng ký trước)' },
      ],
    }
    await tours.create(tourData)
    existingTour = await tours.findBySlugAdmin(sampleSlug)
  }

  if (existingTour) {
    const departures = (existingTour.departures || []) as any[]
    const dep7 = departures[0]
    const dep21 = departures[1]
    if (dep7 && dep21) {
      // Chỉ seed bookings mẫu nếu chưa từng có (admin list rỗng)
      const countCheck = await bookings.adminListBookings({ limit: 1, page: 1 })
      if (!countCheck.total) {
        const mkD = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
        const today7 = new Date()
        const b7y = today7.getFullYear() - 30
        const b8y = today7.getFullYear() - 8
        const b2y = today7.getFullYear() - 2
        try {
          // Đơn 1: new, dep7, 2 NL + 1 TE, CK ngân hàng
          const b1 = await bookings.createBookingForTour(sampleSlug, {
            departureId: String(dep7._id || dep7.id),
            adultCount: 2,
            childCount: 1,
            infantCount: 0,
            contact: { name: 'Nguyễn Thị Mai Anh', phone: '0912111222', email: 'maianh.nguyen@example.vn', address: '123 Lê Lợi, Q.1, TP.HCM' },
            passengers: [
              { type: 'NL', fullName: 'Nguyễn Văn Bình', birthDate: mkD(new Date(b7y, 1, 15)), gender: 'male', idCard: '079195001234', notes: 'Phòng số 2 khách sạn tầng 2' },
              { type: 'NL', fullName: 'Nguyễn Thị Mai Anh', birthDate: mkD(new Date(b7y + 3, 4, 22)), gender: 'female', idCard: '079198004567', notes: null },
              { type: 'TE', fullName: 'Nguyễn Ngọc Hân', birthDate: mkD(new Date(b8y, 7, 3)), gender: 'female', idCard: '', notes: 'Ăn chay nhẹ' },
            ],
            surcharges: [],
            notes: 'Khách có quà cáp cần khoá hành lý riêng, cần hỗ trợ khi lên xe.',
            paymentMethod: 'bank_transfer',
            agreeTerms: true,
          }, null)
          // Đơn 2: new, dep21, 1 NL + 1 EB, hold
          const b2 = await bookings.createBookingForTour(sampleSlug, {
            departureId: String(dep21._id || dep21.id),
            adultCount: 1,
            childCount: 0,
            infantCount: 1,
            contact: { name: 'Trần Văn Khoa', phone: '0909555432', email: 'khoa.tran@example.vn', address: '20 Điện Biên Phủ, Q.3, TP.HCM' },
            passengers: [
              { type: 'NL', fullName: 'Trần Văn Khoa', birthDate: mkD(new Date(b7y - 2, 9, 9)), gender: 'male', idCard: '079200008877', notes: null },
              { type: 'EB', fullName: 'Trần Bảo An', birthDate: mkD(new Date(b2y, 1, 26)), gender: 'male', idCard: '', notes: 'Cảm lạnh, thuốc có sẵn, cần giường chống tuột' },
            ],
            surcharges: [
              { label: 'Phụ thu phòng đơn (1 đêm)', note: 'Đơn phòng riêng 3 đêm, tour cho 1 khách', quantity: 3, unitPrice: 700000 },
            ],
            notes: 'Đơn đặt cọc giữ chỗ 24h, sẽ thanh toán CK đầy đủ sau khi nhận email xác nhận.',
            paymentMethod: 'hold',
            agreeTerms: true,
          }, null)
          // Đơn 3: confirmed, dep7, 2 NL + 1 TE, CK đã thanh toán
          const b3 = await bookings.createBookingForTour(sampleSlug, {
            departureId: String(dep7._id || dep7.id),
            adultCount: 2,
            childCount: 1,
            infantCount: 0,
            contact: { name: 'Lê Thị Hồng Nhung', phone: '0938222333', email: 'nhung.le@example.vn', address: '456 Trường Chinh, Q.12, TP.HCM' },
            passengers: [
              { type: 'NL', fullName: 'Lê Minh Hoàng', birthDate: mkD(new Date(b7y - 5, 5, 10)), gender: 'male', idCard: '078198001112', notes: null },
              { type: 'NL', fullName: 'Lê Thị Hồng Nhung', birthDate: mkD(new Date(b7y - 1, 11, 27)), gender: 'female', idCard: '078199003344', notes: null },
              { type: 'TE', fullName: 'Lê Minh Khoi', birthDate: mkD(new Date(b8y + 1, 3, 18)), gender: 'male', idCard: '', notes: 'Dị ứng hải sản cua, ghẹ' },
            ],
            surcharges: [
              { label: 'Nâng cấp KS 5 sao (toàn bộ tour)', note: 'Nâng cấp 3 khách', quantity: 3, unitPrice: 2100000 },
            ],
            notes: 'Chuyển khoản ngân hàng Vietcombank ngày 02/06, mã GD CB234589991.',
            paymentMethod: 'bank_transfer',
            agreeTerms: true,
          }, null)
          await bookings.updateStatus(b3.id || b3.code, { status: 'confirmed', adminNote: 'Đã nhận tiền đủ, KXN email ngày xác nhận booking mẫu.', sendBackSeatsOnCancel: false })
          // Đơn 4: confirmed, dep21, 4 NL (nhóm bạn)
          const b4 = await bookings.createBookingForTour(sampleSlug, {
            departureId: String(dep21._id || dep21.id),
            adultCount: 4,
            childCount: 0,
            infantCount: 0,
            contact: { name: 'Phạm Đức Long', phone: '0977123456', email: 'long.pham@example.vn', address: '789 Kha Vạn Cân, TP. Thủ Đức' },
            passengers: [
              { type: 'NL', fullName: 'Phạm Đức Long', birthDate: mkD(new Date(b7y + 1, 6, 30)), gender: 'male', idCard: '081199007766', notes: null },
              { type: 'NL', fullName: 'Hoàng Nam Sơn', birthDate: mkD(new Date(b7y + 1, 4, 15)), gender: 'male', idCard: '081199007777', notes: null },
              { type: 'NL', fullName: 'Vũ Quỳnh Anh', birthDate: mkD(new Date(b7y + 1, 8, 3)), gender: 'female', idCard: '081199007788', notes: 'Yoga, cần thức sớm 5h30 để tập' },
              { type: 'NL', fullName: 'Đỗ Bảo Ngọc', birthDate: mkD(new Date(b7y + 1, 10, 24)), gender: 'female', idCard: '081199007799', notes: null },
            ],
            surcharges: [],
            notes: 'Nhóm bạn sinh viên, phương thức thanh toán tiền mặt khi nhận vé tại văn phòng ngày 12/6.',
            paymentMethod: 'hold',
            agreeTerms: true,
          }, null)
          await bookings.updateStatus(b4.id || b4.code, { status: 'confirmed', adminNote: 'Đã nhận tiền mặt tại VP, nhân viên An kiểm tra.', sendBackSeatsOnCancel: false })
          // Đơn 5: cancelled, dep7, 3 NL - (test trả chỗ)
          const b5 = await bookings.createBookingForTour(sampleSlug, {
            departureId: String(dep7._id || dep7.id),
            adultCount: 3,
            childCount: 0,
            infantCount: 0,
            contact: { name: 'Ngô Hoàng Nam', phone: '0918999666', email: 'nam.ngo@example.vn', address: '999 Nguyễn Thị Thập, Q.7' },
            passengers: [
              { type: 'NL', fullName: 'Ngô Hoàng Nam', birthDate: mkD(new Date(b7y, 2, 28)), gender: 'male', idCard: '079201009988', notes: null },
              { type: 'NL', fullName: 'Bùi Lan Hương', birthDate: mkD(new Date(b7y + 2, 10, 12)), gender: 'female', idCard: '079202009977', notes: null },
              { type: 'NL', fullName: 'Bùi Khánh Linh', birthDate: mkD(new Date(b7y + 5, 12, 19)), gender: 'female', idCard: '079203009966', notes: null },
            ],
            surcharges: [],
            notes: 'Khách gặp việc gia đình đột xuất, hủy trước ngày đi 28 ngày.',
            paymentMethod: 'bank_transfer',
            agreeTerms: true,
          }, null)
          await bookings.updateStatus(b5.id || b5.code, { status: 'cancelled', adminNote: 'Hủy theo yêu cầu khách + hoàn tiền 70% theo điều khoản hủy tour 20+ ngày.', sendBackSeatsOnCancel: true })
        } catch {
          // ignore booking seed errors (duplicate code, etc.)
        }
      }
    }
  }

  if (email && password) {
    const existing = await users.findByEmail(email)
    if (!existing) {
      const passwordHash = await bcrypt.hash(password, 10)
      await users.createUser({ name: 'Admin', email, passwordHash, role: 'admin' })
    }
  }

  const seededStaff = await seedStaff(users)
  await seedGroupTourRequests(groupTours, seededStaff)

  await app.close()
}

seed()
