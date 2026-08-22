import { z } from 'zod'
import {
  CONTRACT_STATUSES,
  HANDOVER_STATUSES,
  HANDOVER_TYPES,
  INQUIRY_SOURCES,
  INQUIRY_STATUSES,
  QUOTATION_STATUSES,
  SETTLEMENT_STATUSES,
} from './rentals.schema'
import { VEHICLE_CLASSES, VEHICLE_STATUSES, VEHICLE_TYPES } from '../vehicles/vehicle.schema'

/* ---------- shared helpers ---------- */
const dateDto = z
  .union([z.string().trim(), z.null(), z.date()])
  .transform((v) => {
    if (v === null || v === undefined) return null
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
    const s = String(v).trim()
    if (!s) return null
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
  })
  .refine((v) => v === null || v instanceof Date)

const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v)
const vehicleTypeDto = z.enum([...VEHICLE_TYPES] as [string, ...string[]])
const vehicleStatusDto = z.enum([...VEHICLE_STATUSES] as [string, ...string[]])
const vehicleClassDto = z.enum([...VEHICLE_CLASSES] as [string, ...string[]])
const inquiryStatusDto = z.enum([...INQUIRY_STATUSES] as [string, ...string[]])
const inquirySourceDto = z.enum([...INQUIRY_SOURCES] as [string, ...string[]])
const quotationStatusDto = z.enum([...QUOTATION_STATUSES] as [string, ...string[]])
const contractStatusDto = z.enum([...CONTRACT_STATUSES] as [string, ...string[]])
const handoverTypeDto = z.enum([...HANDOVER_TYPES] as [string, ...string[]])
const handoverStatusDto = z.enum([...HANDOVER_STATUSES] as [string, ...string[]])
const settlementStatusDto = z.enum([...SETTLEMENT_STATUSES] as [string, ...string[]])

const positiveInt = (min = 0, max = 1_000_000_000) => z.preprocess(emptyToNull, z.coerce.number().int().min(min).max(max).nullable().optional())
const money = z.preprocess(emptyToNull, z.coerce.number().int().min(0).max(100_000_000_000).nullable().optional()).default(0)

const lineItemDto = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(300),
  unitPrice: positiveInt().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(1000).optional(),
  amountVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
})

const checklistItemDto = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(300),
  ok: z.boolean(),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
})
const damagePhotoDto = z.object({
  id: z.string().trim().min(1).max(80),
  angle: z.string().trim().min(1).max(120),
  damageNotes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
  url: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
})
const settlementLineItemDto = z.object({
  key: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(300),
  amountVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable().optional()),
})

/* ============================ PUBLIC / CUSTOMER RENTALS ============================ */
export const publicCreateInquiryDto = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().trim().min(8).max(30),
  customerEmail: z.preprocess(emptyToNull, z.string().trim().email().max(160).nullable().optional()),
  citizenId: z.preprocess(emptyToNull, z.string().trim().min(6).max(30).nullable().optional()),
  customerAddress: z.preprocess(emptyToNull, z.string().trim().max(400).nullable().optional()),
  vehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  vehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  seatCountMin: positiveInt(1, 60),
  pickupDateTime: z
    .union([z.string().trim(), z.date()])
    .transform((v) => (typeof v === 'string' ? new Date(v) : v))
    .refine((v) => v instanceof Date && !Number.isNaN(v.getTime()), { message: 'Chọn ngày giờ nhận xe hợp lệ' }),
  pickupLocation: z.string().trim().min(2).max(400),
  returnDateTime: z
    .union([z.string().trim(), z.date()])
    .transform((v) => (typeof v === 'string' ? new Date(v) : v))
    .refine((v) => v instanceof Date && !Number.isNaN(v.getTime()), { message: 'Chọn ngày giờ trả xe hợp lệ' }),
  returnLocation: z.string().trim().min(2).max(400),
  withDriver: z.boolean().default(true),
  rentalDays: z.coerce.number().int().min(1).max(3000).optional(),
  passengerCount: positiveInt(1, 1000),
  luggageCount: positiveInt(0, 1000).default(0),
  routeNotes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  specialRequests: z.preprocess(emptyToNull, z.string().trim().max(3000).nullable().optional()),
  agreementAccepted: z.boolean().refine((v) => !!v, { message: 'Vui lòng xác nhận đã đọc và đồng ý với Chính sách cho thuê xe' }),
  bookingId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
}).superRefine((d, ctx) => {
  if ((d.pickupDateTime as any) instanceof Date && (d.returnDateTime as any) instanceof Date && (d.pickupDateTime as any) >= (d.returnDateTime as any)) {
    ctx.addIssue({ code: 'custom', message: 'Ngày giờ trả xe phải sau ngày giờ nhận xe', path: ['returnDateTime'] })
  }
})
export type PublicCreateInquiryDto = z.infer<typeof publicCreateInquiryDto>

