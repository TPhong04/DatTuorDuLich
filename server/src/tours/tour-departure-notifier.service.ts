import { Injectable, Logger } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Cron, CronExpression } from '@nestjs/schedule'
import { Model, Types } from 'mongoose'
import { Tour, TourDocument } from './tour.schema'
import { User, UserDocument } from '../users/user.schema'
import { NotificationsService, CreateNotificationInput } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/notification.schema'

type DepAlertType =
  | 'departure_soldout'
  | 'departure_low_stock'
  | 'departure_within_24h'
  | 'departure_today'
  | 'departure_last_7days_booking'

@Injectable()
export class TourDepartureNotifierService {
  private readonly logger = new Logger(TourDepartureNotifierService.name)

  private readonly antiSpam = new Map<string, { expiresAt: number }>()
  private readonly ANTI_SPAM_TTL_MS = 1000 * 60 * 60 * 24 * 14
  private readonly ANTI_SPAM_MAX = 8000

  private readonly LOW_STOCK_PCT = 15
  private readonly LAST_7DAYS_DAYS = 7

  constructor(
    @InjectModel(Tour.name) private readonly tours: Model<TourDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  private antiSpamKey(depIdHex: string, alertType: DepAlertType) {
    return `${alertType}:${depIdHex}`
  }

  private isSent(depIdHex: string, alertType: DepAlertType) {
    const k = this.antiSpamKey(depIdHex, alertType)
    const entry = this.antiSpam.get(k)
    if (!entry) return false
    if (entry.expiresAt < Date.now()) {
      this.antiSpam.delete(k)
      return false
    }
    return true
  }

  private markSent(depIdHex: string, alertType: DepAlertType) {
    const k = this.antiSpamKey(depIdHex, alertType)
    if (this.antiSpam.size >= this.ANTI_SPAM_MAX) {
      const firstKey = this.antiSpam.keys().next().value
      if (firstKey) this.antiSpam.delete(firstKey)
    }
    this.antiSpam.set(k, { expiresAt: Date.now() + this.ANTI_SPAM_TTL_MS })
  }

  private pad2(n: number) {
    return String(n).padStart(2, '0')
  }

  private isoDate(d: Date) {
    return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`
  }

  private startOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }

  private endOfDay(d: Date) {
    const x = new Date(d)
    x.setHours(23, 59, 59, 999)
    return x
  }

  private formatVND(n: number | null | undefined) {
    if (!n && n !== 0) return '0'
    return Number(n).toLocaleString('vi-VN')
  }

  private async listAdminAndStaffRecipients(): Promise<Array<{ _id: Types.ObjectId; role: 'admin' | 'staff' }>> {
    const rows = await this.users
      .find({ role: { $in: ['admin', 'staff'] as any }, isActive: true }, { _id: 1, role: 1 })
      .lean()
      .limit(200)
      .exec()
    return rows.map((r) => ({
      _id: r._id as Types.ObjectId,
      role: (r.role === 'admin' || r.role === 'staff') ? r.role : 'staff' as any,
    }))
  }

  private buildNotification(args: {
    recipient: { _id: Types.ObjectId; role: 'admin' | 'staff' }
    alertType: DepAlertType
    tour: TourDocument
    dep: { _id: Types.ObjectId; departureDate: Date; standardText: string | null; priceAdult: number; seatsTotal: number; seatsAvailable: number; status: string }
    title: string
    body: string
    priority?: 'low' | 'medium' | 'high' | 'urgent'
  }): CreateNotificationInput {
    const actionUrl = `/admin/departures?tourId=${String(args.tour._id)}&departureId=${String(args.dep._id)}`
    return {
      recipientId: new Types.ObjectId(String(args.recipient._id)),
      recipientRole: args.recipient.role,
      type: args.alertType as NotificationType,
      title: args.title,
      body: args.body,
      entityType: 'tour_departure',
      entityId: args.dep._id,
      actionUrl,
      priority: args.priority ?? 'high',
      payload: {
        tourId: String(args.tour._id),
        tourTitle: args.tour.title,
        tourCode: args.tour.code,
        tourSlug: args.tour.slug,
        departureId: String(args.dep._id),
        departureDate: args.dep.departureDate.toISOString(),
        seatsAvailable: args.dep.seatsAvailable,
        seatsTotal: args.dep.seatsTotal,
      },
    }
  }

  @Cron('*/15 * * * *')
  async cronScanDepartureAlerts() {
    try {
      const now = new Date()
      const nowMs = now.getTime()
      const startOfToday = this.startOfDay(now)
      const endOfToday = this.endOfDay(now)
      const within24hStart = now
      const within24hEnd = new Date(nowMs + 24 * 60 * 60 * 1000)
      const last7DaysBookingDate = new Date(nowMs + this.LAST_7DAYS_DAYS * 24 * 60 * 60 * 1000)
      const todayKey = this.isoDate(now)

      const tours = await this.tours
        .find({ isPublished: true, departures: { $exists: true, $ne: [] } }, {
          _id: 1,
          title: 1,
          slug: 1,
          code: 1,
          departures: 1,
          region: 1,
          durationDays: 1,
          durationNights: 1,
          departureFrom: 1,
          coverImageUrl: 1,
        })
        .sort({ updatedAt: -1 })
        .limit(800)
        .lean()
        .exec()

      type RowAlert = { depIdHex: string; alertType: DepAlertType; tour: TourDocument; dep: any; title: string; body: string; priority?: 'low' | 'medium' | 'high' | 'urgent' }
      const alerts: RowAlert[] = []
      const todaySentKeys = new Set<string>()

      for (const tour of tours) {
        if (!tour.departures || !Array.isArray(tour.departures)) continue
        for (const dep of tour.departures as any[]) {
          if (!dep || !dep._id || !dep.departureDate) continue
          const depIdHex = String(dep._id)
          const depDate = new Date(dep.departureDate)
          const past = depDate.getTime() < startOfToday.getTime()

          if (past) continue

          const seatsTotal = Math.max(0, Number(dep.seatsTotal) || 0)
          const seatsAvailable = Math.max(0, Number(dep.seatsAvailable) || 0)
          const seatsBooked = seatsTotal - seatsAvailable
          const fillPct = seatsTotal > 0 ? Math.round((seatsBooked / seatsTotal) * 100) : 0
          const isSoldOut =
            seatsTotal > 0 && seatsAvailable <= 0 ||
            String(dep.status || '').toLowerCase() === 'soldout'
          const isLowStock =
            !isSoldOut &&
            seatsTotal > 0 &&
            seatsAvailable > 0 &&
            (fillPct >= 100 - this.LOW_STOCK_PCT || seatsAvailable <= Math.max(2, Math.ceil(seatsTotal * (this.LOW_STOCK_PCT / 100))))

          const isWithin24h = depDate.getTime() >= within24hStart.getTime() && depDate.getTime() <= within24hEnd.getTime()
          const isToday = depDate.getTime() >= startOfToday.getTime() && depDate.getTime() <= endOfToday.getTime()
          const isLast7DaysBooking = !isSoldOut && depDate.getTime() <= last7DaysBookingDate.getTime()

          if (isSoldOut) {
            if (!this.isSent(depIdHex, 'departure_soldout')) {
              alerts.push({
                depIdHex,
                alertType: 'departure_soldout',
                tour: tour as any,
                dep,
                title: `🔴 Hết chỗ: ${tour.title}`,
                body: `${tour.code ? `Mã tour ${tour.code} · ` : ''}Khởi hành ${depDate.toLocaleDateString('vi-VN')}. Số chỗ ${seatsTotal}. Giá NL ${this.formatVND(dep.priceAdult)}đ. Đã bán toàn bộ, chuyển sang sold-out.`,
                priority: 'high',
              })
              this.markSent(depIdHex, 'departure_soldout')
            }
          } else if (isLowStock) {
            if (!this.isSent(depIdHex, 'departure_low_stock')) {
              alerts.push({
                depIdHex,
                alertType: 'departure_low_stock',
                tour: tour as any,
                dep,
                title: `🟡 Sắp hết chỗ: ${tour.title}`,
                body: `${tour.code ? `Mã tour ${tour.code} · ` : ''}Khởi hành ${depDate.toLocaleDateString('vi-VN')}. Còn ${seatsAvailable}/${seatsTotal} chỗ (đã đặt ${fillPct}%). Giá NL ${this.formatVND(dep.priceAdult)}đ. Push sales cuối vòng.`,
                priority: 'medium',
              })
              this.markSent(depIdHex, 'departure_low_stock')
            }
          }

          if (isWithin24h && !isToday) {
            if (!this.isSent(depIdHex, 'departure_within_24h')) {
              alerts.push({
                depIdHex,
                alertType: 'departure_within_24h',
                tour: tour as any,
                dep,
                title: `🔵 24h tới khởi hành: ${tour.title}`,
                body: `${tour.code ? `Mã tour ${tour.code} · ` : ''}Khởi hành ${depDate.toLocaleDateString('vi-VN')}. Chuẩn bị xe, HDV, danh sách hành khách. Gặp mặt: ${dep.standardText || tour.departureFrom || '—'}.`,
                priority: 'high',
              })
              this.markSent(depIdHex, 'departure_within_24h')
            }
          }

          if (isToday) {
            const todayNotifKey = `departure_today:${todayKey}:${depIdHex}`
            if (!todaySentKeys.has(todayNotifKey) && !this.isSent(depIdHex, 'departure_today')) {
              alerts.push({
                depIdHex,
                alertType: 'departure_today',
                tour: tour as any,
                dep,
                title: `🟢 Khởi hành hôm nay: ${tour.title}`,
                body: `${tour.code ? `Mã tour ${tour.code} · ` : ''}Hôm nay ${depDate.toLocaleDateString('vi-VN')} có ${seatsTotal - seatsAvailable}/${seatsTotal} khách. Gặp mặt ${dep.standardText || tour.departureFrom || '—'}.`,
                priority: 'high',
              })
              this.markSent(depIdHex, 'departure_today')
              todaySentKeys.add(todayNotifKey)
            }
          }

          if (isLast7DaysBooking && !isSoldOut && !isLowStock) {
            if (!this.isSent(depIdHex, 'departure_last_7days_booking')) {
              alerts.push({
                depIdHex,
                alertType: 'departure_last_7days_booking',
                tour: tour as any,
                dep,
                title: `🟣 ≤ 7 ngày nữa khởi hành: ${tour.title}`,
                body: `${tour.code ? `Mã tour ${tour.code} · ` : ''}Khởi hành ${depDate.toLocaleDateString('vi-VN')}. Còn ${seatsAvailable}/${seatsTotal} chỗ trống (đặt ${fillPct}%). Chốt sales cuối vòng.`,
                priority: 'medium',
              })
              this.markSent(depIdHex, 'departure_last_7days_booking')
            }
          }
        }
      }

      if (alerts.length === 0) {
        this.logger.verbose('cronScanDepartureAlerts: no alerts')
        return
      }

      const recipients = await this.listAdminAndStaffRecipients()
      if (recipients.length === 0) {
        this.logger.warn('cronScanDepartureAlerts: no admin/staff recipients')
        return
      }

      const inputs: CreateNotificationInput[] = []
      for (const a of alerts) {
        for (const r of recipients) {
          inputs.push(
            this.buildNotification({
              recipient: r,
              alertType: a.alertType,
              tour: a.tour,
              dep: a.dep,
              title: a.title,
              body: a.body,
              priority: a.priority,
            })
          )
        }
      }

      await this.notifications.bulk(inputs)
      this.logger.log(
        `cronScanDepartureAlerts: ${alerts.length} alerts × ${recipients.length} recipients = ${inputs.length} notifs sent. soldout=${alerts.filter((a) => a.alertType === 'departure_soldout').length} low_stock=${alerts.filter((a) => a.alertType === 'departure_low_stock').length} 24h=${alerts.filter((a) => a.alertType === 'departure_within_24h').length} today=${alerts.filter((a) => a.alertType === 'departure_today').length} last7d=${alerts.filter((a) => a.alertType === 'departure_last_7days_booking').length}`,
      )
    } catch (err: any) {
      this.logger.error(`cronScanDepartureAlerts fail: ${String(err?.message || err)}`)
    }
  }
}
