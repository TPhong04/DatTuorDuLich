import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model, Types } from 'mongoose'
import * as fs from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'

/* =================================================================================
 * 📄 HELPERS: ĐỌC SỐ RA CHỮ TIẾNG VIỆT + SLUGIFY TÊN FILE AN TOÀN
 * ===============================================================================*/
const VN_NUMS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']
function readGroup3(n: number): string {
  if (n === 0) return ''
  const h = Math.floor(n / 100); const t = Math.floor((n % 100) / 10); const u = n % 10
  const parts: string[] = []
  if (h > 0) parts.push(VN_NUMS[h] + ' trăm')
  else parts.push('')
  if (t > 0) {
    if (t === 1) parts.push('mười')
    else parts.push(VN_NUMS[t] + ' mươi')
  } else if (h > 0 && u > 0) {
    parts.push('lẻ')
  } else parts.push('')
  if (u > 0) {
    if (t >= 2 && u === 5) parts.push('lăm')
    else if (t >= 1 && u === 1) parts.push('mốt')
    else parts.push(VN_NUMS[u])
  } else parts.push('')
  return parts.filter(p => p && p.length > 0).join(' ')
}
const UNITS_BIG = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ']
export function numToWordsVN(amount: number): string {
  if (!Number.isFinite(amount)) return 'Không đồng'
  const n = Math.abs(Math.round(amount))
  if (n === 0) return 'Không đồng'
  const groups: number[] = []
  let x = n
  while (x > 0) { groups.unshift(x % 1000); x = Math.floor(x / 1000) }
  const wordsArr: string[] = []
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i]; const unitIdx = groups.length - 1 - i; const unit = UNITS_BIG[unitIdx] ?? ''
    if (g === 0) {
      if (wordsArr.length > 0 && unitIdx === 2 && wordsArr.length < groups.length - i + 1) {
        wordsArr.push('tỷ')
      }
      continue
    }
    const needHundredPrefix = (i > 0 && g < 100)
    let gWords = readGroup3(g)
    if (needHundredPrefix && !gWords.startsWith('không trăm') && g < 100) gWords = 'không trăm ' + gWords
    const cap = gWords.charAt(0).toUpperCase() + gWords.slice(1)
    wordsArr.push(cap + (unit ? ' ' + unit : ''))
  }
  return wordsArr.join(' ').trim() + ' đồng'
}
export function slugifyFileNameSafe(str: string): string {
  return String(str || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/g, '_')
    .replace(/\s+/g, '_').replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'QuyKhach'
}

import { NotificationType } from '../notifications/notification.schema'
import { CreateNotificationInput, NotificationsService } from '../notifications/notifications.service'
import {
  ConfirmInquiryDto,
  CreateContractDto,
  CreateHandoverDto,
  CreateInquiryDto,
  CreateQuotationDto,
  CreateSettlementDto,
  ListContractsDto,
  ListHandoversDto,
  ListInquiriesDto,
  ListQuotationsDto,
  ListSettlementsDto,
  SuggestAvailableVehiclesDto,
  UpdateContractDto,
  UpdateHandoverDto,
  UpdateInquiryDto,
  UpdateQuotationDto,
  UpdateSettlementDto,
} from './dto'
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_TONES,
  HANDOVER_STATUS_LABELS,
  HANDOVER_STATUS_TONES,
  HANDOVER_TYPE_LABELS,
  INQUIRY_SOURCE_LABELS,
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_TONES,
  QUOTATION_STATUS_LABELS,
  QUOTATION_STATUS_TONES,
  SETTLEMENT_STATUS_LABELS,
  SETTLEMENT_STATUS_TONES,
  VehicleHandover,
  VehicleHandoverDocument,
  VehicleInquiry,
  VehicleInquiryDocument,
  VehicleQuotation,
  VehicleQuotationDocument,
  VehicleRentalContract,
  VehicleRentalContractDocument,
  VehicleSettlement,
  VehicleSettlementDocument,
} from './rentals.schema'
import {
  Vehicle,
  VehicleClass,
  VehicleDocument,
  VehicleStatus,
  VehicleType,
  VEHICLE_CLASS_DESCRIPTIONS,
  VEHICLE_CLASS_LABELS,
  VEHICLE_CLASS_TONES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPE_SEATS,
  VEHICLE_TYPE_SUITABILITY,
  VEHICLE_TYPES,
  VEHICLE_CLASSES,
} from '../vehicles/vehicle.schema'

