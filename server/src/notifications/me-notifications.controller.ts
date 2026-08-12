import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { Types } from 'mongoose'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { JwtPayload } from '../auth/auth.types'
import { ListNotificationsQuery, NotificationsService } from './notifications.service'

@UseGuards(AccessTokenGuard)
@Controller('me/notifications')
export class MeNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
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

  @Patch('settings')
  patchSetting(@CurrentUser() u: JwtPayload, @Body() body: any) {
    return this.service.updateSetting(new Types.ObjectId(u.sub), body || {})
  }

  @Patch(':id/read')
  markRead(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.service.markRead(new Types.ObjectId(u.sub), id)
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
