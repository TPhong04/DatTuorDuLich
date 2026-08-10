import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ZodError } from 'zod'

import { JwtPayload } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import {
  createPostDto,
  importRssFeedsDto,
  patchPostPermissionsDto,
  publishPostDto,
  updatePostDto,
} from './dto'
import { AdminPostActor, PostsService, toAdminPost } from './posts.service'

@Controller('admin/posts')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin', 'staff')
export class AdminPostsController {
  constructor(
    private readonly posts: PostsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  private toActor(u: JwtPayload): AdminPostActor {
    return { sub: u.sub, email: u.email, role: u.role === 'admin' || u.role === 'staff' ? u.role : 'staff' }
  }

  @Get()
  async list(
    @CurrentUser() actor: JwtPayload,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('authorId') authorId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.posts.listAdmin({
      status,
      category,
      authorId,
      search,
      page: Number(page ?? 1),
      pageSize: Number(pageSize ?? 25),
      actor: this.toActor(actor),
    })
  }

  @Post()
  async create(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(createPostDto, body)
    const created = await this.posts.create(dto, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.create',
      entityType: 'post',
      entityId: created.id,
      meta: { title: created.title, status: created.status, category: created.category },
    })
    return created
  }

  @Patch(':id')
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(updatePostDto, body)
    const updated = await this.posts.update(id, dto, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.update',
      entityType: 'post',
      entityId: id,
      meta: { patch: Object.keys(dto) },
    })
    return updated
  }

  @Patch(':id/status')
  async setStatus(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(publishPostDto, body)
    const updated = await this.posts.setStatus(id, dto, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.status',
      entityType: 'post',
      entityId: id,
      meta: { next: dto.status },
    })
    return updated
  }

  @Patch(':id/permissions')
  async patchPermissions(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(patchPostPermissionsDto, body)
    const updated = await this.posts.patchPermissions(id, dto, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.permissions',
      entityType: 'post',
      entityId: id,
      meta: dto,
    })
    return updated
  }

  @Delete(':id')
  async remove(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    const removed = await this.posts.remove(id, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.delete',
      entityType: 'post',
      entityId: id,
      meta: { slug: removed.slug, title: removed.title },
    })
    return { ok: true }
  }

  @Post('import/rss')
  async importRss(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(importRssFeedsDto, body)
    const res = await this.posts.importRssFeeds(dto, this.toActor(actor))
    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.post.import_rss',
      entityType: 'post',
      entityId: null,
      meta: { imported: res.imported, feeds: dto.feeds ?? null },
    })
    return res
  }

  private parse<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) {
        const first = (e as ZodError).issues[0]
        throw new BadRequestException(`Dữ liệu không hợp lệ: ${first?.path?.join('.') ?? 'dto'} ${first?.message ?? ''}`)
      }
      throw e
    }
  }
}