function norm<T extends string | null | undefined>(v: T): T | null {
  if (typeof v === 'string') {
    const s = v.trim()
    return (s ? s : null) as any
  }
  return v ?? null
}
function id(v: string | Types.ObjectId | undefined | null): Types.ObjectId | null {
  if (!v) return null
  try {
    return typeof v === 'string' ? new Types.ObjectId(v) : v
  } catch {
    return null
  }
}
function pad(n: number, w = 4) {
  const s = String(n)
  return s.length >= w ? s : '0'.repeat(w - s.length) + s
}
function yymm(d: Date = new Date()) {
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}${String(m).padStart(2, '0')}`
}
function escapeHtml(raw: string | null | undefined): string {
  if (raw == null) return ''
  const str = String(raw)
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
function formatVnd(amount: number): string {
  const n = Number.isFinite(amount) ? Math.round(amount) : 0
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('vi-VN') + ' ₫'
  return n < 0 ? '-' + formatted : formatted
}

const HITEMS_STANDARD = [
  { key: 'papers', label: 'Giấy tờ xe (Đăng kiểm, BHDS, Biển số)' },
  { key: 'exterior_front', label: 'Ngoại thất - Trước xe' },
  { key: 'exterior_back', label: 'Ngoại thất - Sau xe' },
  { key: 'exterior_left', label: 'Ngoại thất - Hông trái' },
  { key: 'exterior_right', label: 'Ngoại thất - Hông phải' },
  { key: 'glass', label: 'Kính xe (trước/sau/hông/mái)' },
  { key: 'interior', label: 'Nội thất (ghế, điều hòa, loa, TV)' },
  { key: 'wheels', label: 'Lốp + Mâm (gai lốp, áp suất)' },
  { key: 'tools', label: 'Đồ dùng phụ (láp, xăng dự phòng, thảm, khăn)' },
  { key: 'engine', label: 'Động cơ + Phanh (thử chạy)' },
]

@Injectable()
export class RentalsService {
  constructor(
    @InjectModel(VehicleInquiry.name) private readonly inquiries: Model<VehicleInquiryDocument>,
    @InjectModel(VehicleQuotation.name) private readonly quotations: Model<VehicleQuotationDocument>,
    @InjectModel(VehicleRentalContract.name) private readonly contracts: Model<VehicleRentalContractDocument>,
    @InjectModel(VehicleHandover.name) private readonly handovers: Model<VehicleHandoverDocument>,
    @InjectModel(VehicleSettlement.name) private readonly settlements: Model<VehicleSettlementDocument>,
    @InjectModel(Vehicle.name) private readonly vehicles: Model<VehicleDocument>,
    private readonly notifications: NotificationsService,
  ) {}

  /* ================= INQUIRY ================= */
  private async nextInquiryCode() {
    const prefix = 'INQ'
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const count = await this.inquiries.countDocuments({ createdAt: { $gte: monthStart } }).exec()
    return `${prefix}-${yymm(today)}-${pad(count + 1, 3)}`
  }

  async listInquiries(q: ListInquiriesDto, actor?: { id: string; role: string }) {
    const page = Math.max(1, Number(q.page) || 1)
    const limit = Math.max(1, Number(q.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.status) filter.status = q.status
    if (q.source) filter.source = q.source
    if (q.vehicleType) filter.preferredVehicleType = q.vehicleType
    if (q.vehicleClass) filter.preferredVehicleClass = q.vehicleClass
    if (q.bookingId) filter.bookingId = id(q.bookingId)
    if ((q as any).customerUserId) filter.customerUserId = id((q as any).customerUserId)
    if (q.fromDate || q.toDate) {
      const range: Record<string, Date> = {}
      if (q.fromDate) range.$gte = q.fromDate
      if (q.toDate) range.$lte = q.toDate
      filter.pickupDateTime = range
    }
    if (q.q) {
      const like = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [
        { code: like },
        { customerName: like },
        { customerPhone: like },
        { customerEmail: like },
        { pickupLocation: like },
        { returnLocation: like },
      ]
    }
    if (actor?.role === 'staff' && !actor.id) {
      /* staff only; default: all */
    }
    const [total, items] = await Promise.all([
      this.inquiries.countDocuments(filter).exec(),
      this.inquiries
        .find(filter)
        .sort({ createdAt: -1, pickupDateTime: 1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'quotationId', select: 'code status totalGrandVnd validUntil' })
        .populate({ path: 'contractId', select: 'code status totalGrandVnd' })
        .populate({ path: 'bookingId', select: 'code status' })
        .populate({ path: 'customerUserId', select: 'fullName email phone' })
        .populate({ path: 'ownerStaffId', select: 'fullName email' })
        .exec(),
    ])
    return {
      page,
      limit,
      total,
      items: items.map((i) => this.serializeInquiry(i)),
    }
  }

  async getInquiryById(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã yêu cầu không hợp lệ')
    const doc = await this.inquiries
      .findById(oid)
      .populate({ path: 'quotationId', select: 'code status totalGrandVnd validUntil depositRequiredVnd' })
      .populate({ path: 'contractId', select: 'code status totalGrandVnd pickupDateTime returnDateTime' })
      .populate({ path: 'bookingId', select: 'code status tourId departureDate' })
      .populate({ path: 'customerUserId', select: 'fullName email phone citizenId address' })
      .populate({ path: 'ownerStaffId', select: 'fullName email phone' })
      .exec()
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu thuê xe')
    return this.serializeInquiry(doc)
  }

  async createInquiry(dto: CreateInquiryDto, actor?: { id: string; role: string }) {
    const code = norm(dto.code) ?? (await this.nextInquiryCode())
    const bookingId = id(dto.bookingId)
    const customerUserId = id(dto.customerUserId)
    const ownerStaffId = id(dto.ownerStaffId) ?? (actor?.role !== 'customer' ? id(actor?.id) : null)
    const expiredAt = dto.expiredAt ?? (() => {
      const d = new Date(dto.pickupDateTime.getTime())
      d.setDate(d.getDate() - 3)
      return d
    })()
    const doc = await this.inquiries.create({
      code,
      status: dto.status ?? 'pending',
      source: dto.source,
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone.trim(),
      customerEmail: norm(dto.customerEmail),
      citizenId: norm(dto.citizenId),
      customerAddress: norm(dto.customerAddress),
      pickupDateTime: dto.pickupDateTime,
      pickupLocation: dto.pickupLocation.trim(),
      returnDateTime: dto.returnDateTime,
      returnLocation: dto.returnLocation.trim(),
      passengerCount: dto.passengerCount,
      luggageCount: dto.luggageCount ?? 0,
      seatCountMin: typeof dto.seatCountMin === 'number' && dto.seatCountMin > 0 ? dto.seatCountMin : null,
      rentalDays: typeof dto.rentalDays === 'number' && dto.rentalDays > 0 ? dto.rentalDays : null,
      preferredVehicleType: dto.preferredVehicleType ?? null,
      preferredVehicleClass: dto.preferredVehicleClass ?? null,
      withDriver: dto.withDriver,
      selfDriveRequirePapers: dto.selfDriveRequirePapers,
      routeNotes: norm(dto.routeNotes),
      specialRequests: norm(dto.specialRequests),
      bookingId,
      customerUserId,
      ownerStaffId,
      expiredAt,
      internalNotes: norm(dto.internalNotes),
    } as Partial<VehicleInquiry>)
    return this.serializeInquiry(await this.inquiries.findById(doc._id).exec())
  }

  async updateInquiry(idStr: string, dto: UpdateInquiryDto) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã yêu cầu không hợp lệ')
    const patch: Record<string, any> = {}
    if (dto.customerName !== undefined) patch.customerName = dto.customerName.trim()
    if (dto.customerPhone !== undefined) patch.customerPhone = dto.customerPhone.trim()
    if (dto.customerEmail !== undefined) patch.customerEmail = norm(dto.customerEmail)
    if (dto.citizenId !== undefined) patch.citizenId = norm(dto.citizenId)
    if (dto.customerAddress !== undefined) patch.customerAddress = norm(dto.customerAddress)
    if (dto.source !== undefined) patch.source = dto.source
    if (dto.status !== undefined) patch.status = dto.status
    if (dto.pickupDateTime !== undefined) patch.pickupDateTime = dto.pickupDateTime
    if (dto.returnDateTime !== undefined) patch.returnDateTime = dto.returnDateTime
    if (dto.pickupLocation !== undefined) patch.pickupLocation = dto.pickupLocation?.trim()
    if (dto.returnLocation !== undefined) patch.returnLocation = dto.returnLocation?.trim()
    if (dto.passengerCount !== undefined) patch.passengerCount = dto.passengerCount
    if (dto.luggageCount !== undefined) patch.luggageCount = dto.luggageCount ?? 0
    if (dto.seatCountMin !== undefined) patch.seatCountMin = typeof dto.seatCountMin === 'number' && dto.seatCountMin > 0 ? dto.seatCountMin : null
    if (dto.rentalDays !== undefined) patch.rentalDays = typeof dto.rentalDays === 'number' && dto.rentalDays > 0 ? dto.rentalDays : null
    if (dto.preferredVehicleType !== undefined) patch.preferredVehicleType = dto.preferredVehicleType ?? null
    if (dto.preferredVehicleClass !== undefined) patch.preferredVehicleClass = dto.preferredVehicleClass ?? null
    if (dto.withDriver !== undefined) patch.withDriver = dto.withDriver
    if (dto.selfDriveRequirePapers !== undefined) patch.selfDriveRequirePapers = dto.selfDriveRequirePapers
    if (dto.routeNotes !== undefined) patch.routeNotes = norm(dto.routeNotes)
    if (dto.specialRequests !== undefined) patch.specialRequests = norm(dto.specialRequests)
    if (dto.bookingId !== undefined) patch.bookingId = id(dto.bookingId)
    if (dto.customerUserId !== undefined) patch.customerUserId = id(dto.customerUserId)
    if (dto.ownerStaffId !== undefined) patch.ownerStaffId = id(dto.ownerStaffId)
    if (dto.expiredAt !== undefined) patch.expiredAt = dto.expiredAt
    if (dto.cancelReason !== undefined) patch.cancelReason = norm(dto.cancelReason)
    if (dto.internalNotes !== undefined) patch.internalNotes = norm(dto.internalNotes)
    const updated = await this.inquiries.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    if (!updated) throw new NotFoundException('Không tìm thấy yêu cầu thuê xe')
    return this.serializeInquiry(updated)
  }

  async deleteInquiry(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã yêu cầu không hợp lệ')
    const inq = await this.inquiries.findById(oid).exec()
    if (!inq) throw new NotFoundException('Không tìm thấy yêu cầu thuê xe')
    if (inq.quotationId || inq.contractId) {
      throw new BadRequestException('Không thể xóa yêu cầu đã có báo giá / hợp đồng, vui lòng hủy thay vì xóa.')
    }
    await this.inquiries.findByIdAndDelete(oid).exec()
    return { ok: true }
  }

  private serializeInquiry(i: any) {
    const status = String(i?.status || 'draft')
    return {
      id: String(i._id ?? i.id),
      code: String(i.code ?? ''),
      status,
      statusLabel: INQUIRY_STATUS_LABELS[status as keyof typeof INQUIRY_STATUS_LABELS] || status,
      statusTone: INQUIRY_STATUS_TONES[status as keyof typeof INQUIRY_STATUS_TONES] || 'bg-slate-100 text-slate-700 ring-slate-200',
      source: String(i.source || 'staff'),
      sourceLabel: INQUIRY_SOURCE_LABELS[i.source as keyof typeof INQUIRY_SOURCE_LABELS] || String(i.source),
      customerName: String(i.customerName ?? ''),
      customerPhone: String(i.customerPhone ?? ''),
      customerEmail: i.customerEmail ?? null,
      citizenId: i.citizenId ?? null,
      customerAddress: i.customerAddress ?? null,
      pickupDateTime: i.pickupDateTime ? new Date(i.pickupDateTime).toISOString() : null,
      pickupLocation: String(i.pickupLocation ?? ''),
      returnDateTime: i.returnDateTime ? new Date(i.returnDateTime).toISOString() : null,
      returnLocation: String(i.returnLocation ?? ''),
      passengerCount: Number(i.passengerCount || 0),
      luggageCount: Number(i.luggageCount || 0),
      seatCountMin: (typeof i.seatCountMin === 'number' && i.seatCountMin > 0) ? i.seatCountMin : null,
      rentalDays: (typeof i.rentalDays === 'number' && i.rentalDays > 0) ? i.rentalDays : null,
      preferredVehicleType: i.preferredVehicleType ?? null,
      preferredVehicleTypeLabel: i.preferredVehicleType ? (VEHICLE_TYPE_LABELS[i.preferredVehicleType as VehicleType] || String(i.preferredVehicleType)) : null,
      preferredVehicleClass: i.preferredVehicleClass ?? null,
      preferredVehicleClassLabel: i.preferredVehicleClass ? (VEHICLE_CLASS_LABELS[i.preferredVehicleClass as VehicleClass] || String(i.preferredVehicleClass)) : null,
      withDriver: Boolean(i.withDriver),
      selfDriveRequirePapers: Boolean(i.selfDriveRequirePapers),
      routeNotes: i.routeNotes ?? null,
      specialRequests: i.specialRequests ?? null,
      bookingId: i.bookingId ? String(typeof i.bookingId === 'object' ? i.bookingId?._id ?? i.bookingId : i.bookingId) : null,
      bookingCode: typeof i.bookingId === 'object' ? (i.bookingId?.code ?? null) : null,
      customerUserId: i.customerUserId ? String(typeof i.customerUserId === 'object' ? i.customerUserId?._id ?? i.customerUserId : i.customerUserId) : null,
      customerUser: typeof i.customerUserId === 'object' && i.customerUserId
        ? {
            id: String(i.customerUserId._id),
            fullName: String(i.customerUserId.fullName ?? ''),
            email: i.customerUserId.email ?? null,
            phone: i.customerUserId.phone ?? null,
          }
        : null,
      ownerStaffId: i.ownerStaffId ? String(typeof i.ownerStaffId === 'object' ? i.ownerStaffId?._id ?? i.ownerStaffId : i.ownerStaffId) : null,
      ownerStaff: typeof i.ownerStaffId === 'object' && i.ownerStaffId
        ? { id: String(i.ownerStaffId._id), fullName: String(i.ownerStaffId.fullName ?? ''), email: i.ownerStaffId.email ?? null }
        : null,
      quotationId: i.quotationId ? String(typeof i.quotationId === 'object' ? i.quotationId?._id ?? i.quotationId : i.quotationId) : null,
      quotationSummary: typeof i.quotationId === 'object' && i.quotationId
        ? {
            code: String(i.quotationId.code ?? ''),
            status: String(i.quotationId.status ?? ''),
            totalGrandVnd: Number(i.quotationId.totalGrandVnd || 0),
            depositRequiredVnd: Number(i.quotationId.depositRequiredVnd || 0),
          }
        : null,
      contractId: i.contractId ? String(typeof i.contractId === 'object' ? i.contractId?._id ?? i.contractId : i.contractId) : null,
      contractSummary: typeof i.contractId === 'object' && i.contractId
        ? { code: String(i.contractId.code ?? ''), status: String(i.contractId.status ?? '') }
        : null,
      expiredAt: i.expiredAt ? new Date(i.expiredAt).toISOString() : null,
      cancelReason: i.cancelReason ?? null,
      internalNotes: i.internalNotes ?? null,
      confirmedAt: i.confirmedAt ? new Date(i.confirmedAt).toISOString() : null,
      confirmedByStaffId: i.confirmedByStaffId ? String(typeof i.confirmedByStaffId === 'object' ? i.confirmedByStaffId?._id ?? i.confirmedByStaffId : i.confirmedByStaffId) : null,
      confirmedByStaff: typeof i.confirmedByStaffId === 'object' && i.confirmedByStaffId
        ? { id: String(i.confirmedByStaffId._id), fullName: String(i.confirmedByStaffId.fullName ?? ''), email: i.confirmedByStaffId.email ?? null }
        : null,
      quotationPdfUrlPath: i.quotationPdfUrlPath ?? null,
      quotationPdfGeneratedAt: i.quotationPdfGeneratedAt ? new Date(i.quotationPdfGeneratedAt).toISOString() : null,
      confirmedNotifBody: i.confirmedNotifBody ?? null,
      createdAt: i.createdAt ? new Date(i.createdAt).toISOString() : null,
      updatedAt: i.updatedAt ? new Date(i.updatedAt).toISOString() : null,
    }
  }

  /* ================= QUOTATION ================= */
  private async nextQuotationCode() {
    const prefix = 'QUO'
    const count = await this.quotations.countDocuments({ createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }).exec()
    return `${prefix}-${yymm()}-${pad(count + 1, 3)}`
  }

  async listQuotations(q: ListQuotationsDto) {
    const page = Math.max(1, Number(q.page) || 1)
    const limit = Math.max(1, Number(q.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.status) filter.status = q.status
    if (q.inquiryId) filter.inquiryId = id(q.inquiryId)
    if (q.vehicleType) filter.vehicleType = q.vehicleType
    if (q.vehicleClass) filter.vehicleClass = q.vehicleClass
    if (q.fromDate || q.toDate) {
      const range: Record<string, Date> = {}
      if (q.fromDate) range.$gte = q.fromDate
      if (q.toDate) range.$lte = q.toDate
      filter.createdAt = range
    }
    if (q.q) {
      const like = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [{ code: like }]
    }
    const [total, items] = await Promise.all([
      this.quotations.countDocuments(filter).exec(),
      this.quotations
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'inquiryId', select: 'code customerName customerPhone pickupDateTime returnDateTime status' })
        .populate({ path: 'suggestedVehicleIds', select: 'licensePlate vehicleType vehicleClass status' })
        .populate({ path: 'contractId', select: 'code status' })
        .populate({ path: 'createdById', select: 'fullName email' })
        .populate({ path: 'approvedById', select: 'fullName email' })
        .exec(),
    ])
    return { page, limit, total, items: items.map(this.serializeQuotation) }
  }

  async getQuotationById(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã báo giá không hợp lệ')
    const doc = await this.quotations
      .findById(oid)
      .populate({ path: 'inquiryId', select: 'code customerName customerPhone pickupDateTime returnDateTime pickupLocation returnLocation passengerCount withDriver' })
      .populate({ path: 'suggestedVehicleIds', select: 'licensePlate vehicleType vehicleClass status brand color mileageKm rentalPricePerDayVnd' })
      .populate({ path: 'contractId', select: 'code status pickupDateTime returnDateTime' })
      .populate({ path: 'createdById', select: 'fullName email' })
      .populate({ path: 'approvedById', select: 'fullName email' })
      .exec()
    if (!doc) throw new NotFoundException('Không tìm thấy báo giá')
    return this.serializeQuotation(doc)
  }

  async createQuotation(dto: CreateQuotationDto, actor?: { id: string; role: string }) {
    const inquiryOid = id(dto.inquiryId)
    if (!inquiryOid) throw new BadRequestException('Mã yêu cầu không hợp lệ')
    const inq = await this.inquiries.findById(inquiryOid).exec()
    if (!inq) throw new NotFoundException('Không tìm thấy yêu cầu thuê xe')
    const code = await this.nextQuotationCode()
    const validUntil = new Date()
    validUntil.setDate(validUntil.getDate() + Math.max(1, Number(dto.validityDays || 7)))
    const doc = await this.quotations.create({
      code,
      status: 'draft',
      inquiryId: inquiryOid,
      validityDays: dto.validityDays,
      validUntil,
      vehicleType: dto.vehicleType,
      vehicleClass: dto.vehicleClass,
      suggestedVehicleIds: (dto.suggestedVehicleIds || []).map((s) => id(s)).filter(Boolean) as Types.ObjectId[],
      withDriver: dto.withDriver,
      lineItems: dto.lineItems || [],
      rentalDays: dto.rentalDays,
      baseAmountVnd: dto.baseAmountVnd,
      driverFeeVnd: dto.driverFeeVnd,
      extrasAmountVnd: dto.extrasAmountVnd,
      discountPercent: dto.discountPercent,
      discountAmountVnd: dto.discountAmountVnd,
      totalBeforeTaxVnd: dto.totalBeforeTaxVnd,
      taxPercent: dto.taxPercent,
      taxAmountVnd: dto.taxAmountVnd,
      totalGrandVnd: dto.totalGrandVnd,
      depositPercentRequired: dto.depositPercentRequired,
      depositRequiredVnd: dto.depositRequiredVnd,
      termsHtml: norm(dto.termsHtml),
      createdById: actor?.id ? id(actor.id) : null,
    } as Partial<VehicleQuotation>)
    if (inq.status === 'pending') {
      await this.inquiries.findByIdAndUpdate(inq._id, { $set: { status: 'quoted', quotationId: doc._id } }).exec()
    }
    return this.serializeQuotation(await this.quotations.findById(doc._id).exec())
  }

  async updateQuotation(idStr: string, dto: UpdateQuotationDto) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã báo giá không hợp lệ')
    const q = await this.quotations.findById(oid).exec()
    if (!q) throw new NotFoundException('Không tìm thấy báo giá')
    if (q.status !== 'draft') {
      throw new BadRequestException(`Chỉ sửa được báo giá ở trạng thái NHÁP (hiện tại: ${q.status})`)
    }
    const patch: Record<string, any> = {}
    if (dto.inquiryId !== undefined) patch.inquiryId = id(dto.inquiryId)
    if (dto.validityDays !== undefined) {
      patch.validityDays = dto.validityDays
      const vu = new Date(q.createdAt || new Date())
      vu.setDate(vu.getDate() + Math.max(1, Number(dto.validityDays || 7)))
      patch.validUntil = vu
    }
    if (dto.vehicleType !== undefined) patch.vehicleType = dto.vehicleType
    if (dto.vehicleClass !== undefined) patch.vehicleClass = dto.vehicleClass
    if (dto.suggestedVehicleIds !== undefined) patch.suggestedVehicleIds = dto.suggestedVehicleIds.map((s) => id(s)).filter(Boolean) as Types.ObjectId[]
    if (dto.withDriver !== undefined) patch.withDriver = dto.withDriver
    if (dto.lineItems !== undefined) patch.lineItems = dto.lineItems
    if (dto.rentalDays !== undefined) patch.rentalDays = dto.rentalDays
    if (dto.baseAmountVnd !== undefined) patch.baseAmountVnd = dto.baseAmountVnd
    if (dto.driverFeeVnd !== undefined) patch.driverFeeVnd = dto.driverFeeVnd
    if (dto.extrasAmountVnd !== undefined) patch.extrasAmountVnd = dto.extrasAmountVnd
    if (dto.discountPercent !== undefined) patch.discountPercent = dto.discountPercent
    if (dto.discountAmountVnd !== undefined) patch.discountAmountVnd = dto.discountAmountVnd
    if (dto.totalBeforeTaxVnd !== undefined) patch.totalBeforeTaxVnd = dto.totalBeforeTaxVnd
    if (dto.taxPercent !== undefined) patch.taxPercent = dto.taxPercent
    if (dto.taxAmountVnd !== undefined) patch.taxAmountVnd = dto.taxAmountVnd
    if (dto.totalGrandVnd !== undefined) patch.totalGrandVnd = dto.totalGrandVnd
    if (dto.depositPercentRequired !== undefined) patch.depositPercentRequired = dto.depositPercentRequired
    if (dto.depositRequiredVnd !== undefined) patch.depositRequiredVnd = dto.depositRequiredVnd
    if (dto.termsHtml !== undefined) patch.termsHtml = norm(dto.termsHtml)
    const updated = await this.quotations.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeQuotation(updated)
  }

  async quotationAction(idStr: string, action: any, actor?: { id: string; role: string }) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã báo giá không hợp lệ')
    const q = await this.quotations.findById(oid).exec()
    if (!q) throw new NotFoundException('Không tìm thấy báo giá')
    let patch: Record<string, any> | null = null
    switch (action.action) {
      case 'submit_approval':
        if (q.status !== 'draft') throw new BadRequestException(`Chỉ báo giá Nháp mới gửi duyệt (hiện tại: ${q.status})`)
        patch = { status: 'pending_approval' }
        break
      case 'approve':
        if (q.status !== 'pending_approval') throw new BadRequestException(`Báo giá chưa ở trạng thái chờ duyệt (hiện tại: ${q.status})`)
        patch = { status: 'approved', approvedById: actor?.id ? id(actor.id) : q.approvedById ?? null, approvedAt: new Date() }
        break
      case 'reject':
        if (q.status !== 'pending_approval') throw new BadRequestException(`Báo giá chưa ở trạng thái chờ duyệt (hiện tại: ${q.status})`)
        patch = { status: 'rejected', rejectReason: String(action.rejectReason || '').trim() }
        break
      case 'send':
        if (!['approved', 'draft', 'pending_approval'].includes(q.status)) {
          if (q.status === 'rejected') throw new BadRequestException('Báo giá đã bị từ chối, tạo báo giá mới.')
          throw new BadRequestException(`Trạng thái không cho phép gửi (hiện tại: ${q.status})`)
        }
        patch = { status: 'sent', sentAt: new Date() }
        break
      case 'accept':
        if (!['sent', 'approved'].includes(q.status)) throw new BadRequestException('Báo giá chưa được gửi, khách không thể đồng ý')
        patch = { status: 'accepted', customerAcceptedAt: new Date() }
        const inq = await this.inquiries.findById(q.inquiryId).exec()
        if (inq && inq.status === 'quoted' || inq?.status === 'pending') {
          await this.inquiries.findByIdAndUpdate(inq._id, { $set: { status: 'converted' } }).exec()
        }
        break
      case 'decline':
        if (!['sent', 'approved'].includes(q.status)) throw new BadRequestException('Báo giá chưa được gửi')
        patch = { status: 'declined', customerDeclineReason: String(action.customerDeclineReason || '').trim() }
        break
      case 'expire':
        patch = { status: 'expired' }
        break
      case 'cancel':
        patch = { status: 'canceled' }
        break
      default:
        throw new BadRequestException('Hành động không hợp lệ')
    }
    const updated = await this.quotations.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeQuotation(updated)
  }

  async deleteQuotation(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã báo giá không hợp lệ')
    const q = await this.quotations.findById(oid).exec()
    if (!q) throw new NotFoundException('Không tìm thấy báo giá')
    if (['accepted', 'converted', 'sent', 'approved'].includes(q.status)) {
      throw new BadRequestException('Báo giá đã gửi/đồng ý, không xóa được (chuyển sang HỦY).')
    }
    await this.quotations.findByIdAndDelete(oid).exec()
    return { ok: true }
  }

  private serializeQuotation(q: any) {
    const status = String(q.status || 'draft')
    return {
      id: String(q._id ?? q.id),
      code: String(q.code ?? ''),
      status,
      statusLabel: QUOTATION_STATUS_LABELS[status as keyof typeof QUOTATION_STATUS_LABELS] || status,
      statusTone: QUOTATION_STATUS_TONES[status as keyof typeof QUOTATION_STATUS_TONES] || 'bg-slate-100 text-slate-700 ring-slate-200',
      inquiryId: q.inquiryId ? String(typeof q.inquiryId === 'object' ? q.inquiryId?._id ?? q.inquiryId : q.inquiryId) : null,
      inquirySummary: typeof q.inquiryId === 'object' && q.inquiryId
        ? {
            code: String(q.inquiryId.code ?? ''),
            customerName: String(q.inquiryId.customerName ?? ''),
            customerPhone: String(q.inquiryId.customerPhone ?? ''),
            status: String(q.inquiryId.status ?? ''),
            pickupDateTime: q.inquiryId.pickupDateTime ? new Date(q.inquiryId.pickupDateTime).toISOString() : null,
            returnDateTime: q.inquiryId.returnDateTime ? new Date(q.inquiryId.returnDateTime).toISOString() : null,
            passengerCount: Number(q.inquiryId.passengerCount || 0),
            withDriver: Boolean(q.inquiryId.withDriver),
          }
        : null,
      validityDays: Number(q.validityDays || 0),
      validUntil: q.validUntil ? new Date(q.validUntil).toISOString() : null,
      vehicleType: q.vehicleType,
      vehicleTypeLabel: VEHICLE_TYPE_LABELS[q.vehicleType as VehicleType] || String(q.vehicleType),
      vehicleClass: q.vehicleClass ?? 'seat',
      vehicleClassLabel: VEHICLE_CLASS_LABELS[q.vehicleClass as VehicleClass] || String(q.vehicleClass ?? 'seat'),
      suggestedVehicles: Array.isArray(q.suggestedVehicleIds)
        ? q.suggestedVehicleIds.map((v: any) => ({
            id: String(v._id ?? v.id),
            licensePlate: String(v.licensePlate ?? ''),
            vehicleType: v.vehicleType ?? null,
            vehicleClass: v.vehicleClass ?? null,
            status: v.status ?? null,
          }))
        : [],
      withDriver: Boolean(q.withDriver),
      lineItems: Array.isArray(q.lineItems) ? q.lineItems : [],
      rentalDays: Number(q.rentalDays || 0),
      baseAmountVnd: Number(q.baseAmountVnd || 0),
      driverFeeVnd: Number(q.driverFeeVnd || 0),
      extrasAmountVnd: Number(q.extrasAmountVnd || 0),
      discountPercent: Number(q.discountPercent || 0),
      discountAmountVnd: Number(q.discountAmountVnd || 0),
      totalBeforeTaxVnd: Number(q.totalBeforeTaxVnd || 0),
      taxPercent: Number(q.taxPercent || 0),
      taxAmountVnd: Number(q.taxAmountVnd || 0),
      totalGrandVnd: Number(q.totalGrandVnd || 0),
      depositPercentRequired: Number(q.depositPercentRequired || 0),
      depositRequiredVnd: Number(q.depositRequiredVnd || 0),
      termsHtml: q.termsHtml ?? null,
      rejectReason: q.rejectReason ?? null,
      customerDeclineReason: q.customerDeclineReason ?? null,
      contractId: q.contractId ? String(typeof q.contractId === 'object' ? q.contractId?._id ?? q.contractId : q.contractId) : null,
      contractSummary: typeof q.contractId === 'object' ? { code: String(q.contractId?.code ?? ''), status: String(q.contractId?.status ?? '') } : null,
      createdById: q.createdById ? String(typeof q.createdById === 'object' ? q.createdById?._id ?? q.createdById : q.createdById) : null,
      createdBy: typeof q.createdById === 'object' && q.createdById
        ? { id: String(q.createdById._id), fullName: String(q.createdById.fullName ?? ''), email: q.createdById.email ?? null }
        : null,
      approvedById: q.approvedById ? String(typeof q.approvedById === 'object' ? q.approvedById?._id ?? q.approvedById : q.approvedById) : null,
      approvedBy: typeof q.approvedById === 'object' && q.approvedById
        ? { id: String(q.approvedById._id), fullName: String(q.approvedById.fullName ?? '') }
        : null,
      approvedAt: q.approvedAt ? new Date(q.approvedAt).toISOString() : null,
      sentAt: q.sentAt ? new Date(q.sentAt).toISOString() : null,
      customerAcceptedAt: q.customerAcceptedAt ? new Date(q.customerAcceptedAt).toISOString() : null,
      createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : null,
      updatedAt: q.updatedAt ? new Date(q.updatedAt).toISOString() : null,
    }
  }

  /* ================= CONTRACT ================= */
  private async nextContractCode() {
    const prefix = 'RENT'
    const count = await this.contracts.countDocuments({ createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }).exec()
    return `${prefix}-${yymm()}-${pad(count + 1, 3)}`
  }

  private async findConflictVehicleIds(vehicleIds: Types.ObjectId[], pickup: Date, ret: Date, excludeContractId?: Types.ObjectId) {
    if (!vehicleIds?.length) return [] as Types.ObjectId[]
    const active = ['pending_signature', 'signed', 'deposit_paid', 'in_progress']
    const baseFilter: Record<string, any> = {
      status: { $in: active },
      $or: [
        { pickupDateTime: { $lt: ret }, returnDateTime: { $gt: pickup } },
      ],
    }
    if (excludeContractId) baseFilter._id = { $ne: excludeContractId }
    const all = await this.contracts
      .find({ ...baseFilter, assignedVehicleIds: { $in: vehicleIds } })
      .select('assignedVehicleIds pickupDateTime returnDateTime code status')
      .exec()
    const conflict = new Set<string>()
    for (const c of all) {
      for (const v of c.assignedVehicleIds || []) {
        if (vehicleIds.find((x) => String(x) === String(v))) conflict.add(String(v))
      }
    }
    return [...conflict].map((s) => new Types.ObjectId(s))
  }

  async suggestAvailableVehicles(dto: SuggestAvailableVehiclesDto) {
    const pickup = dto.pickupDateTime
    const ret = dto.returnDateTime
    const durationMs = Math.max(1, ret.getTime() - pickup.getTime())
    const days = Math.max(1, Math.ceil(durationMs / (24 * 60 * 60 * 1000)))
    const filter: Record<string, any> = { status: dto.vehicleStatus ?? 'available' }
    if (dto.vehicleType) filter.vehicleType = dto.vehicleType
    if (dto.vehicleClass) filter.vehicleClass = dto.vehicleClass
    const candidates = await this.vehicles.find(filter).sort({ rentalPricePerDayVnd: 1, mileageKm: 1, licensePlate: 1 }).exec()
    const ids = candidates.map((c) => c._id)
    const conflicts = await this.findConflictVehicleIds(ids, pickup, ret)
    const conflictSet = new Set(conflicts.map((c) => String(c)))
    const items = candidates
      .filter((c) => !conflictSet.has(String(c._id)))
      .map((v) => ({
        id: String(v._id),
        licensePlate: String(v.licensePlate ?? ''),
        vehicleType: v.vehicleType,
        vehicleTypeLabel: VEHICLE_TYPE_LABELS[v.vehicleType as VehicleType] || v.vehicleType,
        vehicleClass: v.vehicleClass,
        vehicleClassLabel: VEHICLE_CLASS_LABELS[v.vehicleClass as VehicleClass] || v.vehicleClass,
        vehicleClassTone: VEHICLE_CLASS_TONES[v.vehicleClass as VehicleClass] || '',
        brand: v.brand ?? null,
        color: v.color ?? null,
        manufactureYear: v.manufactureYear ?? null,
        mileageKm: Number(v.mileageKm || 0),
        status: v.status,
        statusLabel: VEHICLE_STATUS_LABELS[v.status as VehicleStatus] || String(v.status),
        statusTone: ({
          available: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
          booked: 'bg-amber-50 text-amber-700 ring-amber-600/20',
          in_use: 'bg-blue-50 text-blue-700 ring-blue-600/20',
          maintenance: 'bg-orange-50 text-orange-700 ring-orange-600/20',
          off_market: 'bg-zinc-100 text-zinc-700 ring-zinc-600/20',
        } as Record<string, string>)[v.status as VehicleStatus] || '',
        rentalPricePerDayVnd: Number(v.rentalPricePerDayVnd || 0),
        estimatedTotalVnd: days * Number(v.rentalPricePerDayVnd || 0),
      }))
    return { days, items }
  }

  async listContracts(q: ListContractsDto) {
    const page = Math.max(1, Number(q.page) || 1)
    const limit = Math.max(1, Number(q.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.status) filter.status = q.status
    if (q.inquiryId) filter.inquiryId = id(q.inquiryId)
    if (q.quotationId) filter.quotationId = id(q.quotationId)
    if (q.bookingId) filter.bookingId = id(q.bookingId)
    if ((q as any).customerUserId) filter.customerUserId = id((q as any).customerUserId)
    if (q.vehicleId) filter.assignedVehicleIds = { $in: [id(q.vehicleId)].filter(Boolean) }
    if (q.fromDate || q.toDate) {
      const range: Record<string, Date> = {}
      if (q.fromDate) range.$gte = q.fromDate
      if (q.toDate) range.$lte = q.toDate
      filter.pickupDateTime = range
    }
    if (q.q) {
      const like = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [
        { code: like },
        { customerName: like },
        { customerPhone: like },
        { citizenId: like },
      ]
    }
    const [total, items] = await Promise.all([
      this.contracts.countDocuments(filter).exec(),
      this.contracts
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'inquiryId', select: 'code status' })
        .populate({ path: 'quotationId', select: 'code status totalGrandVnd' })
        .populate({ path: 'bookingId', select: 'code status tourId departureDate' })
        .populate({ path: 'assignedVehicleIds', select: 'licensePlate vehicleType vehicleClass status' })
        .populate({ path: 'pickupHandoverId', select: 'handoverType status handoverDateTime' })
        .populate({ path: 'returnHandoverId', select: 'handoverType status handoverDateTime' })
        .populate({ path: 'settlementId', select: 'code status totalExtraChargesVnd customerMustPayVnd refundToCustomerVnd' })
        .populate({ path: 'signedByStaffId', select: 'fullName' })
        .populate({ path: 'ownerSalesId', select: 'fullName email' })
        .exec(),
    ])
    return { page, limit, total, items: items.map(this.serializeContract) }
  }

  async getContractById(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã hợp đồng không hợp lệ')
    const doc = await this.contracts
      .findById(oid)
      .populate({ path: 'inquiryId', select: 'code customerName customerPhone pickupDateTime returnDateTime status' })
      .populate({ path: 'quotationId', select: 'code status totalGrandVnd validUntil depositRequiredVnd lineItems' })
      .populate({ path: 'bookingId', select: 'code status tourId departureDate returnDate customerCount' })
      .populate({ path: 'assignedVehicleIds', select: 'licensePlate vehicleType vehicleClass status brand color mileageKm rentalPricePerDayVnd' })
      .populate({ path: 'pickupHandoverId', select: 'handoverType status handoverDateTime locationAddress mileageKm fuelPercent' })
      .populate({ path: 'returnHandoverId', select: 'handoverType status handoverDateTime locationAddress mileageKm fuelPercent' })
      .populate({ path: 'settlementId', select: 'code status customerMustPayVnd refundToCustomerVnd finalPaidVnd totalExtraChargesVnd' })
      .populate({ path: 'signedByStaffId', select: 'fullName email phone' })
      .populate({ path: 'ownerSalesId', select: 'fullName email phone' })
      .exec()
    if (!doc) throw new NotFoundException('Không tìm thấy hợp đồng thuê xe')
    return this.serializeContract(doc)
  }

  async createContract(dto: CreateContractDto, actor?: { id: string; role: string }) {
    const assigned = (dto.assignedVehicleIds || []).map((s) => id(s)).filter(Boolean) as Types.ObjectId[]
    if (!assigned.length) throw new BadRequestException('Cần chọn ít nhất 1 xe cho hợp đồng')
    const conflicts = await this.findConflictVehicleIds(assigned, dto.pickupDateTime, dto.returnDateTime)
    if (conflicts.length) {
      const plates = await this.vehicles.find({ _id: { $in: conflicts } }, { licensePlate: 1 }).exec()
      const plateStr = plates.map((p) => p.licensePlate).join(', ')
      throw new BadRequestException(`Xe bị trùng lịch (đã có hợp đồng khác trong khoảng ngày): ${plateStr}`)
    }
    const code = await this.nextContractCode()
    const inquiryId = id(dto.inquiryId)
    const quotationId = id(dto.quotationId)
    const bookingId = id(dto.bookingId)
    const ownerSalesId = id(dto.ownerSalesId) ?? (actor?.role === 'staff' || actor?.role === 'admin' ? id(actor?.id) : null)
    const doc = await this.contracts.create({
      code,
      status: 'draft',
      inquiryId,
      quotationId,
      bookingId,
      customerName: dto.customerName.trim(),
      customerPhone: dto.customerPhone.trim(),
      customerEmail: norm(dto.customerEmail),
      citizenId: dto.citizenId.trim(),
      citizenIdIssuePlace: norm(dto.citizenIdIssuePlace),
      citizenIdIssueDate: dto.citizenIdIssueDate ?? null,
      customerAddress: dto.customerAddress.trim(),
      driverLicenseNumber: norm(dto.driverLicenseNumber),
      driverLicenseClass: norm(dto.driverLicenseClass),
      assignedVehicleIds: assigned,
      withDriver: dto.withDriver,
      pickupDateTime: dto.pickupDateTime,
      pickupLocation: dto.pickupLocation.trim(),
      returnDateTime: dto.returnDateTime,
      returnLocation: dto.returnLocation.trim(),
      rentalDays: dto.rentalDays,
      totalGrandVnd: dto.totalGrandVnd,
      depositRequiredVnd: dto.depositRequiredVnd,
      depositPaidVnd: dto.depositPaidVnd,
      paidVnd: dto.paidVnd,
      depositPapersHeld: dto.depositPapersHeld,
      collateralCashVnd: dto.collateralCashVnd,
      collateralOther: norm(dto.collateralOther),
      requireVatInvoice: dto.requireVatInvoice,
      invoiceCompanyName: norm(dto.invoiceCompanyName),
      invoiceTaxCode: norm(dto.invoiceTaxCode),
      invoiceAddress: norm(dto.invoiceAddress),
      ownerSalesId,
      termsHtml: norm(dto.termsHtml),
      internalNotes: norm(dto.internalNotes),
    } as Partial<VehicleRentalContract>)
    if (inquiryId) {
      await this.inquiries.findByIdAndUpdate(inquiryId, { $set: { status: 'converted', contractId: doc._id } }).exec()
    }
    if (quotationId) {
      await this.quotations.findByIdAndUpdate(quotationId, { $set: { status: 'converted', contractId: doc._id } }).exec()
    }
    return this.serializeContract(await this.contracts.findById(doc._id).exec())
  }

  async updateContract(idStr: string, dto: UpdateContractDto) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã hợp đồng không hợp lệ')
    const c = await this.contracts.findById(oid).exec()
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng')
    const locked = ['in_progress', 'completed', 'terminated', 'canceled'].includes(c.status)
    const patch: Record<string, any> = {}
    if (dto.inquiryId !== undefined) patch.inquiryId = id(dto.inquiryId)
    if (dto.quotationId !== undefined) patch.quotationId = id(dto.quotationId)
    if (dto.bookingId !== undefined) patch.bookingId = id(dto.bookingId)
    if (dto.customerName !== undefined) patch.customerName = dto.customerName.trim()
    if (dto.customerPhone !== undefined) patch.customerPhone = dto.customerPhone.trim()
    if (dto.customerEmail !== undefined) patch.customerEmail = norm(dto.customerEmail)
    if (dto.citizenId !== undefined) patch.citizenId = dto.citizenId.trim()
    if (dto.citizenIdIssuePlace !== undefined) patch.citizenIdIssuePlace = norm(dto.citizenIdIssuePlace)
    if (dto.citizenIdIssueDate !== undefined) patch.citizenIdIssueDate = dto.citizenIdIssueDate
    if (dto.customerAddress !== undefined) patch.customerAddress = dto.customerAddress.trim()
    if (dto.driverLicenseNumber !== undefined) patch.driverLicenseNumber = norm(dto.driverLicenseNumber)
    if (dto.driverLicenseClass !== undefined) patch.driverLicenseClass = norm(dto.driverLicenseClass)
    if (dto.assignedVehicleIds !== undefined) {
      const assigned = dto.assignedVehicleIds.map((s) => id(s)).filter(Boolean) as Types.ObjectId[]
      const pickup = dto.pickupDateTime ?? c.pickupDateTime
      const ret = dto.returnDateTime ?? c.returnDateTime
      const conflicts = await this.findConflictVehicleIds(assigned, pickup, ret, oid)
      if (conflicts.length) throw new BadRequestException(`Có xe bị trùng lịch: ${conflicts.length} xe`)
      patch.assignedVehicleIds = assigned
    }
    if (dto.withDriver !== undefined) patch.withDriver = dto.withDriver
    if (dto.pickupDateTime !== undefined) patch.pickupDateTime = dto.pickupDateTime
    if (dto.returnDateTime !== undefined) patch.returnDateTime = dto.returnDateTime
    if (dto.pickupLocation !== undefined) patch.pickupLocation = dto.pickupLocation?.trim()
    if (dto.returnLocation !== undefined) patch.returnLocation = dto.returnLocation?.trim()
    if (dto.rentalDays !== undefined) patch.rentalDays = dto.rentalDays
    if (locked && (dto.totalGrandVnd !== undefined || dto.depositRequiredVnd !== undefined)) {
      throw new BadRequestException(`Hợp đồng trạng thái ${c.status} không sửa được giá trị`)
    }
    if (dto.totalGrandVnd !== undefined) patch.totalGrandVnd = dto.totalGrandVnd
    if (dto.depositRequiredVnd !== undefined) patch.depositRequiredVnd = dto.depositRequiredVnd
    if (dto.depositPaidVnd !== undefined) patch.depositPaidVnd = dto.depositPaidVnd
    if (dto.paidVnd !== undefined) patch.paidVnd = dto.paidVnd
    if (dto.depositPapersHeld !== undefined) patch.depositPapersHeld = dto.depositPapersHeld
    if (dto.collateralCashVnd !== undefined) patch.collateralCashVnd = dto.collateralCashVnd
    if (dto.collateralOther !== undefined) patch.collateralOther = norm(dto.collateralOther)
    if (dto.requireVatInvoice !== undefined) patch.requireVatInvoice = dto.requireVatInvoice
    if (dto.invoiceCompanyName !== undefined) patch.invoiceCompanyName = norm(dto.invoiceCompanyName)
    if (dto.invoiceTaxCode !== undefined) patch.invoiceTaxCode = norm(dto.invoiceTaxCode)
    if (dto.invoiceAddress !== undefined) patch.invoiceAddress = norm(dto.invoiceAddress)
    if (dto.ownerSalesId !== undefined) patch.ownerSalesId = id(dto.ownerSalesId)
    if (dto.termsHtml !== undefined) patch.termsHtml = norm(dto.termsHtml)
    if (dto.cancelOrTerminateReason !== undefined) patch.cancelOrTerminateReason = norm(dto.cancelOrTerminateReason)
    if (dto.internalNotes !== undefined) patch.internalNotes = norm(dto.internalNotes)
    const updated = await this.contracts.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeContract(updated)
  }

  async contractAction(idStr: string, action: any, actor?: { id: string; role: string }) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã hợp đồng không hợp lệ')
    const c = await this.contracts.findById(oid).exec()
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng')
    let patch: Record<string, any> | null = null
    switch (action.action) {
      case 'sign':
        if (!['draft', 'pending_signature'].includes(c.status)) throw new BadRequestException(`Hợp đồng phải Nháp/Chờ ký (hiện tại: ${c.status})`)
        patch = { status: 'signed', signedAt: new Date(), signedByStaffId: actor?.id ? id(actor.id) : c.signedByStaffId ?? null }
        break
      case 'mark_deposit_paid':
        if (!['signed', 'pending_signature', 'draft'].includes(c.status)) throw new BadRequestException('Hợp đồng chưa thể đánh dấu đặt cọc')
        const amt = action.amount ?? c.depositRequiredVnd ?? 0
        patch = { status: 'deposit_paid', depositPaidVnd: amt, depositPaidAt: new Date() }
        break
      case 'mark_in_progress':
        if (!['deposit_paid', 'signed'].includes(c.status)) throw new BadRequestException('Cần đặt cọc trước khi đánh dấu Đang thuê (đã giao xe)')
        patch = { status: 'in_progress' }
        break
      case 'mark_completed':
        if (!['in_progress'].includes(c.status)) throw new BadRequestException('Hợp đồng phải Đang thuê mới đánh dấu hoàn tất')
        patch = { status: 'completed', completedAt: new Date() }
        break
      case 'cancel':
        if (c.status === 'completed' || c.status === 'terminated' || c.status === 'canceled') throw new BadRequestException('Hợp đồng đã đóng, không hủy được.')
        patch = { status: 'canceled', cancelOrTerminateReason: String(action.reason || '').trim() }
        break
      case 'terminate':
        if (!['signed', 'deposit_paid', 'in_progress'].includes(c.status)) throw new BadRequestException('Hợp đồng chưa thể chấm dứt sớm.')
        patch = { status: 'terminated', cancelOrTerminateReason: String(action.reason || '').trim() }
        break
      case 'assign_vehicles':
        const assigned = (action.vehicleIds || []).map((s: string) => id(s)).filter(Boolean) as Types.ObjectId[]
        if (!assigned.length) throw new BadRequestException('Cần ít nhất 1 xe')
        const conflicts = await this.findConflictVehicleIds(assigned, c.pickupDateTime, c.returnDateTime, oid)
        if (conflicts.length) throw new BadRequestException(`Có ${conflicts.length} xe bị trùng lịch`)
        patch = { assignedVehicleIds: assigned }
        break
      case 'register_payment':
        const payAmt = Number(action.amount || 0)
        if (payAmt <= 0) throw new BadRequestException('Số tiền thanh toán phải lớn hơn 0')
        patch = { paidVnd: Number(c.paidVnd || 0) + payAmt }
        break
      default:
        throw new BadRequestException('Hành động không hợp lệ')
    }
    const updated = await this.contracts.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeContract(updated)
  }

  async deleteContract(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã hợp đồng không hợp lệ')
    const c = await this.contracts.findById(oid).exec()
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng')
    if (c.pickupHandoverId || c.returnHandoverId || c.settlementId) {
      throw new BadRequestException('Hợp đồng đã có giao xe/tổng kết, không xóa được (chuyển HỦY).')
    }
    if (['completed', 'in_progress', 'deposit_paid', 'signed', 'terminated'].includes(c.status)) {
      throw new BadRequestException('Hợp đồng đã có giao dịch, không xóa được (chuyển HỦY).')
    }
    await this.contracts.findByIdAndDelete(oid).exec()
    return { ok: true }
  }

  private serializeContract(c: any) {
    const status = String(c.status || 'draft')
    return {
      id: String(c._id ?? c.id),
      code: String(c.code ?? ''),
      status,
      statusLabel: CONTRACT_STATUS_LABELS[status as keyof typeof CONTRACT_STATUS_LABELS] || status,
      statusTone: CONTRACT_STATUS_TONES[status as keyof typeof CONTRACT_STATUS_TONES] || 'bg-slate-100 text-slate-700 ring-slate-200',
      inquiryId: c.inquiryId ? String(typeof c.inquiryId === 'object' ? c.inquiryId?._id ?? c.inquiryId : c.inquiryId) : null,
      inquirySummary: typeof c.inquiryId === 'object' && c.inquiryId ? { code: String(c.inquiryId.code ?? ''), status: String(c.inquiryId.status ?? '') } : null,
      quotationId: c.quotationId ? String(typeof c.quotationId === 'object' ? c.quotationId?._id ?? c.quotationId : c.quotationId) : null,
      quotationSummary: typeof c.quotationId === 'object' && c.quotationId
        ? { code: String(c.quotationId.code ?? ''), status: String(c.quotationId.status ?? ''), totalGrandVnd: Number(c.quotationId.totalGrandVnd || 0) }
        : null,
      bookingId: c.bookingId ? String(typeof c.bookingId === 'object' ? c.bookingId?._id ?? c.bookingId : c.bookingId) : null,
      bookingSummary: typeof c.bookingId === 'object' && c.bookingId
        ? { code: String(c.bookingId.code ?? ''), status: String(c.bookingId.status ?? '') }
        : null,
      customerName: String(c.customerName ?? ''),
      customerPhone: String(c.customerPhone ?? ''),
      customerEmail: c.customerEmail ?? null,
      citizenId: String(c.citizenId ?? ''),
      citizenIdIssuePlace: c.citizenIdIssuePlace ?? null,
      citizenIdIssueDate: c.citizenIdIssueDate ? new Date(c.citizenIdIssueDate).toISOString() : null,
      customerAddress: String(c.customerAddress ?? ''),
      driverLicenseNumber: c.driverLicenseNumber ?? null,
      driverLicenseClass: c.driverLicenseClass ?? null,
      assignedVehicles: Array.isArray(c.assignedVehicleIds)
        ? c.assignedVehicleIds.map((v: any) => ({
            id: String(v._id ?? v.id),
            licensePlate: String(v.licensePlate ?? ''),
            vehicleType: v.vehicleType ?? null,
            vehicleTypeLabel: v.vehicleType ? (VEHICLE_TYPE_LABELS[v.vehicleType as VehicleType] || String(v.vehicleType)) : null,
            vehicleClass: v.vehicleClass ?? null,
            vehicleClassLabel: v.vehicleClass ? (VEHICLE_CLASS_LABELS[v.vehicleClass as VehicleClass] || String(v.vehicleClass)) : null,
            status: v.status ?? null,
          }))
        : [],
      withDriver: Boolean(c.withDriver),
      pickupDateTime: c.pickupDateTime ? new Date(c.pickupDateTime).toISOString() : null,
      pickupLocation: String(c.pickupLocation ?? ''),
      returnDateTime: c.returnDateTime ? new Date(c.returnDateTime).toISOString() : null,
      returnLocation: String(c.returnLocation ?? ''),
      rentalDays: Number(c.rentalDays || 0),
      totalGrandVnd: Number(c.totalGrandVnd || 0),
      depositRequiredVnd: Number(c.depositRequiredVnd || 0),
      depositPaidVnd: Number(c.depositPaidVnd || 0),
      paidVnd: Number(c.paidVnd || 0),
      depositPapersHeld: Boolean(c.depositPapersHeld),
      collateralCashVnd: Number(c.collateralCashVnd || 0),
      collateralOther: c.collateralOther ?? null,
      requireVatInvoice: Boolean(c.requireVatInvoice),
      invoiceCompanyName: c.invoiceCompanyName ?? null,
      invoiceTaxCode: c.invoiceTaxCode ?? null,
      invoiceAddress: c.invoiceAddress ?? null,
      pickupHandoverId: c.pickupHandoverId ? String(typeof c.pickupHandoverId === 'object' ? c.pickupHandoverId?._id ?? c.pickupHandoverId : c.pickupHandoverId) : null,
      pickupHandoverSummary: typeof c.pickupHandoverId === 'object' && c.pickupHandoverId
        ? {
            status: String(c.pickupHandoverId.status ?? ''),
            handoverDateTime: c.pickupHandoverId.handoverDateTime ? new Date(c.pickupHandoverId.handoverDateTime).toISOString() : null,
            mileageKm: Number(c.pickupHandoverId.mileageKm || 0),
            fuelPercent: Number(c.pickupHandoverId.fuelPercent || 0),
          }
        : null,
      returnHandoverId: c.returnHandoverId ? String(typeof c.returnHandoverId === 'object' ? c.returnHandoverId?._id ?? c.returnHandoverId : c.returnHandoverId) : null,
      returnHandoverSummary: typeof c.returnHandoverId === 'object' && c.returnHandoverId
        ? {
            status: String(c.returnHandoverId.status ?? ''),
            handoverDateTime: c.returnHandoverId.handoverDateTime ? new Date(c.returnHandoverId.handoverDateTime).toISOString() : null,
            mileageKm: Number(c.returnHandoverId.mileageKm || 0),
            fuelPercent: Number(c.returnHandoverId.fuelPercent || 0),
          }
        : null,
      settlementId: c.settlementId ? String(typeof c.settlementId === 'object' ? c.settlementId?._id ?? c.settlementId : c.settlementId) : null,
      settlementSummary: typeof c.settlementId === 'object' && c.settlementId
        ? {
            code: String(c.settlementId.code ?? ''),
            status: String(c.settlementId.status ?? ''),
            totalExtraChargesVnd: Number(c.settlementId.totalExtraChargesVnd || 0),
            customerMustPayVnd: Number(c.settlementId.customerMustPayVnd || 0),
            refundToCustomerVnd: Number(c.settlementId.refundToCustomerVnd || 0),
          }
        : null,
      signedByStaffId: c.signedByStaffId ? String(typeof c.signedByStaffId === 'object' ? c.signedByStaffId?._id ?? c.signedByStaffId : c.signedByStaffId) : null,
      signedBy: typeof c.signedByStaffId === 'object' && c.signedByStaffId
        ? { id: String(c.signedByStaffId._id), fullName: String(c.signedByStaffId.fullName ?? '') }
        : null,
      ownerSalesId: c.ownerSalesId ? String(typeof c.ownerSalesId === 'object' ? c.ownerSalesId?._id ?? c.ownerSalesId : c.ownerSalesId) : null,
      ownerSales: typeof c.ownerSalesId === 'object' && c.ownerSalesId
        ? { id: String(c.ownerSalesId._id), fullName: String(c.ownerSalesId.fullName ?? '') }
        : null,
      signedAt: c.signedAt ? new Date(c.signedAt).toISOString() : null,
      depositPaidAt: c.depositPaidAt ? new Date(c.depositPaidAt).toISOString() : null,
      completedAt: c.completedAt ? new Date(c.completedAt).toISOString() : null,
      termsHtml: c.termsHtml ?? null,
      cancelOrTerminateReason: c.cancelOrTerminateReason ?? null,
      internalNotes: c.internalNotes ?? null,
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null,
      updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : null,
    }
  }

  /* ================= HANDOVER (Giao/Thu hồi) ================= */
  getDefaultChecklist(type: 'pickup' | 'return', vehicleClass?: VehicleClass) {
    let items = HITEMS_STANDARD.slice()
    if (type === 'return') {
      items = [
        ...items,
        { key: 'return_damage_compare', label: 'Đối chiếu vết xước với biên bản GIAO xe' },
        { key: 'return_tools', label: 'Kiểm tra đồ dùng đã giao đủ chưa (chìa, giấy tờ)' },
      ]
    } else {
      items = [
        ...items,
        { key: 'pickup_wifi', label: 'Wifi phụ / Sạc / Nước uống (vui lòng khách kiểm tra)' },
      ]
    }
    if (vehicleClass === 'sleeper' || vehicleClass === 'cabin') {
      items = [
        ...items.slice(0, 7),
        { key: 'bed_sheets', label: 'Ga giường, chăn, gối (đổi mới sạch)' },
        ...items.slice(7),
      ]
    }
    return items.map((it) => ({ key: it.key, label: it.label, ok: false, notes: null }))
  }

  async listHandovers(q: ListHandoversDto) {
    const page = Math.max(1, Number(q.page) || 1)
    const limit = Math.max(1, Number(q.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.handoverType) filter.handoverType = q.handoverType
    if (q.status) filter.status = q.status
    if (q.contractId) filter.contractId = id(q.contractId)
    if (q.vehicleId) filter.vehicleId = id(q.vehicleId)
    if (q.fromDate || q.toDate) {
      const r: Record<string, Date> = {}
      if (q.fromDate) r.$gte = q.fromDate
      if (q.toDate) r.$lte = q.toDate
      filter.handoverDateTime = r
    }
    if (q.q) {
      const like = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [{ customerSignerName: like }, { customerSignerCitizenId: like }, { locationAddress: like }]
    }
    const [total, items] = await Promise.all([
      this.handovers.countDocuments(filter).exec(),
      this.handovers
        .find(filter)
        .sort({ handoverDateTime: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'contractId', select: 'code status customerName customerPhone totalGrandVnd paidVnd' })
        .populate({ path: 'vehicleId', select: 'licensePlate vehicleType vehicleClass status' })
        .populate({ path: 'pairedPickupHandoverId', select: 'handoverDateTime mileageKm fuelPercent' })
        .populate({ path: 'staffSignerId', select: 'fullName' })
        .populate({ path: 'guideId', select: 'fullName phone' })
        .populate({ path: 'verifiedById', select: 'fullName' })
        .exec(),
    ])
    return { page, limit, total, items: items.map(this.serializeHandover) }
  }

  async getHandoverById(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã biên bản không hợp lệ')
    const doc = await this.handovers
      .findById(oid)
      .populate({ path: 'contractId', select: 'code status customerName customerPhone customerEmail pickupDateTime returnDateTime pickupLocation returnLocation' })
      .populate({ path: 'vehicleId', select: 'licensePlate vehicleType vehicleClass brand color mileageKm status' })
      .populate({ path: 'pairedPickupHandoverId', select: 'handoverDateTime mileageKm fuelPercent checklist damagePhotos' })
      .populate({ path: 'staffSignerId', select: 'fullName email phone' })
      .populate({ path: 'guideId', select: 'fullName email phone' })
      .populate({ path: 'verifiedById', select: 'fullName' })
      .exec()
    if (!doc) throw new NotFoundException('Không tìm thấy biên bản giao/thu hồi xe')
    return this.serializeHandover(doc)
  }

  async createHandover(dto: CreateHandoverDto, actor?: { id: string; role: string }) {
    const contractId = id(dto.contractId)
    const vehicleId = id(dto.vehicleId)
    const paired = id(dto.pairedPickupHandoverId)
    const staffSignerId = id(dto.staffSignerId) ?? (actor?.id ? id(actor.id) : null)
    const guideId = id(dto.guideId)
    const c = await this.contracts.findById(contractId).exec()
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng')
    if (!c.assignedVehicleIds?.map((x) => String(x)).includes(String(vehicleId))) {
      throw new BadRequestException('Xe không thuộc danh sách xe đã gắn cho hợp đồng này.')
    }
    const doc = await this.handovers.create({
      handoverType: dto.handoverType,
      status: dto.checklist.length ? 'in_progress' : 'pending',
      contractId,
      vehicleId,
      pairedPickupHandoverId: paired,
      handoverDateTime: dto.handoverDateTime,
      locationAddress: dto.locationAddress.trim(),
      customerSignerName: dto.customerSignerName.trim(),
      customerSignerCitizenId: dto.customerSignerCitizenId.trim(),
      customerSignerPhone: norm(dto.customerSignerPhone),
      staffSignerId,
      guideId,
      checklist: dto.checklist,
      damagePhotos: dto.damagePhotos || [],
      mileageKm: dto.mileageKm,
      fuelPercent: dto.fuelPercent,
      dailyKmLimit: dto.dailyKmLimit,
      additionalDamages: norm(dto.additionalDamages),
      customerComments: norm(dto.customerComments),
      internalNotes: norm(dto.internalNotes),
    } as Partial<VehicleHandover>)
    if (dto.handoverType === 'pickup' && c.status !== 'in_progress') {
      void this.contractAction(String(c._id), { action: 'mark_in_progress' }, actor).catch(() => {})
    }
    return this.serializeHandover(await this.handovers.findById(doc._id).exec())
  }

  async updateHandover(idStr: string, dto: UpdateHandoverDto) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã biên bản không hợp lệ')
    const h = await this.handovers.findById(oid).exec()
    if (!h) throw new NotFoundException('Không tìm thấy biên bản')
    if (['verified', 'canceled', 'signed'].includes(h.status)) {
      throw new BadRequestException(`Biên bản đã ${h.status} không sửa được (hủy nếu cần).`)
    }
    const patch: Record<string, any> = {}
    if (dto.handoverType !== undefined) patch.handoverType = dto.handoverType
    if (dto.contractId !== undefined) patch.contractId = id(dto.contractId)
    if (dto.vehicleId !== undefined) patch.vehicleId = id(dto.vehicleId)
    if (dto.pairedPickupHandoverId !== undefined) patch.pairedPickupHandoverId = id(dto.pairedPickupHandoverId)
    if (dto.handoverDateTime !== undefined) patch.handoverDateTime = dto.handoverDateTime
    if (dto.locationAddress !== undefined) patch.locationAddress = dto.locationAddress?.trim()
    if (dto.customerSignerName !== undefined) patch.customerSignerName = dto.customerSignerName.trim()
    if (dto.customerSignerCitizenId !== undefined) patch.customerSignerCitizenId = dto.customerSignerCitizenId.trim()
    if (dto.customerSignerPhone !== undefined) patch.customerSignerPhone = norm(dto.customerSignerPhone)
    if (dto.staffSignerId !== undefined) patch.staffSignerId = id(dto.staffSignerId)
    if (dto.guideId !== undefined) patch.guideId = id(dto.guideId)
    if (dto.checklist !== undefined) patch.checklist = dto.checklist
    if (dto.damagePhotos !== undefined) patch.damagePhotos = dto.damagePhotos
    if (dto.mileageKm !== undefined) patch.mileageKm = dto.mileageKm
    if (dto.fuelPercent !== undefined) patch.fuelPercent = dto.fuelPercent
    if (dto.dailyKmLimit !== undefined) patch.dailyKmLimit = dto.dailyKmLimit
    if (dto.additionalDamages !== undefined) patch.additionalDamages = norm(dto.additionalDamages)
    if (dto.customerComments !== undefined) patch.customerComments = norm(dto.customerComments)
    if (dto.internalNotes !== undefined) patch.internalNotes = norm(dto.internalNotes)
    if (dto.checklist !== undefined && Array.isArray(dto.checklist) && dto.checklist.length > 0 && h.status === 'pending') {
      patch.status = 'in_progress'
    }
    const updated = await this.handovers.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeHandover(updated)
  }

  async handoverAction(idStr: string, action: any, actor?: { id: string; role: string }) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã biên bản không hợp lệ')
    const h = await this.handovers.findById(oid).exec()
    if (!h) throw new NotFoundException('Không tìm thấy biên bản')
    let patch: Record<string, any> | null = null
    switch (action.action) {
      case 'start':
        if (!['pending'].includes(h.status)) throw new BadRequestException('Biên bản phải PENDING mới bắt đầu kiểm tra')
        patch = { status: 'in_progress' }
        break
      case 'sign':
        if (!['pending', 'in_progress'].includes(h.status)) throw new BadRequestException('Biên bản đã ký rồi')
        patch = { status: 'signed', signedAt: new Date() }
        if (h.handoverType === 'pickup') {
          void this.contracts.findByIdAndUpdate(h.contractId, { $set: { pickupHandoverId: oid } }).exec()
          const c = await this.contracts.findById(h.contractId).exec()
          if (c && ['signed', 'deposit_paid'].includes(c.status)) {
            void this.contractAction(String(c._id), { action: 'mark_in_progress' }, actor).catch(() => {})
          }
          if (c && c.status === 'draft') {
            void this.contractAction(String(c._id), { action: 'sign' }, actor).catch(() => {})
          }
        } else if (h.handoverType === 'return') {
          void this.contracts.findByIdAndUpdate(h.contractId, { $set: { returnHandoverId: oid } }).exec()
        }
        break
      case 'verify':
        if (h.status !== 'signed') throw new BadRequestException('Biên bản cần được KÝ trước khi VP xác nhận')
        patch = { status: 'verified', verifiedById: actor?.id ? id(actor.id) : h.verifiedById ?? null, verifiedAt: new Date() }
        break
      case 'cancel':
        if (h.status === 'verified') throw new BadRequestException('Biên bản đã XÁC NHẬN không hủy được')
        patch = { status: 'canceled' }
        break
      default:
        throw new BadRequestException('Hành động không hợp lệ')
    }
    const updated = await this.handovers.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeHandover(updated)
  }

  private serializeHandover(h: any) {
    const status = String(h.status || 'pending')
    const type = String(h.handoverType || 'pickup')
    return {
      id: String(h._id ?? h.id),
      handoverType: type,
      handoverTypeLabel: HANDOVER_TYPE_LABELS[type as keyof typeof HANDOVER_TYPE_LABELS] || type,
      status,
      statusLabel: HANDOVER_STATUS_LABELS[status as keyof typeof HANDOVER_STATUS_LABELS] || status,
      statusTone: HANDOVER_STATUS_TONES[status as keyof typeof HANDOVER_STATUS_TONES] || 'bg-slate-100 text-slate-700 ring-slate-200',
      contractId: h.contractId ? String(typeof h.contractId === 'object' ? h.contractId?._id ?? h.contractId : h.contractId) : null,
      contractSummary: typeof h.contractId === 'object' && h.contractId
        ? {
            code: String(h.contractId.code ?? ''),
            status: String(h.contractId.status ?? ''),
            customerName: String(h.contractId.customerName ?? ''),
            customerPhone: String(h.contractId.customerPhone ?? ''),
            totalGrandVnd: Number(h.contractId.totalGrandVnd || 0),
            paidVnd: Number(h.contractId.paidVnd || 0),
          }
        : null,
      vehicleId: h.vehicleId ? String(typeof h.vehicleId === 'object' ? h.vehicleId?._id ?? h.vehicleId : h.vehicleId) : null,
      vehicle: typeof h.vehicleId === 'object' && h.vehicleId
        ? {
            id: String(h.vehicleId._id),
            licensePlate: String(h.vehicleId.licensePlate ?? ''),
            vehicleType: h.vehicleId.vehicleType ?? null,
            vehicleTypeLabel: h.vehicleId.vehicleType ? (VEHICLE_TYPE_LABELS[h.vehicleId.vehicleType as VehicleType] || String(h.vehicleId.vehicleType)) : null,
            vehicleClass: h.vehicleId.vehicleClass ?? null,
            vehicleClassLabel: h.vehicleId.vehicleClass ? (VEHICLE_CLASS_LABELS[h.vehicleId.vehicleClass as VehicleClass] || String(h.vehicleId.vehicleClass)) : null,
            status: h.vehicleId.status ?? null,
          }
        : null,
      pairedPickupHandoverId: h.pairedPickupHandoverId ? String(typeof h.pairedPickupHandoverId === 'object' ? h.pairedPickupHandoverId?._id ?? h.pairedPickupHandoverId : h.pairedPickupHandoverId) : null,
      pairedPickupSummary: typeof h.pairedPickupHandoverId === 'object' && h.pairedPickupHandoverId
        ? {
            handoverDateTime: h.pairedPickupHandoverId.handoverDateTime ? new Date(h.pairedPickupHandoverId.handoverDateTime).toISOString() : null,
            mileageKm: Number(h.pairedPickupHandoverId.mileageKm || 0),
            fuelPercent: Number(h.pairedPickupHandoverId.fuelPercent || 0),
          }
        : null,
      handoverDateTime: h.handoverDateTime ? new Date(h.handoverDateTime).toISOString() : null,
      locationAddress: String(h.locationAddress ?? ''),
      customerSignerName: String(h.customerSignerName ?? ''),
      customerSignerCitizenId: String(h.customerSignerCitizenId ?? ''),
      customerSignerPhone: h.customerSignerPhone ?? null,
      staffSignerId: h.staffSignerId ? String(typeof h.staffSignerId === 'object' ? h.staffSignerId?._id ?? h.staffSignerId : h.staffSignerId) : null,
      staffSigner: typeof h.staffSignerId === 'object' && h.staffSignerId
        ? { id: String(h.staffSignerId._id), fullName: String(h.staffSignerId.fullName ?? '') }
        : null,
      guideId: h.guideId ? String(typeof h.guideId === 'object' ? h.guideId?._id ?? h.guideId : h.guideId) : null,
      guide: typeof h.guideId === 'object' && h.guideId
        ? { id: String(h.guideId._id), fullName: String(h.guideId.fullName ?? ''), phone: h.guideId.phone ?? null }
        : null,
      checklist: Array.isArray(h.checklist) ? h.checklist : [],
      damagePhotos: Array.isArray(h.damagePhotos) ? h.damagePhotos : [],
      mileageKm: Number(h.mileageKm || 0),
      fuelPercent: Number(h.fuelPercent || 0),
      dailyKmLimit: Number(h.dailyKmLimit || 200),
      additionalDamages: h.additionalDamages ?? null,
      customerComments: h.customerComments ?? null,
      signedAt: h.signedAt ? new Date(h.signedAt).toISOString() : null,
      verifiedById: h.verifiedById ? String(typeof h.verifiedById === 'object' ? h.verifiedById?._id ?? h.verifiedById : h.verifiedById) : null,
      verifiedBy: typeof h.verifiedById === 'object' && h.verifiedById
        ? { id: String(h.verifiedById._id), fullName: String(h.verifiedById.fullName ?? '') }
        : null,
      verifiedAt: h.verifiedAt ? new Date(h.verifiedAt).toISOString() : null,
      internalNotes: h.internalNotes ?? null,
      createdAt: h.createdAt ? new Date(h.createdAt).toISOString() : null,
      updatedAt: h.updatedAt ? new Date(h.updatedAt).toISOString() : null,
    }
  }

  /* ================= SETTLEMENT (Tổng kết cuối) ================= */
  private async nextSettlementCode() {
    const prefix = 'STL'
    const count = await this.settlements.countDocuments({ createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } }).exec()
    return `${prefix}-${yymm()}-${pad(count + 1, 3)}`
  }

  async listSettlements(q: ListSettlementsDto) {
    const page = Math.max(1, Number(q.page) || 1)
    const limit = Math.max(1, Number(q.limit) || 50)
    const skip = (page - 1) * limit
    const filter: Record<string, any> = {}
    if (q.status) filter.status = q.status
    if (q.contractId) filter.contractId = id(q.contractId)
    if (q.fromDate || q.toDate) {
      const r: Record<string, Date> = {}
      if (q.fromDate) r.$gte = q.fromDate
      if (q.toDate) r.$lte = q.toDate
      filter.createdAt = r
    }
    if (q.q) {
      const like = { $regex: String(q.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
      filter.$or = [{ code: like }]
    }
    const [total, items] = await Promise.all([
      this.settlements.countDocuments(filter).exec(),
      this.settlements
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: 'contractId', select: 'code status customerName customerPhone totalGrandVnd paidVnd' })
        .populate({ path: 'returnHandoverId', select: 'handoverType status handoverDateTime vehicleId' })
        .populate({ path: 'settledById', select: 'fullName' })
        .exec(),
    ])
    return { page, limit, total, items: items.map(this.serializeSettlement) }
  }

  async getSettlementById(idStr: string) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã bảng kê không hợp lệ')
    const doc = await this.settlements
      .findById(oid)
      .populate({ path: 'contractId', select: 'code status customerName customerPhone citizenId totalGrandVnd paidVnd depositPaidVnd collateralCashVnd depositPapersHeld pickupDateTime returnDateTime pickupHandoverId' })
      .populate({ path: 'returnHandoverId', select: 'handoverDateTime vehicleId mileageKm fuelPercent checklist damagePhotos additionalDamages' })
      .populate({ path: 'settledById', select: 'fullName email phone' })
      .exec()
    if (!doc) throw new NotFoundException('Không tìm thấy bảng kê thanh toán cuối')
    return this.serializeSettlement(doc)
  }

  async createSettlement(dto: CreateSettlementDto, actor?: { id: string; role: string }) {
    const contractId = id(dto.contractId)
    const returnHandoverId = id(dto.returnHandoverId)
    const c = await this.contracts.findById(contractId).exec()
    if (!c) throw new NotFoundException('Không tìm thấy hợp đồng')
    if (c.settlementId) throw new BadRequestException('Hợp đồng này đã có bảng kê thanh toán cuối, mở ra xem/sửa.')
    const code = await this.nextSettlementCode()
    const doc = await this.settlements.create({
      code,
      status: 'draft',
      contractId,
      returnHandoverId,
      lineItems: dto.lineItems || [],
      excessKm: dto.excessKm,
      excessKmRateVnd: dto.excessKmRateVnd,
      fuelDeficitLiters: dto.fuelDeficitLiters,
      fuelRatePerLiterVnd: dto.fuelRatePerLiterVnd,
      damagesRepairVnd: dto.damagesRepairVnd,
      lateReturnPenaltyVnd: dto.lateReturnPenaltyVnd,
      cleaningFeeVnd: dto.cleaningFeeVnd,
      otherChargesVnd: dto.otherChargesVnd,
      totalExtraChargesVnd: dto.totalExtraChargesVnd,
      discountsOrRefundsVnd: dto.discountsOrRefundsVnd,
      contractTotalVnd: dto.contractTotalVnd,
      contractPaidVnd: dto.contractPaidVnd,
      customerMustPayVnd: dto.customerMustPayVnd,
      refundToCustomerVnd: dto.refundToCustomerVnd,
      collateralCashReturnedVnd: dto.collateralCashReturnedVnd,
      depositPapersReturned: dto.depositPapersReturned,
      collateralOtherReturned: norm(dto.collateralOtherReturned),
      finalPaidVnd: dto.finalPaidVnd,
      disputeNotes: norm(dto.disputeNotes),
      internalNotes: norm(dto.internalNotes),
      settledById: actor?.id ? id(actor.id) : null,
    } as Partial<VehicleSettlement>)
    await this.contracts.findByIdAndUpdate(contractId, { $set: { settlementId: doc._id } }).exec()
    return this.serializeSettlement(await this.settlements.findById(doc._id).exec())
  }

  async updateSettlement(idStr: string, dto: UpdateSettlementDto) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã bảng kê không hợp lệ')
    const s = await this.settlements.findById(oid).exec()
    if (!s) throw new NotFoundException('Không tìm thấy bảng kê')
    if (['completed', 'paid'].includes(s.status)) {
      throw new BadRequestException(`Bảng kê đã ${s.status}, không sửa được`)
    }
    const patch: Record<string, any> = {}
    if (dto.contractId !== undefined) patch.contractId = id(dto.contractId)
    if (dto.returnHandoverId !== undefined) patch.returnHandoverId = id(dto.returnHandoverId)
    if (dto.lineItems !== undefined) patch.lineItems = dto.lineItems
    if (dto.excessKm !== undefined) patch.excessKm = dto.excessKm
    if (dto.excessKmRateVnd !== undefined) patch.excessKmRateVnd = dto.excessKmRateVnd
    if (dto.fuelDeficitLiters !== undefined) patch.fuelDeficitLiters = dto.fuelDeficitLiters
    if (dto.fuelRatePerLiterVnd !== undefined) patch.fuelRatePerLiterVnd = dto.fuelRatePerLiterVnd
    if (dto.damagesRepairVnd !== undefined) patch.damagesRepairVnd = dto.damagesRepairVnd
    if (dto.lateReturnPenaltyVnd !== undefined) patch.lateReturnPenaltyVnd = dto.lateReturnPenaltyVnd
    if (dto.cleaningFeeVnd !== undefined) patch.cleaningFeeVnd = dto.cleaningFeeVnd
    if (dto.otherChargesVnd !== undefined) patch.otherChargesVnd = dto.otherChargesVnd
    if (dto.totalExtraChargesVnd !== undefined) patch.totalExtraChargesVnd = dto.totalExtraChargesVnd
    if (dto.discountsOrRefundsVnd !== undefined) patch.discountsOrRefundsVnd = dto.discountsOrRefundsVnd
    if (dto.contractTotalVnd !== undefined) patch.contractTotalVnd = dto.contractTotalVnd
    if (dto.contractPaidVnd !== undefined) patch.contractPaidVnd = dto.contractPaidVnd
    if (dto.customerMustPayVnd !== undefined) patch.customerMustPayVnd = dto.customerMustPayVnd
    if (dto.refundToCustomerVnd !== undefined) patch.refundToCustomerVnd = dto.refundToCustomerVnd
    if (dto.collateralCashReturnedVnd !== undefined) patch.collateralCashReturnedVnd = dto.collateralCashReturnedVnd
    if (dto.depositPapersReturned !== undefined) patch.depositPapersReturned = dto.depositPapersReturned
    if (dto.collateralOtherReturned !== undefined) patch.collateralOtherReturned = norm(dto.collateralOtherReturned)
    if (dto.finalPaidVnd !== undefined) patch.finalPaidVnd = dto.finalPaidVnd
    if (dto.disputeNotes !== undefined) patch.disputeNotes = norm(dto.disputeNotes)
    if (dto.internalNotes !== undefined) patch.internalNotes = norm(dto.internalNotes)
    const updated = await this.settlements.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeSettlement(updated)
  }

  async settlementAction(idStr: string, action: any, actor?: { id: string; role: string }) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã bảng kê không hợp lệ')
    const s = await this.settlements.findById(oid).exec()
    if (!s) throw new NotFoundException('Không tìm thấy bảng kê')
    let patch: Record<string, any> | null = null
    switch (action.action) {
      case 'request_payment':
        if (s.status !== 'draft' && s.status !== 'disputed') throw new BadRequestException('Bảng kê phải NHÁP/ĐANG TRANH CHẤP mới yêu cầu thanh toán')
        patch = { status: 'pending_payment' }
        break
      case 'mark_paid':
        if (!['draft', 'pending_payment', 'disputed'].includes(s.status)) throw new BadRequestException('Trạng thái không hợp lệ cho đánh dấu đã thanh toán')
        const paid = action.amount ?? s.customerMustPayVnd ?? 0
        let c = await this.contracts.findById(s.contractId).exec()
        if (c) {
          const newPaid = Number(c.paidVnd || 0) + Number(paid || 0)
          await this.contracts.findByIdAndUpdate(c._id, { $set: { paidVnd: newPaid } }).exec()
        }
        patch = { status: 'paid', finalPaidVnd: s.finalPaidVnd + Number(paid || 0), finalPaidAt: new Date() }
        break
      case 'return_collateral':
        patch = {
          depositPapersReturned: true,
          collateralCashReturnedVnd: s.collateralCashReturnedVnd || (() => {
            return 0
          })(),
          collateralReturnedAt: new Date(),
        }
        break
      case 'mark_completed':
        if (!['paid', 'pending_payment', 'draft'].includes(s.status)) throw new BadRequestException('Cần khách thanh toán (hoặc $0) trước khi hoàn tất')
        patch = {
          status: 'completed',
          settledById: actor?.id ? id(actor.id) : s.settledById ?? null,
          completedAt: new Date(),
        }
        const contract = await this.contracts.findById(s.contractId).exec()
        if (contract && contract.status === 'in_progress') {
          void this.contractAction(String(contract._id), { action: 'mark_completed' }, actor).catch(() => {})
        }
        break
      case 'raise_dispute':
        if (s.status === 'completed') throw new BadRequestException('Bảng kê đã hoàn tất, không thể nộp tranh chấp')
        patch = { status: 'disputed', disputeNotes: String(action.disputeNotes || '').trim() }
        break
      case 'cancel':
        if (s.status === 'completed') throw new BadRequestException('Bảng kê đã hoàn tất, không hủy được')
        patch = { status: 'canceled' }
        break
      default:
        throw new BadRequestException('Hành động không hợp lệ')
    }
    const updated = await this.settlements.findByIdAndUpdate(oid, { $set: patch }, { new: true }).exec()
    return this.serializeSettlement(updated)
  }

  private serializeSettlement(s: any) {
    const status = String(s.status || 'draft')
    return {
      id: String(s._id ?? s.id),
      code: String(s.code ?? ''),
      status,
      statusLabel: SETTLEMENT_STATUS_LABELS[status as keyof typeof SETTLEMENT_STATUS_LABELS] || status,
      statusTone: SETTLEMENT_STATUS_TONES[status as keyof typeof SETTLEMENT_STATUS_TONES] || 'bg-slate-100 text-slate-700 ring-slate-200',
      contractId: s.contractId ? String(typeof s.contractId === 'object' ? s.contractId?._id ?? s.contractId : s.contractId) : null,
      contractSummary: typeof s.contractId === 'object' && s.contractId
        ? {
            code: String(s.contractId.code ?? ''),
            status: String(s.contractId.status ?? ''),
            customerName: String(s.contractId.customerName ?? ''),
            customerPhone: String(s.contractId.customerPhone ?? ''),
            totalGrandVnd: Number(s.contractId.totalGrandVnd || 0),
            paidVnd: Number(s.contractId.paidVnd || 0),
          }
        : null,
      returnHandoverId: s.returnHandoverId ? String(typeof s.returnHandoverId === 'object' ? s.returnHandoverId?._id ?? s.returnHandoverId : s.returnHandoverId) : null,
      returnHandoverSummary: typeof s.returnHandoverId === 'object' && s.returnHandoverId
        ? {
            handoverDateTime: s.returnHandoverId.handoverDateTime ? new Date(s.returnHandoverId.handoverDateTime).toISOString() : null,
            status: String(s.returnHandoverId.status ?? ''),
            mileageKm: Number(s.returnHandoverId.mileageKm || 0),
            fuelPercent: Number(s.returnHandoverId.fuelPercent || 0),
          }
        : null,
      lineItems: Array.isArray(s.lineItems) ? s.lineItems : [],
      excessKm: Number(s.excessKm || 0),
      excessKmRateVnd: Number(s.excessKmRateVnd || 0),
      fuelDeficitLiters: Number(s.fuelDeficitLiters || 0),
      fuelRatePerLiterVnd: Number(s.fuelRatePerLiterVnd || 0),
      damagesRepairVnd: Number(s.damagesRepairVnd || 0),
      lateReturnPenaltyVnd: Number(s.lateReturnPenaltyVnd || 0),
      cleaningFeeVnd: Number(s.cleaningFeeVnd || 0),
      otherChargesVnd: Number(s.otherChargesVnd || 0),
      totalExtraChargesVnd: Number(s.totalExtraChargesVnd || 0),
      discountsOrRefundsVnd: Number(s.discountsOrRefundsVnd || 0),
      contractTotalVnd: Number(s.contractTotalVnd || 0),
      contractPaidVnd: Number(s.contractPaidVnd || 0),
      customerMustPayVnd: Number(s.customerMustPayVnd || 0),
      refundToCustomerVnd: Number(s.refundToCustomerVnd || 0),
      collateralCashReturnedVnd: Number(s.collateralCashReturnedVnd || 0),
      depositPapersReturned: Boolean(s.depositPapersReturned),
      collateralOtherReturned: s.collateralOtherReturned ?? null,
      collateralReturnedAt: s.collateralReturnedAt ? new Date(s.collateralReturnedAt).toISOString() : null,
      finalPaidVnd: Number(s.finalPaidVnd || 0),
      finalPaidAt: s.finalPaidAt ? new Date(s.finalPaidAt).toISOString() : null,
      settledById: s.settledById ? String(typeof s.settledById === 'object' ? s.settledById?._id ?? s.settledById : s.settledById) : null,
      settledBy: typeof s.settledById === 'object' && s.settledById
        ? { id: String(s.settledById._id), fullName: String(s.settledById.fullName ?? '') }
        : null,
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
      disputeNotes: s.disputeNotes ?? null,
      internalNotes: s.internalNotes ?? null,
      createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
      updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
    }
  }

  async dashboardStats(role = 'admin') {
    const [inqAll, quotAll, contAll, handAll, setlAll] = await Promise.all([
      this.inquiries.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).exec(),
      this.quotations.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalGrandVnd' } } },
      ]).exec(),
      this.contracts.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$totalGrandVnd' }, paid: { $sum: '$paidVnd' } } },
      ]).exec(),
      this.handovers.aggregate([
        { $group: { _id: { t: '$handoverType', s: '$status' }, count: { $sum: 1 } } },
      ]).exec(),
      this.settlements.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, totalExtra: { $sum: '$totalExtraChargesVnd' }, mustPay: { $sum: '$customerMustPayVnd' }, refund: { $sum: '$refundToCustomerVnd' }, finalPaid: { $sum: '$finalPaidVnd' } } },
      ]).exec(),
    ])
    const inquiries = { byStatus: inqAll.map((r: any) => ({ status: String(r._id), count: Number(r.count || 0) })) } as any
    const quotations = {
      byStatus: quotAll.map((r: any) => ({ status: String(r._id), count: Number(r.count || 0), totalGrandVnd: Number(r.total || 0) })),
      totalGrandAllVnd: quotAll.reduce((acc, r: any) => acc + Number(r.total || 0), 0),
    }
    const contracts = {
      byStatus: contAll.map((r: any) => ({ status: String(r._id), count: Number(r.count || 0), totalGrandVnd: Number(r.total || 0), paidVnd: Number(r.paid || 0) })),
      totalGrandAllVnd: contAll.reduce((acc, r: any) => acc + Number(r.total || 0), 0),
      totalPaidAllVnd: contAll.reduce((acc, r: any) => acc + Number(r.paid || 0), 0),
      openReceivableVnd: Math.max(0, contAll.reduce((acc, r: any) => acc + Math.max(0, Number(r.total || 0) - Number(r.paid || 0)), 0)),
    }
    const handovers = handAll.map((r: any) => ({ type: String(r._id.t), status: String(r._id.s), count: Number(r.count || 0) }))
    const settlements = {
      byStatus: setlAll.map((r: any) => ({ status: String(r._id), count: Number(r.count || 0), totalExtraChargesVnd: Number(r.totalExtra || 0), customerMustPayVnd: Number(r.mustPay || 0), refundToCustomerVnd: Number(r.refund || 0), finalPaidVnd: Number(r.finalPaid || 0) })),
      totalFinalPaidAllVnd: setlAll.reduce((acc, r: any) => acc + Number(r.finalPaid || 0), 0),
      totalExtraChargesAllVnd: setlAll.reduce((acc, r: any) => acc + Number(r.totalExtra || 0), 0),
    }
    return { inquiries, quotations, contracts, handovers, settlements }
  }

  async confirmInquiry(
    idStr: string,
    dto: ConfirmInquiryDto,
    actor: { id: string; role: string },
  ) {
    const oid = id(idStr)
    if (!oid) throw new BadRequestException('Mã yêu cầu không hợp lệ')
    const doc = await this.inquiries.findById(oid).exec()
    if (!doc) throw new NotFoundException('Không tìm thấy yêu cầu thuê xe')
    if (doc.status === 'confirmed' || doc.status === 'quoted' || doc.status === 'converted') {
      throw new BadRequestException('Yêu cầu này đã được xác nhận / báo giá, không thể thực hiện lại')
    }
    if (doc.status !== 'pending' && doc.status !== 'draft') {
      throw new BadRequestException('Trạng thái yêu cầu không hợp lệ để xác nhận')
    }
    const {
      suggestedBaseAmountVnd,
      suggestedDriverFeeVnd,
      suggestedExtrasVnd,
      suggestedDiscountPercent,
      suggestedDepositRequiredVnd,
      suggestedValidUntilDate,
    } = dto

    const rentalDaysVal = (typeof doc.rentalDays === 'number' && doc.rentalDays > 0)
      ? doc.rentalDays
      : Math.max(1, Math.round((doc.returnDateTime.getTime() - doc.pickupDateTime.getTime()) / (1000 * 60 * 60 * 24)))
    const typeFallbackPrices = new Map<VehicleType, number>([
      ['seater_4', 2_800_000], ['seater_7', 3_800_000], ['seater_16', 5_200_000], ['seater_29', 7_800_000], ['seater_45', 9_800_000],
    ])
    const selfDriveFallback = new Map<VehicleType, number>([
      ['seater_4', 1_800_000], ['seater_7', 2_400_000], ['seater_16', 3_600_000], ['seater_29', 0], ['seater_45', 0],
    ])
    const vt = (doc.preferredVehicleType as VehicleType) || 'seater_7'
    const suggestDriverPerDay = Number(suggestedBaseAmountVnd ?? ((typeFallbackPrices.get(vt) ?? 3_800_000) + (doc.withDriver ? 0 : 0)))
    const suggestDriverPerDaySafe = Number.isFinite(suggestDriverPerDay) ? suggestDriverPerDay : 0
    const driverFeeLine = Number(suggestedDriverFeeVnd ?? 0) || 0
    const extrasLine = Number(suggestedExtrasVnd ?? 0) || 0
    const discountPct = Number(suggestedDiscountPercent ?? 0) || 0
    const vatPct = 10
    const validUntil = suggestedValidUntilDate instanceof Date
      ? suggestedValidUntilDate
      : (() => { const d = new Date(doc.pickupDateTime.getTime()); d.setDate(d.getDate() - 3); return d })()

    const customerSlug = slugifyFileNameSafe(doc.customerName || 'QuyKhach')
    const pdfFileName = `Bao-Gia-Thue-Xe_${String(doc.code || 'INQ').toUpperCase()}_${customerSlug}.pdf`
    const pdfAbsPath = join(process.cwd(), 'pdfs', pdfFileName)
    try { await mkdir(join(process.cwd(), 'pdfs'), { recursive: true }) } catch {}

    const customerNameHtml = escapeHtml(doc.customerName || 'Quý khách')
    const customerPhoneHtml = escapeHtml(doc.customerPhone || '—')
    const customerEmailHtml = escapeHtml(doc.customerEmail || '')
    const customerAddrHtml = escapeHtml(doc.customerAddress || '')
    const vehicleTypeLabel = VEHICLE_TYPE_LABELS[vt] || String(doc.preferredVehicleType || 'Không yêu cầu')
    const vehicleClassLabel = doc.preferredVehicleClass ? (VEHICLE_CLASS_LABELS[doc.preferredVehicleClass as VehicleClass] || String(doc.preferredVehicleClass)) : 'Không yêu cầu'
    const codeHtml = escapeHtml(doc.code || '')
    const created = new Date(doc.createdAt || Date.now())
    const confirmedNow = new Date()
    const totalRow = (label: string, amount: number, bold = false, bg = '', colorCls = 'text-slate-900') =>
      `<tr class="${bold ? 'font-black ' + colorCls : 'text-slate-700'}"><td class="p-3 border-b border-slate-100${bg ? ' ' + bg : ''}">${label}</td><td class="p-3 border-b border-slate-100 text-right${bg ? ' ' + bg : ''}">${formatVnd(amount)}</td></tr>`
    const selfDrivePerDaySafe = (Number(doc.withDriver) ? 0 : (selfDriveFallback.get(vt) || 0))
    const baseRentalLine = (doc.withDriver ? suggestDriverPerDaySafe : selfDrivePerDaySafe) * rentalDaysVal
    const excessKmLine = 0
    const deliveryLine = 0
    const subtotalBeforeDiscount = baseRentalLine + driverFeeLine + excessKmLine + deliveryLine + extrasLine
    const discountAmount = Math.round(subtotalBeforeDiscount * Math.max(0, Math.min(100, discountPct)) / 100)
    const totalBeforeTax = Math.max(0, subtotalBeforeDiscount - discountAmount)
    const vatAmount = Math.round(totalBeforeTax * vatPct / 100)
    const totalGrandVnd = totalBeforeTax + vatAmount
    const depositRequiredVnd = Number(suggestedDepositRequiredVnd ?? Math.round(totalGrandVnd * 0.3))
    const totalWords = numToWordsVN(totalGrandVnd)
    const lines = [
      totalRow(`1. Giá thuê xe ${vehicleTypeLabel}${vehicleClassLabel ? ' · ' + vehicleClassLabel : ''} (${rentalDaysVal} ngày × ${formatVnd(doc.withDriver ? suggestDriverPerDaySafe : selfDrivePerDaySafe)}/ngày)`, baseRentalLine),
      totalRow(`2. Phụ thu tài xế${driverFeeLine === 0 ? ' (đã bao gồm trong giá xe / tự lái)' : ''}`, driverFeeLine),
      totalRow(`3. Phụ thu vượt 300km/ngày (đơn giá 3.000 ₫/km khi vượt giới hạn) — chưa phát sinh`, excessKmLine),
      totalRow(`4. Phí giao xe ngoài nội thành / sân bay (miễn phí 30km nội thành, đơn giá 3.000 ₫/km nếu xa) — chưa phát sinh`, deliveryLine),
      totalRow(`5. Dịch vụ bổ sung (Wifi, ghế trẻ em, tài xế tiếng Anh, đồ ăn nhẹ, v.v.)${extrasLine === 0 ? ' — không phát sinh' : ''}`, extrasLine),
      totalRow(`6. Tổng trước chiết khấu & thuế (tổng dòng 1 → 5)`, subtotalBeforeDiscount),
    ]
    if (discountAmount > 0) lines.push(totalRow(`7. Chiết khấu ưu đãi ${discountPct.toFixed(2)}%`, -discountAmount))
    lines.push(totalRow(`${discountAmount > 0 ? '8' : '7'}. Tổng thành tiền trước VAT 10%`, totalBeforeTax))
    lines.push(totalRow(`${discountAmount > 0 ? '9' : '8'}. Thuế GTGT (VAT ${vatPct}%)`, vatAmount))
    lines.push(totalRow(`${discountAmount > 0 ? '10' : '9'}. TỔNG CÔNG THANH TOÁN (đã bao gồm VAT)`, totalGrandVnd, true, 'bg-gradient-to-r from-indigo-50 to-orange-50 ring-1 ring-inset ring-indigo-200', 'text-indigo-800'))
    lines.push(totalRow('💵 Cọc tối thiểu yêu cầu trước 24h (≈ 30% tổng)', depositRequiredVnd, true, 'bg-rose-50', 'text-rose-700'))

    const htmlTemplate = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8" /><title>Báo giá thuê xe ${codeHtml || ''} - ${customerNameHtml || ''}</title>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin:0; padding:0; }
body {
  position: relative;
  font-family: 'Times New Roman', Times, serif;
  color:#0f172a;
  background:#ffffff;
  font-size: 13px;
  line-height: 1.6;
  padding: 22mm 18mm 18mm 18mm;
}
/* ========== WATERMARK C ========== */
body::before{
  content: "B\\00c1O G\\00cd\\00c1";
  position: fixed; inset: 0; margin: auto;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Times New Roman', Times, serif;
  font-size: 130px; font-weight: 900; letter-spacing: 18px;
  color: rgba(79, 70, 229, 0.08);
  transform: rotate(-42deg);
  pointer-events: none;
  white-space: nowrap;
  z-index: 1;
}
body::after{
  content: "B\\1ea2N G\\1ed0C";
  position: fixed; right: 16mm; bottom: 10mm;
  font-family: 'Times New Roman', Times, serif;
  font-size: 14px; font-weight: 900; letter-spacing: 2px;
  color: rgba(234, 88, 12, 0.55);
  border: 1.5px solid rgba(234, 88, 12, 0.45);
  padding: 4px 14px; border-radius: 10px;
  background: rgba(255,255,255,0.6);
  pointer-events: none; z-index: 1;
}
.page-wrap{
  position: relative; z-index: 2;
  min-height: 250mm;
  padding: 10px 14px 20px 14px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
  border-image: linear-gradient(to right, #4f46e5 0%, #2563eb 45%, #f97316 100%) 1;
}
.header {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
  padding-bottom: 14px;
  border-bottom: 2.5px solid #4f46e5;
  border-image: linear-gradient(to right, #4f46e5, #2563eb, #f97316) 1;
}
.logo-wrap { display:flex; align-items:center; gap: 14px; }
.logo-box {
  width: 62px; height: 62px; border-radius: 14px;
  background: linear-gradient(135deg, #4338ca 0%, #2563eb 55%, #f97316 100%);
  display:flex; align-items:center; justify-content:center;
  box-shadow: 0 8px 20px -6px rgba(79,70,229,0.35);
  color:#fff; font-family: Arial, sans-serif; font-weight: 900; letter-spacing: 0.5px;
}
.company h1 {
  margin: 0 0 6px 0;
  font-size: 21px; line-height: 1.15;
  background: linear-gradient(to right, #4338ca, #2563eb, #f97316);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  letter-spacing: 0.2px;
  font-weight: 900;
}
.company p { margin: 2px 0; color:#334155; font-size: 12px; }
.meta-right { text-align: right; color:#475569; font-size: 12.5px; }
.meta-right .code-badge {
  display: inline-block;
  padding: 4px 12px; border-radius: 999px;
  background: linear-gradient(to right, #e0e7ff, #fff7ed);
  border: 1px solid #c7d2fe;
  font-weight: 900; color: #3730a3; font-size: 14.5px; letter-spacing: 0.4px;
  margin-bottom: 6px;
}
.meta-right .status-pill {
  display: inline-block; margin-top: 6px;
  padding: 3px 10px; border-radius: 999px;
  background: #ecfdf5; color:#047857;
  font-weight: 800; border:1px solid #a7f3d0;
  font-size: 12px;
}
.doc-title {
  text-align: center; margin: 20px 0 4px;
  font-size: 25px; letter-spacing: 0.5px;
  font-weight: 900;
  background: linear-gradient(to right, #3730a3 0%, #2563eb 50%, #ea580c 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  text-transform: uppercase;
}
.doc-subtitle{
  text-align: center; color: #475569; font-style: italic; margin: 0 0 18px; font-size: 12.5px;
}
.section-title {
  margin: 16px 0 10px;
  padding: 6px 14px;
  background: linear-gradient(to right, #eef2ff, #fff7ed);
  color: #3730a3;
  font-weight: 900; font-size: 14px;
  border-left: 4px solid #f97316;
  border-radius: 0 8px 8px 0;
  letter-spacing: 0.2px;
}
.info-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
.info-grid .row { display: contents; }
.info-grid dt { color:#64748b; font-weight: 700; }
.info-grid dd { margin: 0 0 6px 0; color:#0f172a; font-weight: 600; }
.greeting {
  margin: 10px 0 4px 0;
  padding: 10px 14px;
  border-radius: 10px;
  background: linear-gradient(to right, #eef2ff 0%, #eff6ff 45%, #fff7ed 100%);
  border:1px solid #e0e7ff;
  font-size: 13px;
  color:#1e293b;
  font-style: italic;
}
.price-table { width:100%; border-collapse: collapse; margin-top: 8px; background:#ffffff; font-size: 13px; }
.price-table thead th {
  background: linear-gradient(to right, #4338ca, #2563eb, #f97316);
  color:#ffffff; font-weight: 900; text-align: left;
  padding: 10px 12px;
  letter-spacing: 0.3px;
  border: none;
}
.price-table thead th + th { text-align: right; }
.total-words {
  margin-top: 10px; padding: 8px 12px;
  border-left: 4px solid #f97316; border-radius: 0 8px 8px 0;
  background: linear-gradient(to right, #fff7ed, #ffffff);
  color: #9a3412; font-weight: 700; font-size: 13px;
}
.valid-note {
  margin-top: 10px; padding: 8px 12px;
  border-radius: 8px;
  background: #fef2f2; color:#991b1b;
  border: 1px solid #fecaca;
  font-size: 12.5px; font-weight: 600;
}
.terms { font-size: 12.5px; color:#334155; line-height: 1.75; }
.terms ol { margin: 4px 0; padding-left: 20px; }
.terms ol li { margin: 3px 0; }
.sign-wrap {
  margin-top: 22px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px;
  text-align: center; color:#334155; font-size: 13px;
}
.sign-wrap .role { font-weight: 900; color: #0f172a; margin-bottom: 64px; letter-spacing: 0.3px; }
.sign-wrap .hint { color: #64748b; font-style: italic; font-size: 12px; }
.foot-note {
  margin-top: 22px; padding-top: 10px;
  border-top: 1px dashed #cbd5e1;
  text-align: center; color: #64748b; font-size: 11.5px;
}
.tag { display:inline-block; padding:1px 8px; border-radius: 999px; font-size: 11px; font-weight: 700;}
.tag-indigo{ background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe; }
.tag-orange{ background:#ffedd5; color:#9a3412; border:1px solid #fed7aa; }
.tag-sky{ background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; }
</style></head><body>
<div class="page-wrap">

  <!-- ============ HEADER LOGO + CÔNG TY ============ -->
  <div class="header">
    <div class="logo-wrap">
      <!-- ⚠️ TODO: Thay thế <svg> logo inline này bằng ảnh logo thật của công ty (đặt file server/public/logo.png rồi <img src="/logo.png" width="62" height="62" />) -->
      <div class="logo-box" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs><linearGradient id="gVE" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffedd5"/></linearGradient></defs>
          <text x="24" y="34" text-anchor="middle" font-family="Arial" font-weight="900" font-size="20" fill="url(#gVE)">VE</text>
        </svg>
      </div>
      <div class="company">
        <h1>CÔNG TY CỔ PHẦN DỊCH VỤ DU LỊCH VIETNAMEXPLORER</h1>
        <p>🏢 Địa chỉ: Trường Cao đẳng Viễn Đông, Lô 2, Công viên phần mềm Quang Trung, Phường Trung Mỹ Tây, TP. Hồ Chí Minh</p>
        <p>📞 Hotline: <b>1900 1009</b> · ✉️ Email: <b>booking@vietnamexplorer.vn</b> · 🌐 Website: <b>www.vietnamexplorer.vn</b></p>
        <p>📝 MST: <b>03-123.456/789</b> · SĐKKD: 41-0812.3456 cấp ngày 01/01/2020 bởi Sở Kế hoạch &amp; Đầu tư TP.HCM</p>
      </div>
    </div>
    <div class="meta-right">
      <div><span class="code-badge">${codeHtml || 'INQ-TEMP'}</span></div>
      <div>Ngày lập báo giá: <b>${confirmedNow.toLocaleDateString('vi-VN')}</b></div>
      <div>Giờ lập: ${confirmedNow.toLocaleTimeString('vi-VN')}</div>
      <div>Hình thức: <span class="tag tag-indigo">Báo giá dịch vụ</span></div>
      <div><span class="status-pill">✅ ĐƠN HÀNG ĐÃ XÁC NHẬN</span></div>
    </div>
  </div>

  <div class="doc-title">BÁO GIÁ DỊCH VỤ CHO THUÊ XE DU LỊCH</div>
  <div class="doc-subtitle">(Kèm theo các Điều khoản thuê xe &amp; Quy định của Công ty)</div>

  <div class="greeting">
    💐 <b>Kính gửi Anh / Chị ${customerNameHtml},</b><br />
    Cảm ơn Anh/Chị đã quan tâm và tin tưởng chọn dịch vụ cho thuê xe của <b>Công ty Cổ phần Dịch vụ Du lịch VietNamExplorer</b>.
    Dưới đây là chi tiết báo giá dịch vụ thuê xe theo yêu cầu của Quý khách, hy vọng cùng Anh/Chị có chuyến đi thật suôn sẻ và ý nghĩa.
  </div>

  <!-- ============ 1. THÔNG TIN KHÁCH HÀNG ============ -->
  <div class="section-title">1. Thông tin khách hàng (Người đặt / Người thanh toán)</div>
  <dl class="info-grid">
    <div class="row"><dt>Họ &amp; tên liên hệ:</dt><dd>${customerNameHtml}</dd></div>
    <div class="row"><dt>Điện thoại (Zalo / Viber):</dt><dd>${customerPhoneHtml}</dd></div>
    <div class="row"><dt>Email:</dt><dd>${customerEmailHtml || '<span style="color:#94a3b8">(Chưa cung cấp)</span>'}</dd></div>
    <div class="row"><dt>Địa chỉ liên hệ:</dt><dd>${customerAddrHtml || '<span style="color:#94a3b8">(Chưa cung cấp)</span>'}</dd></div>
  </dl>

  <!-- ============ 2. THÔNG TIN YÊU CẦU & XE ============ -->
  <div class="section-title">2. Chi tiết lịch trình &amp; yêu cầu xe</div>
  <dl class="info-grid">
    <div class="row"><dt>Loại xe khách chọn:</dt><dd><span class="tag tag-indigo">${vehicleTypeLabel}</span></dd></div>
    <div class="row"><dt>Phân hạng xe (Class):</dt><dd><span class="tag tag-orange">${vehicleClassLabel}</span></dd></div>
    <div class="row"><dt>Quy cách dịch vụ:</dt><dd>${doc.withDriver ? '👨‍✈️ <b>Có tài xế lái chuyên nghiệp</b> (khuyên dùng)' : '🚘 <b>Tự lái</b> (yêu cầu GPLX hạng tương ứng)'}</dd></div>
    <div class="row"><dt>Số chỗ xe tối thiểu:</dt><dd>${(typeof doc.seatCountMin === 'number' && doc.seatCountMin > 0) ? (doc.seatCountMin + ' chỗ') : '<span style="color:#64748b">Không yêu cầu</span>'}</dd></div>
    <div class="row"><dt>Số hành khách dự kiến:</dt><dd><b>${Number(doc.passengerCount || 1)}</b> khách (người lớn + trẻ em)</dd></div>
    <div class="row"><dt>Số hành lý (vali/túi xách):</dt><dd><b>${Number(doc.luggageCount || 0)}</b> vali</dd></div>
    <div class="row"><dt>🕒 Thời gian nhận xe:</dt><dd><b>${new Date(doc.pickupDateTime).toLocaleString('vi-VN')}</b></dd></div>
    <div class="row"><dt>📍 Địa điểm nhận xe:</dt><dd>${escapeHtml(doc.pickupLocation || '—')}</dd></div>
    <div class="row"><dt>🕒 Thời gian trả xe:</dt><dd><b>${new Date(doc.returnDateTime).toLocaleString('vi-VN')}</b></dd></div>
    <div class="row"><dt>📍 Địa điểm trả xe:</dt><dd>${escapeHtml(doc.returnLocation || '—')}</dd></div>
    <div class="row"><dt>📅 Tổng số ngày thuê:</dt><dd><span class="tag tag-sky">${rentalDaysVal} ngày</span></dd></div>
    <div class="row"><dt>💬 Yêu cầu khác của KH:</dt><dd>${doc.specialRequests ? escapeHtml(doc.specialRequests) : '<span style="color:#64748b">Không</span>'}</dd></div>
  </dl>
  ${doc.routeNotes ? `<div style="margin-top:6px"><b>🗺️ Lộ trình / Tuyến đường dự kiến:</b> <span style="color:#0f172a">${escapeHtml(doc.routeNotes || '')}</span></div>` : ''}

  <!-- ============ 3. BẢNG GIÁ CHI TIẾT ============ -->
  <div class="section-title">3. Bảng chi tiết giá (ĐVT: VNĐ - đã bao gồm thuế nếu có ghi chú)</div>
  <table class="price-table">
    <thead>
      <tr>
        <th style="width:76%; border-radius: 8px 0 0 0;">NỘI DUNG CHI TIẾT</th>
        <th style="border-radius: 0 8px 0 0;">THÀNH TIỀN (VNĐ)</th>
      </tr>
    </thead>
    <tbody>${lines.join('')}</tbody>
  </table>
  <div class="total-words">✍️ <b>Tổng cộng bằng chữ:</b> ${totalWords}</div>
  <div class="valid-note">⚠️ <b>Báo giá này có hiệu lực đến ngày ${validUntil.toLocaleDateString('vi-VN')}</b>. Quá thời hạn trên, giá thuê xe có thể được điều chỉnh lại phù hợp với tình hình thị trường. Sau 24h không đặt cọc, đơn hàng sẽ tự động hủy không báo trước.</div>

  <!-- ============ 4. ĐIỀU KHOẢN & CHÍNH SÁCH ============ -->
  <div class="section-title">4. Điều khoản &amp; Chính sách áp dụng (Quý khách vui lòng đọc kỹ trước khi ký xác nhận)</div>
  <div class="terms">
    <ol>
      <li><b>Chính sách đặt cọc:</b> Quý khách vui lòng đặt cọc <b>30% tổng giá trị hợp đồng</b> (hoặc tối thiểu ${formatVnd(depositRequiredVnd)}) trong vòng <b>24 giờ</b> kể từ ngày nhận Báo giá để giữ xe. Số còn lại thanh toán <b>khi nhận xe</b> (tiền mặt / chuyển khoản công ty).</li>
      <li><b>Chính sách hủy &amp; hoàn tiền:</b>
        <ul style="margin:2px 0 0 18px; padding:0">
          <li>Hủy trước <b>≥ 7 ngày</b> so với ngày nhận xe: hoàn trả <b>100%</b> số tiền cọc.</li>
          <li>Hủy từ <b>3 → 7 ngày</b>: hoàn trả <b>50%</b> số tiền cọc.</li>
          <li>Hủy <b>trong vòng 3 ngày</b> / Không đến nhận xe (no-show): <b>không hoàn trả</b> tiền cọc.</li>
        </ul>
      </li>
      <li><b>Bảo hiểm &amp; trách nhiệm xe:</b> Xe luôn được ký <b>Bảo hiểm TNDS (tối thiểu 500 triệu người/vụ)</b> + Bảo hiểm vật chất xe đầy đủ theo quy định pháp luật. Trong quá trình thuê, nếu xảy ra tai nạn hoặc thiệt hại xe do lỗi phía khách hàng, quý khách chịu trách nhiệm bồi thường đúng giá trị thiệt hại (đã trừ hao mòn).</li>
      <li><b>Trách nhiệm của 2 bên:</b>
        <ul style="margin:2px 0 0 18px; padding:0">
          <li><b>Công ty VietNamExplorer:</b> giao xe đúng hạng, đủ giấy tờ hợp pháp, tài xế chuyên nghiệp, hỗ trợ 24/7 trong quá trình thuê; vệ sinh khử khuẩn xe trước &amp; sau mỗi chuyến.</li>
          <li><b>Khách hàng:</b> sử dụng xe đúng mục đích, không vượt quá tải trọng/số khách cho phép; không lái xe nếu đã uống rượu bia; không cho người khác (không ký hợp đồng) thay thế lái xe nếu thuê tự lái.</li>
        </ul>
      </li>
      <li><b>Quy định quãng đường &amp; phụ thu phát sinh:</b>
        <ul style="margin:2px 0 0 18px; padding:0">
          <li>Giới hạn miến phí: <b>300 km/ngày</b>; Vượt giới hạn tính <b>3.000 ₫/km</b> (xe 4-16 chỗ) hoặc <b>5.000 ₫/km</b> (xe 29 chỗ trở lên).</li>
          <li>Giờ thuê thêm (qua thời gian trả xe đã thống nhất): tính <b>200.000 ₫/giờ</b> (4-7 chỗ) / <b>350.000 ₫/giờ</b> (16 chỗ trở lên).</li>
          <li>Phí giao / nhận xe ngoài 30km nội thành: tính <b>3.000 ₫/km</b> khứ hồi tài xế vận chuyển xe.</li>
        </ul>
      </li>
      <li><b>Hiệu lực báo giá:</b> Báo giá này có hiệu lực <b>7 ngày</b> kể từ ngày lập (đã nêu rõ trên). Sau thời gian hiệu lực, đơn đặt cọc sẽ được xem xét lại giá theo quy định của công ty.</li>
    </ol>
  </div>

  <!-- ============ 5. KÝ XÁC NHẬN ============ -->
  <div class="sign-wrap">
    <div>
      <div class="role">NGƯỜI LẬP BÁO GIÁ<br />(${confirmedNow.toLocaleDateString('vi-VN')})</div>
      <div class="hint">(Ký, ghi rõ họ tên &amp; chức vụ)</div>
    </div>
    <div>
      <div class="role">KHÁCH HÀNG XÁC NHẬN &amp; ĐỒNG Ý<br />(${confirmedNow.toLocaleDateString('vi-VN')})</div>
      <div class="hint">(Ký, ghi rõ họ tên &amp; số điện thoại liên hệ)</div>
    </div>
  </div>

  <div class="foot-note">
    Báo giá này được lập tự động từ Hệ thống Quản lý Du lịch &amp; Cho thuê xe VietNamExplorer CMS v2 · Mọi thắc mắc vui lòng liên hệ <b>Hotline 1900 1009</b> (8h-22h tất cả các ngày trong tuần) · Trân trọng cảm ơn!
  </div>

</div>
</body></html>`

    let pdfPathReturned: string | null = null
    try {
      const puppeteer = await (Function('return import("puppeteer")')() as Promise<typeof import('puppeteer')>)
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      })
      try {
        const page = await browser.newPage()
        await page.setContent(htmlTemplate, { waitUntil: 'domcontentloaded', timeout: 60_000 })
        await page.pdf({
          path: pdfAbsPath,
          format: 'A4',
          printBackground: true,
          margin: { top: '8mm', bottom: '10mm', left: '8mm', right: '8mm' },
          preferCSSPageSize: true,
          displayHeaderFooter: false,
        })
      } finally {
        try { await browser.close() } catch {}
      }
      if (fs.existsSync(pdfAbsPath)) {
        pdfPathReturned = `/pdfs/${encodeURIComponent(pdfFileName)}`
      }
    } catch (e) {
      const msg = String((e as any)?.message || e || '')
      // Nếu puppeteer không chạy được (không có chromium) → vẫn trả về xác nhận nhưng không tạo PDF file.
      if (msg.length > 0) {
        try { this.notifications.create({ recipientId: new Types.ObjectId(actor.id), recipientRole: (actor.role as any) ?? 'admin', type: 'admin_server_error' as NotificationType, title: 'Tạo PDF xác nhận thuê xe gặp lỗi (Puppeteer)', body: `Mã yêu cầu ${String(doc.code || '')} - Lỗi: ${msg.slice(0, 400)}`, priority: 'high', channels: ['in_app'] }).catch(() => {}) } catch {}
      }
    }

    const finalBodyText = dto.customNotifBody?.trim()
      ? dto.customNotifBody.trim()
      : `Chào ${customerNameHtml || 'bạn'}, yêu cầu thuê xe ${vehicleTypeLabel} của bạn đã được nhân viên xác nhận. Trong 2 giờ làm việc tới bộ phận CSKH sẽ gọi điện SĐT ${customerPhoneHtml} để trao đổi chi tiết & hướng dẫn đặt cọc giữ xe. Phiếu báo giá xác nhận PDF đã sẵn sàng tải trong mục Tài khoản > Thuê xe của tôi hoặc mục Thông báo.`
    const finalTitle = dto.customNotifTitle?.trim()
      ? dto.customNotifTitle.trim()
      : `Yêu cầu ${String(doc.code || 'INQ')} đã được xác nhận`

    doc.status = 'confirmed'
    doc.confirmedAt = confirmedNow
    doc.confirmedByStaffId = new Types.ObjectId(actor.id)
    doc.quotationPdfUrlPath = pdfPathReturned
    if (pdfPathReturned) doc.quotationPdfGeneratedAt = confirmedNow
    doc.confirmedNotifBody = finalBodyText
    await doc.save()

    if (doc.customerUserId && String(doc.customerUserId).length > 0) {
      try {
        await this.notifications.create({
          recipientId: doc.customerUserId as Types.ObjectId,
          recipientRole: 'customer',
          type: 'rental_inquiry_confirmed' as NotificationType,
          title: finalTitle,
          body: finalBodyText,
          entityType: 'vehicle_inquiry',
          entityId: doc._id,
          actionUrl: '/account/rentals?tab=inq',
          payload: {
            inquiryId: String(doc._id),
            inquiryCode: doc.code,
            confirmedAt: confirmedNow.toISOString(),
            totalGrandVnd,
            depositRequiredVnd,
            validUntil: validUntil.toISOString(),
            pdfDownloadUrl: pdfPathReturned,
          },
          channels: ['in_app', 'email'],
          priority: 'high',
          senderUserId: new Types.ObjectId(actor.id),
        })
      } catch {}
    }
    // Notify owner staff + admin
    const bulkToSend: CreateNotificationInput[] = []
    const confirmedBy = new Types.ObjectId(actor.id)
    if (doc.ownerStaffId && String(doc.ownerStaffId) !== String(confirmedBy)) {
      bulkToSend.push({
        recipientId: doc.ownerStaffId as Types.ObjectId,
        recipientRole: 'staff',
        type: 'admin_rental_inquiry_confirmed' as NotificationType,
        title: `Yêu cầu ${String(doc.code || '')} đã được xác nhận`,
        body: `Yêu cầu khách ${customerNameHtml || ''} (${customerPhoneHtml}) đã được ${actor.role === 'admin' ? 'Admin' : 'Nhân viên'} xác nhận. ${pdfPathReturned ? 'PDF đã được tạo trong thư mục pdfs.' : 'Lưu ý: tạo PDF không thành công, kiểm tra cấu hình Puppeteer.'}`,
        entityType: 'vehicle_inquiry',
        entityId: doc._id,
        actionUrl: '/admin/rentals',
        payload: { inquiryId: String(doc._id), inquiryCode: doc.code, pdfDownloadUrl: pdfPathReturned, totalGrandVnd, depositRequiredVnd },
        priority: 'medium',
        channels: ['in_app'],
        senderUserId: confirmedBy,
      })
    }
    if (bulkToSend.length) {
      try { await this.notifications.bulk(bulkToSend) } catch {}
    }

    const refreshed = await this.inquiries.findById(doc._id)
      .populate({ path: 'customerUserId', select: 'fullName email phone' })
      .populate({ path: 'ownerStaffId', select: 'fullName email phone' })
      .populate({ path: 'confirmedByStaffId', select: 'fullName email phone' })
      .exec()
    return {
      inquiry: refreshed ? this.serializeInquiry(refreshed) : this.serializeInquiry(doc),
      pdfDownloadUrl: pdfPathReturned,
      totalGrandVnd,
      depositRequiredVnd,
      vatAmount,
      validUntil: validUntil.toISOString(),
    }
  }

  async aggregatePublicVehicleOptions() {
    type AggRow = {
      _id: VehicleType
      maxSeats: number
      avgDriver: number
      avgSelfDrive: number
      sampleDisplayName: string | null
      sampleSuitability: string | null
      count: number
    }
    const rows: AggRow[] = await this.vehicles.aggregate< AggRow >([
      {
        $match: {
          $or: [
            { showInPublicOptions: { $eq: true } },
            { showInPublicOptions: { $exists: false } },
          ],
          status: { $in: ['available', 'in_trip', 'maintenance'] as VehicleStatus[] },
        },
      },
      {
        $group: {
          _id: '$vehicleType' as any,
          maxSeats: { $max: { $ifNull: ['$seatCount', 0] } },
          avgDriver: { $avg: { $ifNull: ['$rentalPricePerDayVnd', 0] } },
          avgSelfDrive: { $avg: { $ifNull: ['$rentalSelfDrivePricePerDayVnd', 0] } },
          sampleDisplayName: { $first: { $ifNull: ['$publicDisplayName', null] } },
          sampleSuitability: { $first: { $ifNull: ['$publicSuitability', null] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]).exec()
    const byType = new Map<VehicleType, AggRow>()
    for (const r of rows) byType.set(r._id, r)
    const types = VEHICLE_TYPES
      .map((vt) => {
        const row = byType.get(vt)
        const fallbackSeats = VEHICLE_TYPE_SEATS[vt] ?? 0
        const seats = (row && row.maxSeats && row.maxSeats > 0) ? row.maxSeats : fallbackSeats
        const label = (row && row.sampleDisplayName) || VEHICLE_TYPE_LABELS[vt] || vt
        const suitability = (row && row.sampleSuitability) || VEHICLE_TYPE_SUITABILITY[vt] || ''
        const avgDriver = row ? Math.round(Number(row.avgDriver) || 0) : 0
        const avgSelfDrive = row ? Math.round(Number(row.avgSelfDrive) || 0) : 0
        const hasDataInDb = !!row && row.count > 0
        const suggestDriverDailyVnd = avgDriver > 0
          ? avgDriver
          : ({
            seater_4: 2_800_000,
            seater_7: 3_800_000,
            seater_16: 5_200_000,
            seater_29: 7_800_000,
            seater_45: 9_800_000,
          } as Record<VehicleType, number>)[vt]
        const suggestSelfDriveDailyVnd = avgSelfDrive > 0
          ? avgSelfDrive
          : ({
            seater_4: 1_800_000,
            seater_7: 2_400_000,
            seater_16: 3_600_000,
            seater_29: 0,
            seater_45: 0,
          } as Record<VehicleType, number>)[vt]
        return {
          value: vt as VehicleType,
          label,
          seats,
          suitability,
          suggestDriverDailyVnd,
          suggestSelfDriveDailyVnd,
          hasDataInDb,
          vehicleCountInDb: row?.count ?? 0,
        }
      })
    const classes = VEHICLE_CLASSES.map((vc) => ({
      value: vc as VehicleClass,
      label: VEHICLE_CLASS_LABELS[vc] ?? vc,
      tone: VEHICLE_CLASS_TONES[vc] ?? 'bg-slate-100 text-slate-700 ring-slate-200',
      desc: VEHICLE_CLASS_DESCRIPTIONS[vc] ?? '',
    }))
    const policyHighlights = [
      { key: 'cancel_7d', title: 'Miễn phí hủy trước 7 ngày', desc: 'Hủy trước 7 ngày nhận xe: được hoàn 100% tiền cọc.' },
      { key: 'cancel_3d', title: 'Hủy 3-7 ngày', desc: 'Hoàn 50% tiền cọc, áp dụng lại cho chuyến tiếp theo trong 60 ngày.' },
      { key: 'cancel_late', title: 'Hủy trong 3 ngày / No-show', desc: 'Không hoàn tiền cọc.' },
      { key: 'deposit', title: 'Đặt cọc 30%', desc: 'Cọc 30% tổng giá trị HĐ để giữ xe, số còn lại thanh toán khi nhận xe.' },
      { key: 'driver', title: 'Tài xế / Tự lái', desc: 'Có tài xế (khuyên dùng cho 16 chỗ trở lên) hoặc tự lái cho xe < 16 chỗ (điều kiện GPLX phù hợp).' },
      { key: 'damage', title: 'Vỡ đầu / Thiệt hại', desc: 'Thiệt hại xe do lỗi khách hàng: KH bồi thường đúng thiệt hại; Vỡ đầu trong hợp đồng miễn phí 1 lần.' },
      { key: 'excess_km', title: 'Quá giới hạn KM', desc: '300 km/ngày, vượt quá mức 3.000 ₫/km (xe 4-7 chỗ) / 5.000 ₫/km (16+ chỗ).' },
      { key: 'fuel', title: 'Xăng / Nhiên liệu', desc: 'Trả xe thiếu xăng tính chênh lệch theo giá xăng thị trường + 10% phí đổ xăng.' },
      { key: 'handover', title: 'Giao / Thu xe', desc: 'Giao xe tại văn phòng công ty hoặc tại địa điểm khách yêu cầu (phụ thu phí tùy khu vực).' },
    ]
    return { types, classes, policyHighlights }
  }
}
