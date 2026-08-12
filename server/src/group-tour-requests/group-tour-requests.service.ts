import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { NotificationsService, CreateNotificationInput } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/notification.schema'
import { GroupTourRequest, GroupTourRequestDocument, GroupTourRequestStatus } from './group-tour-request.schema'
import { AdminPatchGroupTourRequestDTO, CreateGroupTourRequestDTO } from './dto'

type ListQuery = {
  status?: GroupTourRequestStatus
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  assignedStaffId?: string
  mine?: boolean
  searchKeyword?: string
  page?: number
  pageSize?: number
  sort?: 'newest' | 'oldest' | 'priority' | 'follow_up'
}

@Injectable()
export class GroupTourRequestsService {
  constructor(
    @InjectModel(GroupTourRequest.name) private readonly model: Model<GroupTourRequestDocument>,
    private readonly audit: AuditLogsService,
    private readonly notifications: NotificationsService,
  ) {}

  async generateCode() {
    const prefix = 'GTR'
    const today = new Date()
    const y = today.getFullYear() % 100
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const base = `${prefix}${y}${m}${d}`
    const todayCount = await this.model.countDocuments({ code: { $regex: `^${base}-` } }).exec()
    return `${base}-${String(todayCount + 1).padStart(3, '0')}`
  }

