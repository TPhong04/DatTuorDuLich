import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { Types } from 'mongoose'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { JwtPayload } from '../auth/auth.types'
import { ListNotificationsQuery, NotificationsService } from './notifications.service'

@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  listAll(@CurrentUser() _u: JwtPayload, @Query() q: ListNotificationsQuery & { recipientRole?: any }) {
    return this.service.listAdmin(q)
  }

  @Get('me')
  list(@CurrentUser() u: JwtPayload, @Query() q: ListNotificationsQuery) {
    return this.service.listMe(new Types.ObjectId(u.sub), q)
  }

  @Get('badge')
  badge(@CurrentUser() u: JwtPayload) {
    return this.service.countUnread(new Types.ObjectId(u.sub)).then((unreadCount) => ({ unreadCount }))
  }

  @Get('settings')
  getSetting(@CurrentUser() u: JwtPayload) {
    return this.service.getOrCreateSetting(new Types.ObjectId(u.sub))
  }

  @Patch(':id/read')
  markRead(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.service.markRead(new Types.ObjectId(u.sub), id)
  }

  @Patch('settings')
  patchSetting(@CurrentUser() u: JwtPayload, @Body() body: any) {
    return this.service.updateSetting(new Types.ObjectId(u.sub), body || {})
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() u: JwtPayload) {
    return this.service.markAllRead(new Types.ObjectId(u.sub))
  }

  @Delete(':id')
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.service.remove(new Types.ObjectId(u.sub), id)
  }
}
