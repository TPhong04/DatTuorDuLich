import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { HydratedDocument, Types } from 'mongoose'
import { VehicleClass, VehicleType } from '../vehicles/vehicle.schema'

export type VehicleInquiryDocument = HydratedDocument<VehicleInquiry>
export type VehicleQuotationDocument = HydratedDocument<VehicleQuotation>
export type VehicleRentalContractDocument = HydratedDocument<VehicleRentalContract>
export type VehicleHandoverDocument = HydratedDocument<VehicleHandover>
export type VehicleSettlementDocument = HydratedDocument<VehicleSettlement>

/* ========================== INQUIRY (Yêu cầu thuê xe) ========================== */
export const INQUIRY_STATUSES = ['draft', 'pending', 'confirmed', 'quoted', 'converted', 'expired', 'canceled'] as const
export type VehicleInquiryStatus = (typeof INQUIRY_STATUSES)[number]
export const INQUIRY_STATUS_LABELS: Record<VehicleInquiryStatus, string> = {
  draft: 'Nháp',
  pending: 'Chờ xử lý',
  confirmed: 'Đã xác nhận',
  quoted: 'Đã báo giá',
  converted: 'Đã chuyển HĐ',
  expired: 'Hết hạn',
  canceled: 'Khách hủy',
}
export const INQUIRY_STATUS_TONES: Record<VehicleInquiryStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  confirmed: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  quoted: 'bg-sky-100 text-sky-800 ring-sky-200',
  converted: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  expired: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
  canceled: 'bg-rose-100 text-rose-800 ring-rose-200',
}

export const INQUIRY_SOURCES = ['website', 'hotline', 'zalo', 'facebook', 'walkin', 'staff', 'enterprise'] as const
export type InquirySource = (typeof INQUIRY_SOURCES)[number]
export const INQUIRY_SOURCE_LABELS: Record<InquirySource, string> = {
  website: 'Website (Form thuê xe)',
  hotline: 'Hotline',
  zalo: 'Zalo OA',
  facebook: 'Facebook / Messenger',
  walkin: 'Khách đến trực tiếp VP',
  staff: 'Nhân viên tự nhập',
  enterprise: 'Khách doanh nghiệp',
}

@Schema({ timestamps: true, collection: 'vehicle_inquiries' })
export class VehicleInquiry {
  _id!: Types.ObjectId

  @Prop({ type: String, required: false, trim: true, index: true })
  code?: string | null

  @Prop({ type: String, required: true, enum: INQUIRY_STATUSES, default: 'pending', index: true })
  status!: VehicleInquiryStatus

  @Prop({ type: String, required: true, enum: INQUIRY_SOURCES, default: 'staff', index: true })
  source!: InquirySource

  /* ==== Thông tin khách hàng ==== */
  @Prop({ type: String, required: true, trim: true, index: true })
  customerName!: string

  @Prop({ type: String, required: true, trim: true, index: true })
  customerPhone!: string

  @Prop({ type: String, default: null, trim: true })
  customerEmail?: string | null

  @Prop({ type: String, default: null, trim: true })
  citizenId?: string | null

  @Prop({ type: String, default: null, trim: true })
  customerAddress?: string | null

  /* ==== Yêu cầu xe ==== */
  @Prop({ type: Date, required: true, index: true })
  pickupDateTime!: Date

  @Prop({ type: String, required: true, trim: true })
  pickupLocation!: string

  @Prop({ type: Date, required: true, index: true })
  returnDateTime!: Date

  @Prop({ type: String, required: true, trim: true })
  returnLocation!: string

  @Prop({ type: Number, required: true, default: 1, min: 1, max: 200 })
  passengerCount!: number

  @Prop({ type: Number, required: false, default: 0, min: 0, max: 100 })
  luggageCount?: number

  @Prop({ type: Number, default: null, min: 1, max: 80 })
  seatCountMin?: number | null

  @Prop({ type: Number, default: null, min: 1, max: 3000 })
  rentalDays?: number | null

  @Prop({ type: String, enum: ['seater_4', 'seater_7', 'seater_16', 'seater_29', 'seater_45'], required: false, index: true })
  preferredVehicleType?: VehicleType | null

  @Prop({ type: String, enum: ['seat', 'sleeper', 'limousine', 'cabin'], required: false, index: true })
  preferredVehicleClass?: VehicleClass | null

  @Prop({ type: Boolean, required: true, default: true })
  withDriver!: boolean

