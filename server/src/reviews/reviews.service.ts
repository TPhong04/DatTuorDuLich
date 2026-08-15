import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'

import { JwtPayload } from '../auth/auth.types'
import {
  CreateReviewDto,
  UpdateReviewDto,
  SetReviewStatusDto,
  PatchReviewPermissionsDto,
  ReportReviewDto,
  AdminReplyReviewDto,
  StaffReplyReviewDto,
  ListReviewsQueryDto,
  BulkReviewActionDto,
} from './dto'
import { Review, ReviewDocument, ReviewRating, ReviewStatus, REVIEW_STATUSES } from './review.schema'
import { Booking, BookingDocument } from '../bookings/booking.schema'
import { Tour, TourDocument } from '../tours/tour.schema'
import { User, UserDocument } from '../users/user.schema'

export type ReviewActor = JwtPayload

const REPORT_AUTO_REPORTED_THRESHOLD = 3
const REVIEW_EDITABLE_DAYS_AFTER_CREATED = 7
const REVIEW_CREATE_WINDOW_DAYS_AFTER_TRIP_END = 30

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function tripEndDate(departure: Date, durationDays: number): Date {
  const d = new Date(departure)
  d.setDate(d.getDate() + Math.max(0, durationDays - 1))
  return d
}

function toPublicReview(r: any) {
  return {
    id: String(r._id ?? r.id),
    tourId: String(r.tourId),
    bookingId: String(r.bookingId),
    customerId: String(r.customerId),
    customerName: r.customerName,
    customerAvatarUrl: r.customerAvatarUrl ?? null,
    rating: r.rating as ReviewRating,
    title: r.title ?? null,
    content: r.content,
    images: Array.isArray(r.images) ? r.images : [],
    tripDate: r.tripDate,
    likeCount: Number(r.likeCount ?? 0),
    isVerified: Boolean(r.isVerified ?? true),
    status: r.status as ReviewStatus,
    isReported: Boolean(r.isReported),
    reportCount: Number(r.reportCount ?? 0),
    adminReply: r.adminReply ?? null,
    adminReplyAt: r.adminReplyAt ?? null,
    staffReply: r.staffReply ?? null,
    staffReplyAt: r.staffReplyAt ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

function toAdminReview(r: any) {
  return {
    ...toPublicReview(r),
    requireStaffRemoval: Boolean(r.requireStaffRemoval ?? false),
    canStaffDelete: Boolean(r.canStaffDelete ?? false),
    canStaffEdit: Boolean(r.canStaffEdit ?? false),
    adminReplyBy: r.adminReplyBy ? String(r.adminReplyBy) : null,
    staffReplyBy: r.staffReplyBy ? String(r.staffReplyBy) : null,
    removedByStaffId: r.removedByStaffId ? String(r.removedByStaffId) : null,
    removedAt: r.removedAt ?? null,
    removedBy: r.removedBy ? String(r.removedBy) : null,
    editableUntil: r.editableUntil ?? null,
    reports: Array.isArray(r.reports)
      ? r.reports.map((rp: any) => ({
        reportedByUserId: rp.reportedByUserId ? String(rp.reportedByUserId) : null,
        reportedByGuestIp: rp.reportedByGuestIp ?? null,
        reason: rp.reason,
        detail: rp.detail ?? null,
        createdAt: rp.createdAt,
      }))
      : [],
  }
}

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly model: Model<ReviewDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Tour.name) private readonly tourModel: Model<TourDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    try {
      const job = CronJob.from({
        cronTime: '0 10 2 * * *',
        onTick: () => void this.runNightlyJobs().catch(() => undefined),
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      schedulerRegistry.addCronJob('reviews_nightly_jobs', job)
      job.start()
    } catch (_err) {
      // noop
    }
  }

  private isAdmin(actor: ReviewActor): boolean {
    return actor.role === 'admin'
  }

  private isStaff(actor: ReviewActor): boolean {
    return actor.role === 'staff'
  }

  private isCustomer(actor: ReviewActor): boolean {
    return actor.role === 'customer'
  }

  assertCanCreateForBooking(booking: BookingDocument, tour: TourDocument, actor: ReviewActor): void {
    if (!this.isCustomer(actor)) throw new ForbiddenException('Chỉ khách hàng mới được viết đánh giá')
    if (String((booking as any).createdBy) !== String(actor.sub)) throw new ForbiddenException('Đây không phải đơn hàng của bạn')
    if (booking.status === 'cancelled') throw new ForbiddenException('Đơn hàng đã bị hủy, không được đánh giá')
    if (booking.status !== 'completed') throw new ForbiddenException('Chỉ được đánh giá đơn tour đã hoàn thành (trạng thái completed)')
    const endDate = tripEndDate(booking.departureDate, tour.durationDays)
    const today = new Date()
    if (today.getTime() <= endDate.getTime()) throw new ForbiddenException('Tour chưa kết thúc, bạn có thể đánh giá sau khi tour kết thúc')
    const windowEnd = addDays(endDate, REVIEW_CREATE_WINDOW_DAYS_AFTER_TRIP_END)
    if (today.getTime() > windowEnd.getTime()) throw new ForbiddenException(`Đã hết thời gian đánh giá (${REVIEW_CREATE_WINDOW_DAYS_AFTER_TRIP_END} ngày kể từ khi tour kết thúc)`)
  }

  assertCanEditOwnReview(doc: ReviewDocument, actor: ReviewActor): void {
    if (this.isAdmin(actor)) return
    if (this.isStaff(actor)) {
      if (!doc.canStaffEdit) throw new ForbiddenException('Admin chưa cấp quyền sửa bài đánh giá này cho staff')
      return
    }
    if (String(doc.customerId) !== String(actor.sub)) throw new ForbiddenException('Bạn không phải người viết đánh giá này')
    if (!doc.editableUntil || new Date(doc.editableUntil).getTime() < Date.now()) throw new ForbiddenException('Đã hết thời gian sửa đánh giá (7 ngày)')
  }

  assertCanDelete(doc: ReviewDocument, actor: ReviewActor): void {
    if (this.isAdmin(actor)) return
    if (this.isStaff(actor)) {
      if (!doc.requireStaffRemoval && !doc.canStaffDelete) throw new ForbiddenException('Chỉ được xóa bài đánh giá khi admin có yêu cầu (bật cờ xử lý bài tiêu cực)')
      return
    }
    if (String(doc.customerId) !== String(actor.sub)) throw new ForbiddenException('Bạn không phải người viết đánh giá này')
    if (!doc.editableUntil || new Date(doc.editableUntil).getTime() < Date.now()) throw new ForbiddenException('Đã hết thời gian xóa đánh giá (7 ngày)')
  }

  assertCanChangeStatus(actor: ReviewActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ admin mới được ẩn/hiện/xóa vĩnh viễn bài đánh giá')
  }

  assertCanSetPermissions(actor: ReviewActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ admin mới được bật/tắt quyền staff xử lý bài đánh giá')
  }

  assertCanStaffReply(actor: ReviewActor): void {
    if (!this.isStaff(actor) && !this.isAdmin(actor)) throw new ForbiddenException('Chỉ nhân viên / admin mới được trả lời bài đánh giá với vai trò hỗ trợ')
  }

  assertCanAdminReply(actor: ReviewActor): void {
    if (!this.isAdmin(actor)) throw new ForbiddenException('Chỉ admin mới được trả lời chính thức quản trị viên')
  }

  // ---------- Public read ----------

  async listPublic(dto: ListReviewsQueryDto) {
    const page = Math.max(1, Number(dto.page ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(dto.pageSize ?? 10)))
    const filter: Record<string, unknown> = { status: 'published' }
    if (dto.tourId) filter.tourId = new Types.ObjectId(dto.tourId)
    if (dto.tourSlug) {
      const t = await this.tourModel.findOne({ slug: dto.tourSlug }).select('_id').lean()
      if (t) filter.tourId = t._id
    }
    if (dto.rating) filter.rating = dto.rating
    let sort: Record<string, 1 | -1> = { createdAt: -1 }
    switch (dto.sort) {
      case 'oldest':
        sort = { createdAt: 1 }
        break
      case 'rating_desc':
        sort = { rating: -1, createdAt: -1 }
        break
      case 'rating_asc':
        sort = { rating: 1, createdAt: -1 }
        break
      case 'most_liked':
        sort = { likeCount: -1, createdAt: -1 }
        break
      case 'most_reported':
        sort = { reportCount: -1, createdAt: -1 }
        break
      default:
        sort = { createdAt: -1 }
    }
    if (dto.search) {
      (filter as any).$or = [
        { title: { $regex: String(dto.search), $options: 'i' } },
        { content: { $regex: String(dto.search), $options: 'i' } },
      ]
    }
    const [totalRows, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).sort(sort).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ])
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    return {
      rows: rows.map(toPublicReview),
      page,
      pageSize,
      totalPages,
      totalRows,
    }
  }

  async getTourSummary(tourIdRaw: string, tourSlug: string | null) {
    let tourId: Types.ObjectId | null = null
    if (tourIdRaw) tourId = new Types.ObjectId(tourIdRaw)
    if (!tourId && tourSlug) {
      const t = await this.tourModel.findOne({ slug: tourSlug }).select('_id').lean()
      if (t) tourId = t._id as Types.ObjectId
    }
    if (!tourId) return { avgRating: null, totalReviews: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }
    const filter = { tourId, status: 'published' as const }
    const [totalReviews, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).select('rating').lean(),
    ])
    let sum = 0
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>
    for (const r of rows) {
      sum += r.rating
      if (r.rating >= 1 && r.rating <= 5) dist[r.rating] = (dist[r.rating] || 0) + 1
    }
    const avgRating = totalReviews > 0 ? Math.round((sum / totalReviews) * 10) / 10 : null
    return { tourId: String(tourId), avgRating, totalReviews, ratingDistribution: dist }
  }

  async myPendingReviewBookings(customerId: string, _dto: { page: number; pageSize: number }) {
    const customerOid = new Types.ObjectId(customerId)
    const bookings = await this.bookingModel
      .find({ createdBy: customerOid, status: { $in: ['completed'] } })
      .sort({ departureDate: -1 })
      .lean()
    const tourIds = [...new Set(bookings.map((b) => String(b.tourId)))]
    const tours = await this.tourModel
      .find({ _id: { $in: tourIds.map((id) => new Types.ObjectId(id)) } })
      .select('_id title slug durationDays coverImageUrl')
      .lean()
    const tourMap = new Map(tours.map((t) => [String(t._id), t]))
    const existingReviews = await this.model.find({ customerId: customerOid }).select('bookingId').lean()
    const reviewedBookingIds = new Set(existingReviews.map((r) => String(r.bookingId)))
    const today = new Date()
    const rows: any[] = []
    for (const b of bookings) {
      const t = tourMap.get(String(b.tourId))
      if (!t) continue
      const tdur = (t as any).durationDays && typeof (t as any).durationDays === 'number' ? (t as any).durationDays : 1
      const endDate = tripEndDate(b.departureDate, tdur)
      const windowEnd = addDays(endDate, REVIEW_CREATE_WINDOW_DAYS_AFTER_TRIP_END)
      const canReview =
        b.status === 'completed' &&
        today.getTime() > endDate.getTime() &&
        today.getTime() <= windowEnd.getTime() &&
        !reviewedBookingIds.has(String(b._id ?? b.id))
      const state = !canReview
        ? reviewedBookingIds.has(String(b._id ?? b.id))
          ? 'reviewed'
          : today.getTime() <= endDate.getTime()
          ? 'not_started'
          : today.getTime() > windowEnd.getTime()
          ? 'expired'
          : 'not_eligible'
        : 'pending'
      rows.push({
        bookingId: String(b._id ?? b.id),
        bookingCode: b.code,
        tourId: String(b.tourId),
        tourTitle: (b.tourSnapshot as any)?.title ?? (t as any).title,
        tourSlug: (t as any).slug ?? null,
        tourCover: (t as any).coverImageUrl ?? null,
        departureDate: b.departureDate,
        tripEndDate: endDate,
        reviewWindowEnd: windowEnd,
        bookingStatus: b.status,
        reviewState: state,
        canReview,
      })
    }
    return {
      rows,
      pendingCount: rows.filter((r) => r.canReview).length,
      totalRows: rows.length,
    }
  }

  async canCustomerEditState(customerId: string) {
    const rows = await this.myPendingReviewBookings(customerId, { page: 1, pageSize: 200 })
    return {
      pendingReviewBookings: rows.rows,
      pendingCount: rows.pendingCount,
    }
  }

  // ---------- Write public / me ----------

  async create(dto: CreateReviewDto, actor: ReviewActor) {
    if (!this.isCustomer(actor)) throw new ForbiddenException('Chỉ khách hàng mới viết đánh giá')
    const booking = await this.bookingModel.findById(dto.bookingId)
    if (!booking) throw new NotFoundException('Đơn hàng không tồn tại')
    const tour = await this.tourModel.findById(booking.tourId)
    if (!tour) throw new NotFoundException('Tour không tồn tại')
    this.assertCanCreateForBooking(booking, tour, actor)
    const existed = await this.model.findOne({ customerId: new Types.ObjectId(actor.sub), tourId: tour._id })
    if (existed) throw new BadRequestException('Bạn đã đánh giá tour này rồi, chỉ được đánh giá 1 lần / tour')
    const user = await this.userModel.findById(actor.sub).select('fullName avatarUrl').lean()
    const created = await this.model.create({
      tourId: tour._id,
      tourTitleSnapshot: tour.title,
      bookingId: booking._id,
      customerId: new Types.ObjectId(actor.sub),
      customerName: (user as any)?.fullName ?? actor.email,
      customerAvatarUrl: (user as any)?.avatarUrl ?? null,
      rating: dto.rating as ReviewRating,
      title: dto.title ?? null,
      content: dto.content,
      images: Array.isArray(dto.images) ? dto.images.slice(0, 6) : [],
      tripDate: booking.departureDate,
      editableUntil: addDays(new Date(), REVIEW_EDITABLE_DAYS_AFTER_CREATED),
      status: 'published',
    })
    await this.refreshTourRatingAndCount(tour._id)
    return toAdminReview(await created.save().then((x) => x.toObject()))
  }

  async update(id: string, dto: UpdateReviewDto, actor: ReviewActor) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    this.assertCanEditOwnReview(doc, actor)
    if (typeof dto.rating === 'number') doc.rating = dto.rating as ReviewRating
    if (typeof dto.title !== 'undefined') doc.title = dto.title ?? null
    if (typeof dto.content !== 'undefined' && dto.content !== null && dto.content !== '') doc.content = dto.content
    if (Array.isArray(dto.images)) doc.images = dto.images.slice(0, 6)
    const saved = await doc.save()
    await this.refreshTourRatingAndCount(doc.tourId)
    return toAdminReview(saved.toObject())
  }

  async remove(id: string, actor: ReviewActor) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    this.assertCanDelete(doc, actor)
    const tourIdBefore = doc.tourId
    doc.status = 'deleted'
    doc.removedBy = new Types.ObjectId(actor.sub)
    doc.removedAt = new Date()
    if (this.isStaff(actor)) doc.removedByStaffId = new Types.ObjectId(actor.sub)
    if (doc.requireStaffRemoval) doc.requireStaffRemoval = false
    await doc.save()
    await this.refreshTourRatingAndCount(tourIdBefore)
    return { success: true, id }
  }

  async setStatus(id: string, dto: SetReviewStatusDto, actor: ReviewActor) {
    this.assertCanChangeStatus(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    if (!REVIEW_STATUSES.includes(dto.status as any)) throw new BadRequestException('Trạng thái không hợp lệ')
    const before = doc.status
    doc.status = dto.status as ReviewStatus
    if (dto.status === 'deleted') {
      doc.removedAt = new Date()
      doc.removedBy = new Types.ObjectId(actor.sub)
    }
    await doc.save()
    await this.refreshTourRatingAndCount(doc.tourId)
    return { ...toAdminReview(doc.toObject()), beforeStatus: before }
  }

  async patchPermissions(id: string, dto: PatchReviewPermissionsDto, actor: ReviewActor) {
    this.assertCanSetPermissions(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    if (typeof dto.requireStaffRemoval === 'boolean') doc.requireStaffRemoval = dto.requireStaffRemoval
    if (typeof dto.canStaffDelete === 'boolean') doc.canStaffDelete = dto.canStaffDelete
    if (typeof dto.canStaffEdit === 'boolean') doc.canStaffEdit = dto.canStaffEdit
    await doc.save()
    return toAdminReview(doc.toObject())
  }

  async report(id: string, dto: ReportReviewDto, actor: ReviewActor | null, guestIp: string | null) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    doc.reports.push({
      reportedByUserId: actor ? new Types.ObjectId(actor.sub) : null,
      reportedByGuestIp: guestIp,
      reason: dto.reason,
      detail: dto.detail ?? null,
      createdAt: new Date(),
    })
    doc.reportCount = (doc.reportCount || 0) + 1
    if (doc.reportCount >= REPORT_AUTO_REPORTED_THRESHOLD) doc.isReported = true
    await doc.save()
    return { success: true, reportCount: doc.reportCount, isReported: doc.isReported }
  }

  async toggleLike(id: string, actor: ReviewActor) {
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    const userIdStr = String(actor.sub)
    const likedArr = doc.likedByUserIds?.map(String) ?? []
    const has = likedArr.includes(userIdStr)
    if (has) {
      doc.likedByUserIds = (doc.likedByUserIds || []).filter((x) => String(x) !== userIdStr)
      doc.likeCount = Math.max(0, (doc.likeCount || 0) - 1)
    } else {
      doc.likedByUserIds = [...(doc.likedByUserIds || []), new Types.ObjectId(userIdStr)]
      doc.likeCount = (doc.likeCount || 0) + 1
    }
    await doc.save()
    return { success: true, liked: !has, likeCount: doc.likeCount }
  }

  async staffReply(id: string, dto: StaffReplyReviewDto, actor: ReviewActor) {
    this.assertCanStaffReply(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    doc.staffReply = dto.content
    doc.staffReplyBy = new Types.ObjectId(actor.sub)
    doc.staffReplyAt = new Date()
    await doc.save()
    return toAdminReview(doc.toObject())
  }

  async adminReply(id: string, dto: AdminReplyReviewDto, actor: ReviewActor) {
    this.assertCanAdminReply(actor)
    const doc = await this.model.findById(id)
    if (!doc) throw new NotFoundException('Bài đánh giá không tồn tại')
    doc.adminReply = dto.content
    doc.adminReplyBy = new Types.ObjectId(actor.sub)
    doc.adminReplyAt = new Date()
    await doc.save()
    return toAdminReview(doc.toObject())
  }

  // ---------- Admin list ----------

  async listAdmin(dto: ListReviewsQueryDto, actor: ReviewActor) {
    const page = Math.max(1, Number(dto.page ?? 1))
    const pageSize = Math.min(200, Math.max(1, Number(dto.pageSize ?? 25)))
    const filter: Record<string, unknown> = {}
    if (dto.tourId) filter.tourId = new Types.ObjectId(dto.tourId)
    if (dto.tourSlug) {
      const t = await this.tourModel.findOne({ slug: dto.tourSlug }).select('_id').lean()
      if (t) filter.tourId = t._id
    }
    if (dto.rating) filter.rating = dto.rating
    if (Array.isArray(dto.status) && dto.status.length) filter.status = { $in: dto.status }
    if (dto.customerId && dto.customerId !== 'all') filter.customerId = new Types.ObjectId(dto.customerId)
    if (typeof dto.isReported === 'boolean') filter.isReported = dto.isReported
    if (typeof dto.requireStaffRemoval === 'boolean') filter.requireStaffRemoval = dto.requireStaffRemoval
    if (this.isStaff(actor) && dto.onlyMine) {
      (filter as any).$or = [{ requireStaffRemoval: true }, { canStaffDelete: true }]
    }
    if (Array.isArray(dto.ids) && dto.ids.length) filter._id = { $in: dto.ids.map((x) => new Types.ObjectId(x)) }
    if (dto.search) {
      (filter as any).$or = [
        { title: { $regex: String(dto.search), $options: 'i' } },
        { content: { $regex: String(dto.search), $options: 'i' } },
        { customerName: { $regex: String(dto.search), $options: 'i' } },
      ]
    }
    let sort: Record<string, 1 | -1> = { createdAt: -1 }
    switch (dto.sort) {
      case 'oldest':
        sort = { createdAt: 1 }
        break
      case 'rating_desc':
        sort = { rating: -1, createdAt: -1 }
        break
      case 'rating_asc':
        sort = { rating: 1, createdAt: -1 }
        break
      case 'most_liked':
        sort = { likeCount: -1, createdAt: -1 }
        break
      case 'most_reported':
        sort = { reportCount: -1, isReported: -1, requireStaffRemoval: -1 } as any
        break
      default:
        sort = { createdAt: -1 }
    }
    const [totalRows, rows] = await Promise.all([
      this.model.countDocuments(filter),
      this.model.find(filter).sort(sort as any).skip((page - 1) * pageSize).limit(pageSize).lean(),
    ])
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
    const reportedPending = await this.model.countDocuments({ $or: [{ isReported: true }, { reportCount: { $gte: 1 } }] })
    const assigned = await this.model.countDocuments({ requireStaffRemoval: true, status: { $ne: 'deleted' } })
    return {
      rows: rows.map(toAdminReview),
      page,
      pageSize,
      totalPages,
      totalRows,
      reportedPendingCount: reportedPending,
      assignedStaffCount: assigned,
    }
  }

  async bulkAction(dto: BulkReviewActionDto, actor: ReviewActor) {
    const ids = Array.isArray(dto.ids) ? dto.ids : []
    if (!ids.length) throw new BadRequestException('Chưa chọn bài nào')
    const oids = ids.map((x) => new Types.ObjectId(x))
    const rows = await this.model.find({ _id: { $in: oids } })
    const uniqueTourIds = [...new Set(rows.map((r) => String(r.tourId)))]
    let processed = 0
    if (dto.action === 'hide' || dto.action === 'publish') {
      this.assertCanChangeStatus(actor)
      for (const doc of rows) {
        doc.status = dto.action === 'hide' ? 'hidden' : 'published'
        await doc.save()
        processed += 1
      }
    } else if (dto.action === 'delete') {
      for (const doc of rows) {
        try {
          this.assertCanDelete(doc, actor)
          doc.status = 'deleted'
          doc.removedAt = new Date()
          doc.removedBy = new Types.ObjectId(actor.sub)
          if (this.isStaff(actor)) doc.removedByStaffId = new Types.ObjectId(actor.sub)
          if (doc.requireStaffRemoval) doc.requireStaffRemoval = false
          await doc.save()
          processed += 1
        } catch (_e) {
          // next
        }
      }
    } else if (dto.action === 'assign_staff' || dto.action === 'unassign_staff') {
      this.assertCanSetPermissions(actor)
      for (const doc of rows) {
        doc.requireStaffRemoval = dto.action === 'assign_staff'
        await doc.save()
        processed += 1
      }
    }
    for (const tid of uniqueTourIds) await this.refreshTourRatingAndCount(new Types.ObjectId(tid))
    return { success: true, action: dto.action, processed }
  }

  // ---------- Helpers ----------

  private async refreshTourRatingAndCount(tourId: Types.ObjectId) {
    try {
      const filter = { tourId, status: 'published' as const }
      const [total, rows] = await Promise.all([
        this.model.countDocuments(filter),
        this.model.find(filter).select('rating').lean(),
      ])
      let sum = 0
      for (const r of rows) sum += r.rating || 0
      const avg = total > 0 ? Math.round((sum / total) * 10) / 10 : null
      await this.tourModel.updateOne({ _id: tourId }, { $set: { avgRating: avg, reviewCount: total } })
    } catch (_e) {
      // noop
    }
  }

  // ---------- Cron ----------

  async runNightlyJobs() {
    return this.autoMarkCompletedBookings()
  }

  private async autoMarkCompletedBookings() {
    try {
      const tours = await this.tourModel.find({}).select('_id durationDays').lean()
      const tourDurationMap = new Map(tours.map((t) => [String(t._id), (t as any).durationDays && typeof (t as any).durationDays === 'number' ? (t as any).durationDays : 1]))
      const today = new Date()
      const bookings = await this.bookingModel.find({ status: { $in: ['confirmed', 'in_progress'] } }).select('tourId departureDate status').lean()
      for (const b of bookings) {
        const dur = tourDurationMap.get(String(b.tourId)) || 1
        const end = tripEndDate(b.departureDate, dur)
        if (today.getTime() > addDays(end, 1).getTime() && b.status !== 'completed') {
          await this.bookingModel.updateOne({ _id: (b as any)._id }, { $set: { status: 'completed' } })
        }
      }
      return { success: true }
    } catch (_e) {
      return { success: false }
    }
  }
}