/* ============================ INQUIRY ============================ */
export const listInquiriesDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.preprocess(emptyToNull, inquiryStatusDto.nullable().optional()),
  source: z.preprocess(emptyToNull, inquirySourceDto.nullable().optional()),
  vehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  vehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  bookingId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  fromDate: dateDto.nullable().optional(),
  toDate: dateDto.nullable().optional(),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
})
export type ListInquiriesDto = z.infer<typeof listInquiriesDto>

const createInquiryDtoShape = z.object({
  code: z.preprocess(emptyToNull, z.string().trim().min(1).max(60).nullable().optional()),
  status: inquiryStatusDto.optional(),
  source: inquirySourceDto.default('staff'),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(6).max(40),
  customerEmail: z.preprocess(emptyToNull, z.string().trim().email().max(160).nullable().optional()),
  citizenId: z.preprocess(emptyToNull, z.string().trim().min(6).max(30).nullable().optional()),
  customerAddress: z.preprocess(emptyToNull, z.string().trim().max(300).nullable().optional()),
  pickupDateTime: dateDto.refine((v) => v instanceof Date),
  pickupLocation: z.string().trim().min(1).max(400),
  returnDateTime: dateDto.refine((v) => v instanceof Date),
  returnLocation: z.string().trim().min(1).max(400),
  rentalDays: z.coerce.number().int().min(1).max(3000).optional(),
  passengerCount: z.coerce.number().int().min(1).max(500).default(1),
  luggageCount: z.coerce.number().int().min(0).max(500).default(0),
  preferredVehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  preferredVehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  seatCountMin: z.coerce.number().int().min(1).max(60).nullable().optional(),
  withDriver: z.boolean().default(true),
  selfDriveRequirePapers: z.boolean().default(false),
  routeNotes: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  specialRequests: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  bookingId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  customerUserId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  ownerStaffId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  expiredAt: dateDto.nullable().optional(),
  internalNotes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})

export const createInquiryDto = createInquiryDtoShape.superRefine((d, ctx) => {
  if (d.pickupDateTime && d.returnDateTime && d.pickupDateTime >= d.returnDateTime) {
    ctx.addIssue({ code: 'custom', message: 'Ngày giờ trả xe phải sau ngày giờ nhận xe', path: ['returnDateTime'] })
  }
})
export type CreateInquiryDto = z.infer<typeof createInquiryDto>

export const updateInquiryDto = createInquiryDtoShape.partial().extend({
  cancelReason: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})
export type UpdateInquiryDto = z.infer<typeof updateInquiryDto>

export const inquiryChangeStatusDto = z.object({
  status: inquiryStatusDto,
  cancelReason: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})
export type InquiryChangeStatusDto = z.infer<typeof inquiryChangeStatusDto>