  @Prop({ type: Boolean, required: true, default: false })
  selfDriveRequirePapers?: boolean

  /* ==== Yêu cầu đặc biệt / đường đi ==== */
  @Prop({ type: String, default: null, trim: true, maxLength: 2000 })
  routeNotes?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 2000 })
  specialRequests?: string | null

  /* ==== Liên kết (convert) ==== */
  @Prop({ type: Types.ObjectId, ref: 'VehicleQuotation', required: false, index: true })
  quotationId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'VehicleRentalContract', required: false, index: true })
  contractId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: false, index: true })
  bookingId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  customerUserId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  ownerStaffId?: Types.ObjectId | null

  @Prop({ type: Date, default: null, index: true })
  expiredAt?: Date | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  cancelReason?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  internalNotes?: string | null

  @Prop({ type: Date, default: null, index: true })
  confirmedAt?: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  confirmedByStaffId?: Types.ObjectId | null

  @Prop({ type: String, default: null, trim: true, maxLength: 400 })
  quotationPdfUrlPath?: string | null

  @Prop({ type: Date, default: null })
  quotationPdfGeneratedAt?: Date | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  confirmedNotifBody?: string | null

  createdAt!: Date
  updatedAt!: Date
}

/* ========================== QUOTATION (Báo giá) ========================== */
export const QUOTATION_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'sent', 'accepted', 'declined', 'expired', 'converted', 'canceled'] as const
export type VehicleQuotationStatus = (typeof QUOTATION_STATUSES)[number]
export const QUOTATION_STATUS_LABELS: Record<VehicleQuotationStatus, string> = {
  draft: 'Nháp',
  pending_approval: 'Chờ Quản lý duyệt',
  approved: 'Quản lý đã duyệt',
  rejected: 'Quản lý từ chối',
  sent: 'Đã gửi khách',
  accepted: 'Khách đã đồng ý',
  declined: 'Khách từ chối',
  expired: 'Hết hiệu lực',
  converted: 'Đã chuyển HĐ',
  canceled: 'Hủy',
}
export const QUOTATION_STATUS_TONES: Record<VehicleQuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending_approval: 'bg-amber-100 text-amber-800 ring-amber-200',
  approved: 'bg-sky-100 text-sky-800 ring-sky-200',
  rejected: 'bg-rose-100 text-rose-800 ring-rose-200',
  sent: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  accepted: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  declined: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
  expired: 'bg-orange-100 text-orange-800 ring-orange-200',
  converted: 'bg-teal-100 text-teal-800 ring-teal-200',
  canceled: 'bg-rose-100 text-rose-800 ring-rose-200',
}

type QuotationLineItem = {
  key: string
  title: string
  unitPrice?: number | null
  quantity?: number
  amountVnd: number
  notes?: string | null
}

@Schema({ timestamps: true, collection: 'vehicle_quotations' })
export class VehicleQuotation {
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  code!: string

  @Prop({ type: String, required: true, enum: QUOTATION_STATUSES, default: 'draft', index: true })
  status!: VehicleQuotationStatus

  @Prop({ type: Types.ObjectId, ref: 'VehicleInquiry', required: true, index: true })
  inquiryId!: Types.ObjectId

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  validityDays!: number

  @Prop({ type: Date, required: true, index: true })
  validUntil!: Date

  /* ==== Xe & dịch vụ ==== */
  @Prop({ type: String, enum: ['seater_4', 'seater_7', 'seater_16', 'seater_29', 'seater_45'], required: true, index: true })
  vehicleType!: VehicleType

  @Prop({ type: String, enum: ['seat', 'sleeper', 'limousine', 'cabin'], required: true, default: 'seat', index: true })
  vehicleClass!: VehicleClass

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Vehicle', index: true }], default: [] })
  suggestedVehicleIds!: Types.ObjectId[]

  @Prop({ type: Boolean, required: true, default: true })
  withDriver!: boolean

  /* ==== Chi tiết line items ==== */
  @Prop({ type: [{ type: Object, required: true }], default: [] })
  lineItems!: QuotationLineItem[]

  /* ==== Tổng số ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  rentalDays!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  baseAmountVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  driverFeeVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  extrasAmountVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: -100, max: 100 })
  discountPercent!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  discountAmountVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalBeforeTaxVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0, max: 100 })
  taxPercent!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  taxAmountVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalGrandVnd!: number

  @Prop({ type: Number, required: true, default: 30, min: 0, max: 100 })
  depositPercentRequired!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  depositRequiredVnd!: number

  /* ==== Chính sách & từ chối ==== */
  @Prop({ type: String, default: null, trim: true, maxLength: 6000 })
  termsHtml?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  rejectReason?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  customerDeclineReason?: string | null

