import { apiFetch } from '@/lib/api'
import type { VehicleClass, VehicleType } from '@/features/vehicles/vehicles'
import {
  VEHICLE_CLASS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  classVehicleInfo,
  labelVehicleClass,
  labelVehicleType,
} from '@/features/vehicles/vehicles'

export type { VehicleClass, VehicleType }
export {
  VEHICLE_CLASS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  classVehicleInfo,
  labelVehicleClass,
  labelVehicleType,
}

/* ========== Status + Source + Type Enums ========== */
export type InquiryStatus =
  | 'draft' | 'pending' | 'confirmed' | 'quoted' | 'converted' | 'lost' | 'canceled'
export type InquirySource =
  | 'website' | 'hotline' | 'zalo' | 'facebook' | 'walkin' | 'staff' | 'enterprise'

export type QuotationStatus =
  | 'draft' | 'pending_approval' | 'approved' | 'rejected'
  | 'sent' | 'accepted' | 'declined' | 'expired' | 'converted' | 'canceled'

export type ContractStatus =
  | 'draft' | 'pending_signature' | 'signed'
  | 'deposit_paid' | 'in_progress' | 'completed'
  | 'terminated' | 'canceled'

export type HandoverType = 'pickup' | 'return'
export type HandoverStatus = 'pending' | 'in_progress' | 'signed' | 'verified' | 'canceled'

export type SettlementStatus =
  | 'draft' | 'pending_payment' | 'paid'
  | 'disputed' | 'completed' | 'canceled'