export const confirmInquiryDto = z.object({
  suggestedBaseAmountVnd: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
  suggestedDriverFeeVnd: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
  suggestedExtrasVnd: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
  suggestedDiscountPercent: z.coerce.number().min(0).max(100).optional(),
  suggestedDepositRequiredVnd: z.coerce.number().int().min(0).max(100_000_000_000).optional(),
  suggestedValidUntilDate: dateDto.nullable().optional(),
  customNotifTitle: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
  customNotifBody: z.preprocess(emptyToNull, z.string().trim().min(1).max(4000).nullable().optional()),
})
export type ConfirmInquiryDto = z.infer<typeof confirmInquiryDto>

/* ============================ QUOTATION ============================ */
export const listQuotationsDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.preprocess(emptyToNull, quotationStatusDto.nullable().optional()),
  inquiryId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  vehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  vehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  fromDate: dateDto.nullable().optional(),
  toDate: dateDto.nullable().optional(),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
})
export type ListQuotationsDto = z.infer<typeof listQuotationsDto>

export const createQuotationDto = z.object({
  inquiryId: z.string().trim().min(1).max(80),
  validityDays: z.coerce.number().int().min(1).max(365).default(7),
  vehicleType: vehicleTypeDto,
  vehicleClass: vehicleClassDto.default('seat'),
  suggestedVehicleIds: z.array(z.string().trim().min(1)).max(20).default([]),
  withDriver: z.boolean().default(true),
  lineItems: z.array(lineItemDto).min(0).max(100).default([]),
  rentalDays: z.coerce.number().int().min(1).max(1000),
  baseAmountVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  driverFeeVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  extrasAmountVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  discountAmountVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  totalBeforeTaxVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  taxPercent: z.coerce.number().min(0).max(100).default(0),
  taxAmountVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  totalGrandVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  depositPercentRequired: z.coerce.number().min(0).max(100).default(30),
  depositRequiredVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  termsHtml: z.preprocess(emptyToNull, z.string().trim().max(20000).nullable().optional()),
})
export type CreateQuotationDto = z.infer<typeof createQuotationDto>

export const updateQuotationDto = createQuotationDto.partial()
export type UpdateQuotationDto = z.infer<typeof updateQuotationDto>

export const quotationActionDto = z.union([
  z.object({ action: z.literal('submit_approval') }),
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), rejectReason: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('send') }),
  z.object({ action: z.literal('accept') }),
  z.object({ action: z.literal('decline'), customerDeclineReason: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('expire') }),
  z.object({ action: z.literal('cancel') }),
])
export type QuotationActionDto = z.infer<typeof quotationActionDto>

/* ============================ CONTRACT ============================ */
export const listContractsDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.preprocess(emptyToNull, contractStatusDto.nullable().optional()),
  inquiryId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  quotationId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  bookingId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  vehicleId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  fromDate: dateDto.nullable().optional(),
  toDate: dateDto.nullable().optional(),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
})
export type ListContractsDto = z.infer<typeof listContractsDto>

export const suggestAvailableVehiclesDto = z.object({
  pickupDateTime: dateDto.refine((v) => v instanceof Date),
  returnDateTime: dateDto.refine((v) => v instanceof Date),
  vehicleType: z.preprocess(emptyToNull, vehicleTypeDto.nullable().optional()),
  vehicleClass: z.preprocess(emptyToNull, vehicleClassDto.nullable().optional()),
  vehicleStatus: z.preprocess(emptyToNull, vehicleStatusDto.nullable().optional()),
}).superRefine((d, ctx) => {
  if (d.pickupDateTime && d.returnDateTime && d.pickupDateTime >= d.returnDateTime) {
    ctx.addIssue({ code: 'custom', message: 'Ngày giờ trả xe phải sau ngày giờ nhận xe', path: ['returnDateTime'] })
  }
})
export type SuggestAvailableVehiclesDto = z.infer<typeof suggestAvailableVehiclesDto>