  private parseDateSafe(v: string | undefined | null): Date | null {
    if (!v) return null
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  async createPublic(payload: CreateGroupTourRequestDTO, opts?: {
    ip?: string | null
    createdByUserId?: Types.ObjectId | null
  }): Promise<GroupTourRequestDocument> {
    const code = await this.generateCode()
    const doc = await this.model.create({
      code,
      status: 'new',
      priority: 'normal',
      contactName: payload.contactName.trim(),
      contactPhone: payload.contactPhone.trim(),
      contactEmail: payload.contactEmail ?? null,
      contactRole: payload.contactRole ?? null,
      companyOrGroupName: payload.companyOrGroupName.trim(),
      companyTaxCode: payload.companyTaxCode ?? null,
      adultCount: Number(payload.adultCount) || 1,
      childCount: Number(payload.childCount) || 0,
      infantCount: Number(payload.infantCount) || 0,
      departureCity: payload.departureCity ?? null,
      destination: payload.destination.trim(),
      approximateDurationText: payload.approximateDurationText ?? null,
      preferredStartDate: this.parseDateSafe(payload.preferredStartDate),
      preferredEndDate: this.parseDateSafe(payload.preferredEndDate),
      hotelClassRequested: payload.hotelClassRequested ?? null,
      servicesPreference: payload.servicesPreference ?? {
        needVisa: false, needFlight: false, needBus: false, needHotel: true, needMeals: true, needGuide: true,
      },
      transportRequestedNotes: payload.transportRequestedNotes ?? null,
      budgetPerPersonVnd: payload.budgetPerPersonVnd ?? null,
      totalBudgetVnd: payload.totalBudgetVnd ?? null,
      specialRequirements: payload.specialRequirements ?? null,
      sourceChannel: payload.sourceChannel ?? 'website_form',
      ipAddress: opts?.ip ?? null,
      createdByUserId: opts?.createdByUserId ?? null,
      followUpAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    })
    await this.audit.create({
      actorUserId: opts?.createdByUserId?.toString() ?? 'guest',
      actorEmail: 'guest@localhost.local',
      actorRole: (opts?.createdByUserId ? 'customer' : 'customer'),
      action: 'group_tour_request.create',
      entityType: 'group_tour_request',
      entityId: (doc._id as any)?.toString() ?? null,
      meta: {
        ip: opts?.ip ?? null,
        code: doc.code,
        companyOrGroupName: doc.companyOrGroupName,
        destination: doc.destination,
        pax: doc.adultCount + doc.childCount + doc.infantCount,
      },
    })
    try { await this.emitGtrCreatedNotifications(doc, opts?.createdByUserId ?? null) } catch {}
    return doc
  }

  private async emitGtrCreatedNotifications(doc: GroupTourRequestDocument, createdByUserId: Types.ObjectId | null) {
    const estimate = Number(doc.totalBudgetVnd || doc.budgetPerPersonVnd ? (Number(doc.budgetPerPersonVnd || 0) * (Number(doc.adultCount || 0) + Number(doc.childCount || 0) + Number(doc.infantCount || 0))) : 0)
    const pax = Number(doc.adultCount || 0) + Number(doc.childCount || 0) + Number(doc.infantCount || 0)
    const code = String(doc.code || doc._id)
    const admins = await this.model.db.collection('users').find({ role: 'admin', isActive: { $ne: false } }).project({ _id: 1 }).toArray()
    const bulk: CreateNotificationInput[] = []
    for (const a of admins) {
      bulk.push({
        recipientId: new Types.ObjectId(String(a._id)),
        recipientRole: 'admin',
        type: 'admin_new_gtr' as NotificationType,
        title: `Yêu cầu báo giá MỚI: ${doc.contactName || 'Khách đoàn'} - ${doc.destination || 'Tour'}`,
        body: `${code}. ${pax} khách. ${estimate ? (Number(estimate).toLocaleString('vi-VN') + 'đ ước tính.') : ''} Nguồn: ${doc.sourceChannel || 'website_form'}. Độ ưu tiên: ${doc.priority || 'normal'}. Cần giao nhân viên xử lý ngay.`,
        entityType: 'group_tour_request',
        entityId: doc._id as any,
        actionUrl: `/admin/group-tour-requests?id=${doc._id}`,
        priority: doc.priority === 'urgent' ? 'urgent' : (doc.priority === 'high' ? 'high' : 'medium'),
      })
    }
    if (createdByUserId) {
      bulk.push({
        recipientId: new Types.ObjectId(String(createdByUserId)),
        recipientRole: 'customer',
        type: 'gtr_created' as NotificationType,
        title: `Đã tiếp nhận yêu cầu ${code}`,
        body: `Chúng tôi đã tiếp nhận yêu cầu Tour đoàn ${doc.destination || ''}. Nhân viên sẽ liên hệ số ${doc.contactPhone || ''} trong 30 phút tới.`,
        entityType: 'group_tour_request',
        entityId: doc._id as any,
        actionUrl: `/account/notifications`,
        priority: 'medium',
      })
    }
    if (bulk.length) await this.notifications.bulk(bulk)
  }

  async list(q: ListQuery, actorId?: Types.ObjectId | null) {
    const status = q.status
    const page = Math.max(1, Number(q.page) || 1)
    const pageSize = Math.min(100, Math.max(1, Number(q.pageSize) || 25))
    const skip = (page - 1) * pageSize
    const filter: any = {}
    if (status) filter.status = status
    if (q.priority) filter.priority = q.priority
    if (q.mine && actorId) filter.assignedStaffId = actorId
    else if (q.assignedStaffId) {
      if (q.assignedStaffId === 'none') filter.assignedStaffId = null
      else if (Types.ObjectId.isValid(q.assignedStaffId)) filter.assignedStaffId = new Types.ObjectId(q.assignedStaffId)
    }
    if (q.searchKeyword) {
      const kw = q.searchKeyword.trim()
      filter.$or = [
        { code: { $regex: kw, $options: 'i' } },
        { contactName: { $regex: kw, $options: 'i' } },
        { contactPhone: { $regex: kw, $options: 'i' } },
        { companyOrGroupName: { $regex: kw, $options: 'i' } },
        { destination: { $regex: kw, $options: 'i' } },
      ]
    }
    const sort: Record<string, 1 | -1> = {}
    switch (q.sort) {
      case 'oldest': sort.createdAt = 1; break
      case 'priority': sort.priority = -1; sort.createdAt = -1; break
      case 'follow_up': sort.followUpAt = 1; sort.createdAt = -1; break
      default: sort.createdAt = -1
    }
    const [total, rows] = await Promise.all([
      this.model.countDocuments(filter).exec(),
      this.model.find(filter).sort(sort).skip(skip).limit(pageSize).lean().exec(),
    ])
    return {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows: rows as unknown as GroupTourRequestDocument[],
    }
  }

  async getById(id: string): Promise<GroupTourRequestDocument> {
    const isValid = Types.ObjectId.isValid(id)
    let doc: GroupTourRequestDocument | null = null
    if (isValid) doc = await this.model.findById(id).exec()
    if (!doc) doc = await this.model.findOne({ code: id }).exec()
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu báo giá đoàn')
    return doc
  }

  async patch(id: string, payload: AdminPatchGroupTourRequestDTO, actorId: Types.ObjectId, actorRole: 'admin' | 'staff') {
    const doc = await this.getById(id)
    const patch: any = {}
    if (payload.status !== undefined) patch.status = payload.status
    if (payload.priority !== undefined) patch.priority = payload.priority
    if (payload.assignedStaffId !== undefined) {
      if (payload.assignedStaffId === null || payload.assignedStaffId === 'null' || payload.assignedStaffId === '') patch.assignedStaffId = null
      else if (Types.ObjectId.isValid(payload.assignedStaffId)) patch.assignedStaffId = new Types.ObjectId(payload.assignedStaffId)
      else throw new BadRequestException('assignedStaffId không hợp lệ')
    }
    if (payload.internalStaffNote !== undefined) patch.internalStaffNote = payload.internalStaffNote
    if (payload.lastQuoteSummary !== undefined) patch.lastQuoteSummary = payload.lastQuoteSummary
    if (payload.followUpAt !== undefined) patch.followUpAt = this.parseDateSafe(payload.followUpAt)
    if (payload.lastContactedAt !== undefined) patch.lastContactedAt = this.parseDateSafe(payload.lastContactedAt)
    if (payload.wonAt !== undefined) patch.wonAt = this.parseDateSafe(payload.wonAt)
    if (payload.lostReason !== undefined) patch.lostReason = payload.lostReason
    if (payload.quoteCount !== undefined) patch.quoteCount = payload.quoteCount
    if (payload.convertedBookingId !== undefined) {
      if (!payload.convertedBookingId) patch.convertedBookingId = null
      else if (Types.ObjectId.isValid(payload.convertedBookingId)) patch.convertedBookingId = new Types.ObjectId(payload.convertedBookingId)
      else throw new BadRequestException('convertedBookingId không hợp lệ')
    }
    if (patch.status === 'converted_booking' && !patch.convertedBookingId && !doc.convertedBookingId) {
      throw new BadRequestException('Cần cung cấp convertedBookingId khi đổi trạng thái thành booking')
    }
    const now = new Date()
    patch.updatedByStaffId = actorId
    if (actorRole === 'staff' && patch.lastContactedAt === undefined) {
      patch.lastContactedAt = now
    }
    const hasNewQuote =
      (patch.lastQuoteSummary !== undefined && patch.lastQuoteSummary !== null && patch.lastQuoteSummary !== '' &&
        patch.lastQuoteSummary !== doc.lastQuoteSummary) ||
      (typeof payload.quoteCount === 'number' && (doc.quoteCount || 0) < payload.quoteCount)
    if (hasNewQuote) {
      patch.quoteCount = Math.max(Number(doc.quoteCount || 0) + 1, Number(payload.quoteCount || 0))
      if (patch.status === undefined && doc.status !== 'won' && doc.status !== 'converted_booking' && doc.status !== 'lost' && doc.status !== 'archived') {
        patch.status = 'quoting'
      }
    }
    if (patch.lostReason && !doc.lostReason && patch.lostReason !== doc.lostReason) {
      if (patch.status === undefined) patch.status = 'lost'
    }
    if (patch.status === 'won' && !patch.wonAt && !doc.wonAt) patch.wonAt = now
    if (patch.status === 'lost' && !doc.lostAt) patch.lostAt = now
    if (patch.status === 'converted_booking' && !patch.wonAt && !doc.wonAt) patch.wonAt = now
    const oldSnap = doc.toObject()
    const updated = await this.model.findByIdAndUpdate(doc._id, { $set: patch }, { new: true }).orFail().exec()
    await this.audit.create({
      actorUserId: actorId.toString(),
      actorEmail: `${actorRole}_${actorId.toString()}@internal.local`,
      actorRole: actorRole,
      action: 'group_tour_request.update',
      entityType: 'group_tour_request',
      entityId: (doc._id as any)?.toString() ?? null,
      meta: { patch, old: oldSnap, code: doc.code, autoTransitioned: hasNewQuote ? 'quoting' : (patch.status === 'lost' ? 'lost' : (patch.status === 'won' ? 'won' : null)) },
    })
    try { await this.emitGtrNotifications({ before: oldSnap as any, after: updated.toObject(), actorId, actorRole }) } catch {}
    return updated
  }

  private async emitGtrNotifications(ctx: {
    before: GroupTourRequestDocument
    after: GroupTourRequestDocument
    actorId: Types.ObjectId
    actorRole: 'admin' | 'staff'
  }) {
    const { before, after, actorId, actorRole } = ctx
    const changedStatus = after.status !== before.status
    const code = String(after.code || before.code || after._id)
    const customerSummary = `${after.contactName || before.contactName || 'Khách đoàn'} - ${after.destination || before.destination || 'Tour đoàn'}`
    const pax = Number(after.adultCount || before.adultCount || 0) + Number(after.childCount || before.childCount || 0) + Number(after.infantCount || before.infantCount || 0)
    const estimate = Number(after.totalBudgetVnd || before.totalBudgetVnd || (Number(after.budgetPerPersonVnd || before.budgetPerPersonVnd || 0) * Math.max(1, Number(after.adultCount || before.adultCount || 0) + Number(after.childCount || before.childCount || 0) + Number(after.infantCount || before.infantCount || 0))) || 0)
    const list: CreateNotificationInput[] = []

    if (after.assignedStaffId && String(after.assignedStaffId) !== String(before.assignedStaffId)) {
      list.push({
        recipientId: new Types.ObjectId(String(after.assignedStaffId)),
        recipientRole: 'staff',
        type: 'gtr_assigned_staff' as NotificationType,
        title: `Giao đơn mới: ${customerSummary}`,
        body: `Bạn được giao xử lý yêu cầu ${code}. ${pax ? (pax + ' hành khách.') : ''} ${estimate ? ('Chi phí ước tính ' + Number(estimate).toLocaleString('vi-VN') + 'đ.') : ''} Vui lòng liên hệ trong 30 phút.`,
        entityType: 'group_tour_request',
        entityId: after._id as any,
        actionUrl: `/staff/group-tour-requests?id=${after._id}`,
        priority: after.priority === 'urgent' ? 'urgent' : (after.priority === 'high' ? 'high' : 'medium'),
        senderUserId: actorRole === 'admin' ? actorId : null,
      })
    }

    if (changedStatus && after.status === 'contacted') {
      if (after.createdByUserId) {
        list.push({
          recipientId: new Types.ObjectId(String(after.createdByUserId)),
          recipientRole: 'customer',
          type: 'gtr_contacted' as NotificationType,
          title: `Nhân viên đã liên hệ - ${code}`,
          body: `Nhân viên xử lý đã liên hệ về yêu cầu tour đoàn của bạn. Sẽ gửi báo giá chi tiết sớm.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/account/notifications`,
          priority: 'medium',
          senderUserId: actorId,
        })
      }
    }

    if (after.quoteCount > (before.quoteCount || 0) || (after.lastQuoteSummary && after.lastQuoteSummary !== before.lastQuoteSummary)) {
      if (after.createdByUserId) {
        list.push({
          recipientId: new Types.ObjectId(String(after.createdByUserId)),
          recipientRole: 'customer',
          type: 'gtr_quoting' as NotificationType,
          title: `Báo giá mới #${after.quoteCount || 1} - ${code}`,
          body: after.lastQuoteSummary ? after.lastQuoteSummary : 'Báo giá chi tiết đã sẵn sàng, vui lòng xem chi tiết và phản hồi.',
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/account/notifications`,
          priority: 'high',
          senderUserId: actorId,
        })
      }
    }

    if (changedStatus && after.status === 'negotiating') {
      if (after.createdByUserId) {
        list.push({
          recipientId: new Types.ObjectId(String(after.createdByUserId)),
          recipientRole: 'customer',
          type: 'gtr_negotiating' as NotificationType,
          title: `Đang đàm phán - ${code}`,
          body: `Nhân viên đang điều chỉnh yêu cầu theo phản hồi của bạn (phòng, chỗ ở, dịch vụ thêm). Kết quả có trong 1-2 ngày làm việc.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/account/notifications`,
          priority: 'medium',
          senderUserId: actorId,
        })
      }
    }

    if (changedStatus && (after.status === 'won' || after.status === 'converted_booking')) {
      if (after.createdByUserId) {
        list.push({
          recipientId: new Types.ObjectId(String(after.createdByUserId)),
          recipientRole: 'customer',
          type: 'gtr_won' as NotificationType,
          title: `Đã chốt đơn - ${code}`,
          body: `Yêu cầu tour đoàn đã được xác nhận chính thức! Nhân viên sẽ gửi hợp đồng và biên lai đặt cọc trong 1 giờ.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: after.convertedBookingId ? `/account/bookings?id=${after.convertedBookingId}` : `/account/notifications`,
          priority: 'high',
          senderUserId: actorId,
        })
      }
      if (estimate >= 500_000_000) {
        list.push({
          recipientId: null as any,
          recipientRole: 'admin',
          type: 'admin_gtr_won_large' as NotificationType,
          title: `Chốt đơn LỚN ${code} - ${customerSummary}`,
          body: `Đã chốt đơn trị giá ${Number(estimate).toLocaleString('vi-VN')}đ - ${pax} khách. Đến hạn xác nhận dịch vụ sớm.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/admin/group-tour-requests?id=${after._id}`,
          priority: 'urgent',
          channels: ['in_app', 'email'],
          senderUserId: actorId,
        })
      }
    }

    if (changedStatus && after.status === 'lost') {
      if (after.createdByUserId) {
        list.push({
          recipientId: new Types.ObjectId(String(after.createdByUserId)),
          recipientRole: 'customer',
          type: 'gtr_lost' as NotificationType,
          title: `Yêu cầu ${code} đã đóng`,
          body: `Chúng tôi rất tiếc chưa thể phục vụ chuyến đi này. Mong có cơ hội đồng hành cùng quý đoàn lần sau. Voucher 5% tour tiếp theo đã được gửi vào tài khoản.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/account/notifications`,
          priority: 'medium',
          senderUserId: actorId,
        })
      }
      if (estimate >= 500_000_000) {
        list.push({
          recipientId: null as any,
          recipientRole: 'admin',
          type: 'admin_gtr_lost_large' as NotificationType,
          title: `Thua đơn LỚN ${code} - ${customerSummary}`,
          body: `Lý do: ${after.lostReason || '—'}. Trị giá ${Number(estimate).toLocaleString('vi-VN')}đ. Review kịch bản đối thủ.`,
          entityType: 'group_tour_request',
          entityId: after._id as any,
          actionUrl: `/admin/group-tour-requests?id=${after._id}`,
          priority: 'high',
          channels: ['in_app', 'email'],
          senderUserId: actorId,
        })
      }
    }

    if (!list.length) return
    const bulkFinal: CreateNotificationInput[] = []
    for (const n of list) {
      if (n.recipientRole === 'admin' && !String(n.recipientId)) {
        const admins = await this.model.db.collection('users').find({ role: 'admin', isActive: { $ne: false } }).project({ _id: 1 }).toArray()
        for (const a of admins) {
          bulkFinal.push({ ...n, recipientId: new Types.ObjectId(String(a._id)) })
        }
      } else {
        bulkFinal.push(n)
      }
    }
    await this.notifications.bulk(bulkFinal)
  }

  async markContacted(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff') {
    const now = new Date()
    return this.patch(id, { status: 'contacted', lastContactedAt: now.toISOString(), followUpAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() } as any, actorId, actorRole)
  }

  async markQuoting(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff', summary?: string, followUpDays = 1) {
    const now = new Date()
    return this.patch(id, {
      status: 'quoting',
      lastQuoteSummary: summary || undefined,
      followUpAt: new Date(now.getTime() + followUpDays * 24 * 60 * 60 * 1000).toISOString(),
      quoteCount: 1,
    } as any, actorId, actorRole)
  }

  async markNegotiating(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff', note?: string, followUpDays = 2) {
    const now = new Date()
    return this.patch(id, {
      status: 'negotiating',
      internalStaffNote: note ? (note + (note.endsWith('\n') ? '' : '\n') + '[Auto: chuyển trạng thái đàm phán ' + now.toISOString().slice(0, 16) + ']') : undefined,
      followUpAt: new Date(now.getTime() + followUpDays * 24 * 60 * 60 * 1000).toISOString(),
    } as any, actorId, actorRole)
  }

  async markWon(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff', note?: string) {
    const now = new Date()
    return this.patch(id, {
      status: 'won',
      wonAt: now.toISOString(),
      internalStaffNote: note ? (note + (note.endsWith('\n') ? '' : '\n') + '[Auto: chốt đơn ' + now.toISOString().slice(0, 16) + ']') : undefined,
    } as any, actorId, actorRole)
  }

  async markLost(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff', reason: string) {
    const now = new Date()
    return this.patch(id, {
      status: 'lost',
      lostAt: now.toISOString(),
      lostReason: reason || 'Không nêu lý do',
    } as any, actorId, actorRole)
  }
}