/* ========== Options + Helpers (label/tone tiếng Việt) ========== */
export const INQUIRY_STATUS_OPTIONS: { value: InquiryStatus; label: string; tone: string }[] = [
  { value: 'draft', label: 'Nháp', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
  { value: 'pending', label: 'Đang chờ xử lý', tone: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  { value: 'confirmed', label: 'Đã xác nhận', tone: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  { value: 'quoted', label: 'Đã báo giá', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'converted', label: 'Đã thành HĐ', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'lost', label: 'Mất đơn', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  { value: 'canceled', label: 'Đã hủy', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-600/20' },
]

export const INQUIRY_SOURCE_OPTIONS: { value: InquirySource; label: string }[] = [
  { value: 'website', label: 'Website (Form thuê xe)' },
  { value: 'hotline', label: 'Hotline' },
  { value: 'zalo', label: 'Zalo OA' },
  { value: 'facebook', label: 'Facebook / Messenger' },
  { value: 'walkin', label: 'Khách đến VP' },
  { value: 'staff', label: 'Nhân viên tự nhập' },
  { value: 'enterprise', label: 'Khách doanh nghiệp' },
]

export const QUOTATION_STATUS_OPTIONS: { value: QuotationStatus; label: string; tone: string }[] = [
  { value: 'draft', label: 'Nháp', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
  { value: 'pending_approval', label: 'Chờ duyệt', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'approved', label: 'Đã duyệt', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'rejected', label: 'Từ chối', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  { value: 'sent', label: 'Đã gửi KH', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  { value: 'accepted', label: 'KH đồng ý', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'declined', label: 'KH từ chối', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  { value: 'expired', label: 'Quá hạn', tone: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
  { value: 'converted', label: 'Đã thành HĐ', tone: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  { value: 'canceled', label: 'Đã hủy', tone: 'bg-zinc-200 text-zinc-700 ring-zinc-400' },
]

export const CONTRACT_STATUS_OPTIONS: { value: ContractStatus; label: string; tone: string }[] = [
  { value: 'draft', label: 'Nháp', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
  { value: 'pending_signature', label: 'Chờ ký', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'signed', label: 'Đã ký', tone: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  { value: 'deposit_paid', label: 'Đã đặt cọc', tone: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20' },
  { value: 'in_progress', label: 'Đang thuê', tone: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  { value: 'completed', label: 'Hoàn tất', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'terminated', label: 'Chấm dứt sớm', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  { value: 'canceled', label: 'Đã hủy', tone: 'bg-zinc-200 text-zinc-700 ring-zinc-400' },
]

export const HANDOVER_TYPE_OPTIONS: { value: HandoverType; label: string }[] = [
  { value: 'pickup', label: 'Giao xe' },
  { value: 'return', label: 'Thu hồi xe' },
]

export const HANDOVER_STATUS_OPTIONS: { value: HandoverStatus; label: string; tone: string }[] = [
  { value: 'pending', label: 'Chờ giao/thu', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
  { value: 'in_progress', label: 'Kiểm tra xe', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'signed', label: 'Đã ký BB', tone: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
  { value: 'verified', label: 'VP xác nhận', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'canceled', label: 'Hủy BB', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
]

export const SETTLEMENT_STATUS_OPTIONS: { value: SettlementStatus; label: string; tone: string }[] = [
  { value: 'draft', label: 'Nháp', tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' },
  { value: 'pending_payment', label: 'Chờ thanh toán', tone: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  { value: 'paid', label: 'Đã thanh toán', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  { value: 'disputed', label: 'Tranh chấp', tone: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  { value: 'completed', label: 'Hoàn tất', tone: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  { value: 'canceled', label: 'Đã hủy', tone: 'bg-zinc-200 text-zinc-700 ring-zinc-400' },
]

export function inqStatusInfo(s: string | null | undefined) {
  return INQUIRY_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' }
}
export function quoStatusInfo(s: string | null | undefined) {
  return QUOTATION_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' }
}
export function ctrStatusInfo(s: string | null | undefined) {
  return CONTRACT_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' }
}
export function hoStatusInfo(s: string | null | undefined) {
  return HANDOVER_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' }
}
export function stlStatusInfo(s: string | null | undefined) {
  return SETTLEMENT_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-zinc-100 text-zinc-700 ring-zinc-300' }
}
export function inqSourceLabel(s: string | null | undefined) {
  return INQUIRY_SOURCE_OPTIONS.find((x) => x.value === s)?.label ?? String(s ?? '-')
}
export function handoverTypeLabel(t: string | null | undefined) {
  return HANDOVER_TYPE_OPTIONS.find((x) => x.value === t)?.label ?? String(t ?? '-')
}

/* ========== Mini refs (FE-friendly) ========== */
export type IdSummary = { id: string; code?: string | null; status?: string | null }
export type VehicleSuggestion = {
  id: string
  plateNumber: string
  vehicleType: VehicleType
  vehicleTypeLabel: string
  seatCount: number
  vehicleClass: VehicleClass
  vehicleClassLabel: string
  vehicleClassTone: string
  brand: string | null
  color: string | null
  manufactureYear: number | null
  mileageKm: number
  status: string
  statusLabel: string
  statusTone: string
  rentalPricePerDayVnd: number
  estimatedTotalVnd: number
}
export type ChecklistItem = {
  key: string
  label: string
  group?: string
  required?: boolean
  passed?: boolean
  note?: string | null
}

/* ========== 1) INQUIRY (Yêu cầu thuê xe) ========== */
export type VehicleInquiry = {
  id: string
  code: string
  status: InquiryStatus
  statusLabel?: string
  statusTone?: string
  source: InquirySource
  sourceLabel?: string
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  customerAddress?: string | null
  routeNotes?: string | null
  bookingId?: string | null
  bookingSummary?: IdSummary | null
  vehicleType?: VehicleType | null
  vehicleClass?: VehicleClass | null
  seatCountMin?: number | null
  pickupDateTime: string
  pickupLocation: string
  returnDateTime: string
  returnLocation: string
  rentalDays: number
  withDriver: boolean
  estimatedDistanceKm?: number | null
  specialRequests?: string | null
  quotationSummary?: IdSummary | null
  contractSummary?: IdSummary | null
  ownerSalesId?: string | null
  ownerStaffSummary?: { id: string; fullName: string | null; email: string | null } | null
  internalNotes?: string | null
  confirmedAt?: string | null
  confirmedByStaffId?: string | null
  confirmedByStaff?: { id: string; fullName?: string | null; email?: string | null } | null
  quotationPdfUrlPath?: string | null
  quotationPdfGeneratedAt?: string | null
  confirmedNotifBody?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type InquiryCreateInput = Partial<Omit<VehicleInquiry, 'id' | 'code' | 'statusLabel' | 'statusTone' | 'sourceLabel' | 'quotationSummary' | 'contractSummary' | 'bookingSummary' | 'createdAt' | 'updatedAt'>>
export type InquiryUpdateInput = InquiryCreateInput & { cancelReason?: string | null }

export async function adminListInquiries(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleInquiry[]; total: number; page: number; limit: number }>(`/admin/rentals/inquiries${qs ? `?${qs}` : ''}`)
}
export async function adminGetInquiry(id: string) {
  return apiFetch<VehicleInquiry>(`/admin/rentals/inquiries/${id}`)
}
export async function adminCreateInquiry(input: InquiryCreateInput) {
  return apiFetch<VehicleInquiry>(`/admin/rentals/inquiries`, { method: 'POST', body: JSON.stringify(input) })
}
export async function adminUpdateInquiry(id: string, input: InquiryUpdateInput) {
  return apiFetch<VehicleInquiry>(`/admin/rentals/inquiries/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function adminPatchInquiryStatus(id: string, status: string, data?: any) {
  return apiFetch<VehicleInquiry>(`/admin/rentals/inquiries/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, ...(data || {}) }) })
}
export async function adminDeleteInquiry(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/rentals/inquiries/${id}`, { method: 'DELETE' })
}
export type ConfirmInquiryInput = {
  suggestedBaseAmountVnd?: number
  suggestedDriverFeeVnd?: number
  suggestedExtrasVnd?: number
  suggestedDiscountPercent?: number
  suggestedDepositRequiredVnd?: number
  suggestedValidUntilDate?: string | null
  customNotifTitle?: string | null
  customNotifBody?: string | null
}
export type ConfirmInquiryResult = {
  inquiry: VehicleInquiry
  pdfDownloadUrl?: string | null
  totalGrandVnd?: number
  depositRequiredVnd?: number
  vatAmountVnd?: number
  validUntil?: string | null
  customerNotifBody?: string | null
}
export async function adminConfirmInquiry(id: string, payload: ConfirmInquiryInput): Promise<ConfirmInquiryResult> {
  return apiFetch<ConfirmInquiryResult>(`/admin/rentals/inquiries/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export async function staffConfirmInquiry(id: string, payload: ConfirmInquiryInput): Promise<ConfirmInquiryResult> {
  return apiFetch<ConfirmInquiryResult>(`/staff/rentals/inquiries/${id}/confirm`, { method: 'PATCH', body: JSON.stringify(payload) })
}

/* ========== 2) QUOTATION (Báo giá) ========== */
export type QuotationLineItem = {
  key: string
  label: string
  unitPriceVnd: number
  quantity: number
  totalVnd: number
  notes?: string | null
}
export type VehicleQuotation = {
  id: string
  code: string
  status: QuotationStatus
  statusLabel?: string
  statusTone?: string
  inquiryId: string
  inquirySummary?: IdSummary | null
  validityDays: number
  validUntil?: string | null
  vehicleType?: VehicleType | null
  vehicleClass?: VehicleClass | null
  suggestedVehicleIds?: string[]
  suggestedVehicles?: (VehicleSuggestion | null)[]
  lineItems: QuotationLineItem[]
  totalSubVnd: number
  totalVatVnd: number
  totalGrandVnd: number
  depositPercentRequired: number
  depositRequiredVnd: number
  termsHtml?: string | null
  internalNotes?: string | null
  rejectReason?: string | null
  customerDeclineReason?: string | null
  approvedById?: string | null
  approvedAt?: string | null
  sentAt?: string | null
  respondedAt?: string | null
  contractSummary?: IdSummary | null
  createdAt?: string | null
  updatedAt?: string | null
}
export type QuotationCreateInput = Partial<Omit<VehicleQuotation, 'id' | 'code' | 'statusLabel' | 'statusTone' | 'inquirySummary' | 'suggestedVehicles' | 'approvedAt' | 'sentAt' | 'respondedAt' | 'contractSummary' | 'createdAt' | 'updatedAt'>>
export type QuotationUpdateInput = QuotationCreateInput & { rejectReason?: string | null }

export async function adminListQuotations(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleQuotation[]; total: number; page: number; limit: number }>(`/admin/rentals/quotations${qs ? `?${qs}` : ''}`)
}
export async function adminGetQuotation(id: string) {
  return apiFetch<VehicleQuotation>(`/admin/rentals/quotations/${id}`)
}
export async function adminCreateQuotation(input: QuotationCreateInput) {
  return apiFetch<VehicleQuotation>(`/admin/rentals/quotations`, { method: 'POST', body: JSON.stringify(input) })
}
export async function adminUpdateQuotation(id: string, input: QuotationUpdateInput) {
  return apiFetch<VehicleQuotation>(`/admin/rentals/quotations/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function adminQuotationAction(id: string, action: any) {
  return apiFetch<VehicleQuotation>(`/admin/rentals/quotations/${id}/actions`, { method: 'POST', body: JSON.stringify(action) })
}
export async function adminDeleteQuotation(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/rentals/quotations/${id}`, { method: 'DELETE' })
}

/* ========== 3) CONTRACT (Hợp đồng thuê xe) ========== */
export type VehicleRentalContract = {
  id: string
  code: string
  status: ContractStatus
  statusLabel?: string
  statusTone?: string
  inquiryId?: string | null
  quotationId?: string | null
  bookingId?: string | null
  inquirySummary?: IdSummary | null
  quotationSummary?: IdSummary | null
  bookingSummary?: IdSummary | null
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  citizenId: string
  citizenIdIssuePlace?: string | null
  citizenIdIssueDate?: string | null
  customerAddress: string
  driverLicenseNumber?: string | null
  driverLicenseClass?: string | null
  assignedVehicleIds: string[]
  assignedVehicles?: (VehicleSuggestion | null)[]
  withDriver: boolean
  pickupDateTime: string
  pickupLocation: string
  returnDateTime: string
  returnLocation: string
  rentalDays: number
  totalGrandVnd: number
  depositRequiredVnd: number
  depositPaidVnd: number
  paidVnd: number
  depositPapersHeld: boolean
  collateralCashVnd: number
  collateralOther?: string | null
  requireVatInvoice: boolean
  invoiceCompanyName?: string | null
  invoiceTaxCode?: string | null
  invoiceAddress?: string | null
  ownerSalesId?: string | null
  pickupHandoverId?: string | null
  returnHandoverId?: string | null
  settlementId?: string | null
  settlementSummary?: IdSummary | null
  termsHtml?: string | null
  internalNotes?: string | null
  cancelOrTerminateReason?: string | null
  signedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
export type ContractCreateInput = Partial<Omit<VehicleRentalContract, 'id' | 'code' | 'statusLabel' | 'statusTone' | 'inquirySummary' | 'quotationSummary' | 'bookingSummary' | 'assignedVehicles' | 'settlementSummary' | 'signedAt' | 'completedAt' | 'createdAt' | 'updatedAt'>>
export type ContractUpdateInput = ContractCreateInput & { cancelOrTerminateReason?: string | null }

export async function adminSuggestAvailableVehicles(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ days: number; items: VehicleSuggestion[] }>(`/admin/rentals/suggest-available-vehicles${qs ? `?${qs}` : ''}`)
}
export async function adminListContracts(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleRentalContract[]; total: number; page: number; limit: number }>(`/admin/rentals/contracts${qs ? `?${qs}` : ''}`)
}
export async function adminGetContract(id: string) {
  return apiFetch<VehicleRentalContract>(`/admin/rentals/contracts/${id}`)
}
export async function adminCreateContract(input: ContractCreateInput) {
  return apiFetch<VehicleRentalContract>(`/admin/rentals/contracts`, { method: 'POST', body: JSON.stringify(input) })
}
export async function adminUpdateContract(id: string, input: ContractUpdateInput) {
  return apiFetch<VehicleRentalContract>(`/admin/rentals/contracts/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function adminContractAction(id: string, action: any) {
  return apiFetch<VehicleRentalContract>(`/admin/rentals/contracts/${id}/actions`, { method: 'POST', body: JSON.stringify(action) })
}
export async function adminDeleteContract(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/rentals/contracts/${id}`, { method: 'DELETE' })
}

/* ========== 4) HANDOVER (Giao xe / Thu hồi xe) ========== */
export type HandoverPhoto = { url: string; caption?: string | null; takenAt?: string | null }
export type VehicleHandover = {
  id: string
  code: string
  handoverType: HandoverType
  handoverTypeLabel?: string
  status: HandoverStatus
  statusLabel?: string
  statusTone?: string
  contractId: string
  contractSummary?: IdSummary | null
  vehicleId: string
  vehicleSummary?: { id: string; plateNumber?: string | null; vehicleType?: string | null; status?: string | null } | null
  pairedPickupHandoverId?: string | null
  pairedPickupSummary?: IdSummary | null
  checklist: ChecklistItem[]
  damagePhotos: HandoverPhoto[]
  mileageKm?: number | null
  fuelPercent?: number | null
  dailyKmLimit?: number | null
  staffSignerId?: string | null
  customerSignerName?: string | null
  customerSignerCitizenId?: string | null
  signedAt?: string | null
  verifiedById?: string | null
  verifiedAt?: string | null
  cancelReason?: string | null
  notes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
export type HandoverCreateInput = Partial<Omit<VehicleHandover, 'id' | 'code' | 'handoverTypeLabel' | 'statusLabel' | 'statusTone' | 'contractSummary' | 'vehicleSummary' | 'pairedPickupSummary' | 'signedAt' | 'verifiedAt' | 'createdAt' | 'updatedAt'>>

export async function adminDefaultChecklist(p: { handoverType: 'pickup' | 'return'; vehicleClass?: VehicleClass }) {
  const params = new URLSearchParams()
  params.set('handoverType', p.handoverType)
  if (p.vehicleClass) params.set('vehicleClass', p.vehicleClass)
  return apiFetch<{ items: ChecklistItem[] }>(`/admin/rentals/handovers/default-checklist?${params.toString()}`)
}
export async function adminListHandovers(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleHandover[]; total: number; page: number; limit: number }>(`/admin/rentals/handovers${qs ? `?${qs}` : ''}`)
}
export async function adminGetHandover(id: string) {
  return apiFetch<VehicleHandover>(`/admin/rentals/handovers/${id}`)
}
export async function adminCreateHandover(input: HandoverCreateInput) {
  return apiFetch<VehicleHandover>(`/admin/rentals/handovers`, { method: 'POST', body: JSON.stringify(input) })
}
export async function adminUpdateHandover(id: string, input: HandoverCreateInput) {
  return apiFetch<VehicleHandover>(`/admin/rentals/handovers/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function adminHandoverAction(id: string, action: any) {
  return apiFetch<VehicleHandover>(`/admin/rentals/handovers/${id}/actions`, { method: 'POST', body: JSON.stringify(action) })
}
export async function adminDeleteHandover(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/rentals/handovers/${id}`, { method: 'DELETE' })
}

/* ========== 5) SETTLEMENT (Thanh toán cuối + Trả thế chấp) ========== */
export type SettlementLineItem = {
  key: string
  label: string
  amountVnd: number
  note?: string | null
}
export type VehicleSettlement = {
  id: string
  code: string
  status: SettlementStatus
  statusLabel?: string
  statusTone?: string
  contractId: string
  contractSummary?: IdSummary | null
  returnHandoverId: string
  returnHandoverSummary?: IdSummary | null
  lineItems: SettlementLineItem[]
  excessKm?: number | null
  excessKmRateVnd?: number | null
  excessKmTotalVnd?: number | null
  fuelDeficitLiters?: number | null
  fuelRatePerLiterVnd?: number | null
  fuelDeficitTotalVnd?: number | null
  damagesRepairTotalVnd?: number
  latePenaltyTotalVnd?: number
  cleaningFeeVnd?: number
  otherExtraTotalVnd?: number
  totalExtraChargesVnd: number
  customerMustPayVnd: number
  refundToCustomerVnd: number
  depositPapersReturned: boolean
  collateralCashReturnedVnd: number
  collateralOtherReturned?: string | null
  finalPaidVnd: number
  finalPaidAt?: string | null
  collateralReturnedAt?: string | null
  disputeReason?: string | null
  internalNotes?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
export type SettlementCreateInput = Partial<Omit<VehicleSettlement, 'id' | 'code' | 'statusLabel' | 'statusTone' | 'contractSummary' | 'returnHandoverSummary' | 'finalPaidAt' | 'collateralReturnedAt' | 'createdAt' | 'updatedAt'>>

export async function adminListSettlements(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleSettlement[]; total: number; page: number; limit: number }>(`/admin/rentals/settlements${qs ? `?${qs}` : ''}`)
}
export async function adminGetSettlement(id: string) {
  return apiFetch<VehicleSettlement>(`/admin/rentals/settlements/${id}`)
}
export async function adminCreateSettlement(input: SettlementCreateInput) {
  return apiFetch<VehicleSettlement>(`/admin/rentals/settlements`, { method: 'POST', body: JSON.stringify(input) })
}
export async function adminUpdateSettlement(id: string, input: SettlementCreateInput) {
  return apiFetch<VehicleSettlement>(`/admin/rentals/settlements/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function adminSettlementAction(id: string, action: any) {
  return apiFetch<VehicleSettlement>(`/admin/rentals/settlements/${id}/actions`, { method: 'POST', body: JSON.stringify(action) })
}
export async function adminDeleteSettlement(id: string) {
  return apiFetch<{ ok: boolean }>(`/admin/rentals/settlements/${id}`, { method: 'DELETE' })
}

/* ========== DASHBOARD STATS ========== */
export type RentalsDashboardStats = {
  inquiryByStatus: { status: string; count: number; statusLabel: string; statusTone: string }[]
  quotationByStatus: { status: string; count: number; totalGrandVnd: number; statusLabel: string; statusTone: string }[]
  contractByStatus: { status: string; count: number; totalGrandAllVnd: number; openReceivableVnd: number; statusLabel: string; statusTone: string }[]
  handoverByStatus: { handoverType: string; status: string; count: number; typeLabel: string; statusLabel: string }[]
  settlementByStatus: { status: string; count: number; finalPaidAllVnd: number; totalExtraCharges: number; statusLabel: string; statusTone: string }[]
  vehicleByClass: { vehicleClass: string; count: number; availableCount: number; inUseCount: number; classLabel: string; classTone: string }[]
  total: {
    openInquiry: number
    openQuotationApproved: number
    activeContracts: number
    openReceivableAllVnd: number
    settlementsPendingPayment: number
  }
}

export async function adminRentalsDashboardStats() {
  return apiFetch<RentalsDashboardStats>(`/admin/rentals/dashboard-stats`)
}

/* ========== STAFF (giới hạn quyền) API ========== */
export async function staffRentalsMeta() {
  return apiFetch<{ inquirySources: typeof INQUIRY_SOURCE_OPTIONS }>(`/staff/rentals/meta`)
}
export async function staffDefaultChecklist(p: { handoverType: 'pickup' | 'return'; vehicleClass?: VehicleClass }) {
  const params = new URLSearchParams()
  params.set('handoverType', p.handoverType)
  if (p.vehicleClass) params.set('vehicleClass', p.vehicleClass)
  return apiFetch<{ items: ChecklistItem[] }>(`/staff/rentals/handovers/default-checklist?${params.toString()}`)
}
export async function staffListInquiries(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleInquiry[]; total: number; page: number; limit: number }>(`/staff/rentals/inquiries${qs ? `?${qs}` : ''}`)
}
export async function staffListQuotations(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleQuotation[]; total: number; page: number; limit: number }>(`/staff/rentals/quotations${qs ? `?${qs}` : ''}`)
}
export async function staffListContracts(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleRentalContract[]; total: number; page: number; limit: number }>(`/staff/rentals/contracts${qs ? `?${qs}` : ''}`)
}
export async function staffListHandovers(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleHandover[]; total: number; page: number; limit: number }>(`/staff/rentals/handovers${qs ? `?${qs}` : ''}`)
}
export async function staffGetHandover(id: string) {
  return apiFetch<VehicleHandover>(`/staff/rentals/handovers/${id}`)
}
export async function staffCreateHandover(input: HandoverCreateInput) {
  return apiFetch<VehicleHandover>(`/staff/rentals/handovers`, { method: 'POST', body: JSON.stringify(input) })
}
export async function staffUpdateHandover(id: string, input: HandoverCreateInput) {
  return apiFetch<VehicleHandover>(`/staff/rentals/handovers/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
export async function staffHandoverAction(id: string, action: any) {
  return apiFetch<VehicleHandover>(`/staff/rentals/handovers/${id}/actions`, { method: 'POST', body: JSON.stringify(action) })
}
export async function staffListSettlements(p: any = {}) {
  const params = new URLSearchParams()
  Object.entries(p || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') params.set(k, String(v)) })
  const qs = params.toString()
  return apiFetch<{ items: VehicleSettlement[]; total: number; page: number; limit: number }>(`/staff/rentals/settlements${qs ? `?${qs}` : ''}`)
}

/* ========================= PUBLIC / CUSTOMER ========================= */

export type RentalVehicleTypeOption = { value: string; label: string; seats: number; suitability?: string; suggestDriverDailyVnd: number; suggestSelfDriveDailyVnd: number; hasDataInDb?: boolean; vehicleCountInDb?: number }
export type RentalVehicleClassOption = { value: string; label: string; tone: string; desc: string }
export type RentalPolicyHighlight = { key: string; title: string; desc: string }
export type RentalVehicleOptions = {
  types: RentalVehicleTypeOption[]
  classes: RentalVehicleClassOption[]
  policyHighlights: RentalPolicyHighlight[]
}

export type PublicCreateInquiryInput = {
  customerName: string
  customerPhone: string
  customerEmail?: string | null
  citizenId?: string | null
  customerAddress?: string | null
  vehicleType?: string | null
  vehicleClass?: string | null
  seatCountMin?: number | null
  pickupDateTime: string
  pickupLocation: string
  returnDateTime: string
  returnLocation: string
  withDriver?: boolean
  rentalDays?: number
  passengerCount?: number | null
  luggageCount?: number
  routeNotes?: string | null
  specialRequests?: string | null
  agreementAccepted: boolean
  bookingId?: string | null
}

export async function publicRentalsVehicleOptions() {
  return apiFetch<RentalVehicleOptions>(`/rentals/vehicle-options`)
}
export async function publicCreateInquiry(input: PublicCreateInquiryInput) {
  return apiFetch<VehicleInquiry>(`/rentals/inquiries`, { method: 'POST', body: JSON.stringify(input) })
}
export async function customerMyInquiries() {
  return apiFetch<{ items: VehicleInquiry[]; total: number; page: number; limit: number }>(`/rentals/my/inquiries`)
}
export async function customerMyContracts() {
  return apiFetch<{ items: VehicleRentalContract[]; total: number; page: number; limit: number }>(`/rentals/my/contracts`)
}