  @Prop({ type: Types.ObjectId, ref: 'VehicleRentalContract', required: false, index: true })
  contractId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  createdById?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  approvedById?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  approvedAt?: Date | null

  @Prop({ type: Date, default: null })
  sentAt?: Date | null

  @Prop({ type: Date, default: null })
  customerAcceptedAt?: Date | null

  createdAt!: Date
  updatedAt!: Date
}

/* ========================== RENTAL CONTRACT (Hợp đồng thuê) ========================== */
export const CONTRACT_STATUSES = ['draft', 'pending_signature', 'signed', 'deposit_paid', 'in_progress', 'completed', 'canceled', 'terminated'] as const
export type VehicleRentalContractStatus = (typeof CONTRACT_STATUSES)[number]
export const CONTRACT_STATUS_LABELS: Record<VehicleRentalContractStatus, string> = {
  draft: 'Nháp',
  pending_signature: 'Chờ ký',
  signed: 'Đã ký',
  deposit_paid: 'Đã đặt cọc',
  in_progress: 'Đang thuê (đã giao xe)',
  completed: 'Hoàn tất',
  canceled: 'Hủy (đã hoàn tiền)',
  terminated: 'Chấm dứt sớm',
}
export const CONTRACT_STATUS_TONES: Record<VehicleRentalContractStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending_signature: 'bg-amber-100 text-amber-800 ring-amber-200',
  signed: 'bg-sky-100 text-sky-800 ring-sky-200',
  deposit_paid: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  in_progress: 'bg-blue-100 text-blue-800 ring-blue-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  canceled: 'bg-rose-100 text-rose-800 ring-rose-200',
  terminated: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
}

@Schema({ timestamps: true, collection: 'vehicle_rental_contracts' })
export class VehicleRentalContract {
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  code!: string

  @Prop({ type: String, required: true, enum: CONTRACT_STATUSES, default: 'draft', index: true })
  status!: VehicleRentalContractStatus

  @Prop({ type: Types.ObjectId, ref: 'VehicleInquiry', required: false, index: true })
  inquiryId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'VehicleQuotation', required: false, index: true })
  quotationId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'Booking', required: false, index: true })
  bookingId?: Types.ObjectId | null

  @Prop({ type: String, required: true, trim: true })
  customerName!: string

  @Prop({ type: String, required: true, trim: true, index: true })
  customerPhone!: string

  @Prop({ type: String, default: null, trim: true })
  customerEmail?: string | null

  @Prop({ type: String, required: true, trim: true })
  citizenId!: string

  @Prop({ type: String, default: null, trim: true })
  citizenIdIssuePlace?: string | null

  @Prop({ type: Date, default: null })
  citizenIdIssueDate?: Date | null

  @Prop({ type: String, required: true, trim: true })
  customerAddress!: string

  @Prop({ type: String, default: null, trim: true })
  driverLicenseNumber?: string | null

  @Prop({ type: String, default: null, trim: true })
  driverLicenseClass?: string | null

  /* ==== Xe được gắn ==== */
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true }], default: [] })
  assignedVehicleIds!: Types.ObjectId[]

  @Prop({ type: Boolean, required: true, default: true })
  withDriver!: boolean

  /* ==== Thời gian & địa điểm ==== */
  @Prop({ type: Date, required: true, index: true })
  pickupDateTime!: Date

  @Prop({ type: String, required: true, trim: true })
  pickupLocation!: string

  @Prop({ type: Date, required: true, index: true })
  returnDateTime!: Date

  @Prop({ type: String, required: true, trim: true })
  returnLocation!: string

  @Prop({ type: Number, required: true, default: 1, min: 1 })
  rentalDays!: number

  /* ==== Giá trị hợp đồng ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalGrandVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  depositRequiredVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  depositPaidVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  paidVnd!: number

  /* ==== Thế chấp ==== */
  @Prop({ type: Boolean, required: true, default: false })
  depositPapersHeld!: boolean

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  collateralCashVnd!: number

  @Prop({ type: String, default: null, trim: true, maxLength: 2000 })
  collateralOther?: string | null

  /* ==== Hóa đơn / thanh toán ==== */
  @Prop({ type: Boolean, required: true, default: false })
  requireVatInvoice!: boolean

  @Prop({ type: String, default: null, trim: true })
  invoiceCompanyName?: string | null

  @Prop({ type: String, default: null, trim: true })
  invoiceTaxCode?: string | null

  @Prop({ type: String, default: null, trim: true })
  invoiceAddress?: string | null

  /* ==== Gắn kết quản lý ==== */
  @Prop({ type: Types.ObjectId, ref: 'VehicleHandover', required: false, index: true })
  pickupHandoverId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'VehicleHandover', required: false, index: true })
  returnHandoverId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'VehicleSettlement', required: false, index: true })
  settlementId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  signedByStaffId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  ownerSalesId?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  signedAt?: Date | null

  @Prop({ type: Date, default: null })
  depositPaidAt?: Date | null

  @Prop({ type: Date, default: null })
  completedAt?: Date | null

  @Prop({ type: String, default: null, trim: true, maxLength: 6000 })
  termsHtml?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  cancelOrTerminateReason?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  internalNotes?: string | null

  createdAt!: Date
  updatedAt!: Date
}

