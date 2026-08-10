import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { AuditLogsService } from '../audit-logs/audit-logs.service'
import { UserRole } from '../users/user-role'
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
      actorRole: (opts?.createdByUserId ? 'customer' : 'customer') as UserRole,
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
    return doc
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
    if (patch.status === 'lost' && !patch.lostReason && !doc.lostReason) {
      // allow lost without reason
    }
    const oldSnap = doc.toObject()
    const updated = await this.model.findByIdAndUpdate(doc._id, { $set: patch }, { new: true }).orFail().exec()
    await this.audit.create({
      actorUserId: actorId.toString(),
      actorEmail: `${actorRole}_${actorId.toString()}@internal.local`,
      actorRole: actorRole as UserRole,
      action: 'group_tour_request.update',
      entityType: 'group_tour_request',
      entityId: (doc._id as any)?.toString() ?? null,
      meta: { patch, old: oldSnap, code: doc.code },
    })
    return updated
  }

  async markContacted(id: string, actorId: Types.ObjectId, actorRole: 'admin' | 'staff') {
    const now = new Date()
    return this.patch(id, { status: 'contacted', lastContactedAt: now.toISOString(), followUpAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() } as any, actorId, actorRole)
  }
}
