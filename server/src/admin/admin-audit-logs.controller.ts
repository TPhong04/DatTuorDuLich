import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ZodError, z } from 'zod'

import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const queryDto = z.object({
  actorEmail: z.preprocess(emptyToUndefined, z.string().min(1)).optional(),
  action: z.preprocess(emptyToUndefined, z.string().min(1)).optional(),
  from: z.preprocess(emptyToUndefined, z.string().min(1)).optional(),
  to: z.preprocess(emptyToUndefined, z.string().min(1)).optional(),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1)).optional(),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100)).optional(),
})

@Controller('admin/audit-logs')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminAuditLogsController {
  constructor(private readonly auditLogs: AuditLogsService) {}

  @Get()
  async list(@Query() query: unknown) {
    const q = this.parse(queryDto, query)
    const from = q.from ? new Date(q.from) : undefined
    const to = q.to ? new Date(q.to) : undefined

    const result = await this.auditLogs.list({
      actorEmail: q.actorEmail,
      action: q.action,
      from: from && !Number.isNaN(from.getTime()) ? from : undefined,
      to: to && !Number.isNaN(to.getTime()) ? to : undefined,
      page: q.page,
      limit: q.limit,
    })

    return {
      items: result.items.map((l) => ({
        id: l.id,
        actorUserId: l.actorUserId,
        actorEmail: l.actorEmail,
        actorRole: l.actorRole,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        meta: l.meta,
        createdAt: (l as any).createdAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
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

