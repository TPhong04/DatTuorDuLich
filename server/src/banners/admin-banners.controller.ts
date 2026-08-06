import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { BannersService } from './banners.service'
import { createBannerDto, reorderBannersDto, updateBannerDto } from './dto'

function toAdminBanner(b: any) {
  return {
    id: b.id,
    title: b.title,
    imageUrl: b.imageUrl,
    targetType: b.targetType,
    targetValue: b.targetValue,
    openInNewTab: b.openInNewTab,
    order: b.order,
    isActive: b.isActive,
    startAt: b.startAt ? b.startAt.toISOString() : null,
    endAt: b.endAt ? b.endAt.toISOString() : null,
    createdAt: b.createdAt ? b.createdAt.toISOString() : null,
    updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
  }
}

@Controller('admin/banners')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminBannersController {
  constructor(
    private readonly banners: BannersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  @Get()
  async list() {
    const items = await this.banners.listAdmin()
    return { items: items.map(toAdminBanner) }
  }

  @Post()
  async create(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(createBannerDto, body)
    const created = await this.banners.create(dto)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.banner.create',
      entityType: 'banner',
      entityId: created.id,
      meta: { banner: toAdminBanner(created) },
    })
    return toAdminBanner(created)
  }

  @Patch('reorder')
  async reorder(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(reorderBannersDto, body)
    await this.banners.reorder(dto.ids)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.banner.reorder',
      entityType: 'banner',
      entityId: null,
      meta: { ids: dto.ids },
    })
    return { ok: true }
  }

  @Patch(':id')
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(updateBannerDto, body)
    const updated = await this.banners.update(id, dto)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.banner.update',
      entityType: 'banner',
      entityId: id,
      meta: { patch: dto },
    })
    return toAdminBanner(updated)
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    const removed = await this.banners.remove(id)
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.banner.delete',
      entityType: 'banner',
      entityId: id,
      meta: { banner: toAdminBanner(removed) },
    })
    return { ok: true }
  }

  private parse<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) throw new BadRequestException('Dữ liệu không hợp lệ')
      throw e
    }
  }
}