export const createContractDtoShape = z.object({
  inquiryId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  quotationId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  bookingId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(6).max(40),
  customerEmail: z.preprocess(emptyToNull, z.string().trim().email().max(160).nullable().optional()),
  citizenId: z.string().trim().min(6).max(30),
  citizenIdIssuePlace: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  citizenIdIssueDate: dateDto.nullable().optional(),
  customerAddress: z.string().trim().min(1).max(400),
  driverLicenseNumber: z.preprocess(emptyToNull, z.string().trim().max(60).nullable().optional()),
  driverLicenseClass: z.preprocess(emptyToNull, z.string().trim().max(10).nullable().optional()),
  assignedVehicleIds: z.array(z.string().trim().min(1)).min(1).max(20),
  withDriver: z.boolean().default(true),
  pickupDateTime: dateDto.refine((v) => v instanceof Date),
  pickupLocation: z.string().trim().min(1).max(400),
  returnDateTime: dateDto.refine((v) => v instanceof Date),
  returnLocation: z.string().trim().min(1).max(400),
  rentalDays: z.coerce.number().int().min(1).max(3000),
  totalGrandVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  depositRequiredVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  depositPaidVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  paidVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  depositPapersHeld: z.boolean().default(false),
  collateralCashVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  collateralOther: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  requireVatInvoice: z.boolean().default(false),
  invoiceCompanyName: z.preprocess(emptyToNull, z.string().trim().max(200).nullable().optional()),
  invoiceTaxCode: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
  invoiceAddress: z.preprocess(emptyToNull, z.string().trim().max(400).nullable().optional()),
  ownerSalesId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  termsHtml: z.preprocess(emptyToNull, z.string().trim().max(20000).nullable().optional()),
  internalNotes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})

export const createContractDto = createContractDtoShape.superRefine((d, ctx) => {
  if (d.pickupDateTime && d.returnDateTime && d.pickupDateTime >= d.returnDateTime) {
    ctx.addIssue({ code: 'custom', message: 'Ngày giờ trả xe phải sau ngày giờ nhận xe', path: ['returnDateTime'] })
  }
})
export type CreateContractDto = z.infer<typeof createContractDto>

export const updateContractDto = createContractDtoShape.partial().extend({
  cancelOrTerminateReason: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})
export type UpdateContractDto = z.infer<typeof updateContractDto>

export const contractActionDto = z.union([
  z.object({ action: z.literal('sign') }),
  z.object({ action: z.literal('mark_deposit_paid'), amount: z.coerce.number().int().min(0).max(100_000_000_000).optional() }),
  z.object({ action: z.literal('mark_in_progress') }),
  z.object({ action: z.literal('mark_completed') }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('terminate'), reason: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal('assign_vehicles'), vehicleIds: z.array(z.string().trim().min(1)).min(1).max(20) }),
  z.object({ action: z.literal('register_payment'), amount: z.coerce.number().int().min(0).max(100_000_000_000) }),
])
export type ContractActionDto = z.infer<typeof contractActionDto>

/* ============================ HANDOVER ============================ */
export const listHandoversDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  handoverType: z.preprocess(emptyToNull, handoverTypeDto.nullable().optional()),
  status: z.preprocess(emptyToNull, handoverStatusDto.nullable().optional()),
  contractId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  vehicleId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  fromDate: dateDto.nullable().optional(),
  toDate: dateDto.nullable().optional(),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
})
export type ListHandoversDto = z.infer<typeof listHandoversDto>

export const createHandoverDto = z.object({
  handoverType: handoverTypeDto,
  contractId: z.string().trim().min(1).max(80),
  vehicleId: z.string().trim().min(1).max(80),
  pairedPickupHandoverId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  handoverDateTime: dateDto.refine((v) => v instanceof Date),
  locationAddress: z.string().trim().min(1).max(400),
  customerSignerName: z.string().trim().min(1).max(120),
  customerSignerCitizenId: z.string().trim().min(6).max(30),
  customerSignerPhone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable().optional()),
  staffSignerId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  guideId: z.preprocess(emptyToNull, z.string().trim().max(80).nullable().optional()),
  checklist: z.array(checklistItemDto).min(0).max(200).default([]),
  damagePhotos: z.array(damagePhotoDto).min(0).max(200).default([]),
  mileageKm: z.coerce.number().int().min(0).max(10_000_000),
  fuelPercent: z.coerce.number().min(0).max(100),
  dailyKmLimit: z.coerce.number().int().min(0).max(2000).default(200),
  additionalDamages: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
  customerComments: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  internalNotes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})
