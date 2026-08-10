import { Body, Controller, Post, Ip, UseGuards, Req, Get } from '@nestjs/common'
import { Request } from 'express'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { UserDocument } from '../users/user.schema'
import { Types } from 'mongoose'
import { GroupTourRequestsService } from './group-tour-requests.service'
import { CreateGroupTourRequestDTO, CreateGroupTourRequestZod } from './dto'

@Controller('group-tour-requests')
export class PublicGroupTourRequestsController {
  constructor(private readonly svc: GroupTourRequestsService) {}

  @Post()
  async createPublic(
    @Body() body: CreateGroupTourRequestDTO,
    @Ip() ip: string | undefined,
    @Req() req: Request,
  ) {
    const parsed = CreateGroupTourRequestZod.safeParse(body)
    if (!parsed.success) {
      const first = parsed.error.errors[0]
      throw new (await import('@nestjs/common')).BadRequestException(`${first?.path?.join('.') || 'payload'}: ${first?.message || 'Dữ liệu không hợp lệ'}`)
    }
    const user = (req as any).user as UserDocument | undefined
    const createdBy: Types.ObjectId | null = user?._id ? new Types.ObjectId(user._id as any) : null
    const realIp = (ip as string | undefined)
      || (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      || (req.headers['x-real-ip'] as string | undefined)
      || null
    const doc = await this.svc.createPublic(parsed.data, { ip: realIp, createdByUserId: createdBy })
    return { ok: true, id: doc._id, code: doc.code, message: 'Đã gửi yêu cầu báo giá. Nhân viên sẽ liên hệ trong 30 phút.' }
  }

  @Get('my-quotes')
  @UseGuards(AccessTokenGuard)
  async myQuotes(@CurrentUser() u: UserDocument) {
    const userId = new Types.ObjectId(u._id as any)
    const list = await this.svc.list({ page: 1, pageSize: 50, sort: 'newest' } as any, null)
    const mine = list.rows.filter((r: any) => String(r.createdByUserId || '') === String(userId) || String(r.assignedStaffId || '') === String(userId))
    return { ok: true, rows: mine }
  }
}
