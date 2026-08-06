import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import bcrypt from 'bcryptjs'

import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { JwtPayload } from '../auth/auth.types'
import { UsersService } from '../users/users.service'
import { UserRole } from '../users/user-role'

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async list(input: { search?: string; role?: UserRole; isActive?: boolean; page?: number; limit?: number }) {
    return this.usersService.adminListUsers(input)
  }

  async create(
    actor: JwtPayload,
    input: { name: string; email: string; password: string; role: UserRole; phone?: string | null },
  ) {
    const existing = await this.usersService.findByEmail(input.email)
    if (existing) throw new ConflictException('Email đã tồn tại')

    const passwordHash = await bcrypt.hash(input.password, 10)
    const user = await this.usersService.createUser({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      phone: input.phone ?? null,
    })

    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.user.create',
      entityType: 'user',
      entityId: user.id,
      meta: { role: user.role, email: user.email },
    })

    return user
  }

  async update(actor: JwtPayload, userId: string, input: { role?: UserRole; isActive?: boolean }) {
    const updated = await this.usersService.adminUpdateUser(userId, input)
    if (!updated) throw new NotFoundException('Không tìm thấy user')

    await this.auditLogs.create({
      actorUserId: actor.sub,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'admin.user.update',
      entityType: 'user',
      entityId: userId,
      meta: { changes: input },
    })

    return updated
  }
}