export type CreateHandoverDto = z.infer<typeof createHandoverDto>

export const updateHandoverDto = createHandoverDto.partial()
export type UpdateHandoverDto = z.infer<typeof updateHandoverDto>

export const handoverActionDto = z.union([
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('sign') }),
  z.object({ action: z.literal('verify') }),
  z.object({ action: z.literal('cancel') }),
])
export type HandoverActionDto = z.infer<typeof handoverActionDto>

export const defaultChecklistDto = z.object({
  handoverType: handoverTypeDto,
  vehicleClass: vehicleClassDto.optional(),
})
export type DefaultChecklistDto = z.infer<typeof defaultChecklistDto>

/* ============================ SETTLEMENT ============================ */
export const listSettlementsDto = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  status: z.preprocess(emptyToNull, settlementStatusDto.nullable().optional()),
  contractId: z.preprocess(emptyToNull, z.string().trim().min(1).max(80).nullable().optional()),
  fromDate: dateDto.nullable().optional(),
  toDate: dateDto.nullable().optional(),
  q: z.preprocess(emptyToNull, z.string().trim().min(1).max(200).nullable().optional()),
})
export type ListSettlementsDto = z.infer<typeof listSettlementsDto>

export const createSettlementDto = z.object({
  contractId: z.string().trim().min(1).max(80),
  returnHandoverId: z.string().trim().min(1).max(80),
  lineItems: z.array(settlementLineItemDto).min(0).max(100).default([]),
  excessKm: z.coerce.number().int().min(0).max(10_000_000).default(0),
  excessKmRateVnd: z.coerce.number().int().min(0).max(100_000_000).default(1500),
  fuelDeficitLiters: z.coerce.number().int().min(0).max(10_000).default(0),
  fuelRatePerLiterVnd: z.coerce.number().int().min(0).max(1_000_000).default(20000),
  damagesRepairVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  lateReturnPenaltyVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  cleaningFeeVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  otherChargesVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  totalExtraChargesVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  discountsOrRefundsVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  contractTotalVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  contractPaidVnd: z.coerce.number().int().min(0).max(100_000_000_000),
  customerMustPayVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  refundToCustomerVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  collateralCashReturnedVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  depositPapersReturned: z.boolean().default(false),
  collateralOtherReturned: z.preprocess(emptyToNull, z.string().trim().max(2000).nullable().optional()),
  finalPaidVnd: z.coerce.number().int().min(0).max(100_000_000_000).default(0),
  disputeNotes: z.preprocess(emptyToNull, z.string().trim().max(6000).nullable().optional()),
  internalNotes: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable().optional()),
})
export type CreateSettlementDto = z.infer<typeof createSettlementDto>

export const updateSettlementDto = createSettlementDto.partial()
export type UpdateSettlementDto = z.infer<typeof updateSettlementDto>

export const settlementActionDto = z.union([
  z.object({ action: z.literal('request_payment') }),
  z.object({ action: z.literal('mark_paid'), amount: z.coerce.number().int().min(0).max(100_000_000_000).optional() }),
  z.object({ action: z.literal('return_collateral') }),
  z.object({ action: z.literal('mark_completed') }),
  z.object({ action: z.literal('raise_dispute'), disputeNotes: z.string().trim().min(1).max(6000) }),
  z.object({ action: z.literal('cancel') }),
])
export type SettlementActionDto = z.infer<typeof settlementActionDto>
