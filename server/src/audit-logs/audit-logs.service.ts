import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'

import { UserRole } from '../users/user-role'
import { AuditLog, AuditLogDocument } from './audit-log.schema'

@Injectable()
export class AuditLogsService {
  constructor(@InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLogDocument>) {}

  create(input: {
    actorUserId: string
    actorEmail: string
    actorRole: UserRole
    action: string
    entityType?: string | null
    entityId?: string | null
    meta?: unknown
  }) {
    return this.auditLogModel.create({
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      meta: input.meta ?? null,
    })
  }

  async list(input: {
    actorEmail?: string
    action?: string
    from?: Date
    to?: Date
    page?: number
    limit?: number
  }) {
    const page = Math.max(1, Math.floor(input.page ?? 1))
    const limit = Math.min(100, Math.max(1, Math.floor(input.limit ?? 20)))
    const skip = (page - 1) * limit

    const filter: Record<string, unknown> = {}
    if (input.actorEmail) filter.actorEmail = { $regex: input.actorEmail.trim(), $options: 'i' }
    if (input.action) filter.action = { $regex: input.action.trim(), $options: 'i' }
    if (input.from || input.to) {
      filter.createdAt = {}
      if (input.from) (filter.createdAt as any).$gte = input.from
      if (input.to) (filter.createdAt as any).$lte = input.to
    }

    const [items, total] = await Promise.all([
      this.auditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.auditLogModel.countDocuments(filter).exec(),
    ])

    return { items, total, page, limit }
  }
}

