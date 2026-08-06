import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ZodError, z } from 'zod'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { Roles } from '../auth/decorators/roles.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { JwtPayload } from '../auth/auth.types'
import { UserRole } from '../users/user-role'
import { AdminUsersService } from './admin-users.service'

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v)

const listUsersQuery = z.object({
  search: z.preprocess(emptyToUndefined, z.string().min(1)).optional(),
  role: z.preprocess(emptyToUndefined, z.enum(['customer', 'staff', 'admin'])).optional(),
  isActive: z.preprocess(emptyToUndefined, z.enum(['true', 'false'])).optional(),
  page: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1)).optional(),
  limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100)).optional(),
})

const createUserDto = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['customer', 'staff', 'admin']),
  phone: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.string().min(1).nullable()).optional(),
})

const updateUserDto = z.object({
  role: z.enum(['customer', 'staff', 'admin']).optional(),
  isActive: z.boolean().optional(),
})

@Controller('admin/users')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  async list(@Query() query: unknown) {
    const q = this.parse(listUsersQuery, query)
    const isActive = q.isActive ? q.isActive === 'true' : undefined

    const result = await this.adminUsers.list({
      search: q.search,
      role: q.role as UserRole | undefined,
      isActive,
      page: q.page,
      limit: q.limit,
    })

    return {
      items: result.items.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        gender: u.gender,
        avatarUrl: u.avatarUrl,
        role: u.role,
        isActive: u.isActive !== false,
        createdAt: (u as any).createdAt,
        updatedAt: (u as any).updatedAt,
      })),
      total: result.total,
      page: result.page,
      limit: result.limit,
    }
  }

  @Post()
  async create(@CurrentUser() actor: JwtPayload, @Body() body: unknown) {
    const dto = this.parse(createUserDto, body)
    const user = await this.adminUsers.create(actor, dto as any)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive !== false,
    }
  }

  @Patch(':id')
  async update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() body: unknown) {
    const dto = this.parse(updateUserDto, body)
    const user = await this.adminUsers.update(actor, id, dto as any)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      avatarUrl: user.avatarUrl,
      role: user.role,
      isActive: user.isActive !== false,
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