/* ========================== HANDOVER (Giao / Thu hồi xe) ========================== */
export const HANDOVER_TYPES = ['pickup', 'return'] as const
export type VehicleHandoverType = (typeof HANDOVER_TYPES)[number]
export const HANDOVER_TYPE_LABELS: Record<VehicleHandoverType, string> = {
  pickup: 'Giao xe',
  return: 'Thu hồi xe',
}

export const HANDOVER_STATUSES = ['pending', 'in_progress', 'signed', 'verified', 'canceled'] as const
export type VehicleHandoverStatus = (typeof HANDOVER_STATUSES)[number]
export const HANDOVER_STATUS_LABELS: Record<VehicleHandoverStatus, string> = {
  pending: 'Chờ giao/thu hồi',
  in_progress: 'Đang kiểm tra',
  signed: 'Đã ký xác nhận',
  verified: 'Đã xác nhận (VP)',
  canceled: 'Hủy',
}
export const HANDOVER_STATUS_TONES: Record<VehicleHandoverStatus, string> = {
  pending: 'bg-amber-100 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-100 text-sky-800 ring-sky-200',
  signed: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  verified: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  canceled: 'bg-rose-100 text-rose-800 ring-rose-200',
}

type HandoverChecklistItem = { key: string; label: string; ok: boolean; notes?: string | null }
type DamagePhoto = { id: string; angle: string; damageNotes?: string | null; url?: string | null }

@Schema({ timestamps: true, collection: 'vehicle_handovers' })
export class VehicleHandover {
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, enum: HANDOVER_TYPES, index: true })
  handoverType!: VehicleHandoverType

  @Prop({ type: String, required: true, enum: HANDOVER_STATUSES, default: 'pending', index: true })
  status!: VehicleHandoverStatus

  @Prop({ type: Types.ObjectId, ref: 'VehicleRentalContract', required: true, index: true })
  contractId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'Vehicle', required: true, index: true })
  vehicleId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'VehicleHandover', required: false, index: true })
  pairedPickupHandoverId?: Types.ObjectId | null

  @Prop({ type: Date, required: true })
  handoverDateTime!: Date

  @Prop({ type: String, required: true, trim: true })
  locationAddress!: string

  /* ==== Người ký ==== */
  @Prop({ type: String, required: true, trim: true })
  customerSignerName!: string

  @Prop({ type: String, required: true, trim: true })
  customerSignerCitizenId!: string

  @Prop({ type: String, default: null, trim: true })
  customerSignerPhone?: string | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  staffSignerId?: Types.ObjectId | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  guideId?: Types.ObjectId | null

  /* ==== Checklists 10 điểm ==== */
  @Prop({ type: [{ type: Object, required: true }], default: [] })
  checklist!: HandoverChecklistItem[]

  @Prop({ type: [{ type: Object }], default: [] })
  damagePhotos!: DamagePhoto[]

  /* ==== Số liệu quan trọng ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  mileageKm!: number

  @Prop({ type: Number, required: true, default: 100, min: 0, max: 100 })
  fuelPercent!: number

  @Prop({ type: Number, required: true, default: 0, min: 0, max: 2000 })
  dailyKmLimit!: number

  /* ==== Tình trạng / ý kiến khách ==== */
  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  additionalDamages?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 2000 })
  customerComments?: string | null

  @Prop({ type: Date, default: null })
  signedAt?: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  verifiedById?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  verifiedAt?: Date | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  internalNotes?: string | null

  createdAt!: Date
  updatedAt!: Date
}

