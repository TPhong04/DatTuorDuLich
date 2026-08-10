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
  updateReviewDto,
  setReviewStatusDto,
  patchReviewPermissionsDto,
  adminReplyReviewDto,
  bulkReviewActionDto,
} from './dto'
import { ReviewsService } from './reviews.service'

@Controller('admin/reviews')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin', 'staff')
export class AdminReviewsController {
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
    @Query('tourSlug') tourSlug?: string,
    @Query('rating') rating?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('isReported') isReported?: string,
    @Query('requireStaffRemoval') requireStaffRemoval?: string,
    @Query('onlyMine') onlyMine?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('ids') ids?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const dto = this.parse(listReviewsQueryDto, {
      tourId,
      tourSlug,
      rating,
      status,
      customerId,
      isReported,
      requireStaffRemoval,
      onlyMine,
      sort,
      search,
      ids,
      page,
      pageSize,
    })
    return this.reviews.listAdmin(dto as any, actor)
  }

  @Patch(':id')
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(updateReviewDto, body)
    const updated = await this.reviews.update(id, dto as any, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.review.update',
      entityType: 'review',
      entityId: id,
      meta: { patch: Object.keys(dto as any) },
    })
    return updated
  }

  @Patch(':id/status')
  async setStatus(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(setReviewStatusDto, body)
    const res = await this.reviews.setStatus(id, dto, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.review.status',
      entityType: 'review',
      entityId: id,
      meta: { status: dto.status, before: (res as any).beforeStatus },
    })
    return res
  }

  @Patch(':id/permissions')
  async patchPermissions(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(patchReviewPermissionsDto, body)
    const updated = await this.reviews.patchPermissions(id, dto, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.review.permissions',
      entityType: 'review',
      entityId: id,
      meta: dto,
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
      action: 'admin.review.delete',
      entityType: 'review',
      entityId: id,
      meta: {},
    })
    return res
  }

  @Post(':id/admin-reply')
  async adminReply(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(adminReplyReviewDto, body)
    const updated = await this.reviews.adminReply(id, dto, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.review.admin_reply',
      entityType: 'review',
      entityId: id,
      meta: { length: dto.content.length },
    })
    return updated
  }

  @Post('bulk')
  async bulk(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(bulkReviewActionDto, body)
    const result = await this.reviews.bulkAction(dto as any, actor)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.review.bulk',
      entityType: 'review',
      entityId: null,
      meta: { action: dto.action, processed: result.processed },
    })
    return result
  }
}
