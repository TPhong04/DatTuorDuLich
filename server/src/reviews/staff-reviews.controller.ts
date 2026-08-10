import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import {
  listReviewsQueryDto,
  staffReplyReviewDto,
  bulkReviewActionDto,
} from './dto'
import { ReviewsService } from './reviews.service'

@Controller('staff/reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('staff', 'admin')
export class StaffReviewsController {
  constructor(
    private readonly reviews: ReviewsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private parse<T>(schema: { parse: (v: unknown) => T }, body: unknown): T {
    try {
      return schema.parse(body)
    } catch (err) {
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
    @CurrentUser() actor: JwtPayload,
    @Query('tourId') tourId?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
    @Query('isReported') isReported?: string,
    @Query('requireStaffRemoval') requireStaffRemoval?: string,
    @Query('onlyMine') onlyMine?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const onlyMineVal = actor.role === 'staff' ? (onlyMine === undefined ? 'true' : onlyMine) : onlyMine
    const dto = this.parse(listReviewsQueryDto, {
      tourId,
      rating,
      status,
      isReported,
      requireStaffRemoval,
      onlyMine: onlyMineVal,
      sort,
      search,
      page,
      pageSize,
    })
    return this.reviews.listAdmin(dto as any, actor)
  }

  @Post(':id/staff-reply')
  async staffReply(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(staffReplyReviewDto, body)
    const updated = await this.reviews.staffReply(id, dto, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'staff.review.reply',
      entityType: 'review',
      entityId: id,
      meta: { length: dto.content.length },
    })
    return updated
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    const res = await this.reviews.remove(id, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'staff.review.delete',
      entityType: 'review',
      entityId: id,
      meta: { via: 'requireStaffRemoval OR canStaffDelete' },
    })
    return res
  }

  @Post('bulk')
  async bulk(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(bulkReviewActionDto, body)
    if (actor.role !== 'admin' && (dto.action === 'assign_staff' || dto.action === 'unassign_staff' || dto.action === 'hide' || dto.action === 'publish')) {
      throw new BadRequestException('Staff không được bulk action assign/hide/publish, chỉ được delete bài admin cho phép')
    }
    const result = await this.reviews.bulkAction(dto as any, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'staff.review.bulk',
      entityType: 'review',
      entityId: null,
      meta: { action: dto.action, processed: result.processed },
    })
    return result
  }
}
