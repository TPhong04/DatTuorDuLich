import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule'
import { Model, Types } from 'mongoose'
import { JwtPayload } from '../auth/auth.types'
import { NotificationsService, CreateNotificationInput } from '../notifications/notifications.service'
import { NotificationType } from '../notifications/notification.schema'
import { Booking, BookingDocument, BookingStatus, BookingTourSnapshot, BookingPassenger, BookingSurchargeLine } from './booking.schema'
import { CreateBookingPayload, ListBookingsQuery, UpdateBookingStatusPayload, AssignStaffBookingPayload } from './dto'
import { Tour, TourDocument, TourDeparture } from '../tours/tour.schema'
import { TransactionsService } from '../transactions/transactions.service'
import { UsersService } from '../users/users.service'
import { VehiclesService } from '../vehicles/vehicles.service'
// #region debug-point booking-create-500
import { dbg } from '../_dbg'
// #endregion

const UPPER_POOL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomChars(len: number): string {
  let out = ''
  for (let i = 0; i < len; i += 1) out += UPPER_POOL[Math.floor(Math.random() * UPPER_POOL.length)]
  return out
}
function todayYYYYMMDD(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function toDateLocal(input: string | number | Date): Date {
  const d = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Định dạng ngày không hợp lệ')
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, da] = input.split('-').map((x) => parseInt(x, 10))
    return new Date(y, (m || 1) - 1, da || 1, 12, 0, 0, 0)
  }
  return d
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Tour.name) private readonly tourModel: Model<TourDocument>,
    private readonly notifications: NotificationsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly transactions: TransactionsService,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
  ) {
    try {
      const { CronJob } = require('cron') as typeof import('cron')
      const job = CronJob.from({
        cronTime: process.env.BOOKING_HOLD_CRON || '0 */2 * * * *',
        onTick: () => void this.releaseExpiredHolds().catch(() => undefined),
        timeZone: 'Asia/Ho_Chi_Minh',
      })
      schedulerRegistry.addCronJob('booking_release_expired_holds', job)
      job.start()
    } catch (_err) {
      // noop
    }
  }

  async generateBookingCode(attempt = 0): Promise<string> {
    if (attempt > 8) throw new ConflictException('Không sinh được mã đặt chỗ, vui lòng thử lại.')
    const code = `BK-VNEX-${todayYYYYMMDD()}-${randomChars(3)}`
    const exist = await this.bookingModel.findOne({ code }).select('_id').lean()
    if (exist) return this.generateBookingCode(attempt + 1)
    return code
  }

  async findDepartureWithinTour(tour: TourDocument, departureIdHex: string): Promise<{ idx: number; dep: TourDeparture; depIdSafe: Types.ObjectId | null }> {
    const candidates: any[] = Array.isArray(tour.departures) ? tour.departures : []
    const idOrNum = String(departureIdHex || '')
    let idx = -1
    let dep: TourDeparture | undefined
    try {
      const depIdRaw = new Types.ObjectId(idOrNum)
      for (let i = 0; i < candidates.length; i += 1) {
        const d: any = candidates[i]
        const compare = typeof d?._id === 'object' && d._id?.toString ? d._id.toString() : String(d?.id || i)
        if (compare === depIdRaw.toString()) { dep = d as TourDeparture; idx = i; break }
      }
    } catch {
      // not a valid ObjectId, fall through
    }
    if (idx < 0) {
      for (let i = 0; i < candidates.length; i += 1) {
        const d: any = candidates[i]
        if (String(d?.id) === idOrNum || String(d?._id) === idOrNum || (d?._id?.toString ? d._id.toString() : '') === idOrNum) {
          dep = d as TourDeparture; idx = i; break
        }
      }
    }
    if (idx < 0) {
      const byIndex = /^-?\d+$/.test(idOrNum) ? Number(idOrNum) : NaN
      if (!Number.isNaN(byIndex) && byIndex >= 0 && byIndex < candidates.length) {
        const d = candidates[byIndex]
        if (d) { idx = byIndex; dep = d as TourDeparture }
      }
    }
    if (idx < 0 || !dep) throw new NotFoundException('Không tìm thấy đợt khởi hành cho tour này.')
    const dAny: any = dep
    let depIdSafe: Types.ObjectId | null = null
    const depRaw = dAny?._id
    if (depRaw instanceof Types.ObjectId) depIdSafe = depRaw
    else if (depRaw && Types.ObjectId.isValid(String(depRaw)) && /^[0-9a-fA-F]{24}$/.test(String(depRaw))) depIdSafe = new Types.ObjectId(String(depRaw))
    if (!depIdSafe) {
      const tAsAny: any = tour
      const newId = new Types.ObjectId()
      const depsCopy: any[] = Array.isArray(tAsAny.departures) ? tAsAny.departures.slice() : []
      const orig = depsCopy[idx]
      if (orig) { depsCopy[idx] = { ...(orig && typeof orig === 'object' && !Array.isArray(orig) ? orig : {}), _id: newId } }
      tAsAny.departures = depsCopy
      tAsAny.markModified?.('departures')
      const saved = await tour.save()
      const reloaded = await this.tourModel.findById(saved._id).select('+departures').exec()
      const reloadDeps: any[] = Array.isArray((reloaded as any)?.departures) ? (reloaded as any).departures : []
      const foundReloaded: any = reloadDeps[idx] ?? null
      if (foundReloaded && foundReloaded._id instanceof Types.ObjectId) depIdSafe = foundReloaded._id
      else if (foundReloaded && foundReloaded._id && Types.ObjectId.isValid(String(foundReloaded._id))) depIdSafe = new Types.ObjectId(String(foundReloaded._id))
      if (!depIdSafe) depIdSafe = newId
    }
    return { idx, dep, depIdSafe }
  }

  computeSubtotal(payload: CreateBookingPayload, dep: TourDeparture) {
    const adult = (payload.adultCount || 0) * (dep.priceAdult || 0)
    const child = (payload.childCount || 0) * ((typeof dep.priceChild === 'number' ? dep.priceChild : 0) || 0)
    const infant = (payload.infantCount || 0) * ((typeof dep.priceInfant === 'number' ? dep.priceInfant : 0) || 0)
    return { adult, child, infant, subtotal: adult + child + infant }
  }

  computeSurcharge(surcharges: BookingSurchargeLine[]) {
    return surcharges.reduce((sum, s) => sum + Math.max(0, s.quantity || 0) * Math.max(0, s.unitPrice || 0), 0)
  }

  computeTotals(payload: CreateBookingPayload, dep: TourDeparture) {
    const { subtotal } = this.computeSubtotal(payload, dep)
    const surcharge = this.computeSurcharge((payload.surcharges ?? []) as BookingSurchargeLine[])
    const vat = 0
    return { subtotalAmount: subtotal, surchargeAmount: surcharge, vatAmount: vat, totalAmount: subtotal + surcharge + vat }
  }

  assertStaffOwnershipOrAdmin(actor: JwtPayload, booking: BookingDocument, actionLabel = 'thay đổi đơn này'): void {
    if (!actor) throw new ForbiddenException('Thiếu thông tin người dùng')
    const role = String(actor.role || '').toLowerCase()
    if (role === 'admin') return
    if (role !== 'staff') throw new ForbiddenException('Bạn không có quyền thực hiện hành động này')
    const staffId = String(actor.sub)
    const assigned = Array.isArray(booking.assignedStaffIds) ? booking.assignedStaffIds.map((x) => String(x)) : []
    const updatedById = (booking as any).updatedByStaffId ? String((booking as any).updatedByStaffId) : null
    const found = assigned.includes(staffId) || updatedById === staffId
    if (!found) throw new ForbiddenException(`Bạn không được ${actionLabel} vì đơn này không được giao phụ trách cho bạn.`)
  }

  ageAtDeparture(birth: Date | null | undefined, dep: TourDeparture): number | null {
    if (!birth) return null
    const b = birth instanceof Date ? birth : new Date(birth as any)
    if (Number.isNaN(b.getTime())) return null
    const at = dep.departureDate instanceof Date ? dep.departureDate : new Date(dep.departureDate as any)
    if (Number.isNaN(at.getTime())) return null
    let years = at.getFullYear() - b.getFullYear()
    const m = at.getMonth() - b.getMonth()
    if (m < 0 || (m === 0 && at.getDate() < b.getDate())) years -= 1
    return years
  }

  assertPassengerAgeRangesByDeparture(
    passengers: BookingPassenger[],
    dep: TourDeparture,
    adultCountExpected: number,
    childCountExpected: number,
    infantCountExpected: number,
  ): void {
    if (!Array.isArray(passengers)) return
    const issues: string[] = []
    for (let i = 0; i < passengers.length; i += 1) {
      const p = passengers[i]
      if (!p) continue
      const age = this.ageAtDeparture(p.birthDate as any, dep)
      const idxLabel = `Hành khách #${i + 1}${p.fullName ? ' (' + String(p.fullName).slice(0, 24) + ')' : ''}`
      if (age === null) continue
      const type = String(p.type || 'NL')
      if (age < 2) {
        if (type !== 'EB') {
          issues.push(
            `${idxLabel}: ${age} tuổi (tính theo ngày khởi hành) phải là loại EB (em bé dưới 2 tuổi). Hiện đang đặt loại ${type} → sai phí vé (có thể chênh lệch đến -40%~-75% giá vé).`,
          )
        }
      } else if (age <= 12) {
        if (type !== 'TE') {
          issues.push(
            `${idxLabel}: ${age} tuổi (tính theo ngày khởi hành) phải là loại TE (trẻ em từ 2 đến 12 tuổi). Hiện đang đặt loại ${type} → sai giá vé (TE thường bằng 70%~85% giá NL).`,
          )
        }
      } else {
        if (type !== 'NL') {
          issues.push(
            `${idxLabel}: ${age} tuổi (tính theo ngày khởi hành) phải là loại NL (người lớn ≥ 13 tuổi). Hiện đang đặt loại ${type} → giá thấp hơn thực tế gây thiếu thu.`,
          )
        }
      }
    }
    if (issues.length > 0) {
      throw new BadRequestException('Dữ liệu hành khách cần điều chỉnh theo chuẩn ngành du lịch (2 tuổi TE, <2 tuổi EB, ≥13 tuổi NL):\n' + issues.join('\n'))
    }
  }

  async staffListBookings(actor: JwtPayload, query: ListBookingsQuery) {
    if (!actor) throw new ForbiddenException('Thiếu thông tin người dùng')
    const role = String(actor.role || '').toLowerCase()
    const staffOid = (() => { try { return new Types.ObjectId(String(actor.sub)) } catch { return null } })()
    if (role === 'admin') return this.adminListBookings(query)
    if (role !== 'staff') throw new ForbiddenException('Bạn không có quyền xem danh sách này')
    if (!staffOid) throw new BadRequestException('Thông tin nhân viên không hợp lệ')
    const filter: any = {
      $or: [
        { assignedStaffIds: staffOid },
        { updatedByStaffId: staffOid },
      ],
    }
    if (query.status) filter.status = query.status
    if (query.from) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$gte = new Date(query.from as string) }
    if (query.to) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$lte = new Date(new Date(query.to as string).getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000 + 999) }
    if (query.q) {
      const qr = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$and = (filter.$and || []).concat([{
        $or: [{ code: qr }, { 'tourSnapshot.title': qr }, { 'contact.name': qr }, { 'contact.phone': qr }, { 'contact.email': qr }],
      }])
    }
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(5, Number(query.limit) || 20))
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.bookingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bookingModel.countDocuments(filter),
    ])
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async getOneScoped(idOrCode: string, actor: JwtPayload | null): Promise<BookingDocument> {
    const doc = await this.findByCodeOrId(idOrCode)
    if (!actor) return doc
    const role = String(actor.role || '').toLowerCase()
    if (role === 'admin') return doc
    if (role === 'staff') {
      this.assertStaffOwnershipOrAdmin(actor, doc, 'xem chi tiết đơn này')
      return doc
    }
    const userOid = String(actor.sub)
    if (String(doc.createdBy || '') === userOid) return doc
    throw new ForbiddenException('Bạn không có quyền xem đơn này')
  }

  assertPassengersMatchCounts(payload: CreateBookingPayload) {
    const isGroup = Boolean((payload as any).isGroupTour)
    if (isGroup) return
    const passengers: BookingPassenger[] = payload.passengers as any
    const counts = { NL: 0, TE: 0, EB: 0 }
    for (const p of passengers) counts[p.type] = (counts[p.type] || 0) + 1
    if (
      counts.NL !== (payload.adultCount || 0) ||
      counts.TE !== (payload.childCount || 0) ||
      counts.EB !== (payload.infantCount || 0) ||
      passengers.length !== (payload.adultCount || 0) + (payload.childCount || 0) + (payload.infantCount || 0)
    ) {
      throw new BadRequestException('Số lượng & loại hành khách không khớp với số lượng đã chọn.')
    }
  }

  async createBookingForTour(tourSlug: string, payload: CreateBookingPayload, createdBy: Types.ObjectId | null): Promise<BookingDocument> {
    this.assertPassengersMatchCounts(payload)
    const tour = await this.tourModel.findOne({ slug: tourSlug }).orFail(new NotFoundException('Không tìm thấy tour')).exec()
    if (!tour.isPublished) throw new NotFoundException('Tour này chưa được xuất bản')
    // #region debug-point booking-create-500
    await dbg('svc.find_dep', { depIdFromPayload: payload.departureId, departuresN: tour.departures?.length ?? 0, firstFewIds: (tour.departures ?? []).slice(0, 6).map((d: any, i: number) => ({ i, id: d?._id?.toString?.() ?? String(d?.id ?? d?._id ?? i), date: (d as any).departureDate, status: (d as any).status, seats: (d as any).seatsAvailable })) })
    // #endregion
    const { idx, dep, depIdSafe } = await this.findDepartureWithinTour(tour, payload.departureId)
    const totalGuests = (payload.adultCount || 0) + (payload.childCount || 0) + (payload.infantCount || 0)
    if (totalGuests <= 0) throw new BadRequestException('Cần ít nhất 1 hành khách.')
    const depIdStr = depIdSafe ? depIdSafe.toString() : null
    const depIdx = idx
    const depStatus = String((dep as any).status || 'open')
    if (depStatus === 'closed' || depStatus === 'cancelled' || depStatus === 'soldout') {
      throw new BadRequestException('Đợt khởi hành này đã đóng bán, vui lòng chọn đợt khác.')
    }
    if (typeof dep.seatsAvailable === 'number' && totalGuests > dep.seatsAvailable) {
      throw new BadRequestException(`Số chỗ còn lại chỉ ${dep.seatsAvailable}, không đủ cho ${totalGuests} hành khách.`)
    }

    this.assertPassengerAgeRangesByDeparture(payload.passengers as any, dep, payload.adultCount || 0, payload.childCount || 0, payload.infantCount || 0)

    // --- BUG-001 FIX: Atomic Seats Lock (Optimistic + Pessimistic atomic update) ---
    // Filter: match tour + specific departure by _id/idx + seatsAvailable>=totalGuests + status NOT closed/cancelled/soldout
    const seatFilter: any = { _id: tour._id }
    if (depIdStr && Types.ObjectId.isValid(depIdStr)) {
      seatFilter['departures._id'] = new Types.ObjectId(depIdStr)
      seatFilter['departures'] = {
        $elemMatch: {
          _id: new Types.ObjectId(depIdStr),
          seatsAvailable: { $gte: totalGuests },
          status: { $nin: ['closed', 'cancelled', 'soldout'] },
        },
      }
    } else {
      seatFilter['departures'] = {
        $elemMatch: {
          seatsAvailable: { $gte: totalGuests },
          status: { $nin: ['closed', 'cancelled', 'soldout'] },
        },
      }
      // fallback match idx by numeric index
      const arr: any[] = Array.isArray((tour as any).departures) ? (tour as any).departures : []
      if (depIdx >= 0 && depIdx < arr.length) {
        const exactId = (arr[depIdx] as any)?._id
        if (exactId instanceof Types.ObjectId) {
          seatFilter['departures._id'] = exactId
          seatFilter['departures'] = {
            $elemMatch: { _id: exactId, seatsAvailable: { $gte: totalGuests }, status: { $nin: ['closed', 'cancelled', 'soldout'] } },
          }
        }
      }
    }
    const atomicSeatsUpdate = await this.tourModel.updateOne(seatFilter, {
      $inc: {
        [`departures.${depIdx}.seatsAvailable`]: -totalGuests,
        totalBookings: 1,
      },
    }).exec()
    if (!atomicSeatsUpdate.acknowledged) {
      throw new ConflictException('Hệ thống thanh toán tạm thời bận, vui lòng thử lại.')
    }
    if (atomicSeatsUpdate.matchedCount === 0 || atomicSeatsUpdate.modifiedCount === 0) {
      throw new ConflictException(
        `Đợt khởi hành này chỉ còn ${(tour.departures as any)[depIdx]?.seatsAvailable ?? 0} chỗ. Có ${totalGuests} khách cùng đặt, bạn vui lòng chọn đợt khác hoặc giảm số lượng hành khách.`
      )
    }

    const snapshot: BookingTourSnapshot = {
      title: tour.title,
      slug: tour.slug,
      code: tour.code,
      durationDays: tour.durationDays,
      durationNights: tour.durationNights,
      coverImageUrl: tour.coverImageUrl,
    }
    const totals = this.computeTotals(payload, dep)
    const code = await this.generateBookingCode()
    const departureDate = toDateLocal(dep.departureDate)
    const holdsUntil = new Date(Date.now() + 15 * 60 * 1000)
    const isGroup = Boolean((payload as any).isGroupTour)
    let passengersClean: BookingPassenger[] = []
    if (isGroup) {
      for (let i = 0; i < (payload.adultCount || 0); i += 1) passengersClean.push({ fullName: `[Đoàn] Người lớn ${i + 1}`, type: 'NL', birthDate: null, gender: null, idCard: null, notes: null })
      for (let i = 0; i < (payload.childCount || 0); i += 1) passengersClean.push({ fullName: `[Đoàn] Trẻ em ${i + 1}`, type: 'TE', birthDate: null, gender: null, idCard: null, notes: null })
      for (let i = 0; i < (payload.infantCount || 0); i += 1) passengersClean.push({ fullName: `[Đoàn] Em bé ${i + 1}`, type: 'EB', birthDate: null, gender: null, idCard: null, notes: null })
    } else {
      passengersClean = (payload.passengers as any[]).map((p) => ({
        fullName: String(p?.fullName || '').trim(),
        type: p?.type || 'NL',
        birthDate: p?.birthDate ? new Date(p.birthDate) : null,
        gender: p?.gender ?? null,
        idCard: typeof p?.idCard === 'string' ? p.idCard.trim() || null : null,
        notes: typeof p?.notes === 'string' ? p.notes.trim() || null : null,
      }))
    }
    const surchargesClean: BookingSurchargeLine[] = (payload.surcharges ?? []).map((s: any) => ({
      label: String(s?.label || '').trim(),
      quantity: Math.max(0, Number(s?.quantity) || 0),
      unitPrice: Math.max(0, Number(s?.unitPrice) || 0),
      note: typeof s?.note === 'string' ? s.note.trim() || null : null,
    }))
    let doc: BookingDocument | null = null
    try {
      doc = await this.bookingModel.create({
        code,
        tourId: tour._id,
        tourSnapshot: snapshot,
        departureId: depIdSafe,
        departureDate,
        departureStandardText: dep.standardText ?? null,
        adultCount: payload.adultCount || 0,
        childCount: payload.childCount || 0,
        infantCount: payload.infantCount || 0,
        priceAdultSnapshot: dep.priceAdult || 0,
        priceChildSnapshot: typeof dep.priceChild === 'number' ? dep.priceChild : null,
        priceInfantSnapshot: typeof dep.priceInfant === 'number' ? dep.priceInfant : null,
        contact: {
          name: String(payload.contact?.name || '').trim(),
          phone: String(payload.contact?.phone || '').trim(),
          email: typeof payload.contact?.email === 'string' ? payload.contact.email.trim() || null : null,
          address: typeof payload.contact?.address === 'string' ? payload.contact.address.trim() || null : null,
        },
        passengers: passengersClean,
        notes: typeof payload.notes === 'string' ? payload.notes.trim() || null : null,
        surcharges: surchargesClean,
        subtotalAmount: totals.subtotalAmount,
        surchargeAmount: totals.surchargeAmount,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        currency: 'VND',
        paymentMethod: payload.paymentMethod || 'hold',
        paymentStatus: payload.paymentMethod === 'online' ? 'partial' : 'unpaid',
        createdBy,
        status: 'new',
        holdsUntil,
        isGroupTour: isGroup,
        groupCompanyName: typeof (payload as any).groupCompanyName === 'string' ? (payload as any).groupCompanyName.trim() || null : null,
        groupContactPerson: typeof (payload as any).groupContactPerson === 'string' ? (payload as any).groupContactPerson.trim() || null : null,
        groupContactRole: typeof (payload as any).groupContactRole === 'string' ? (payload as any).groupContactRole.trim() || null : null,
        groupUploadedListFileUrl: typeof (payload as any).groupUploadedListFileUrl === 'string' ? (payload as any).groupUploadedListFileUrl.trim() || null : null,
        groupNote: typeof (payload as any).groupNote === 'string' ? (payload as any).groupNote.trim() || null : null,
        vehicleRequest: typeof (payload as any).vehicleRequest === 'object' && (payload as any).vehicleRequest
          ? {
              enabled: Boolean((payload as any).vehicleRequest.enabled),
              vehicleType: typeof (payload as any).vehicleRequest.vehicleType === 'string' ? (payload as any).vehicleRequest.vehicleType.trim() || null : null,
              vehicleClass: typeof (payload as any).vehicleRequest.vehicleClass === 'string' ? (payload as any).vehicleRequest.vehicleClass.trim() || null : null,
              seatCountMin: typeof (payload as any).vehicleRequest.seatCountMin === 'number' ? (payload as any).vehicleRequest.seatCountMin : null,
              vehicleCount: typeof (payload as any).vehicleRequest.vehicleCount === 'number' ? Math.max(1, (payload as any).vehicleRequest.vehicleCount) : 1,
              withDriver: (payload as any).vehicleRequest.withDriver !== false,
              pickupLocation: typeof (payload as any).vehicleRequest.pickupLocation === 'string' ? (payload as any).vehicleRequest.pickupLocation.trim() || null : null,
              returnLocation: typeof (payload as any).vehicleRequest.returnLocation === 'string' ? (payload as any).vehicleRequest.returnLocation.trim() || null : null,
              notes: typeof (payload as any).vehicleRequest.notes === 'string' ? (payload as any).vehicleRequest.notes.trim() || null : null,
            }
          : null,
      } as any)
    } catch (createErr) {
      try {
        await this.tourModel.updateOne({ _id: tour._id }, {
          $inc: {
            [`departures.${depIdx}.seatsAvailable`]: +totalGuests,
            totalBookings: -1,
          },
        }).exec()
      } catch { /* swallow compensation rollback error */ }
      throw createErr
    }
    // #region debug-point booking-create-500
    await dbg('svc.doc_created', { code, _id: doc._id?.toString?.() ?? null })
    // #endregion
    try { await this.emitBookingCreatedNotifications(doc) } catch {}
    try { await this.transactions.recordSaleFromBooking(doc, { createdById: createdBy ?? null }) } catch (_errTxn) {
      // best effort, booking creation already committed — no throw
    }
    if (createdBy) {
      try { await this.usersService.mergeBookingIntoCustomerProfileIfEmpty(createdBy, doc) } catch {}
    }
    return doc
  }

  async findByCodeOrId(idOrCode: string): Promise<BookingDocument> {
    if (Types.ObjectId.isValid(idOrCode)) {
      const byId = await this.bookingModel.findById(idOrCode).exec()
      if (byId) return byId
    }
    const byCode = await this.bookingModel.findOne({ code: idOrCode }).exec()
    if (!byCode) throw new NotFoundException('Không tìm thấy đơn đặt')
    return byCode
  }

  async listMyBookings(userId: Types.ObjectId, query: ListBookingsQuery) {
    const userOid = userId instanceof Types.ObjectId ? userId : new Types.ObjectId(String(userId))
    const resolvedUser = (async () => { try { return await this.bookingModel.db.collection('users').findOne({ _id: userOid }, { projection: { email: 1, phone: 1 } }) as any } catch { return null } })()
    const emails = new Set<string>()
    const phones = new Set<string>()
    try {
      const u = await resolvedUser
      if (u?.email && typeof u.email === 'string') emails.add(u.email.trim().toLowerCase())
      if (u?.phone && typeof u.phone === 'string') phones.add(u.phone.replace(/\D+/g, ''))
    } catch {}
    const orRoot: any[] = [{ createdBy: userOid }]
    if (emails.size) orRoot.push({ 'contact.email': { $in: Array.from(emails).map((e) => new RegExp('^' + e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')) } })
    if (phones.size) {
      orRoot.push({
        $or: Array.from(phones).map((p) => ({
          $expr: {
            $eq: [
              { $replaceAll: { input: { $replaceAll: { input: { $ifNull: ['$contact.phone', ''] }, find: ' ', replacement: '' } }, find: '-', replacement: '' } },
              p,
            ],
          },
        })),
      })
    }
    const filter: any = { $or: orRoot }
    const baseFilter: any = {}
    if (query.status) baseFilter.status = query.status
    if (query.from) { baseFilter.createdAt = baseFilter.createdAt || {}; baseFilter.createdAt.$gte = new Date(query.from as string) }
    if (query.to) { baseFilter.createdAt = baseFilter.createdAt || {}; baseFilter.createdAt.$lte = new Date(new Date(query.to as string).getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000 + 999) }
    if (query.q) {
      const qr = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      baseFilter.$or = [{ code: qr }, { 'tourSnapshot.title': qr }, { 'contact.name': qr }, { 'contact.phone': qr }]
    }
    const finalFilter = Object.keys(baseFilter).length ? { $and: [filter, baseFilter] } : filter
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(5, Number(query.limit) || 20))
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.bookingModel.find(finalFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bookingModel.countDocuments(finalFilter),
    ])
    try {
      const unattachedIds = await this.bookingModel.find({ ...finalFilter, createdBy: { $in: [null, undefined] } }, { _id: 1 }).sort({ createdAt: -1 }).limit(2000).lean().exec()
      if (unattachedIds.length) {
        const idsArr = unattachedIds.map((r: any) => new Types.ObjectId(String(r._id)))
        await this.bookingModel.updateMany({ _id: { $in: idsArr }, createdBy: { $in: [null, undefined] } }, { $set: { createdBy: userOid } }).exec()
      }
    } catch {}
    try {
      const latestForSync = await this.bookingModel.findOne(
        { $or: [{ createdBy: userOid }, ...(orRoot.length > 1 ? [orRoot.find((r) => r && typeof r === 'object' && !('createdBy' in r)) || {}] : [])] } as any,
        { contact: 1, passengers: 1, createdAt: 1, _id: 0 },
      ).sort({ createdAt: -1 }).limit(1).exec()
      if (latestForSync && (latestForSync.contact || (latestForSync.passengers && latestForSync.passengers.length))) {
        try { await this.usersService.mergeBookingIntoCustomerProfileIfEmpty(userOid, latestForSync as any) } catch {}
      }
    } catch {}
    // #region debug-point listMyBookings-resolve
    ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix-h6', hypothesisId: 'A3', location: 'bookings.service.ts:253', msg: '[DEBUG] listMyBookings result for user', data: { userId: String(userOid), resolvedEmails: Array.from(emails), resolvedPhones: Array.from(phones), total, page, limit, firstId: items[0]?._id ? String(items[0]._id) : null, filter: JSON.stringify(finalFilter) }, ts: Date.now() }) }).catch(() => { }) })();
    // #endregion
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async adminListBookings(query: ListBookingsQuery) {
    const filter: any = {}
    if (query.status) filter.status = query.status
    if (query.from) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$gte = new Date(query.from as string) }
    if (query.to) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$lte = new Date(new Date(query.to as string).getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000 + 999) }
    if (query.q) {
      const qr = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ code: qr }, { 'tourSnapshot.title': qr }, { 'contact.name': qr }, { 'contact.phone': qr }, { 'contact.email': qr }]
    }
    const page = Math.max(1, Number(query.page) || 1)
    const limit = Math.min(100, Math.max(5, Number(query.limit) || 20))
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.bookingModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean().exec(),
      this.bookingModel.countDocuments(filter),
    ])
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async updateStatus(idOrCode: string, payload: UpdateBookingStatusPayload, actor: JwtPayload | null = null): Promise<BookingDocument> {
    const booking = await this.findByCodeOrId(idOrCode)
    if (actor) {
      const role = String(actor.role || '').toLowerCase()
      if (role === 'staff') {
        this.assertStaffOwnershipOrAdmin(actor, booking, 'cập nhật trạng thái đơn này')
      } else if (role !== 'admin') {
        if (String(booking.createdBy || '') !== String(actor.sub)) {
          throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái đơn này')
        }
      }
      const staffOid = String(actor.role || '').toLowerCase() === 'staff' ? new Types.ObjectId(String(actor.sub)) : null
      if (staffOid) booking.set('updatedByStaffId', staffOid)
    }
    const prevStatus = booking.status
    const nextStatus = payload.status as BookingStatus
    if (nextStatus === 'cancelled' && prevStatus !== 'cancelled') {
      booking.cancelledAt = new Date()
      if (payload.sendBackSeatsOnCancel !== false) {
        const tour = await this.tourModel.findById(booking.tourId).exec()
        if (tour) {
          const depId = booking.departureId.toString()
          const totalSeats = (booking.adultCount || 0) + (booking.childCount || 0) + (booking.infantCount || 0)
          const departures: any[] = Array.isArray((tour as any).departures) ? (tour as any).departures : []
          let ok = false
          for (let i = 0; i < departures.length; i += 1) {
            const d: any = departures[i]
            const cmp = d?._id?.toString ? d._id.toString() : String(d?.id || i)
            if (cmp === depId || String(d?._id) === depId) {
              departures[i] = {
                ...d,
                seatsAvailable: Math.min(Math.max(0, d.seatsTotal || 0), Math.max(0, (d.seatsAvailable || 0) + totalSeats)),
                seatsTotal: d.seatsTotal,
              }
              ok = true
              break
            }
          }
          if (ok) {
            tour.set('departures', departures)
            if (!booking.confirmedAt && Number(tour.totalBookings || 0) > 0) {
              tour.totalBookings = Number(tour.totalBookings || 0) - 1
            }
            await tour.save()
          }
        }
      }
    }
    if (nextStatus === 'confirmed' && prevStatus !== 'confirmed') {
      booking.confirmedAt = new Date()
    }
    booking.status = nextStatus
    if (typeof payload.adminNote === 'string' && payload.adminNote) booking.adminNote = payload.adminNote
    const saved = await booking.save()
    try {
      if (nextStatus === 'cancelled') {
        const actorId = actor && actor.sub ? new Types.ObjectId(String(actor.sub)) : null
        await this.transactions.recordRefundFromCancelledBooking(saved, { createdById: actorId, narration: payload.adminNote || undefined }).catch(() => undefined)
      }
    } catch { /* best effort */ }
    try { await this.emitBookingStatusChanged(prevStatus, saved) } catch {}
    return saved
  }

  async assignStaff(idOrCode: string, payload: AssignStaffBookingPayload, actor: JwtPayload | null = null): Promise<BookingDocument> {
    const booking = await this.findByCodeOrId(idOrCode)
    if (actor && String(actor.role || '').toLowerCase() !== 'admin') {
      throw new ForbiddenException('Chỉ admin mới được quyền giao / thu hồi nhân viên phụ trách đơn đặt.')
    }
    const rawIds = Array.isArray(payload?.staffIds) ? payload.staffIds : []
    const dedup = Array.from(new Set(rawIds.map((s) => String(s || '').trim()).filter(Boolean)))
    const normalized: Types.ObjectId[] = []
    for (const s of dedup) {
      if (!Types.ObjectId.isValid(s)) throw new BadRequestException(`staffId không hợp lệ: ${s}`)
      normalized.push(new Types.ObjectId(s))
    }
    if (normalized.length > 0) {
      const exist = await this.bookingModel.db
        .collection('users')
        .find({ _id: { $in: normalized }, role: 'staff', isActive: { $ne: false } })
        .project({ _id: 1 })
        .toArray()
      const validSet = new Set(exist.map((u) => String(u._id)))
      for (const sid of normalized) {
        if (!validSet.has(String(sid))) {
          throw new BadRequestException(
            `staffId=${sid} không tồn tại hoặc không phải nhân viên đang hoạt động (role=staff, isActive=true).`,
          )
        }
      }
    }
    const before = Array.isArray(booking.assignedStaffIds) ? booking.assignedStaffIds.map((x) => String(x)) : []
    const afterSet = new Set(normalized.map((x) => String(x)))
    let changed = before.length !== afterSet.size
    if (!changed) for (const bid of before) { if (!afterSet.has(bid)) { changed = true; break } }
    booking.set('assignedStaffIds', normalized)
    if (typeof payload.adminNote === 'string' && payload.adminNote) {
      booking.set('adminNote', payload.adminNote)
    }
    const saved = await booking.save()
    if (changed) {
      try {
        const stamp = new Date().toLocaleString('vi-VN')
        const push: any[] = []
        const recipientIds = normalized
        const tourName = saved.tourSnapshot?.title || 'Tour'
        const total = Number(saved.totalAmount || 0).toLocaleString('vi-VN') + 'đ'
        const customer = saved.contact?.name || 'Khách'
        for (const rid of recipientIds) {
          const wasThere = before.includes(String(rid))
          if (wasThere) continue
          push.push({
            recipientId: rid,
            recipientRole: 'staff' as any,
            type: 'staff_new_booking' as any,
            title: `ĐƯỢC GIAO VIỆC - ${saved.code}`,
            body: `Admin giao đơn ${saved.code} cho bạn phụ trách: ${tourName} ngày ${saved.departureDate ? new Date(saved.departureDate as any).toLocaleDateString('vi-VN') : '—'} — ${customer} — ${total}. Vui lòng gọi xác nhận và xử lý ngay!`,
            entityType: 'booking' as any,
            entityId: saved._id as any,
            actionUrl: `/staff/bookings?id=${saved._id}`,
            priority: 'high' as any,
            channels: ['in_app'] as any[],
          })
        }
        if (push.length) await this.notifications.bulk(push).catch(() => undefined)
      } catch {}
    }
    return saved
  }

  private async emitBookingCreatedNotifications(doc: BookingDocument) {
    const list: CreateNotificationInput[] = []
    const title = `Đặt chỗ thành công - ${doc.code}`
    const dateStr = doc.departureDate ? new Date(doc.departureDate as any).toLocaleDateString('vi-VN') : '—'
    const totalStr = Number(doc.totalAmount || 0).toLocaleString('vi-VN') + 'đ'
    if (doc.createdBy) {
      list.push({
        recipientId: new Types.ObjectId(String(doc.createdBy)),
        recipientRole: 'customer',
        type: 'gtr_booking_created' as NotificationType,
        title,
        body: `Chúc mừng! ${doc.tourSnapshot?.title || 'Tour'} ngày ${dateStr} - Tổng ${totalStr}. Vui lòng thanh toán cọc ${doc.holdsUntil ? ('trước ' + new Date(doc.holdsUntil as any).toLocaleString('vi-VN')) : ''} để giữ chỗ.`,
        entityType: 'booking',
        entityId: doc._id as any,
        actionUrl: `/account/bookings?id=${doc._id}`,
        priority: 'high',
        channels: ['in_app', 'email'],
      })
    }
    const admins = await this.bookingModel.db.collection('users').find({ role: 'admin', isActive: { $ne: false } }).project({ _id: 1 }).toArray()
    const notifyPriority: CreateNotificationInput['priority'] = Number(doc.totalAmount || 0) > 50_000_000 ? 'high' : 'medium'
    for (const a of admins) {
      list.push({
        recipientId: new Types.ObjectId(String(a._id)),
        recipientRole: 'admin',
        type: 'admin_new_booking' as NotificationType,
        title: `🚨 CẦN XỬ LÝ NGAY - Đơn đặt mới: ${doc.code} - ${doc.tourSnapshot?.title || 'Tour'}`,
        body: `${dateStr} - ${(doc.adultCount || 0) + (doc.childCount || 0) + (doc.infantCount || 0)} khách - ${totalStr}. Khách: ${doc.contact?.name || ''} ${doc.contact?.phone || ''}${doc.notes ? (' · Ghi chú: ' + doc.notes.slice(0, 80)) : ''}`,
        entityType: 'booking',
        entityId: doc._id as any,
        actionUrl: `/admin/bookings?id=${doc._id}`,
        priority: notifyPriority,
      })
    }
    try {
      const staffIds = new Set<string>()
      if ((doc as any).updatedByStaffId) staffIds.add(String((doc as any).updatedByStaffId))
      if (Array.isArray((doc as any).assignedStaffIds)) for (const s of (doc as any).assignedStaffIds) staffIds.add(String(s))
      const idsArr = Array.from(staffIds).map((x) => new Types.ObjectId(x)).filter((x) => Types.ObjectId.isValid(x))
      if (!idsArr.length) {
        try {
          const allStaff = await this.bookingModel.db.collection('users').find({ role: 'staff', isActive: { $ne: false } }, { projection: { _id: 1, limit: 30 } }).toArray() as any[]
          for (const s of allStaff.slice(0, 20)) idsArr.push(new Types.ObjectId(String(s._id)))
        } catch {}
      }
      const staffList = idsArr.length ? await this.bookingModel.db.collection('users').find({ _id: { $in: idsArr }, role: 'staff', isActive: { $ne: false } }, { projection: { _id: 1 } }).toArray() as any[] : []
      for (const s of staffList) {
        list.push({
          recipientId: new Types.ObjectId(String(s._id)),
          recipientRole: 'staff',
          type: 'staff_new_booking' as NotificationType,
          title: `📥 CÓ ĐƠN MỚI CẦN XỬ LÝ - ${doc.code}`,
          body: `${doc.tourSnapshot?.title || 'Tour'} - ${dateStr} - ${totalStr}. Admin click để giao việc hoặc bạn nhấn nút TIẾP NHẬN để xử lý!`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/staff/bookings?id=${doc._id}`,
          priority: notifyPriority,
        })
      }
    } catch {}
    if (list.length) await this.notifications.bulk(list)
  }

  private async resolveCustomerRecipient(doc: BookingDocument): Promise<{ id: Types.ObjectId | null; note: string }> {
    if (!doc) return { id: null, note: 'no-doc' }
    try {
      if (doc.createdBy) {
        const db = this.bookingModel.db.collection('users')
        const creator = await db.findOne({ _id: new Types.ObjectId(String(doc.createdBy)) }, { projection: { _id: 1, role: 1, email: 1 } }).catch(() => null) as any
        if (creator && String(creator.role || '').toLowerCase() === 'customer') {
          return { id: new Types.ObjectId(String(creator._id)), note: 'createdBy-is-customer' }
        }
      }
      const email = typeof doc.contact?.email ? String(doc.contact.email).trim().toLowerCase() : null
      if (email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        const db = this.bookingModel.db.collection('users')
        const found = await db.findOne({ email, isActive: { $ne: false } }, { projection: { _id: 1, role: 1 } }).catch(() => null) as any
        if (found) return { id: new Types.ObjectId(String(found._id)), note: 'matched-contact-email' }
      }
      return { id: null, note: 'no-customer-user-found' }
    } catch (err: any) {
      return { id: null, note: `error:${String(err?.message || err)}` }
    }
  }

  private async emitBookingStatusChanged(prevStatus: string, doc: BookingDocument) {
    // #region debug-point H4:booking-emit-status-guard-entry
    ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix-h6', hypothesisId: 'H6', location: 'bookings.service.ts:373', msg: '[DEBUG] POST-FIX-H6 emitBookingStatusChanged entry guard + recipient resolver', data: { code: String(doc.code || doc._id), prevStatus, nextStatus: doc.status, paymentStatus: doc.paymentStatus, hasCreatedBy: Boolean(doc.createdBy), createdById: doc.createdBy ? String(doc.createdBy) : null, contactEmail: doc.contact?.email || null, guardCondNotCreatedByAndSameStatus: !doc.createdBy && prevStatus === doc.status, changedPaymentExprNow: prevStatus !== doc.status || (doc.paymentStatus as any) !== (doc as any).prevPaymentStatus }, ts: Date.now() }) }).catch(() => { }) })();
    // #endregion
    if (!doc.createdBy && prevStatus === doc.status) return
    const customer = await this.resolveCustomerRecipient(doc)
    const customerRecipientId = customer.id
    // #region debug-point H6:customer-resolve
    ;(() => { let u = 'http://127.0.0.1:7788/event', s = 'notifications-push-slow-missing'; try { const e = require('fs').readFileSync('.dbg/notifications-push-slow-missing.env', 'utf8'); u = e.match(/DEBUG_SERVER_URL=(.+)/)?.[1] || u; s = e.match(/DEBUG_SESSION_ID=(.+)/)?.[1] || s } catch {} fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: s, runId: 'post-fix-h6', hypothesisId: 'H6', location: 'bookings.service.ts:376', msg: '[DEBUG] POST-FIX-H6 customer recipient resolve result', data: { code: String(doc.code || doc._id), resolveNote: customer.note, resolvedId: customerRecipientId ? String(customerRecipientId) : null, recipientMissing: !customerRecipientId }, ts: Date.now() }) }).catch(() => { }) })();
    // #endregion

    const code = String(doc.code || doc._id)
    const tourName = doc.tourSnapshot?.title || 'Tour'
    const nextStatus = doc.status
    const changedPayment = prevStatus !== nextStatus || (doc.paymentStatus as any) !== (doc as any).prevPaymentStatus

    const pushStaffList = async (list: CreateNotificationInput[], title: string, body: string) => {
      const uniq = new Map<string, Types.ObjectId>()
      const addId = (rawId: any) => {
        if (!rawId) return
        try {
          const id = new Types.ObjectId(String(rawId))
          uniq.set(String(id), id)
        } catch {}
      }
      addId((doc as any).updatedByStaffId)
      if (Array.isArray((doc as any).assignedStaffIds)) for (const raw of (doc as any).assignedStaffIds) addId(raw)
      if (!uniq.size) return
      const ids = Array.from(uniq.values())
      try {
        const db = this.bookingModel.db.collection('users')
        const staffs = await db.find({ _id: { $in: ids }, role: 'staff', isActive: { $ne: false } }, { projection: { _id: 1, role: 1 } }).toArray() as any[]
        for (const stf of staffs) {
          list.push({
            recipientId: new Types.ObjectId(String(stf._id)),
            recipientRole: 'staff',
            type: 'staff_booking_updated' as NotificationType,
            title,
            body,
            entityType: 'booking',
            entityId: doc._id as any,
            actionUrl: `/staff/bookings?id=${doc._id}`,
            priority: 'medium',
          })
        }
      } catch {}
    }

    const list: CreateNotificationInput[] = []
    const admins = await this.bookingModel.db.collection('users').find({ role: 'admin', isActive: { $ne: false } }).project({ _id: 1 }).toArray()

    if ((doc.paymentStatus === 'partial' || doc.paymentStatus === 'paid') && prevStatus !== nextStatus) {
      if (customerRecipientId) {
        list.push({
          recipientId: customerRecipientId,
          recipientRole: 'customer',
          type: 'booking_deposit_paid' as NotificationType,
          title: `Đã nhận đặt cọc - ${code}`,
          body: `Đơn ${tourName} - Cảm ơn bạn đã thanh toán cọc. Biên lai sẽ được gửi email trong vài phút.`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/account/bookings?id=${doc._id}`,
          priority: 'high',
          channels: ['in_app', 'email'],
        })
      }
      for (const a of admins) {
        list.push({
          recipientId: new Types.ObjectId(String(a._id)),
          recipientRole: 'admin',
          type: 'admin_booking_updated' as NotificationType,
          title: `Nhận cọc: ${code} - ${tourName}`,
          body: `${Number(doc.totalAmount || 0).toLocaleString('vi-VN')}đ - Thanh toán ${doc.paymentStatus}. Khách: ${doc.contact?.name || ''} ${doc.contact?.phone || ''}`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/admin/bookings?id=${doc._id}`,
          priority: 'medium',
        })
      }
      await pushStaffList(list, `Nhận cọc booking ${code}`, `${tourName} - ${Number(doc.totalAmount || 0).toLocaleString('vi-VN')}đ. Khách ${doc.contact?.name || ''}`)
    }

    if (nextStatus === 'confirmed' && prevStatus !== nextStatus) {
      if (customerRecipientId) {
        list.push({
          recipientId: customerRecipientId,
          recipientRole: 'customer',
          type: 'booking_confirmed' as NotificationType,
          title: `Booking đã xác nhận - ${code}`,
          body: `${tourName} đã xác nhận tất cả dịch vụ (vé máy bay, khách sạn, xe, bảo hiểm). ${doc.departureStandardText ? ('Thông tin gặp mặt: ' + doc.departureStandardText) : ''}`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/account/bookings?id=${doc._id}`,
          priority: 'high',
          channels: ['in_app', 'email'],
        })
      }
      for (const a of admins) {
        list.push({
          recipientId: new Types.ObjectId(String(a._id)),
          recipientRole: 'admin',
          type: 'admin_booking_updated' as NotificationType,
          title: `Đã xác nhận booking: ${code} - ${tourName}`,
          body: `Ngày đi ${doc.departureDate ? new Date(doc.departureDate as any).toLocaleDateString('vi-VN') : ''}. ${(doc.adultCount || 0) + (doc.childCount || 0) + (doc.infantCount || 0)} khách - ${Number(doc.totalAmount || 0).toLocaleString('vi-VN')}đ`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/admin/bookings?id=${doc._id}`,
          priority: 'medium',
        })
      }
      await pushStaffList(list, `Xác nhận booking ${code}`, `${tourName} - ${Number(doc.totalAmount || 0).toLocaleString('vi-VN')}đ. Vui lòng liên hệ xác nhận khách.`)
    }

    if (nextStatus === 'cancelled' && prevStatus !== nextStatus) {
      if (customerRecipientId) {
        list.push({
          recipientId: customerRecipientId,
          recipientRole: 'customer',
          type: 'booking_cancelled' as NotificationType,
          title: `Booking đã hủy - ${code}`,
          body: `${tourName} mã ${code} đã hủy. ${doc.cancelledAt ? ('Thời gian: ' + new Date(doc.cancelledAt as any).toLocaleString('vi-VN')) : ''}. Hoàn tiền sẽ về tài khoản trong 3-5 ngày làm việc.`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/account/bookings?id=${doc._id}`,
          priority: 'medium',
          channels: ['in_app', 'email'],
        })
      }
      for (const a of admins) {
        list.push({
          recipientId: new Types.ObjectId(String(a._id)),
          recipientRole: 'admin',
          type: 'admin_booking_updated' as NotificationType,
          title: `Hủy booking: ${code} - ${tourName}`,
          body: `Lý do: ${(doc as any).cancelReason || 'Không ghi rõ'}. Số tiền hoàn: ${Number(doc.totalAmount || 0).toLocaleString('vi-VN')}đ`,
          entityType: 'booking',
          entityId: doc._id as any,
          actionUrl: `/admin/bookings?id=${doc._id}`,
          priority: 'medium',
        })
      }
      await pushStaffList(list, `Khách hủy booking ${code}`, `${tourName} - Vui lòng kiểm tra và xác nhận hoàn tiền cho khách.`)
    }

    if (list.length) await this.notifications.bulk(list)
  }

  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'booking_auto_release_hold_fallback',
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async releaseExpiredHoldsCronFallback() {
    try { await this.releaseExpiredHolds() } catch { /* noop */ }
  }

  async assignVehiclesToBooking(idOrCode: string, vehicleIdsRaw: string[], actor: JwtPayload | null = null): Promise<BookingDocument> {
    if (!actor || !(actor.role === 'admin' || actor.role === 'staff')) {
      throw new ForbiddenException('Chỉ admin / nhân viên vận hành mới được gắn xe vào đơn đặt.')
    }
    const booking = await this.findByCodeOrId(idOrCode)
    if (!booking) throw new NotFoundException('Booking không tồn tại')
    const rawIds = Array.isArray(vehicleIdsRaw) ? vehicleIdsRaw : []
    const dedup = Array.from(new Set(rawIds.map((s) => String(s || '').trim()).filter(Boolean)))
    if (dedup.length > 20) throw new BadRequestException('Gắn tối đa 20 xe vào mỗi đơn. Trường hợp đoàn siêu lớn gắn nhiều đợt.')
    const oids: Types.ObjectId[] = []
    for (const s of dedup) {
      if (!Types.ObjectId.isValid(s)) throw new BadRequestException(`vehicleId không hợp lệ: ${s}`)
      oids.push(new Types.ObjectId(s))
    }
    if (oids.length > 0) {
      try {
        const vs = (await this.vehiclesService.listSimple()) as unknown as Array<{ _id: Types.ObjectId; status: string }>
        const validMap = new Map<string, { status: string }>()
        for (const v of vs) validMap.set(String(v._id), { status: v.status || 'available' })
        for (const oid of oids) {
          if (!validMap.has(String(oid))) throw new BadRequestException(`Xe (id=${oid}) không tồn tại trong quản lý xe.`)
          const info = validMap.get(String(oid))!
          if (info.status === 'out_of_service') throw new BadRequestException(`Xe (id=${oid}) đang trạng thái "Ngừng hoạt động" không được gắn vào booking. Vui lòng đổi xe khác hoặc đổi trạng thái.`)
        }
      } catch (e) {
        if (e instanceof NotFoundException || e instanceof BadRequestException || e instanceof ForbiddenException) throw e
        throw new BadRequestException('Kiểm tra xe tồn tại thất bại: ' + (e as any)?.message)
      }
    }
    booking.set('vehicleIds', oids)
    booking.set('vehiclesAssignedAt', new Date())
    if (actor?.sub) {
      try { booking.set('vehiclesAssignedByUserId', new Types.ObjectId(String(actor.sub))) } catch { /* ignore */ }
    }
    const saved = await booking.save()
    try { await this.vehiclesService.pushBookingHistoryMany(oids, saved._id as Types.ObjectId).catch(() => undefined) } catch { /* ignore best-effort */ }
    return saved
  }

  async releaseExpiredHolds(): Promise<{ processed: number; released: number; returnedSeats: number; errors: number }> {
    const out = { processed: 0, released: 0, returnedSeats: 0, errors: 0 }
    const now = new Date()
    const holdStatuses: BookingStatus[] = ['new', 'pending']
    const cursor = this.bookingModel.find({
      status: { $in: holdStatuses as any },
      holdsUntil: { $exists: true, $ne: null, $lte: now },
      paymentStatus: { $in: ['unpaid'] as any },
      isGroupTour: { $ne: true },
    }).cursor({ batchSize: 50 })
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      try {
        out.processed += 1
        const b = doc as BookingDocument
        const totalGuests = (b.adultCount || 0) + (b.childCount || 0) + (b.infantCount || 0)
        const tourId = b.tourId
        const depId = b.departureId?.toString?.() || String((b as any).departureId)
        if (tourId && depId && totalGuests > 0) {
          try {
            const depIdxFilter: any = {}
            try {
              depIdxFilter['departures._id'] = new Types.ObjectId(depId)
              depIdxFilter['departures'] = {
                $elemMatch: { _id: new Types.ObjectId(depId) },
              }
            } catch {
              /* invalid depId skip dep update */
            }
            if (Object.keys(depIdxFilter).length > 0) {
              const res = await this.tourModel.updateOne(
                { _id: tourId, ...depIdxFilter },
                {
                  $inc: {
                    'departures.$.seatsAvailable': +totalGuests,
                    totalBookings: -1,
                  },
                },
              ).exec()
              if (res.acknowledged && res.matchedCount > 0) out.returnedSeats += totalGuests
            }
          } catch {
            /* swallow seat return error (process next booking) */
          }
        }
        const prevStatus = String(b.status || 'new') as BookingStatus
        b.status = 'expired'
        b.adminNote = [
          b.adminNote ? String(b.adminNote) + ' · ' : '',
          `[Auto][${now.toLocaleString('vi-VN')}] Hết thời gian giữ chỗ (holdsUntil=${new Date((b as any).holdsUntil || now).toLocaleString('vi-VN')}). Tự động trả lại chỗ.`,
        ].join('')
        const saved = await b.save()
        try { await this.transactions.recordReleaseHold(saved).catch(() => undefined) } catch { /* noop */ }
        try { await this.emitBookingStatusChanged(prevStatus, saved) } catch { /* noop */ }
        out.released += 1
      } catch {
        out.errors += 1
      }
    }
    try { await cursor.close?.() } catch { /* noop */ }
    return out
  }
}
