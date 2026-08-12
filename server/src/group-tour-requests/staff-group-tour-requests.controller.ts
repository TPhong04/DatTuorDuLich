import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { Types } from 'mongoose'
import { GroupTourRequestsService } from './group-tour-requests.service'
import { AdminPatchGroupTourRequestDTO, AdminPatchGroupTourRequestZod } from './dto'
import { GroupTourRequestStatus } from './group-tour-request.schema'
import { BadRequestException } from '@nestjs/common'
import { ZodError } from 'zod'

@Controller('staff/group-tour-requests')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff')
export class StaffGroupTourRequestsController {
  constructor(private readonly svc: GroupTourRequestsService) {}

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
    @Query('onlyMine') onlyMine: string | undefined,
    @Query('search') searchKeyword: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Query('sort') sort: 'newest' | 'oldest' | 'priority' | 'follow_up' | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const mine = onlyMine !== '0' && onlyMine !== 'false' && onlyMine !== 'all'
    const res = await this.svc.list({
      status, priority,
      mine,
      searchKeyword,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      sort,
    }, actorId)
    return { ok: true, ...res, forcedScope: 'onlyMine=' + (mine ? '1' : '0') }
  }

  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() u: JwtPayload) {
    const doc = await this.svc.getById(id)
    const actorId = new Types.ObjectId(u.sub)
    if (doc.assignedStaffId && String(doc.assignedStaffId) !== String(actorId)) {
      // staff read-only can still view, admin controller handles full
    }
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
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Bạn không được phép sửa yêu cầu này. Chỉ sửa những yêu cầu admin giao cho bạn.')
    }
    if ((data as any).assignedStaffId !== undefined) {
      throw new BadRequestException('Staff không được tự điều phối nhân viên.')
    }
    const row = await this.svc.patch(id, data, actorId, 'staff')
    return { ok: true, row }
  }

  @Patch(':id/mark-contacted')
  async markContacted(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    const actorId = new Types.ObjectId(u.sub)
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Chỉ staff được giao yêu cầu này mới mark đã liên hệ.')
    }
    const row = await this.svc.markContacted(id, actorId, 'staff')
    return { ok: true, row }
  }

  @Patch(':id/mark-quoting')
  async markQuoting(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { summary?: string; followUpDays?: number } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Chỉ staff được giao yêu cầu này mới chuyển trạng thái báo giá.')
    }
    const row = await this.svc.markQuoting(id, actorId, 'staff', body?.summary, body?.followUpDays ?? 1)
    return { ok: true, row, message: 'Đã cập nhật trạng thái Đã gửi báo giá, tự động tăng counter báo giá.' }
  }

  @Patch(':id/mark-negotiating')
  async markNegotiating(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { note?: string; followUpDays?: number } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Chỉ staff được giao yêu cầu này mới chuyển trạng thái đàm phán.')
    }
    const row = await this.svc.markNegotiating(id, actorId, 'staff', body?.note, body?.followUpDays ?? 2)
    return { ok: true, row, message: 'Đã cập nhật trạng thái Đàm phán (tự động lịch follow-up 2 ngày tới).' }
  }

  @Patch(':id/mark-won')
  async markWon(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { note?: string } | undefined,
  ) {
    const actorId = new Types.ObjectId(u.sub)
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Chỉ staff được giao yêu cầu này mới mark chốt đơn.')
    }
    const row = await this.svc.markWon(id, actorId, 'staff', body?.note)
    return { ok: true, row, message: '🎉 Chúc mừng! Đã chốt đơn won, tự động lưu thời gian chốt + note.' }
  }

  @Patch(':id/mark-lost')
  async markLost(
    @CurrentUser() u: JwtPayload,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    if (!body?.reason || String(body.reason).trim().length < 2) throw new BadRequestException('Cần nêu lý do thua đơn (tối thiểu 2 ký tự).')
    const actorId = new Types.ObjectId(u.sub)
    const doc = await this.svc.getById(id)
    if (!doc.assignedStaffId || String(doc.assignedStaffId) !== String(actorId)) {
      throw new BadRequestException('Chỉ staff được giao yêu cầu này mới mark thua đơn.')
    }
    const row = await this.svc.markLost(id, actorId, 'staff', String(body.reason).trim())
    return { ok: true, row, message: 'Đã lưu lý do thua đơn, hỗ trợ thống kê đối thủ cạnh tranh.' }
  }
}
