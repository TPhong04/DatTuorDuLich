import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import { Booking, BookingDocument, BookingStatus, BookingTourSnapshot, BookingPassenger, BookingSurchargeLine } from './booking.schema'
import { CreateBookingPayload, ListBookingsQuery, UpdateBookingStatusPayload } from './dto'
import { Tour, TourDocument, TourDeparture } from '../tours/tour.schema'
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
  ) {}

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

  assertPassengersMatchCounts(payload: CreateBookingPayload) {
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
    if (dep.status === 'closed' || dep.status === 'cancelled' || dep.status === 'soldout') {
      throw new BadRequestException('Đợt khởi hành này đã đóng bán, vui lòng chọn đợt khác.')
    }
    const totalGuests = (payload.adultCount || 0) + (payload.childCount || 0) + (payload.infantCount || 0)
    if (typeof dep.seatsAvailable === 'number' && totalGuests > dep.seatsAvailable) {
      throw new BadRequestException(`Số chỗ còn lại chỉ ${dep.seatsAvailable}, không đủ cho ${totalGuests} hành khách.`)
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
    const passengersClean: BookingPassenger[] = (payload.passengers as any[]).map((p) => ({
      fullName: String(p?.fullName || '').trim(),
      type: p?.type || 'NL',
      birthDate: p?.birthDate ? new Date(p.birthDate) : null,
      gender: p?.gender ?? null,
      idCard: typeof p?.idCard === 'string' ? p.idCard.trim() || null : null,
      notes: typeof p?.notes === 'string' ? p.notes.trim() || null : null,
    }))
    const surchargesClean: BookingSurchargeLine[] = (payload.surcharges ?? []).map((s: any) => ({
      label: String(s?.label || '').trim(),
      quantity: Math.max(0, Number(s?.quantity) || 0),
      unitPrice: Math.max(0, Number(s?.unitPrice) || 0),
      note: typeof s?.note === 'string' ? s.note.trim() || null : null,
    }))
    const doc = await this.bookingModel.create({
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
    } as any)
    // #region debug-point booking-create-500
    await dbg('svc.doc_created', { code, _id: doc._id?.toString?.() ?? null })
    // #endregion
    ;(tour.departures as any)[idx] = {
      ...dep,
      seatsAvailable: Math.max(0, (dep.seatsAvailable || 0) - totalGuests),
      seatsTotal: dep.seatsTotal,
    } as any
    tour.totalBookings = Number(tour.totalBookings || 0) + 1
    await tour.save()
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
    const filter: any = { createdBy: userId }
    if (query.status) filter.status = query.status
    if (query.from) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$gte = new Date(query.from as string) }
    if (query.to) { filter.createdAt = filter.createdAt || {}; filter.createdAt.$lte = new Date(new Date(query.to as string).getTime() + 23 * 3600 * 1000 + 59 * 60 * 1000 + 999) }
    if (query.q) {
      const qr = new RegExp(String(query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [{ code: qr }, { 'tourSnapshot.title': qr }, { 'contact.name': qr }, { 'contact.phone': qr }]
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

  async updateStatus(idOrCode: string, payload: UpdateBookingStatusPayload): Promise<BookingDocument> {
    const booking = await this.findByCodeOrId(idOrCode)
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
    return booking.save()
  }
}