/* ========================== SETTLEMENT (Bảng kê thanh toán cuối) ========================== */
export const SETTLEMENT_STATUSES = ['draft', 'pending_payment', 'paid', 'completed', 'disputed', 'canceled'] as const
export type VehicleSettlementStatus = (typeof SETTLEMENT_STATUSES)[number]
export const SETTLEMENT_STATUS_LABELS: Record<VehicleSettlementStatus, string> = {
  draft: 'Nháp',
  pending_payment: 'Chờ khách thanh toán',
  paid: 'Khách đã thanh toán',
  completed: 'Hoàn tất (đã hoàn trả thế chấp)',
  disputed: 'Đang tranh chấp',
  canceled: 'Hủy',
}
export const SETTLEMENT_STATUS_TONES: Record<VehicleSettlementStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 ring-slate-200',
  pending_payment: 'bg-amber-100 text-amber-800 ring-amber-200',
  paid: 'bg-sky-100 text-sky-800 ring-sky-200',
  completed: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  disputed: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200',
  canceled: 'bg-rose-100 text-rose-800 ring-rose-200',
}

type SettlementLineItem = {
  key: string
  title: string
  amountVnd: number
  notes?: string | null
}

@Schema({ timestamps: true, collection: 'vehicle_settlements' })
export class VehicleSettlement {
  _id!: Types.ObjectId

  @Prop({ type: String, required: true, unique: true, trim: true, index: true })
  code!: string

  @Prop({ type: String, required: true, enum: SETTLEMENT_STATUSES, default: 'draft', index: true })
  status!: VehicleSettlementStatus

  @Prop({ type: Types.ObjectId, ref: 'VehicleRentalContract', required: true, index: true })
  contractId!: Types.ObjectId

  @Prop({ type: Types.ObjectId, ref: 'VehicleHandover', required: true, index: true })
  returnHandoverId!: Types.ObjectId

  /* ==== Tính toán phụ thu / hoàn tiền ==== */
  @Prop({ type: [{ type: Object, required: true }], default: [] })
  lineItems!: SettlementLineItem[]

  @Prop({ type: Number, required: true, default: 0 })
  excessKm!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  excessKmRateVnd!: number

  @Prop({ type: Number, required: true, default: 0 })
  fuelDeficitLiters!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  fuelRatePerLiterVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  damagesRepairVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  lateReturnPenaltyVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  cleaningFeeVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  otherChargesVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  totalExtraChargesVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  discountsOrRefundsVnd!: number

  /* ==== Tổng kết ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  contractTotalVnd!: number

  @Prop({ type: Number, required: true, default: 0, min: 0 })
  contractPaidVnd!: number

  @Prop({ type: Number, required: true, default: 0 })
  customerMustPayVnd!: number

  @Prop({ type: Number, required: true, default: 0 })
  refundToCustomerVnd!: number

  /* ==== Thế chấp hoàn trả ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  collateralCashReturnedVnd!: number

  @Prop({ type: Boolean, required: true, default: false })
  depositPapersReturned!: boolean

  @Prop({ type: String, default: null, trim: true, maxLength: 2000 })
  collateralOtherReturned?: string | null

  @Prop({ type: Date, default: null })
  collateralReturnedAt?: Date | null

  /* ==== Thanh toán & Hoàn tất ==== */
  @Prop({ type: Number, required: true, default: 0, min: 0 })
  finalPaidVnd!: number

  @Prop({ type: Date, default: null })
  finalPaidAt?: Date | null

  @Prop({ type: Types.ObjectId, ref: 'User', required: false, index: true })
  settledById?: Types.ObjectId | null

  @Prop({ type: Date, default: null })
  completedAt?: Date | null

  @Prop({ type: String, default: null, trim: true, maxLength: 6000 })
  disputeNotes?: string | null

  @Prop({ type: String, default: null, trim: true, maxLength: 4000 })
  internalNotes?: string | null

  createdAt!: Date
  updatedAt!: Date
}

/* ========================== SCHEMA FACTORIES ========================== */
export const VehicleInquirySchema = SchemaFactory.createForClass(VehicleInquiry)
export const VehicleQuotationSchema = SchemaFactory.createForClass(VehicleQuotation)
export const VehicleRentalContractSchema = SchemaFactory.createForClass(VehicleRentalContract)
export const VehicleHandoverSchema = SchemaFactory.createForClass(VehicleHandover)
export const VehicleSettlementSchema = SchemaFactory.createForClass(VehicleSettlement)
