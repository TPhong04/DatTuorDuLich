import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common'
import { ZodError, z } from 'zod'

import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { JwtPayload } from '../auth/auth.types'
import { UsersService } from './users.service'

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)

const updateProfileDto = z.object({
  name: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  phone: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  gender: z.preprocess(emptyToNull, z.enum(['male', 'female', 'other']).nullable()).optional(),
  avatarUrl: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  dateOfBirth: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  address: z
    .preprocess(
      (v) => (v === null ? null : v),
      z
        .object({
          province: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
          district: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
          ward: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
          line1: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
        })
        .nullable(),
    )
    .optional(),
  emergencyContact: z
    .preprocess(
      (v) => (v === null ? null : v),
      z
        .object({
          name: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
          phone: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
          relation: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
        })
        .nullable(),
    )
    .optional(),
  citizenId: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  passportNumber: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  dietary: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
  medicalNotes: z.preprocess(emptyToNull, z.string().min(1).nullable()).optional(),
})

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AccessTokenGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtPayload) {
    const dbUser = await this.usersService.findById(user.sub)
    if (!dbUser) return null
    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      phone: dbUser.phone,
      gender: dbUser.gender,
      avatarUrl: dbUser.avatarUrl,
      dateOfBirth: dbUser.dateOfBirth,
      address: dbUser.address,
      emergencyContact: dbUser.emergencyContact,
      citizenId: dbUser.citizenId,
      passportNumber: dbUser.passportNumber,
      dietary: dbUser.dietary,
      medicalNotes: dbUser.medicalNotes,
      role: dbUser.role,
    }
  }

  @UseGuards(AccessTokenGuard)
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() body: unknown) {
    const dto = this.parseBody(updateProfileDto, body)
    const updated = await this.usersService.updateProfile(user.sub, dto)
    if (!updated) return null
    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      gender: updated.gender,
      avatarUrl: updated.avatarUrl,
      dateOfBirth: updated.dateOfBirth,
      address: updated.address,
      emergencyContact: updated.emergencyContact,
      citizenId: updated.citizenId,
      passportNumber: updated.passportNumber,
      dietary: updated.dietary,
      medicalNotes: updated.medicalNotes,
      role: updated.role,
    }
  }

  private parseBody<T>(schema: { parse: (input: unknown) => T }, input: unknown): T {
    try {
      return schema.parse(input)
    } catch (e) {
      if (e instanceof ZodError) {
        throw new BadRequestException('Dữ liệu không hợp lệ')
      }
      throw e
    }
  }
}
