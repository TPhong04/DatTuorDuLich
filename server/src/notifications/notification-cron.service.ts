import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Model, Types } from 'mongoose'
import { NotificationsService, CreateNotificationInput } from './notifications.service'
import { NotificationType } from './notification.schema'
import { GroupTourRequest, GroupTourRequestDocument } from '../group-tour-requests/group-tour-request.schema'
import { Booking, BookingDocument } from '../bookings/booking.schema'

@Injectable()
export class NotificationCronService {
  private readonly logger = new Logger(NotificationCronService.name)
  constructor(
    private readonly notifications: NotificationsService,
    @InjectModel(GroupTourRequest.name) private readonly gtrModel: Model<GroupTourRequestDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) {}

  @Cron('*/15 * * * *')
  async cronFollowUpDue() {
    try {
      const now = new Date()
      const cutoff = new Date(now.getTime() + 15 * 60 * 1000)
      const rows = await this.gtrModel
        .find({
          followUpAt: { $ne: null, $lte: cutoff, $gt: now },
          assignedStaffId: { $ne: null },
          status: { $in: ['new', 'contacted', 'quoting', 'negotiating'] },
        })
        .limit(500)
        .lean()
        .exec()
      const inputs: CreateNotificationInput[] = []
      for (const r of rows) {
        inputs.push({
          recipientId: new Types.ObjectId(String(r.assignedStaffId)),
          recipientRole: 'staff',
          type: 'staff_followup_due' as NotificationType,
          title: `Đến hạn gọi: ${r.contactName || ''} - ${r.destination || 'Tour đoàn'}`,
          body: `Follow-up GTR ${String(r.code || r._id).slice(0, 12)} sắp đến hạn. Ngày khởi hành dự kiến: ${r.preferredStartDate ? new Date(r.preferredStartDate).toLocaleDateString('vi-VN') : '—'}. ${r.lastQuoteSummary ? ('Ghi chú gần nhất: ' + r.lastQuoteSummary) : (r.internalStaffNote ? ('Nội bộ: ' + r.internalStaffNote) : '')}`,
          entityType: 'group_tour_request',
          entityId: r._id as any,
          actionUrl: `/staff/group-tour-requests?id=${r._id}`,
          priority: 'high',
        })
      }
      if (inputs.length) {
        await this.notifications.bulk(inputs)
        this.logger.verbose(`cronFollowUpDue sent ${inputs.length}`)
      }
    } catch (err: any) {
      this.logger.error(`cronFollowUpDue fail: ${String(err?.message || err)}`)
    }
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async cronBookingTripReminder48h() {
    try {
      const now = new Date()
      const from = new Date(now.getTime() + 47 * 60 * 60 * 1000)
      const to = new Date(now.getTime() + 49 * 60 * 60 * 1000)
      const bookings = await this.bookingModel
        .find({
          departureDate: { $gte: from, $lte: to },
          status: { $in: ['confirmed', 'in_progress'] },
          createdBy: { $ne: null },
        })
        .limit(300)
        .lean()
        .exec()
      const inputs: CreateNotificationInput[] = []
      for (const b of bookings) {
        if (!b.createdBy) continue
        const dateStr = b.departureDate ? new Date(b.departureDate as any).toLocaleDateString('vi-VN') : '—'
        inputs.push({
          recipientId: new Types.ObjectId(String(b.createdBy)),
          recipientRole: 'customer',
          type: 'booking_trip_reminder_48h' as NotificationType,
          title: `Nhắc nhở 48h khởi hành: ${b.tourSnapshot?.title || 'Tour ' + b.code}`,
          body: `Chuyến đi ngày ${dateStr} sắp bắt đầu. Mã booking ${b.code}. Gặp mặt đúng giờ. Hotline hỗ trợ 24/7: 1900 1009. ${b.departureStandardText ? ('Điểm gặp mặt: ' + b.departureStandardText) : ''}`,
          entityType: 'booking',
          entityId: b._id as any,
          actionUrl: `/account/bookings`,
          priority: 'urgent',
          channels: ['in_app', 'email'],
        })
      }
      if (inputs.length) {
        await this.notifications.bulk(inputs)
        this.logger.verbose(`cronBookingTripReminder48h sent ${inputs.length}`)
      }
    } catch (err: any) {
      this.logger.error(`cronBookingTripReminder48h fail: ${String(err?.message || err)}`)
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async cronDepositOverdue() {
    try {
      const now = new Date()
      const bookings = await this.bookingModel
        .find({
          status: { $in: ['new', 'pending'] },
          paymentStatus: { $in: ['unpaid'] },
          createdAt: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        })
        .limit(200)
        .lean()
        .exec()
      const inputs: CreateNotificationInput[] = []
      for (const b of bookings) {
        const customerInputs: CreateNotificationInput[] = []
        if (b.createdBy) {
          const depositEstimate = Math.round((b.totalAmount || 0) * 0.3)
          const hours = Math.max(0, Math.round((now.getTime() - new Date((b as any).createdAt).getTime()) / 3600000))
          customerInputs.push({
            recipientId: new Types.ObjectId(String(b.createdBy)),
            recipientRole: 'customer',
            type: 'booking_deposit_overdue' as NotificationType,
            title: `Đặt cọc quá hạn - ${b.code}`,
            body: `Vui lòng thanh toán cọc ${depositEstimate ? (Number(depositEstimate).toLocaleString('vi-VN') + 'đ') : ''} sớm để giữ chỗ tour ${b.tourSnapshot?.title || ''} ${b.code}. Quá hạn quá ${hours} giờ.`,
            entityType: 'booking',
            entityId: b._id as any,
            actionUrl: `/account/bookings`,
            priority: 'high',
          })
        }
        inputs.push(...customerInputs)
      }
      if (inputs.length) {
        await this.notifications.bulk(inputs)
        this.logger.verbose(`cronDepositOverdue sent ${inputs.length}`)
      }
    } catch (err: any) {
      this.logger.error(`cronDepositOverdue fail: ${String(err?.message || err)}`)
    }
  }
}
