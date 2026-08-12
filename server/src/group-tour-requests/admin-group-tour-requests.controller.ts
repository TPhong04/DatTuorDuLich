import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { Types } from 'mongoose'
import { GroupTourRequestsService } from './group-tour-requests.service'
import { AdminPatchGroupTourRequestDTO, AdminPatchGroupTourRequestZod } from './dto'
import { GroupTourRequestPriority, GroupTourRequestStatus } from './group-tour-request.schema'
import { UsersService } from '../users/users.service'

@Controller('admin/group-tour-requests')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminGroupTourRequestsController {
  constructor(
    private readonly svc: GroupTourRequestsService,
    private readonly users: UsersService,
  ) {}

  private parse<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
    try { return schema.parse(body) } catch (err) {
      if (err instanceof ZodError) {
        const first = err.errors[0]
        const msg = first ? `${first.path.join('.')}: ${first.message}` : 'Dữ liệu không hợp lệ'
        throw new BadRequestException(msg)
      }
      throw err
    }
  }

  @Get()
  async list(
    @CurrentUser() u: JwtPayload,
    @Query('status') status: GroupTourRequestStatus | undefined,
    @Query('priority') priority: 'low' | 'normal' | 'high' | 'urgent' | undefined,
    @Query('assignedStaffId') assignedStaffId: string | undefined,
    @Query('mine') mine: string | undefined,
    @Query('search') searchKeyword: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('sort') sort: 'newest' | 'oldest' | 'priority' | 'follow_up' | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const res = await this.svc.list({
      status, priority, assignedStaffId,
      mine: mine === '1' || mine === 'true',
      searchKeyword,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      sort,
    }, actorId)
    return { ok: true, ...res }
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const doc = await this.svc.getById(id)
    return { ok: true, row: doc }
  }

  @Patch(':id')
  async patch(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: AdminPatchGroupTourRequestDTO,
  ) {
    const data = this.parse(AdminPatchGroupTourRequestZod, body)
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.patch(id, data, actorId, actorRole)
    return { ok: true, row }
  }

  @Get('staff/list')
  async listStaff() {
    const res = await this.users.adminListUsers({ role: 'staff', isActive: true, limit: 200, page: 1 })
    const rows = res.items.map((u) => ({
      id: (u._id as any)?.toString() ?? u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      avatarUrl: u.avatarUrl ?? null,
    }))
    return { ok: true, rows, total: res.total }
  }

  @Patch(':id/mark-contacted')
  async markContacted(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.markContacted(id, actorId, actorRole)
    return { ok: true, row }
  }

  @Patch(':id/mark-quoting')
  async markQuoting(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { summary?: string; followUpDays?: number } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.markQuoting(id, actorId, actorRole, body?.summary, body?.followUpDays ?? 1)
    return { ok: true, row, message: 'Đã cập nhật Đã gửi báo giá, tăng counter quote +1.' }
  }

  @Patch(':id/mark-negotiating')
  async markNegotiating(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { note?: string; followUpDays?: number } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.markNegotiating(id, actorId, actorRole, body?.note, body?.followUpDays ?? 2)
    return { ok: true, row, message: 'Đã chuyển trạng thái Đàm phán + followUp + 2 ngày.' }
  }

  @Patch(':id/mark-won')
  async markWon(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { note?: string } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.markWon(id, actorId, actorRole, body?.note)
    return { ok: true, row, message: '🎉 Chốt đơn won thành công.' }
  }

  @Patch(':id/mark-lost')
  async markLost(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason || String(body.reason).trim().length < 2) throw new BadRequestException('Cần nêu lý do thua đơn.')
    const actorId = new Types.ObjectId(u.sub)
    const actorRole: 'admin' | 'staff' = u.role === 'admin' ? 'admin' : 'staff'
    const row = await this.svc.markLost(id, actorId, actorRole, String(body.reason).trim())
    return { ok: true, row, message: 'Đã lưu lý do thua đơn.' }
  }

  @Post('_dev/seed-samples')
  async seedSamples(@CurrentUser() u: JwtPayload) {
    const check = await this.svc.list({ page: 1, pageSize: 1 }, new Types.ObjectId(u.sub))
    if (check.total >= 5) return { ok: true, skipped: true, message: 'Đã có >= 5 yêu cầu, bỏ qua tạo mẫu (có thể xóa dữ liệu cũ trước khi tạo lại).', total: check.total }
    const staffRes = await this.users.adminListUsers({ role: 'staff', isActive: true, limit: 100, page: 1 })
    const staffList = staffRes.items
    if (!staffList.length) throw new BadRequestException('Hệ thống chưa có user nào role=staff. Vui lòng tạo user staff trong mục Quản trị → Người dùng trước khi tạo mẫu đơn.')
    const pickStaff = (idx: number) => {
      const uDoc = staffList[idx % staffList.length]
      return new Types.ObjectId((uDoc._id as any)?.toString() ?? uDoc.id)
    }
    const mkDate = (offsetDays: number) => new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000).toISOString()
    const samples: Array<{
      status: GroupTourRequestStatus; priority: GroupTourRequestPriority;
      contactName: string; contactPhone: string; contactEmail: string | null; contactRole: string | null;
      companyOrGroupName: string; companyTaxCode: string | null;
      adultCount: number; childCount: number; infantCount: number;
      departureCity: string; destination: string; approximateDurationText: string;
      preferredStartDate: string | null; hotelClassRequested: string | null;
      servicesPreference: { needVisa: boolean; needFlight: boolean; needBus: boolean; needHotel: boolean; needMeals: boolean; needGuide: boolean };
      budgetPerPersonVnd: number | null; totalBudgetVnd: number | null;
      assignedStaffIdx: number | null;
      specialRequirements?: string | null;
      lastQuoteSummary?: string | null;
      quoteCount?: number;
      lostReason?: string | null;
      wonAtOffsetDays?: number;
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
        assignedStaffIdx: 0,
        specialRequirements: 'Cần 2 xe 45 chỗ Limousine, 30 phòng đôi + 10 phòng 3 người, ăn chay 12 người, cần phòng họp team building 1 buổi tối.',
        quoteCount: 0,
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
        assignedStaffIdx: 1,
        specialRequirements: 'Thang máy khách sạn, ăn ít rau muống, cần xe 29 chỗ 2 chiếc, hỗ trợ VAT 0% xuất hóa đơn.',
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
        assignedStaffIdx: null,
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
        assignedStaffIdx: 2,
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
        assignedStaffIdx: 0,
        lastQuoteSummary: 'Đã chốt gói 3N2Đ xe 45 chỗ + KS 3 sao trung tâm = 2.800.000đ/HS', quoteCount: 2, wonAtOffsetDays: -2,
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
        assignedStaffIdx: 3,
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
        assignedStaffIdx: null,
        specialRequirements: 'Cần 10 villa 3 phòng ngủ (3 thế hệ họ Võ), BBQ 2 tối, cần xe đẩy sân bay mỗi tòa nhà.',
      },
    ]
    const createdIds: string[] = []
    const failed: string[] = []
    const sysActor = new Types.ObjectId(u.sub)
    for (const r of samples) {
      try {
        const created = await this.svc.createPublic({
          contactName: r.contactName, contactPhone: r.contactPhone, contactEmail: r.contactEmail, contactRole: r.contactRole,
          companyOrGroupName: r.companyOrGroupName, companyTaxCode: r.companyTaxCode,
          adultCount: r.adultCount, childCount: r.childCount, infantCount: r.infantCount,
          departureCity: r.departureCity, destination: r.destination, approximateDurationText: r.approximateDurationText,
          preferredStartDate: r.preferredStartDate, preferredEndDate: null,
          hotelClassRequested: r.hotelClassRequested,
          servicesPreference: r.servicesPreference,
          transportRequestedNotes: null,
          budgetPerPersonVnd: r.budgetPerPersonVnd, totalBudgetVnd: r.totalBudgetVnd,
          specialRequirements: r.specialRequirements ?? null,
          sourceChannel: 'admin_seed_samples',
        }, { createdByUserId: null, ip: '127.0.0.1' })
        const patch: any = { status: r.status, priority: r.priority }
        if (r.assignedStaffIdx !== null) {
          const sid = pickStaff(r.assignedStaffIdx)
          patch.assignedStaffId = sid.toString()
        }
        if (r.lastQuoteSummary) patch.lastQuoteSummary = r.lastQuoteSummary
        if (typeof r.quoteCount === 'number') patch.quoteCount = r.quoteCount
        if (r.lostReason) patch.lostReason = r.lostReason
        if (typeof r.wonAtOffsetDays === 'number') {
          patch.wonAt = mkDate(r.wonAtOffsetDays)
          patch.lastContactedAt = mkDate(r.wonAtOffsetDays)
        }
        if (r.status === 'quoting' || r.status === 'negotiating' || r.status === 'won') patch.lastContactedAt = mkDate(-1)
        if (r.status === 'contacted' || r.status === 'new') patch.followUpAt = mkDate(1)
        await this.svc.patch((created._id as any).toString(), patch as any, sysActor, 'admin')
        createdIds.push((created._id as any).toString())
      } catch (e: any) {
        failed.push(`${r.companyOrGroupName}: ${String(e?.message || e || 'unknown')}`)
      }
    }
    const after = await this.svc.list({ page: 1, pageSize: 1 }, sysActor)
    return { ok: true, created: createdIds.length, failed: failed.length, failedReasons: failed, total: after.total, staffCount: staffList.length }
  }
}
