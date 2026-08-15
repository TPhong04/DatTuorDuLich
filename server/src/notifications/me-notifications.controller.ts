import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards, NotFoundException } from '@nestjs/common'
import { Types } from 'mongoose'
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger'
import { CurrentUser } from '../auth/decorators/current-user.decorator'
import { AccessTokenGuard } from '../auth/guards/access-token.guard'
import { JwtPayload } from '../auth/auth.types'
import { ListNotificationsQuery, NotificationsService } from './notifications.service'

@ApiTags('Notifications')
@ApiBearerAuth('bearerJwt')
@UseGuards(AccessTokenGuard)
@Controller('me/notifications')
export class MeNotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Danh sách thông báo của tôi (phân trang + filter) — kèm unread badge',
    description:
      "QA: Lấy danh sách thông báo in-app của user đang login. Hỗ trợ filter: isRead (true=đã đọc, false=chưa đọc, null/all= cả 2), type (loại notification: gtr_booking_created / admin_new_booking / staff_new_booking / booking_confirmed / booking_cancelled / booking_deposit_paid / admin_booking_updated / staff_booking_updated / gtr_submitted / gtr_assigned_staff / payment_received / system_maintenance, v.v.), search (fulltext title+body). Phân trang page / pageSize (alias limit chấp nhận). Response trả kèm unreadCount (badge unread) để UI không cần gọi thêm endpoint /badge (save 1 request).",
  })
  @ApiQuery({ name: 'page', required: false, description: 'Số trang (bắt đầu từ 1). Default 1.', example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Số item / trang (alias: limit). 1-100. Default 25.', example: 25 })
  @ApiQuery({ name: 'limit', required: false, description: 'Alias của pageSize (để thống nhất với bookings list). 1-100.', example: 25 })
  @ApiQuery({ name: 'isRead', required: false, description: 'Filter trạng thái đọc: true=chỉ đã đọc, false=chỉ chưa đọc, null/không gửi=tất cả.', type: 'boolean', example: false })
  @ApiQuery({ name: 'read', required: false, description: 'Alias của isRead (thống nhất query parameter). 0/1 hoặc true/false.', example: 'false' })
  @ApiQuery({
    name: 'type',
    required: false,
    description:
      'Filter theo NotificationType. Dạng string đơn lẻ HOẶC csv multiple (vd: booking_confirmed,booking_cancelled).',
    example: 'booking_confirmed',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Fulltext search (title + body) - case-insensitive regex.', example: 'thanh toán' })
  @ApiResponse({
    status: 200,
    description:
      '200 OK: Danh sách items thông báo + phân trang + unreadCount tổng (badge số đỏ UI).',
  })
  @ApiResponse({ status: 401, description: 'Chưa đăng nhập hoặc Bearer token hết hạn.' })
  async list(@CurrentUser() u: JwtPayload, @Query() q: ListNotificationsQuery & { limit?: any; read?: any }) {
    const merged: ListNotificationsQuery = { ...q }
    if (typeof q.limit !== 'undefined' && typeof q.pageSize === 'undefined')
      merged.pageSize = Number(q.limit) || undefined
    if (typeof q.read !== 'undefined' && typeof q.isRead === 'undefined') {
      const r = String(q.read).trim().toLowerCase()
      merged.isRead = r === '1' || r === 'true' || r === 'yes' ? true : r === '0' || r === 'false' || r === 'no' ? false : null
    }
    const [res, unreadCount] = await Promise.all([
      this.service.listMe(new Types.ObjectId(u.sub), merged),
      this.service.countUnread(new Types.ObjectId(u.sub)),
    ])
    return {
      items: res.items.map((n: any) => ({
        id: n._id?.toString?.() ?? n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        priority: n.priority ?? 'medium',
        isRead: Boolean(n.isRead),
        readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
        entityType: n.entityType ?? null,
        entityId: n.entityId?.toString?.() ?? n.entityId ?? null,
        actionUrl: n.actionUrl ?? null,
        payload: n.payload ?? null,
        channels: Array.isArray(n.channels) ? n.channels : [],
        createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : null,
      })),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      unreadCount,
    }
  }

  @Get('badge')
  @ApiOperation({ summary: 'Đếm số thông báo chưa đọc (badge đỏ header UI)', description: 'Chỉ trả unreadCount: number (nhanh hơn GET list nhiều).' })
  @ApiResponse({ status: 200, schema: { type: 'object', properties: { unreadCount: { type: 'number', example: 5 } } } })
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
  @ApiParam({ name: 'id', description: 'Notification ID (24 hex).', example: '67f2a8b3c4d5e6f7a8b9c0ff' })
  @ApiResponse({ status: 404, description: 'Notification không tồn tại / không phải của bạn.' })
  markRead(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    const res = this.service.markRead(new Types.ObjectId(u.sub), id)
    if (!(res as any)?.ok) throw new NotFoundException('Không tìm thấy notification')
    return res
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() u: JwtPayload) {
    return this.service.markAllRead(new Types.ObjectId(u.sub))
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: 'Notification ID (24 hex).' })
  remove(@CurrentUser() u: JwtPayload, @Param('id') id: string) {
    return this.service.remove(new Types.ObjectId(u.sub), id)
  }
}
