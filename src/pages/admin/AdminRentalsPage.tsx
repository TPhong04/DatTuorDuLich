import { FormEvent, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  QUOTATION_STATUS_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  VEHICLE_CLASS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  VehicleClass,
  VehicleInquiry,
  VehicleQuotation,
  VehicleRentalContract,
  VehicleType,
  VehicleSuggestion,
  adminConfirmInquiry,
  adminContractAction,
  adminCreateContract,
  adminCreateInquiry,
  adminCreateQuotation,
  adminDeleteContract,
  adminDeleteInquiry,
  adminDeleteQuotation,
  adminListContracts,
  adminListInquiries,
  adminListQuotations,
  adminQuotationAction,
  adminRentalsDashboardStats,
  adminSuggestAvailableVehicles,
  adminUpdateContract,
  adminUpdateInquiry,
  adminUpdateQuotation,
  classVehicleInfo,
  ctrStatusInfo,
  inqSourceLabel,
  inqStatusInfo,
  quoStatusInfo,
  type ConfirmInquiryInput,
} from '@/features/rentals/rentals'
import { labelVehicleType } from '@/features/vehicles/vehicles'
import { resolveFileUrl } from '@/lib/api'
import { cn } from '@/lib/utils'

type TabKey = 'inquiry' | 'quotation' | 'contract'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'inquiry', label: 'Yêu cầu thuê xe', icon: '📝' },
  { key: 'quotation', label: 'Báo giá', icon: '💰' },
  { key: 'contract', label: 'Hợp đồng', icon: '📄' },
]

function fmtMoney(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v as any)) return '0 ₫'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v))
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '-'
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })
  } catch { return String(s) }
}
function trimOrNull(s: string | null | undefined): string | null {
  return typeof s === 'string' && s.trim() ? s.trim() : null
}
function numOrZero(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function asTypeVehicleType(s: unknown): VehicleType {
  const str = String(s ?? 'seater_7')
  if (str === 'seater_4' || str === 'seater_7' || str === 'seater_16' || str === 'seater_29' || str === 'seater_45') return str
  return 'seater_7'
}
function asTypeVehicleClass(s: unknown): VehicleClass {
  const str = String(s ?? 'seat')
  if (str === 'seat' || str === 'sleeper' || str === 'limousine' || str === 'cabin') return str as VehicleClass
  return 'seat'
}
function toLocalInput(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/* ================= INQUIRY FORM ================= */
type InquiryForm = {
  source: string
  status: string
  customerName: string
  customerPhone: string
  customerEmail: string
  bookingId: string
  vehicleType: string
  vehicleClass: string
  seatCountMin: string
  pickupDateTime: string
  pickupLocation: string
  returnDateTime: string
  returnLocation: string
  rentalDays: string
  withDriver: boolean
  estimatedDistanceKm: string
  specialRequests: string
  ownerSalesId: string
  internalNotes: string
  cancelReason: string
}
const INQ_EMPTY: InquiryForm = {
  source: 'staff', status: 'pending',
  customerName: '', customerPhone: '', customerEmail: '', bookingId: '',
  vehicleType: '', vehicleClass: '', seatCountMin: '',
  pickupDateTime: '', pickupLocation: '',
  returnDateTime: '', returnLocation: '',
  rentalDays: '1', withDriver: true, estimatedDistanceKm: '',
  specialRequests: '', ownerSalesId: '', internalNotes: '', cancelReason: '',
}
function inqFromEntity(v: VehicleInquiry | null): InquiryForm {
  if (!v) return INQ_EMPTY
  return {
    source: String(v.source ?? 'staff'),
    status: String(v.status ?? 'new'),
    customerName: v.customerName ?? '',
    customerPhone: v.customerPhone ?? '',
    customerEmail: v.customerEmail ?? '',
    bookingId: v.bookingId ?? '',
    vehicleType: v.vehicleType ?? '',
    vehicleClass: v.vehicleClass ?? '',
    seatCountMin: v.seatCountMin != null ? String(v.seatCountMin) : '',
    pickupDateTime: toLocalInput(v.pickupDateTime),
    pickupLocation: v.pickupLocation ?? '',
    returnDateTime: toLocalInput(v.returnDateTime),
    returnLocation: v.returnLocation ?? '',
    rentalDays: String(v.rentalDays ?? '1'),
    withDriver: !!v.withDriver,
    estimatedDistanceKm: v.estimatedDistanceKm != null ? String(v.estimatedDistanceKm) : '',
    specialRequests: v.specialRequests ?? '',
    ownerSalesId: v.ownerSalesId ?? '',
    internalNotes: v.internalNotes ?? '',
    cancelReason: '',
  }
}

/* ================= QUOTATION FORM ================= */
type QuotationLine = { key: string; label: string; unitPriceVnd: string; quantity: string; notes: string }
type QuotationForm = {
  inquiryId: string
  validityDays: string
  vehicleType: string
  vehicleClass: string
  suggestedVehicleIds: string[]
  lineItems: QuotationLine[]
  depositPercentRequired: string
  termsHtml: string
  internalNotes: string
  rejectReason: string
}
const QUO_EMPTY: QuotationForm = {
  inquiryId: '', validityDays: '7',
  vehicleType: '', vehicleClass: '', suggestedVehicleIds: [],
  lineItems: [{ key: 'rental_fee', label: 'Phí thuê xe', unitPriceVnd: '0', quantity: '1', notes: '' }],
  depositPercentRequired: '30',
  termsHtml: '', internalNotes: '', rejectReason: '',
}
function quoLineTotal(l: QuotationLine): number { return numOrZero(l.unitPriceVnd) * numOrZero(l.quantity) }
function quoTotals(f: QuotationForm) {
  const sub = f.lineItems.reduce((t, l) => t + quoLineTotal(l), 0)
  const vat = 0
  const grand = sub + vat
  const depositPct = Math.min(100, Math.max(0, numOrZero(f.depositPercentRequired)))
  const deposit = Math.round(grand * depositPct / 100)
  return { sub, vat, grand, depositPct, deposit }
}

/* ================= CONFIRM INQUIRY FORM (shared inline & View modal) ================= */
type ConfirmForm = {
  suggestedBaseAmountVnd: string
  suggestedDriverFeeVnd: string
  suggestedExtrasVnd: string
  suggestedDiscountPercent: string
  suggestedDepositRequiredVnd: string
  suggestedValidUntilDate: string
  customNotifTitle: string
  customNotifBody: string
}
function emptyConfirmForm(v?: VehicleInquiry | null): ConfirmForm {
  const rentalDays = Math.max(1, Number(v?.rentalDays ?? 1))
  const baseAuto = (v?.withDriver ? 2500000 : 1500000) * rentalDays
  const defaultValid = new Date(Date.now() + 7 * 24 * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const validUntilLocal = `${defaultValid.getFullYear()}-${pad(defaultValid.getMonth() + 1)}-${pad(defaultValid.getDate())}`
  return {
    suggestedBaseAmountVnd: String(baseAuto),
    suggestedDriverFeeVnd: v?.withDriver ? String(300000 * rentalDays) : '0',
    suggestedExtrasVnd: '0',
    suggestedDiscountPercent: '0',
    suggestedDepositRequiredVnd: String(Math.round(baseAuto * 0.3)),
    suggestedValidUntilDate: validUntilLocal,
    customNotifTitle: '',
    customNotifBody: '',
  }
}
function confirmTotals(f: ConfirmForm, rentalDays: number = 1) {
  const base = numOrZero(f.suggestedBaseAmountVnd)
  const driver = numOrZero(f.suggestedDriverFeeVnd)
  const extras = numOrZero(f.suggestedExtrasVnd)
  const sub = base + driver + extras
  const discountPct = Math.min(100, Math.max(0, numOrZero(f.suggestedDiscountPercent)))
  const discount = Math.round(sub * discountPct / 100)
  const afterDisc = Math.max(0, sub - discount)
  const vatRate = 10
  const vat = Math.round(afterDisc * vatRate / 100)
  const grand = afterDisc + vat
  const deposit = numOrZero(f.suggestedDepositRequiredVnd) || Math.round(grand * 0.3)
  return { base, driver, extras, sub, discountPct, discount, afterDisc, vatRate, vat, grand, deposit, rentalDays }
}

/* ================= CONTRACT FORM ================= */
type ContractForm = {
  inquiryId: string
  quotationId: string
  bookingId: string
  vehicleType: string
  vehicleClass: string
  customerName: string
  customerPhone: string
  customerEmail: string
  citizenId: string
  citizenIdIssuePlace: string
  citizenIdIssueDate: string
  customerAddress: string
  driverLicenseNumber: string
  driverLicenseClass: string
  assignedVehicleIds: string[]
  withDriver: boolean
  pickupDateTime: string
  pickupLocation: string
  returnDateTime: string
  returnLocation: string
  rentalDays: string
  totalGrandVnd: string
  depositRequiredVnd: string
  depositPaidVnd: string
  paidVnd: string
  depositPapersHeld: boolean
  collateralCashVnd: string
  collateralOther: string
  requireVatInvoice: boolean
  invoiceCompanyName: string
  invoiceTaxCode: string
  invoiceAddress: string
  ownerSalesId: string
  termsHtml: string
  internalNotes: string
  cancelOrTerminateReason: string
}
const CTR_EMPTY: ContractForm = {
  inquiryId: '', quotationId: '', bookingId: '',
  vehicleType: '', vehicleClass: '',
  customerName: '', customerPhone: '', customerEmail: '',
  citizenId: '', citizenIdIssuePlace: '', citizenIdIssueDate: '',
  customerAddress: '', driverLicenseNumber: '', driverLicenseClass: '',
  assignedVehicleIds: [], withDriver: true,
  pickupDateTime: '', pickupLocation: '',
  returnDateTime: '', returnLocation: '',
  rentalDays: '1',
  totalGrandVnd: '0', depositRequiredVnd: '0', depositPaidVnd: '0', paidVnd: '0',
  depositPapersHeld: false, collateralCashVnd: '0', collateralOther: '',
  requireVatInvoice: false, invoiceCompanyName: '', invoiceTaxCode: '', invoiceAddress: '',
  ownerSalesId: '', termsHtml: '', internalNotes: '', cancelOrTerminateReason: '',
}

/* ================= BADGE (inline) ================= */
function Badge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const t = tone || 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', t)}>
      {children}
    </span>
  )
}

/* ================= SELECT (inline simple) ================= */
function Select({
  value, onChange, options, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}) {
  return (
    <select
      className={cn('block w-full rounded-md border-0 py-2 pl-3 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-500 bg-white', className)}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

export default function AdminRentalsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<TabKey>('inquiry')

  const [stats, setStats] = useState<{
    openInquiry?: number; openQuotationApproved?: number; activeContracts?: number;
    openReceivableAllVnd?: number; settlementsPendingPayment?: number
  }>({})
  const loadStats = async () => {
    try {
      const s = await adminRentalsDashboardStats()
      setStats({
        openInquiry: s.total?.openInquiry,
        openQuotationApproved: s.total?.openQuotationApproved,
        activeContracts: s.total?.activeContracts,
        openReceivableAllVnd: s.total?.openReceivableAllVnd,
        settlementsPendingPayment: s.total?.settlementsPendingPayment,
      })
    } catch { /* ignore */ }
  }
  useEffect(() => { void loadStats() }, [])

  /* ===== INQUIRY STATE ===== */
  const [inqLoading, setInqLoading] = useState(true)
  const [inqItems, setInqItems] = useState<VehicleInquiry[]>([])
  const [inqTotal, setInqTotal] = useState(0)
  const [inqPage, setInqPage] = useState(1)
  const [inqQ, setInqQ] = useState('')
  const [inqFStatus, setInqFStatus] = useState<string>('')
  const [inqFSource, setInqFSource] = useState<string>('')
  const [inqFVType, setInqFVType] = useState<string>('')

  const [inqFormOpen, setInqFormOpen] = useState(false)
  const [inqEditingId, setInqEditingId] = useState<string | null>(null)
  const [inqSaving, setInqSaving] = useState(false)
  const [inqForm, setInqForm] = useState<InquiryForm>(INQ_EMPTY)
  const [inqSaveErr, setInqSaveErr] = useState<string | null>(null)

  const [viewInquiryId, setViewInquiryId] = useState<string | null>(null)
  const [confirmForm, setConfirmForm] = useState<ConfirmForm>(emptyConfirmForm())
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmErr, setConfirmErr] = useState<string | null>(null)
  const viewInquiry = useMemo(
    () => inqItems.find((x) => x.id === viewInquiryId) ?? null,
    [inqItems, viewInquiryId],
  )
  const viewConfirmTotals = useMemo(
    () => confirmTotals(confirmForm, Number(viewInquiry?.rentalDays ?? 1)),
    [confirmForm, viewInquiry],
  )

  const refreshInq = async (targetPage = 1) => {
    try {
      setInqLoading(true)
      const res = await adminListInquiries({
        page: targetPage, limit: 20,
        q: inqQ.trim() || undefined,
        status: inqFStatus || undefined,
        source: inqFSource || undefined,
        vehicleType: inqFVType || undefined,
      })
      setInqItems(Array.isArray(res.items) ? (res.items as VehicleInquiry[]) : [])
      setInqTotal(Number(res.total) || 0)
      setInqPage(targetPage)
    } catch (e: any) {
      toast.error('Không tải được danh sách yêu cầu: ' + (e?.message || 'Lỗi'))
    } finally {
      setInqLoading(false)
    }
  }
  useEffect(() => { if (tab === 'inquiry') void refreshInq() }, [tab])
  const submitInqForm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setInqSaving(true); setInqSaveErr(null)
      const payload = {
        source: inqForm.source as any, status: inqForm.status as any,
        customerName: inqForm.customerName.trim() || undefined,
        customerPhone: inqForm.customerPhone.trim() || undefined,
        customerEmail: trimOrNull(inqForm.customerEmail),
        bookingId: trimOrNull(inqForm.bookingId),
        vehicleType: (inqForm.vehicleType || undefined) as any,
        vehicleClass: (inqForm.vehicleClass || undefined) as any,
        seatCountMin: inqForm.seatCountMin === '' ? null : numOrZero(inqForm.seatCountMin),
        pickupDateTime: inqForm.pickupDateTime ? new Date(inqForm.pickupDateTime).toISOString() : undefined,
        pickupLocation: inqForm.pickupLocation.trim() || undefined,
        returnDateTime: inqForm.returnDateTime ? new Date(inqForm.returnDateTime).toISOString() : undefined,
        returnLocation: inqForm.returnLocation.trim() || undefined,
        rentalDays: numOrZero(inqForm.rentalDays),
        withDriver: !!inqForm.withDriver,
        estimatedDistanceKm: inqForm.estimatedDistanceKm === '' ? null : numOrZero(inqForm.estimatedDistanceKm),
        specialRequests: trimOrNull(inqForm.specialRequests),
        ownerSalesId: trimOrNull(inqForm.ownerSalesId),
        internalNotes: trimOrNull(inqForm.internalNotes),
        cancelReason: trimOrNull(inqForm.cancelReason),
      }
      if (inqEditingId) await adminUpdateInquiry(inqEditingId, payload)
      else await adminCreateInquiry(payload)
      toast.success(inqEditingId ? 'Đã cập nhật yêu cầu' : 'Đã tạo yêu cầu')
      setInqFormOpen(false); setInqEditingId(null); setInqForm(INQ_EMPTY)
      await Promise.all([refreshInq(inqPage), loadStats()])
    } catch (e: any) {
      setInqSaveErr(e?.message || 'Lỗi lưu')
      toast.error(e?.message || 'Lỗi lưu yêu cầu')
    } finally {
      setInqSaving(false)
    }
  }
  const openInqNew = () => { setInqEditingId(null); setInqForm(INQ_EMPTY); setInqSaveErr(null); setInqFormOpen(true) }
  const openInqEdit = (v: VehicleInquiry) => { setInqEditingId(v.id); setInqForm(inqFromEntity(v)); setInqSaveErr(null); setInqFormOpen(true) }
  const doDeleteInq = async (v: VehicleInquiry) => {
    if (!confirm(`Xóa yêu cầu ${v.code} (${v.customerName})?`)) return
    try { await adminDeleteInquiry(v.id); toast.success('Đã xóa'); await Promise.all([refreshInq(inqPage), loadStats()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi xóa') }
  }
  const quickInqStatus = async (v: VehicleInquiry, nextStatus: string, extra?: any) => {
    try {
      await adminUpdateInquiry(v.id, { status: nextStatus as any, ...(extra || {}) })
      toast.success(`Cập nhật ${inqStatusInfo(nextStatus).label}`)
      await Promise.all([refreshInq(inqPage), loadStats()])
    } catch (e: any) { toast.error(e?.message || 'Lỗi') }
  }
  const openViewInquiry = (v: VehicleInquiry) => {
    setViewInquiryId(v.id)
    setConfirmForm(emptyConfirmForm(v))
    setConfirmErr(null)
  }
  const doConfirmInquiry = async (inquiry: VehicleInquiry, form: ConfirmForm, opts?: { openInView?: boolean }) => {
    try {
      setConfirmLoading(true); setConfirmErr(null)
      const payload: ConfirmInquiryInput = {
        suggestedBaseAmountVnd: numOrZero(form.suggestedBaseAmountVnd),
        suggestedDriverFeeVnd: numOrZero(form.suggestedDriverFeeVnd),
        suggestedExtrasVnd: numOrZero(form.suggestedExtrasVnd),
        suggestedDiscountPercent: numOrZero(form.suggestedDiscountPercent),
        suggestedDepositRequiredVnd: numOrZero(form.suggestedDepositRequiredVnd),
        suggestedValidUntilDate: form.suggestedValidUntilDate ? new Date(form.suggestedValidUntilDate).toISOString() : null,
        customNotifTitle: trimOrNull(form.customNotifTitle),
        customNotifBody: trimOrNull(form.customNotifBody),
      }
      const result = await adminConfirmInquiry(inquiry.id, payload)
      toast.success(`Đã xác nhận yêu cầu ${result.inquiry.code}. Tổng ${fmtMoney(result.totalGrandVnd)}, Cọc ${fmtMoney(result.depositRequiredVnd)}`)
      if (opts?.openInView) {
        setViewInquiryId(null)
      }
      if (result.pdfDownloadUrl) {
        try { window.open(resolveFileUrl(result.pdfDownloadUrl) || result.pdfDownloadUrl, '_blank', 'noopener,noreferrer') } catch { /* ignore */ }
      }
      await Promise.all([refreshInq(inqPage), loadStats()])
    } catch (e: any) {
      setConfirmErr(e?.message || 'Lỗi xác nhận yêu cầu')
      toast.error(e?.message || 'Lỗi xác nhận yêu cầu')
    } finally { setConfirmLoading(false) }
  }

  /* ===== QUOTATION STATE ===== */
  const [quoLoading, setQuoLoading] = useState(true)
  const [quoItems, setQuoItems] = useState<VehicleQuotation[]>([])
  const [quoTotal, setQuoTotal] = useState(0)
  const [quoPage, setQuoPage] = useState(1)
  const [quoQ, setQuoQ] = useState('')
  const [quoFStatus, setQuoFStatus] = useState<string>('')
  const [quoFVType, setQuoFVType] = useState<string>('')

  const [quoFormOpen, setQuoFormOpen] = useState(false)
  const [quoEditingId, setQuoEditingId] = useState<string | null>(null)
  const [quoSaving, setQuoSaving] = useState(false)
  const [quoForm, setQuoForm] = useState<QuotationForm>(QUO_EMPTY)
  const [quoSaveErr, setQuoSaveErr] = useState<string | null>(null)

  const quoTots = useMemo(() => quoTotals(quoForm), [quoForm])

  const refreshQuo = async (targetPage = 1) => {
    try {
      setQuoLoading(true)
      const res = await adminListQuotations({
        page: targetPage, limit: 20,
        q: quoQ.trim() || undefined,
        status: quoFStatus || undefined,
        vehicleType: quoFVType || undefined,
      })
      setQuoItems(Array.isArray(res.items) ? (res.items as VehicleQuotation[]) : [])
      setQuoTotal(Number(res.total) || 0)
      setQuoPage(targetPage)
    } catch (e: any) {
      toast.error('Không tải được danh sách báo giá: ' + (e?.message || 'Lỗi'))
    } finally { setQuoLoading(false) }
  }
  useEffect(() => { if (tab === 'quotation') void refreshQuo() }, [tab])
  const submitQuoForm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setQuoSaving(true); setQuoSaveErr(null)
      const lineItems = quoForm.lineItems.map((l) => ({
        key: l.key.trim() || `line_${Math.random().toString(36).slice(2, 7)}`,
        label: l.label.trim() || '(chưa đặt tên)',
        unitPriceVnd: numOrZero(l.unitPriceVnd),
        quantity: numOrZero(l.quantity),
        totalVnd: quoLineTotal(l),
        notes: trimOrNull(l.notes),
      }))
      const payload = {
        inquiryId: trimOrNull(quoForm.inquiryId),
        validityDays: numOrZero(quoForm.validityDays) || 7,
        vehicleType: (quoForm.vehicleType || undefined) as any,
        vehicleClass: (quoForm.vehicleClass || undefined) as any,
        suggestedVehicleIds: quoForm.suggestedVehicleIds.filter(Boolean),
        lineItems,
        totalSubVnd: quoTots.sub,
        totalVatVnd: quoTots.vat,
        totalGrandVnd: quoTots.grand,
        depositPercentRequired: quoTots.depositPct,
        depositRequiredVnd: quoTots.deposit,
        termsHtml: trimOrNull(quoForm.termsHtml),
        internalNotes: trimOrNull(quoForm.internalNotes),
        rejectReason: trimOrNull(quoForm.rejectReason),
      }
      if (quoEditingId) await adminUpdateQuotation(quoEditingId, payload)
      else await adminCreateQuotation(payload)
      toast.success(quoEditingId ? 'Đã cập nhật báo giá' : 'Đã tạo báo giá')
      setQuoFormOpen(false); setQuoEditingId(null); setQuoForm(QUO_EMPTY)
      await Promise.all([refreshQuo(quoPage), loadStats()])
    } catch (e: any) {
      setQuoSaveErr(e?.message || 'Lỗi lưu')
      toast.error(e?.message || 'Lỗi lưu báo giá')
    } finally { setQuoSaving(false) }
  }
  const openQuoNew = () => { setQuoEditingId(null); setQuoForm(QUO_EMPTY); setQuoSaveErr(null); setQuoFormOpen(true) }
  const openQuoEdit = (v: VehicleQuotation) => {
    setQuoEditingId(v.id)
    setQuoForm({
      inquiryId: v.inquiryId ?? '',
      validityDays: String(v.validityDays ?? 7),
      vehicleType: v.vehicleType ?? '',
      vehicleClass: v.vehicleClass ?? '',
      suggestedVehicleIds: Array.isArray(v.suggestedVehicleIds) ? [...v.suggestedVehicleIds] : [],
      lineItems: Array.isArray(v.lineItems) && v.lineItems.length
        ? v.lineItems.map((l) => ({ key: l.key, label: l.label, unitPriceVnd: String(l.unitPriceVnd || 0), quantity: String(l.quantity || 0), notes: l.notes ?? '' }))
        : QUO_EMPTY.lineItems,
      depositPercentRequired: String(v.depositPercentRequired ?? 30),
      termsHtml: v.termsHtml ?? '',
      internalNotes: v.internalNotes ?? '',
      rejectReason: '',
    })
    setQuoSaveErr(null); setQuoFormOpen(true)
  }
  const doDeleteQuo = async (v: VehicleQuotation) => {
    if (!confirm(`Xóa báo giá ${v.code}?`)) return
    try { await adminDeleteQuotation(v.id); toast.success('Đã xóa'); await Promise.all([refreshQuo(quoPage), loadStats()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi xóa') }
  }
  const doQuoAction = async (v: VehicleQuotation, actionObj: any) => {
    try { await adminQuotationAction(v.id, actionObj); toast.success('Đã thực hiện thao tác'); await Promise.all([refreshQuo(quoPage), loadStats()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi') }
  }

  /* ===== CONTRACT STATE ===== */
  const [ctrLoading, setCtrLoading] = useState(true)
  const [ctrItems, setCtrItems] = useState<VehicleRentalContract[]>([])
  const [ctrTotal, setCtrTotal] = useState(0)
  const [ctrPage, setCtrPage] = useState(1)
  const [ctrQ, setCtrQ] = useState('')
  const [ctrFStatus, setCtrFStatus] = useState<string>('')
  const [ctrFVType, setCtrFVType] = useState<string>('')

  const [ctrFormOpen, setCtrFormOpen] = useState(false)
  const [ctrEditingId, setCtrEditingId] = useState<string | null>(null)
  const [ctrSaving, setCtrSaving] = useState(false)
  const [ctrForm, setCtrForm] = useState<ContractForm>(CTR_EMPTY)
  const [ctrSaveErr, setCtrSaveErr] = useState<string | null>(null)
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [suggestItems, setSuggestItems] = useState<VehicleSuggestion[]>([])

  // Quick assign vehicles modal
  const [assignOpen, setAssignOpen] = useState(false)
  const [assignContract, setAssignContract] = useState<VehicleRentalContract | null>(null)
  const [assignSelectedIds, setAssignSelectedIds] = useState<string[]>([])
  const [assignSaving, setAssignSaving] = useState(false)
  const [assignSuggestLoading, setAssignSuggestLoading] = useState(false)
  const [assignSuggestItems, setAssignSuggestItems] = useState<VehicleSuggestion[]>([])

  const openAssignModal = async (v: VehicleRentalContract) => {
    setAssignContract(v)
    setAssignSelectedIds(Array.isArray(v.assignedVehicleIds) ? [...v.assignedVehicleIds].filter(Boolean) : [])
    setAssignSuggestItems([])
    setAssignOpen(true)
    if (v.pickupDateTime && v.returnDateTime) {
      try {
        setAssignSuggestLoading(true)
        const firstV = Array.isArray((v as any).assignedVehicles) ? (v as any).assignedVehicles[0] as any : null
        const r = await adminSuggestAvailableVehicles({
          pickupDateTime: new Date(v.pickupDateTime).toISOString(),
          returnDateTime: new Date(v.returnDateTime).toISOString(),
          vehicleType: firstV?.vehicleType || undefined,
          vehicleClass: firstV?.vehicleClass || undefined,
        })
        setAssignSuggestItems(Array.isArray(r.items) ? r.items : [])
      } catch (e: any) { toast.warning('Không gợi ý được xe: ' + (e?.message || '')) }
      finally { setAssignSuggestLoading(false) }
    }
  }
  const doAssignSave = async () => {
    if (!assignContract) return
    try {
      setAssignSaving(true)
      await adminContractAction(assignContract.id, { action: 'assign_vehicles', vehicleIds: assignSelectedIds.filter(Boolean) })
      toast.success('Đã cập nhật xe gán cho hợp đồng')
      setAssignOpen(false)
      setAssignContract(null)
      await Promise.all([refreshCtr(ctrPage), loadStats()])
    } catch (e: any) { toast.error(e?.message || 'Lỗi gán xe') }
    finally { setAssignSaving(false) }
  }

  const refreshCtr = async (targetPage = 1) => {
    try {
      setCtrLoading(true)
      const res = await adminListContracts({
        page: targetPage, limit: 20,
        q: ctrQ.trim() || undefined,
        status: ctrFStatus || undefined,
        vehicleType: ctrFVType || undefined,
      })
      setCtrItems(Array.isArray(res.items) ? (res.items as VehicleRentalContract[]) : [])
      setCtrTotal(Number(res.total) || 0)
      setCtrPage(targetPage)
    } catch (e: any) { toast.error('Không tải được hợp đồng: ' + (e?.message || 'Lỗi')) }
    finally { setCtrLoading(false) }
  }
  useEffect(() => { if (tab === 'contract') void refreshCtr() }, [tab])
  const loadSuggest = async () => {
    const from = ctrForm.pickupDateTime
    const to = ctrForm.returnDateTime
    if (!from || !to) { toast.warning('Chọn ngày nhận/trước khi gợi ý xe'); return }
    try {
      setSuggestLoading(true)
      const r = await adminSuggestAvailableVehicles({
        pickupDateTime: new Date(from).toISOString(),
        returnDateTime: new Date(to).toISOString(),
        vehicleType: ctrForm.vehicleType || undefined,
        vehicleClass: ctrForm.vehicleClass || undefined,
      })
      setSuggestItems(Array.isArray(r.items) ? r.items : [])
    } catch (e: any) { toast.error(e?.message || 'Không gợi ý được xe') }
    finally { setSuggestLoading(false) }
  }
  const submitCtrForm = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setCtrSaving(true); setCtrSaveErr(null)
      const payload = {
        inquiryId: trimOrNull(ctrForm.inquiryId),
        quotationId: trimOrNull(ctrForm.quotationId),
        bookingId: trimOrNull(ctrForm.bookingId),
        customerName: ctrForm.customerName.trim() || undefined,
        customerPhone: ctrForm.customerPhone.trim() || undefined,
        customerEmail: trimOrNull(ctrForm.customerEmail),
        citizenId: ctrForm.citizenId.trim() || undefined,
        citizenIdIssuePlace: trimOrNull(ctrForm.citizenIdIssuePlace),
        citizenIdIssueDate: ctrForm.citizenIdIssueDate ? new Date(ctrForm.citizenIdIssueDate).toISOString() : undefined,
        customerAddress: ctrForm.customerAddress.trim() || undefined,
        driverLicenseNumber: trimOrNull(ctrForm.driverLicenseNumber),
        driverLicenseClass: trimOrNull(ctrForm.driverLicenseClass),
        assignedVehicleIds: ctrForm.assignedVehicleIds.filter(Boolean),
        withDriver: !!ctrForm.withDriver,
        pickupDateTime: ctrForm.pickupDateTime ? new Date(ctrForm.pickupDateTime).toISOString() : undefined,
        pickupLocation: ctrForm.pickupLocation.trim() || undefined,
        returnDateTime: ctrForm.returnDateTime ? new Date(ctrForm.returnDateTime).toISOString() : undefined,
        returnLocation: ctrForm.returnLocation.trim() || undefined,
        rentalDays: numOrZero(ctrForm.rentalDays),
        totalGrandVnd: numOrZero(ctrForm.totalGrandVnd),
        depositRequiredVnd: numOrZero(ctrForm.depositRequiredVnd),
        depositPaidVnd: numOrZero(ctrForm.depositPaidVnd),
        paidVnd: numOrZero(ctrForm.paidVnd),
        depositPapersHeld: !!ctrForm.depositPapersHeld,
        collateralCashVnd: numOrZero(ctrForm.collateralCashVnd),
        collateralOther: trimOrNull(ctrForm.collateralOther),
        requireVatInvoice: !!ctrForm.requireVatInvoice,
        invoiceCompanyName: trimOrNull(ctrForm.invoiceCompanyName),
        invoiceTaxCode: trimOrNull(ctrForm.invoiceTaxCode),
        invoiceAddress: trimOrNull(ctrForm.invoiceAddress),
        ownerSalesId: trimOrNull(ctrForm.ownerSalesId),
        termsHtml: trimOrNull(ctrForm.termsHtml),
        internalNotes: trimOrNull(ctrForm.internalNotes),
        cancelOrTerminateReason: trimOrNull(ctrForm.cancelOrTerminateReason),
      }
      if (ctrEditingId) await adminUpdateContract(ctrEditingId, payload)
      else await adminCreateContract(payload)
      toast.success(ctrEditingId ? 'Đã cập nhật hợp đồng' : 'Đã tạo hợp đồng')
      setCtrFormOpen(false); setCtrEditingId(null); setCtrForm(CTR_EMPTY); setSuggestItems([])
      await Promise.all([refreshCtr(ctrPage), loadStats()])
    } catch (e: any) {
      setCtrSaveErr(e?.message || 'Lỗi lưu')
      toast.error(e?.message || 'Lỗi lưu hợp đồng')
    } finally { setCtrSaving(false) }
  }
  const openCtrNew = () => { setCtrEditingId(null); setCtrForm(CTR_EMPTY); setCtrSaveErr(null); setSuggestItems([]); setCtrFormOpen(true) }
  const openCtrEdit = (v: VehicleRentalContract) => {
    setCtrEditingId(v.id)
    const firstV = Array.isArray(v.assignedVehicles) ? v.assignedVehicles[0] as any : null
    setCtrForm({
      inquiryId: v.inquiryId ?? '', quotationId: v.quotationId ?? '', bookingId: v.bookingId ?? '',
      vehicleType: firstV?.vehicleType ?? '',
      vehicleClass: firstV?.vehicleClass ?? '',
      customerName: v.customerName ?? '', customerPhone: v.customerPhone ?? '', customerEmail: v.customerEmail ?? '',
      citizenId: v.citizenId ?? '', citizenIdIssuePlace: v.citizenIdIssuePlace ?? '', citizenIdIssueDate: toLocalInput(v.citizenIdIssueDate),
      customerAddress: v.customerAddress ?? '', driverLicenseNumber: v.driverLicenseNumber ?? '', driverLicenseClass: v.driverLicenseClass ?? '',
      assignedVehicleIds: Array.isArray(v.assignedVehicleIds) ? [...v.assignedVehicleIds] : [],
      withDriver: !!v.withDriver,
      pickupDateTime: toLocalInput(v.pickupDateTime), pickupLocation: v.pickupLocation ?? '',
      returnDateTime: toLocalInput(v.returnDateTime), returnLocation: v.returnLocation ?? '',
      rentalDays: String(v.rentalDays ?? 1),
      totalGrandVnd: String(v.totalGrandVnd ?? 0),
      depositRequiredVnd: String(v.depositRequiredVnd ?? 0),
      depositPaidVnd: String(v.depositPaidVnd ?? 0),
      paidVnd: String(v.paidVnd ?? 0),
      depositPapersHeld: !!v.depositPapersHeld,
      collateralCashVnd: String(v.collateralCashVnd ?? 0),
      collateralOther: v.collateralOther ?? '',
      requireVatInvoice: !!v.requireVatInvoice,
      invoiceCompanyName: v.invoiceCompanyName ?? '', invoiceTaxCode: v.invoiceTaxCode ?? '', invoiceAddress: v.invoiceAddress ?? '',
      ownerSalesId: v.ownerSalesId ?? '',
      termsHtml: v.termsHtml ?? '', internalNotes: v.internalNotes ?? '', cancelOrTerminateReason: '',
    })
    setCtrSaveErr(null); setSuggestItems([]); setCtrFormOpen(true)
  }
  const doDeleteCtr = async (v: VehicleRentalContract) => {
    if (!confirm(`Xóa hợp đồng ${v.code} (${v.customerName})?`)) return
    try { await adminDeleteContract(v.id); toast.success('Đã xóa'); await Promise.all([refreshCtr(ctrPage), loadStats()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi xóa') }
  }
  const doCtrAction = async (v: VehicleRentalContract, actionObj: any) => {
    try { await adminContractAction(v.id, actionObj); toast.success('Đã thực hiện'); await Promise.all([refreshCtr(ctrPage), loadStats()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi') }
  }

  /* ===== UI ===== */
  const gridCols = 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'

  return (
    <div className="space-y-4">
      <PageHeader title="Cho thuê xe" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Yêu cầu mới" value={stats.openInquiry} tone="bg-sky-50 text-sky-700 ring-sky-100" />
        <StatCard label="Báo giá đã duyệt" value={stats.openQuotationApproved} tone="bg-amber-50 text-amber-700 ring-amber-100" />
        <StatCard label="Hợp đồng đang thuê" value={stats.activeContracts} tone="bg-indigo-50 text-indigo-700 ring-indigo-100" />
        <StatCard label="Công nợ phải thu" value={stats.openReceivableAllVnd} tone="bg-rose-50 text-rose-700 ring-rose-100" money />
        <StatCard label="Thanh toán CK chờ" value={stats.settlementsPendingPayment} tone="bg-emerald-50 text-emerald-700 ring-emerald-100" />
      </div>

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60')}
            onClick={() => setTab(t.key)}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ============================================ TAB INQUIRY ============================================ */}
      {tab === 'inquiry' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              <input placeholder="Tìm tên/SĐT/địa chỉ/code…" className="w-full rounded-md px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                value={inqQ} onChange={(e) => setInqQ(e.target.value)} />
              <Select value={inqFStatus} onChange={setInqFStatus} placeholder="Trạng thái"
                options={INQUIRY_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <Select value={inqFSource} onChange={setInqFSource} placeholder="Nguồn"
                options={INQUIRY_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <Select value={inqFVType} onChange={setInqFVType} placeholder="Loại xe"
                options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200" onClick={() => void refreshInq(1)} disabled={inqLoading}>
                  {inqLoading ? '…' : 'Tìm'}
                </button>
                <button className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={openInqNew}>
                  + Tạo yêu cầu
                </button>
              </div>
            </div>
          </div>

          <TableWrap loading={inqLoading} empty={inqItems.length === 0} colSpan={10}>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <Th>Code</Th>
                <Th>Khách hàng</Th>
                <Th>Xe</Th>
                <Th>Nhận</Th>
                <Th>Trả</Th>
                <Th>Ngày</Th>
                <Th>Nguồn</Th>
                <Th>Trạng thái</Th>
                <Th>Flow</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {inqItems.map((raw) => {
                const v: any = raw
                if (!v?.id) return null
                return (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <Td className="font-mono text-xs">{v.code}</Td>
                    <Td>
                      <div className="font-medium text-slate-900">{v.customerName}</div>
                      <div className="text-xs text-slate-500">{v.customerPhone}{v.customerEmail ? ` · ${v.customerEmail}` : ''}</div>
                    </Td>
                    <Td>
                      <span className="text-xs">
                        {v.vehicleType ? labelVehicleType(v.vehicleType) : '—'}
                        {v.vehicleClass ? ` · ${classVehicleInfo(v.vehicleClass).label}` : ''}
                        {v.seatCountMin ? ` (≥${v.seatCountMin} chỗ)` : ''}
                      </span>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(v.pickupDateTime)}<div className="text-slate-500 truncate max-w-[160px]">{v.pickupLocation}</div></Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(v.returnDateTime)}<div className="text-slate-500 truncate max-w-[160px]">{v.returnLocation}</div></Td>
                    <Td className="text-center text-xs">{v.rentalDays} ngày</Td>
                    <Td className="text-xs">{inqSourceLabel(v.source)}</Td>
                    <Td><Badge tone={inqStatusInfo(v.status).tone}>{inqStatusInfo(v.status).label}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {['draft', 'pending'].includes(v.status) && (
                          <FlowBtn tone="indigo" onClick={() => {
                            if (!confirm(`Xác nhận yêu cầu ${v.code} (${v.customerName})?`)) return
                            const form = emptyConfirmForm(v)
                            void doConfirmInquiry(v, form)
                          }}>✓ Xác nhận</FlowBtn>
                        )}
                        {v.status === 'confirmed' && (
                          <>
                            {v.quotationPdfUrlPath && (
                              <a href={resolveFileUrl(v.quotationPdfUrlPath) || v.quotationPdfUrlPath} target="_blank" rel="noopener noreferrer"
                                className={cn(
                                  'px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset transition-colors inline-flex items-center gap-1',
                                  'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
                                )}
                                download>📥 Tải PDF</a>
                            )}
                            <FlowBtn tone="emerald" onClick={() => quickInqStatus(v, 'quoted')}>→ Báo giá</FlowBtn>
                          </>
                        )}
                        {v.status === 'quoted' && <FlowBtn tone="amber" onClick={() => quickInqStatus(v, 'converted')}>Thành HĐ</FlowBtn>}
                        {!['converted', 'canceled', 'lost'].includes(v.status) && (
                          <FlowBtn tone="emerald" onClick={() => quickInqStatus(v, 'converted')}>Thành HĐ</FlowBtn>
                        )}
                        {!['converted', 'canceled', 'lost'].includes(v.status) && (
                          <FlowBtn tone="rose" onClick={() => {
                            const r = prompt('Lý do mất đơn (hoặc hủy)?') ?? ''
                            const cancel = confirm('Bấm OK = Hủy, Bấm Cancel = Mất đơn')
                            void quickInqStatus(v, cancel ? 'canceled' : 'lost', { cancelReason: r })
                          }}>Mất/Hủy</FlowBtn>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="rounded px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50" onClick={() => openViewInquiry(v)}>Chi tiết</button>
                        <button className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => openInqEdit(v)}>Sửa</button>
                        <button className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onClick={() => doDeleteInq(v)}>Xóa</button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
          <PageInfo total={inqTotal} page={inqPage} pageSize={20} />

          {inqFormOpen && (
            <Modal onClose={() => setInqFormOpen(false)} title={inqEditingId ? 'Sửa yêu cầu thuê xe' : 'Tạo yêu cầu thuê xe'} size="xl">
              <form onSubmit={submitInqForm} className="space-y-3">
                <div className={gridCols}>
                  <Field label="Nguồn *"><Select value={inqForm.source} onChange={(v) => setInqForm({ ...inqForm, source: v })}
                    options={INQUIRY_SOURCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Trạng thái *"><Select value={inqForm.status} onChange={(v) => setInqForm({ ...inqForm, status: v })}
                    options={INQUIRY_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Mã Booking (nếu có)"><input className="ipt" value={inqForm.bookingId} onChange={(e) => setInqForm({ ...inqForm, bookingId: e.target.value })} /></Field>
                  <Field label="Tên khách *"><input required className="ipt" value={inqForm.customerName} onChange={(e) => setInqForm({ ...inqForm, customerName: e.target.value })} /></Field>
                  <Field label="SĐT *"><input required className="ipt" value={inqForm.customerPhone} onChange={(e) => setInqForm({ ...inqForm, customerPhone: e.target.value })} /></Field>
                  <Field label="Email"><input className="ipt" value={inqForm.customerEmail} onChange={(e) => setInqForm({ ...inqForm, customerEmail: e.target.value })} /></Field>
                  <Field label="Loại xe"><Select value={inqForm.vehicleType} onChange={(v) => setInqForm({ ...inqForm, vehicleType: v })} placeholder="(bất kỳ)"
                    options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Phân loại xe"><Select value={inqForm.vehicleClass} onChange={(v) => setInqForm({ ...inqForm, vehicleClass: v })} placeholder="(bất kỳ)"
                    options={VEHICLE_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Số ghế tối thiểu"><input type="number" min="1" className="ipt" value={inqForm.seatCountMin}
                    onChange={(e) => setInqForm({ ...inqForm, seatCountMin: e.target.value })} /></Field>
                  <Field label="Ngày nhận *"><input required type="datetime-local" className="ipt" value={inqForm.pickupDateTime}
                    onChange={(e) => setInqForm({ ...inqForm, pickupDateTime: e.target.value })} /></Field>
                  <Field label="Điểm nhận *"><input required className="ipt" value={inqForm.pickupLocation}
                    onChange={(e) => setInqForm({ ...inqForm, pickupLocation: e.target.value })} /></Field>
                  <Field label="Số ngày *"><input required type="number" min="1" className="ipt" value={inqForm.rentalDays}
                    onChange={(e) => setInqForm({ ...inqForm, rentalDays: e.target.value })} /></Field>
                  <Field label="Ngày trả *"><input required type="datetime-local" className="ipt" value={inqForm.returnDateTime}
                    onChange={(e) => setInqForm({ ...inqForm, returnDateTime: e.target.value })} /></Field>
                  <Field label="Điểm trả *"><input required className="ipt" value={inqForm.returnLocation}
                    onChange={(e) => setInqForm({ ...inqForm, returnLocation: e.target.value })} /></Field>
                  <Field label="Có tài xế?"><Select value={inqForm.withDriver ? '1' : '0'} onChange={(v) => setInqForm({ ...inqForm, withDriver: v === '1' })}
                    options={[{ value: '1', label: 'Có tài xế' }, { value: '0', label: 'Tự lái' }]} /></Field>
                  <Field label="Khoảng cách ước tính (km)"><input type="number" className="ipt" value={inqForm.estimatedDistanceKm}
                    onChange={(e) => setInqForm({ ...inqForm, estimatedDistanceKm: e.target.value })} /></Field>
                  <Field label="Sales phụ trách"><input className="ipt" value={inqForm.ownerSalesId}
                    onChange={(e) => setInqForm({ ...inqForm, ownerSalesId: e.target.value })} /></Field>
                </div>
                <Field label="Yêu cầu đặc biệt"><textarea rows={2} className="ipt" value={inqForm.specialRequests}
                  onChange={(e) => setInqForm({ ...inqForm, specialRequests: e.target.value })} /></Field>
                <Field label="Ghi chú nội bộ"><textarea rows={2} className="ipt" value={inqForm.internalNotes}
                  onChange={(e) => setInqForm({ ...inqForm, internalNotes: e.target.value })} /></Field>
                {inqEditingId && <Field label="Lý do hủy (nếu trạng thái hủy)"><input className="ipt" value={inqForm.cancelReason}
                  onChange={(e) => setInqForm({ ...inqForm, cancelReason: e.target.value })} /></Field>}
                {inqSaveErr && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{inqSaveErr}</div>}
                <div className="flex justify-end gap-2 border-t pt-3">
                  <button type="button" className="btn ghost" onClick={() => setInqFormOpen(false)}>Đóng</button>
                  <button type="submit" disabled={inqSaving} className="btn primary">{inqSaving ? 'Đang lưu…' : (inqEditingId ? 'Cập nhật' : 'Tạo yêu cầu')}</button>
                </div>
              </form>
              <style>{`
                .ipt { @apply block w-full rounded-md border-0 px-3 py-2 text-sm ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-500 bg-white; }
                .btn { @apply rounded-md px-3 py-2 text-sm font-medium; }
                .btn.primary { @apply bg-indigo-600 text-white hover:bg-indigo-500; }
                .btn.ghost { @apply bg-slate-100 text-slate-700 hover:bg-slate-200; }
              `}</style>
            </Modal>
          )}

          {viewInquiry && (
            <Modal onClose={() => setViewInquiryId(null)} title={`Chi tiết yêu cầu ${viewInquiry.code}`} size="3xl">
              <div className="space-y-4">
                <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 p-4 ring-1 ring-indigo-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-indigo-600 font-semibold">Mã yêu cầu</div>
                      <div className="text-2xl font-bold text-slate-900 tabular-nums">{viewInquiry.code}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={inqStatusInfo(viewInquiry.status).tone}>
                        {inqStatusInfo(viewInquiry.status).label}
                      </Badge>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                        {inqSourceLabel(viewInquiry.source)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs font-medium text-slate-600">Khách hàng</div>
                      <div className="mt-0.5 text-sm font-semibold text-slate-900">{viewInquiry.customerName}</div>
                      <div className="text-xs text-slate-500">
                        {viewInquiry.customerPhone}
                        {viewInquiry.customerEmail ? ` · ${viewInquiry.customerEmail}` : ''}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600">Xe & Sổ người</div>
                      <div className="mt-0.5 text-sm text-slate-800">
                        {viewInquiry.vehicleType ? labelVehicleType(viewInquiry.vehicleType) : '—'}
                        {viewInquiry.vehicleClass ? ` · ${classVehicleInfo(viewInquiry.vehicleClass).label}` : ''}
                        {viewInquiry.seatCountMin ? ` · ≥${viewInquiry.seatCountMin} chỗ` : ''}
                        {viewInquiry.withDriver ? ' · Có tài xế' : ' · Tự lái'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600">Nhận xe</div>
                      <div className="mt-0.5 text-sm text-slate-800">{fmtDate(viewInquiry.pickupDateTime)}</div>
                      <div className="text-xs text-slate-500 truncate">{viewInquiry.pickupLocation || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-600">Trả xe</div>
                      <div className="mt-0.5 text-sm text-slate-800">{fmtDate(viewInquiry.returnDateTime)}</div>
                      <div className="text-xs text-slate-500 truncate">{viewInquiry.returnLocation || '—'}</div>
                      <div className="mt-1 text-xs font-medium text-indigo-700">{viewInquiry.rentalDays} ngày thuê</div>
                    </div>
                  </div>
                  {(viewInquiry.routeNotes || viewInquiry.specialRequests) && (
                    <div className="mt-3 space-y-2 text-xs">
                      {viewInquiry.routeNotes && (
                        <div>
                          <span className="font-semibold text-slate-700">Lộ trình / Tuyến:</span>{' '}
                          <span className="text-slate-600">{viewInquiry.routeNotes}</span>
                        </div>
                      )}
                      {viewInquiry.specialRequests && (
                        <div>
                          <span className="font-semibold text-slate-700">Yêu cầu đặc biệt:</span>{' '}
                          <span className="text-slate-600">{viewInquiry.specialRequests}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {viewInquiry.status === 'confirmed' && (
                    <div className="mt-4 rounded-lg bg-emerald-50/70 ring-1 ring-emerald-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Đã xác nhận</div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {viewInquiry.confirmedAt ? fmtDate(viewInquiry.confirmedAt) : ''}
                            {viewInquiry.confirmedByStaff?.fullName ? ` · Bởi ${viewInquiry.confirmedByStaff.fullName}` : ''}
                          </div>
                        </div>
                        {viewInquiry.quotationPdfUrlPath && (
                          <a href={resolveFileUrl(viewInquiry.quotationPdfUrlPath) || viewInquiry.quotationPdfUrlPath} target="_blank" rel="noopener noreferrer" download
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 inline-flex items-center gap-1.5">
                            📥 Tải báo giá PDF
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {['draft', 'pending'].includes(viewInquiry.status) && (
                  <div className="space-y-3 rounded-xl bg-white ring-1 ring-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Nhập báo giá & Xác nhận yêu cầu</div>
                        <div className="text-xs text-slate-500 mt-0.5">Sau khi xác nhận, hệ thống tạo file Báo giá PDF, gửi thông báo qua App + Email cho khách hàng</div>
                      </div>
                    </div>
                    <div className={gridCols}>
                      <Field label={`Thuê xe ${viewInquiry.rentalDays || 1} ngày (VNĐ)`}>
                        <input type="number" min={0} className="ipt"
                          value={confirmForm.suggestedBaseAmountVnd}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedBaseAmountVnd: e.target.value })} />
                      </Field>
                      <Field label="Phí tài xế (VNĐ, nếu có)">
                        <input type="number" min={0} className="ipt"
                          value={confirmForm.suggestedDriverFeeVnd}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedDriverFeeVnd: e.target.value })} />
                      </Field>
                      <Field label="Phụ thu / Dịch vụ thêm (VNĐ)">
                        <input type="number" min={0} className="ipt"
                          value={confirmForm.suggestedExtrasVnd}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedExtrasVnd: e.target.value })} />
                      </Field>
                      <Field label="Chiết khấu (%)">
                        <input type="number" min={0} max={100} step={0.1} className="ipt"
                          value={confirmForm.suggestedDiscountPercent}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedDiscountPercent: e.target.value })} />
                      </Field>
                      <Field label="Tiền đặt cọc (VNĐ)">
                        <input type="number" min={0} className="ipt"
                          value={confirmForm.suggestedDepositRequiredVnd}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedDepositRequiredVnd: e.target.value })} />
                      </Field>
                      <Field label="Hạn báo giá">
                        <input type="date" className="ipt"
                          value={confirmForm.suggestedValidUntilDate}
                          onChange={(e) => setConfirmForm({ ...confirmForm, suggestedValidUntilDate: e.target.value })} />
                      </Field>
                    </div>
                    <div className="rounded-lg bg-slate-50 ring-1 ring-slate-200 divide-y divide-slate-200 text-sm">
                      <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Thuê xe</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.base)}</span></div>
                      {viewConfirmTotals.driver > 0 && <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Phí tài xế</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.driver)}</span></div>}
                      {viewConfirmTotals.extras > 0 && <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Phụ thu / Dịch vụ thêm</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.extras)}</span></div>}
                      <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Tạm tính</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.sub)}</span></div>
                      {viewConfirmTotals.discount > 0 && <div className="flex justify-between px-3 py-2 text-emerald-700"><span>Chiết khấu {viewConfirmTotals.discountPct}%</span><span className="tabular-nums">- {fmtMoney(viewConfirmTotals.discount)}</span></div>}
                      <div className="flex justify-between px-3 py-2"><span className="text-slate-600">Sau chiết khấu</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.afterDisc)}</span></div>
                      <div className="flex justify-between px-3 py-2"><span className="text-slate-600">VAT {viewConfirmTotals.vatRate}%</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.vat)}</span></div>
                      <div className="flex justify-between px-3 py-2 font-semibold text-slate-900 text-base"><span>Tổng tiền (đã VAT)</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.grand)}</span></div>
                      <div className="flex justify-between px-3 py-2 font-semibold text-indigo-700"><span>Cọc (tối thiểu)</span><span className="tabular-nums">{fmtMoney(viewConfirmTotals.deposit)}</span></div>
                    </div>
                    <div className="space-y-2">
                      <Field label="Tiêu đề thông báo (để trống = dùng tiêu đề mặc định)">
                        <input className="ipt" placeholder="VD: Thư ngỏ xác nhận báo giá..." value={confirmForm.customNotifTitle}
                          onChange={(e) => setConfirmForm({ ...confirmForm, customNotifTitle: e.target.value })} />
                      </Field>
                      <Field label="Nội dung thông báo gửi đến khách (có thể sửa theo ý muốn - để trống = dùng mẫu mặc định)">
                        <textarea rows={4} className="ipt"
                          placeholder={`Chào A/Chị ${viewInquiry.customerName},\nCông ty chúng tôi xác nhận có xe phù hợp yêu cầu của Quý khách hàng, chi tiết báo giá xem file đính kèm.\nVui lòng đặt cọc trước hạn báo giá để giữ xe...`}
                          value={confirmForm.customNotifBody}
                          onChange={(e) => setConfirmForm({ ...confirmForm, customNotifBody: e.target.value })} />
                      </Field>
                    </div>
                    {confirmErr && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{confirmErr}</div>}
                  </div>
                )}

                <div className="flex justify-end gap-2 border-t pt-3">
                  <button type="button" className="btn ghost" onClick={() => setViewInquiryId(null)}>Đóng</button>
                  {['draft', 'pending'].includes(viewInquiry.status) && (
                    <button type="button"
                      disabled={confirmLoading}
                      className="btn primary"
                      onClick={() => void doConfirmInquiry(viewInquiry, confirmForm, { openInView: true })}>
                      {confirmLoading ? 'Đang xác nhận…' : '✓ Xác nhận & Gửi báo giá PDF'}
                    </button>
                  )}
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ============================================ TAB QUOTATION ============================================ */}
      {tab === 'quotation' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <input placeholder="Tìm code / KH / nội dung…" className="w-full rounded-md px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                value={quoQ} onChange={(e) => setQuoQ(e.target.value)} />
              <Select value={quoFStatus} onChange={setQuoFStatus} placeholder="Trạng thái"
                options={QUOTATION_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <Select value={quoFVType} onChange={setQuoFVType} placeholder="Loại xe"
                options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200" onClick={() => void refreshQuo(1)} disabled={quoLoading}>
                  {quoLoading ? '…' : 'Tìm'}
                </button>
                <button className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={openQuoNew}>+ Tạo báo giá</button>
              </div>
            </div>
          </div>

          <TableWrap loading={quoLoading} empty={quoItems.length === 0} colSpan={9}>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <Th>Code</Th>
                <Th>Yêu cầu</Th>
                <Th>Xe</Th>
                <Th>Hạn báo giá</Th>
                <Th>Tổng tiền</Th>
                <Th>Cọc (30%)</Th>
                <Th>Trạng thái</Th>
                <Th>Flow</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {quoItems.map((raw) => {
                const v: any = raw
                if (!v?.id) return null
                return (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <Td className="font-mono text-xs">{v.code}</Td>
                    <Td className="text-xs">{v.inquirySummary?.code || v.inquiryId || '—'}<div className="text-slate-500">{v.inquirySummary?.status ? inqStatusInfo(v.inquirySummary.status).label : ''}</div></Td>
                    <Td className="text-xs">
                      {v.vehicleType ? labelVehicleType(v.vehicleType) : '—'}
                      {v.vehicleClass ? ` · ${classVehicleInfo(v.vehicleClass).label}` : ''}
                      <div className="text-slate-500">{v.suggestedVehicleIds?.length || 0} xe gợi ý</div>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(v.validUntil)}<div className="text-slate-500">{v.validityDays} ngày</div></Td>
                    <Td className="text-sm font-semibold text-slate-900 whitespace-nowrap">{fmtMoney(v.totalGrandVnd)}</Td>
                    <Td className="text-xs whitespace-nowrap">{fmtMoney(v.depositRequiredVnd)}<div className="text-slate-500">{v.depositPercentRequired}%</div></Td>
                    <Td><Badge tone={quoStatusInfo(v.status).tone}>{quoStatusInfo(v.status).label}</Badge></Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {v.status === 'draft' && <FlowBtn onClick={() => doQuoAction(v, { action: 'submit_approval' })} tone="amber">Gửi duyệt</FlowBtn>}
                        {v.status === 'pending_approval' && (
                          <>
                            <FlowBtn onClick={() => doQuoAction(v, { action: 'approve' })} tone="emerald">Duyệt</FlowBtn>
                            <FlowBtn onClick={() => {
                              const r = prompt('Lý do từ chối duyệt?') || 'Không rõ lý do'
                              doQuoAction(v, { action: 'reject', rejectReason: r })
                            }} tone="rose">Từ chối</FlowBtn>
                          </>
                        )}
                        {v.status === 'approved' && <FlowBtn onClick={() => doQuoAction(v, { action: 'send' })} tone="indigo">Gửi KH</FlowBtn>}
                        {v.status === 'sent' && (
                          <>
                            <FlowBtn onClick={() => doQuoAction(v, { action: 'accept' })} tone="emerald">KH đồng ý</FlowBtn>
                            <FlowBtn onClick={() => {
                              const r = prompt('Lý do KH từ chối?') || ''
                              doQuoAction(v, { action: 'decline', customerDeclineReason: r })
                            }} tone="rose">KH từ chối</FlowBtn>
                            <FlowBtn onClick={() => doQuoAction(v, { action: 'expire' })} tone="zinc">Quá hạn</FlowBtn>
                          </>
                        )}
                      </div>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => openQuoEdit(v)}>Sửa</button>
                        <button className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onClick={() => doDeleteQuo(v)}>Xóa</button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
          <PageInfo total={quoTotal} page={quoPage} pageSize={20} />

          {quoFormOpen && (
            <Modal onClose={() => setQuoFormOpen(false)} title={quoEditingId ? 'Sửa báo giá' : 'Tạo báo giá'} size="xl">
              <form onSubmit={submitQuoForm} className="space-y-3">
                <div className={gridCols}>
                  <Field label="Mã yêu cầu (inquiryId)"><input className="ipt" value={quoForm.inquiryId}
                    onChange={(e) => setQuoForm({ ...quoForm, inquiryId: e.target.value })} /></Field>
                  <Field label="Hạn báo giá (ngày) *"><input required type="number" min="1" className="ipt" value={quoForm.validityDays}
                    onChange={(e) => setQuoForm({ ...quoForm, validityDays: e.target.value })} /></Field>
                  <Field label="Loại xe"><Select value={quoForm.vehicleType} onChange={(v) => setQuoForm({ ...quoForm, vehicleType: v })} placeholder="(bất kỳ)"
                    options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Phân loại xe"><Select value={quoForm.vehicleClass} onChange={(v) => setQuoForm({ ...quoForm, vehicleClass: v })} placeholder="(bất kỳ)"
                    options={VEHICLE_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} /></Field>
                  <Field label="Xe gợi ý (ids, phân cách ,)"><input className="ipt" value={quoForm.suggestedVehicleIds.join(', ')}
                    onChange={(e) => setQuoForm({ ...quoForm, suggestedVehicleIds: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
                  <Field label="% đặt cọc *"><input required type="number" min="0" max="100" className="ipt" value={quoForm.depositPercentRequired}
                    onChange={(e) => setQuoForm({ ...quoForm, depositPercentRequired: e.target.value })} /></Field>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-800">Chi tiết báo giá</label>
                    <button type="button" className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                      onClick={() => setQuoForm({
                        ...quoForm,
                        lineItems: [...quoForm.lineItems, { key: '', label: '', unitPriceVnd: '0', quantity: '1', notes: '' }],
                      })}>+ Thêm dòng</button>
                  </div>
                  <div className="overflow-x-auto rounded-md ring-1 ring-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="px-2 py-2 text-left w-[120px]">Key</th>
                          <th className="px-2 py-2 text-left">Nội dung</th>
                          <th className="px-2 py-2 text-right w-[140px]">Đơn giá (₫)</th>
                          <th className="px-2 py-2 text-right w-[90px]">SL</th>
                          <th className="px-2 py-2 text-right w-[140px]">Thành tiền</th>
                          <th className="px-2 py-2 text-left w-[180px]">Ghi chú</th>
                          <th className="w-[50px]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {quoForm.lineItems.map((l, idx) => (
                          <tr key={idx}>
                            <td className="px-2 py-1"><input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200"
                              value={l.key} onChange={(e) => {
                                const arr = [...quoForm.lineItems]; arr[idx] = { ...l, key: e.target.value }; setQuoForm({ ...quoForm, lineItems: arr })
                              }} /></td>
                            <td className="px-2 py-1"><input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200"
                              value={l.label} onChange={(e) => {
                                const arr = [...quoForm.lineItems]; arr[idx] = { ...l, label: e.target.value }; setQuoForm({ ...quoForm, lineItems: arr })
                              }} /></td>
                            <td className="px-2 py-1"><input type="number" className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200 text-right"
                              value={l.unitPriceVnd} onChange={(e) => {
                                const arr = [...quoForm.lineItems]; arr[idx] = { ...l, unitPriceVnd: e.target.value }; setQuoForm({ ...quoForm, lineItems: arr })
                              }} /></td>
                            <td className="px-2 py-1"><input type="number" className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200 text-right"
                              value={l.quantity} onChange={(e) => {
                                const arr = [...quoForm.lineItems]; arr[idx] = { ...l, quantity: e.target.value }; setQuoForm({ ...quoForm, lineItems: arr })
                              }} /></td>
                            <td className="px-2 py-2 text-right font-medium tabular-nums">{fmtMoney(quoLineTotal(l))}</td>
                            <td className="px-2 py-1"><input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200"
                              value={l.notes} onChange={(e) => {
                                const arr = [...quoForm.lineItems]; arr[idx] = { ...l, notes: e.target.value }; setQuoForm({ ...quoForm, lineItems: arr })
                              }} /></td>
                            <td className="px-1 py-1 text-center">
                              {quoForm.lineItems.length > 1 && (
                                <button type="button" className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                                  onClick={() => setQuoForm({ ...quoForm, lineItems: quoForm.lineItems.filter((_, i) => i !== idx) })}>✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 text-slate-800">
                        <tr><td colSpan={4} className="px-2 py-2 text-right font-medium">Tổng phụ</td><td className="px-2 py-2 text-right tabular-nums">{fmtMoney(quoTots.sub)}</td><td colSpan={2}></td></tr>
                        <tr><td colSpan={4} className="px-2 py-2 text-right font-medium">VAT</td><td className="px-2 py-2 text-right tabular-nums">{fmtMoney(quoTots.vat)}</td><td colSpan={2}></td></tr>
                        <tr><td colSpan={4} className="px-2 py-2 text-right font-semibold">Tổng cộng</td><td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtMoney(quoTots.grand)}</td><td colSpan={2}></td></tr>
                        <tr><td colSpan={4} className="px-2 py-2 text-right font-medium">Đặt cọc ({quoTots.depositPct}%)</td><td className="px-2 py-2 text-right font-semibold tabular-nums text-emerald-700">{fmtMoney(quoTots.deposit)}</td><td colSpan={2}></td></tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <Field label="Điều khoản (HTML hoặc text)"><textarea rows={3} className="ipt" value={quoForm.termsHtml}
                  onChange={(e) => setQuoForm({ ...quoForm, termsHtml: e.target.value })} /></Field>
                <Field label="Ghi chú nội bộ"><textarea rows={2} className="ipt" value={quoForm.internalNotes}
                  onChange={(e) => setQuoForm({ ...quoForm, internalNotes: e.target.value })} /></Field>
                {quoEditingId && <Field label="Lý do từ chối (nếu Từ chối)"><input className="ipt" value={quoForm.rejectReason}
                  onChange={(e) => setQuoForm({ ...quoForm, rejectReason: e.target.value })} /></Field>}
                {quoSaveErr && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{quoSaveErr}</div>}
                <div className="flex justify-end gap-2 border-t pt-3">
                  <button type="button" className="btn ghost" onClick={() => setQuoFormOpen(false)}>Đóng</button>
                  <button type="submit" disabled={quoSaving} className="btn primary">{quoSaving ? 'Đang lưu…' : (quoEditingId ? 'Cập nhật' : 'Tạo báo giá')}</button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}

      {/* ============================================ TAB CONTRACT ============================================ */}
      {tab === 'contract' && (
        <div className="space-y-3">
          <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
            <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
              <input placeholder="Tìm code / KH / CCCD / biển số…" className="w-full rounded-md px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
                value={ctrQ} onChange={(e) => setCtrQ(e.target.value)} />
              <Select value={ctrFStatus} onChange={setCtrFStatus} placeholder="Trạng thái"
                options={CONTRACT_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <Select value={ctrFVType} onChange={setCtrFVType} placeholder="Loại xe"
                options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
              <div className="flex gap-2">
                <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200" onClick={() => void refreshCtr(1)} disabled={ctrLoading}>
                  {ctrLoading ? '…' : 'Tìm'}
                </button>
                <button className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={openCtrNew}>+ Tạo hợp đồng</button>
              </div>
            </div>
          </div>

          <TableWrap loading={ctrLoading} empty={ctrItems.length === 0} colSpan={10}>
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <Th>Code</Th>
                <Th>Khách hàng</Th>
                <Th>Xe đã gán</Th>
                <Th>Nhận</Th>
                <Th>Trả</Th>
                <Th>Tổng giá trị</Th>
                <Th>Đã thu (cọc)</Th>
                <Th>Công nợ</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {ctrItems.map((raw) => {
                const v: any = raw
                if (!v?.id) return null
                const receivable = Math.max(0, numOrZero(v.totalGrandVnd) - numOrZero(v.paidVnd))
                return (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <Td className="font-mono text-xs">{v.code}</Td>
                    <Td>
                      <div className="font-medium text-slate-900">{v.customerName}</div>
                      <div className="text-xs text-slate-500">{v.customerPhone} · CCCD {v.citizenId}</div>
                    </Td>
                    <Td className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {Array.isArray(v.assignedVehicles) && v.assignedVehicles.length > 0
                          ? v.assignedVehicles.filter(Boolean).map((x: any) => (
                            <Badge key={x.id} tone={x.vehicleClassTone}>{x.licensePlate || x.plateNumber || '—'} · {labelVehicleType(x.vehicleType)}</Badge>
                          ))
                          : Array.isArray(v.assignedVehicleIds) ? `${v.assignedVehicleIds.length} xe` : '—'
                        }
                      </div>
                    </Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(v.pickupDateTime)}<div className="text-slate-500 truncate max-w-[160px]">{v.pickupLocation}</div></Td>
                    <Td className="text-xs whitespace-nowrap">{fmtDate(v.returnDateTime)}<div className="text-slate-500 truncate max-w-[160px]">{v.returnLocation}</div></Td>
                    <Td className="text-sm font-semibold whitespace-nowrap">{fmtMoney(v.totalGrandVnd)}</Td>
                    <Td className="text-xs whitespace-nowrap tabular-nums">
                      <div>{fmtMoney(v.paidVnd)}</div>
                      <div className="text-slate-500">Cọc: {fmtMoney(v.depositPaidVnd)}</div>
                    </Td>
                    <Td className={cn('text-sm whitespace-nowrap tabular-nums font-semibold', receivable > 0 ? 'text-rose-600' : 'text-emerald-700')}>
                      {fmtMoney(receivable)}
                    </Td>
                    <Td><Badge tone={ctrStatusInfo(v.status).tone}>{ctrStatusInfo(v.status).label}</Badge></Td>
                    <Td className="text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {!['completed', 'terminated', 'canceled'].includes(v.status) && (
                          <FlowBtn onClick={() => openAssignModal(v)} tone="indigo">🔗 Gán xe</FlowBtn>
                        )}
                        {v.status === 'draft' && <FlowBtn onClick={() => doCtrAction(v, { action: 'sign' })} tone="zinc">Ký HĐ</FlowBtn>}
                        {['draft', 'pending_signature', 'signed'].includes(v.status) && (
                          <FlowBtn onClick={() => {
                            const amt = Number(prompt('Số tiền cọc đã nhận (VNĐ)', String(v.depositRequiredVnd ?? v.totalGrandVnd * 0.3)) || 0)
                            doCtrAction(v, { action: 'mark_deposit_paid', amount: amt })
                          }} tone="emerald">Đánh dấu đã cọc</FlowBtn>
                        )}
                        {['signed', 'deposit_paid'].includes(v.status) && <FlowBtn onClick={() => doCtrAction(v, { action: 'mark_in_progress' })} tone="amber">Bắt đầu thuê</FlowBtn>}
                        {v.status === 'in_progress' && <FlowBtn onClick={() => doCtrAction(v, { action: 'mark_completed' })} tone="emerald">Hoàn tất</FlowBtn>}
                        {!['completed', 'terminated', 'canceled'].includes(v.status) && <FlowBtn onClick={() => {
                          const r = prompt('Lý do chấm dứt/hủy HĐ?') || ''
                          const terminate = confirm('OK = Chấm dứt (terminated), Cancel = Hủy (canceled)')
                          doCtrAction(v, terminate ? { action: 'terminate' } : { action: 'cancel' })
                          void 0; if (r) void 0
                        }} tone="rose">Chấm dứt/Hủy</FlowBtn>}
                        <button className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => openCtrEdit(v)}>Sửa</button>
                        <button className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50" onClick={() => doDeleteCtr(v)}>Xóa</button>
                      </div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
          <PageInfo total={ctrTotal} page={ctrPage} pageSize={20} />

          {assignOpen && assignContract && (
            <Modal onClose={() => { setAssignOpen(false); setAssignContract(null) }} title={`🔗 Gán xe cho hợp đồng ${assignContract.code || ''}`} size="xl">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 bg-slate-50 rounded-md p-3 ring-1 ring-slate-200">
                  <Field label="Khách hàng">
                    <div className="text-sm font-medium text-slate-800">{assignContract.customerName}</div>
                    <div className="text-xs text-slate-500">{assignContract.customerPhone}</div>
                  </Field>
                  <Field label="Khoảng thời gian">
                    <div className="text-sm font-medium text-slate-800">
                      {assignContract.pickupDateTime ? new Date(assignContract.pickupDateTime).toLocaleString('vi-VN') : '—'}
                    </div>
                    <div className="text-xs text-slate-500">→ {assignContract.returnDateTime ? new Date(assignContract.returnDateTime).toLocaleString('vi-VN') : '—'}</div>
                  </Field>
                  <Field label="Điểm nhận">
                    <div className="text-sm text-slate-800">{assignContract.pickupLocation || '—'}</div>
                  </Field>
                  <Field label="Điểm trả">
                    <div className="text-sm text-slate-800">{assignContract.returnLocation || '—'}</div>
                  </Field>
                </div>

                <div className="rounded-md bg-white ring-1 ring-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-slate-100">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Danh sách xe sẵn sàng (không trùng lịch)</div>
                      <div className="text-[11px] text-slate-500">Tích checkbox để chọn xe gán cho hợp đồng. Hệ thống tự động loại xe bị conflict thời gian.</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={assignSuggestLoading || !assignContract.pickupDateTime || !assignContract.returnDateTime}
                        onClick={async () => {
                          try {
                            setAssignSuggestLoading(true)
                            const r = await adminSuggestAvailableVehicles({
                              pickupDateTime: new Date(assignContract.pickupDateTime!).toISOString(),
                              returnDateTime: new Date(assignContract.returnDateTime!).toISOString(),
                            })
                            setAssignSuggestItems(Array.isArray(r.items) ? r.items : [])
                            toast.success(`Tìm thấy ${Array.isArray(r.items) ? r.items.length : 0} xe phù hợp`)
                          } catch (e: any) { toast.error(e?.message || 'Không gợi ý được xe') }
                          finally { setAssignSuggestLoading(false) }
                        }}>
                        {assignSuggestLoading ? 'Đang tải…' : '🔄 Làm mới gợi ý'}
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[50vh] overflow-y-auto">
                    {assignSuggestLoading && assignSuggestItems.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">Đang tải danh sách xe…</div>
                    ) : assignSuggestItems.length === 0 ? (
                      <div className="p-6 text-center">
                        <div className="text-sm font-semibold text-slate-700">Chưa có xe gợi ý</div>
                        <p className="mt-1 text-xs text-slate-500">Nhấn "Làm mới gợi ý" để tìm các xe sẵn sàng trong khoảng thời gian thuê. Nếu vẫn rỗng, kiểm tra lại ngày nhận/trả hoặc thêm xe mới ở trang Quản lý xe.</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr className="text-left text-slate-600 text-xs uppercase tracking-wider">
                            <th className="px-3 py-2 w-10"></th>
                            <th className="px-3 py-2">Biển số</th>
                            <th className="px-3 py-2">Loại / Chỗ</th>
                            <th className="px-3 py-2">Hạng xe</th>
                            <th className="px-3 py-2">Thông tin</th>
                            <th className="px-3 py-2 text-right">Giá/ngày</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {assignSuggestItems.map((x) => {
                            const checked = assignSelectedIds.includes(x.id)
                            return (
                              <tr key={x.id} className={cn(checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50/60')}>
                                <td className="px-3 py-2">
                                  <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? assignSelectedIds.filter((z) => z !== x.id)
                                        : [...assignSelectedIds, x.id]
                                      setAssignSelectedIds(next)
                                    }} />
                                </td>
                                <td className="px-3 py-2 font-mono font-semibold text-slate-900">{x.plateNumber}</td>
                                <td className="px-3 py-2 text-slate-700">{x.vehicleTypeLabel} ({x.seatCount} chỗ)</td>
                                <td className="px-3 py-2"><Badge tone={x.vehicleClassTone}>{x.vehicleClassLabel}</Badge></td>
                                <td className="px-3 py-2 text-slate-600 text-xs">
                                  <div>{x.brand || '-'} {x.color ? `· ${x.color}` : ''} {x.manufactureYear ? `· ${x.manufactureYear}` : ''}</div>
                                  <div className="text-slate-400">{x.statusLabel} · {Number(x.mileageKm || 0).toLocaleString('vi-VN')} km</div>
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-900 whitespace-nowrap tabular-nums">
                                  {Number(x.rentalPricePerDayVnd || 0).toLocaleString('vi-VN')}đ
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="rounded-md p-3 bg-indigo-50 ring-1 ring-indigo-100">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-indigo-900">Đã chọn: <span className="text-sm">{assignSelectedIds.length}</span> xe</div>
                      <div className="text-[11px] text-indigo-700/80">Lưu ý: các xe đã chọn sẽ được ghi đè lên danh sách xe gán cũ của hợp đồng.</div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setAssignSelectedIds([])}
                        className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Bỏ chọn tất cả
                      </button>
                      <button type="button" onClick={() => { setAssignOpen(false); setAssignContract(null) }}
                        className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                        Hủy
                      </button>
                      <button type="button" disabled={assignSaving} onClick={doAssignSave}
                        className="rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 px-5 py-2 text-xs font-extrabold uppercase text-white shadow-sm hover:brightness-110 disabled:opacity-60">
                        {assignSaving ? 'Đang lưu…' : '✅ Lưu xe gán'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </Modal>
          )}

          {ctrFormOpen && (
            <Modal onClose={() => setCtrFormOpen(false)} title={ctrEditingId ? 'Sửa hợp đồng thuê xe' : 'Tạo hợp đồng thuê xe'} size="3xl">
              <form onSubmit={submitCtrForm} className="space-y-4">
                <details open className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">1. Tham chiếu (Yêu cầu / BG / Booking)</summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Field label="inquiryId"><input className="ipt" value={ctrForm.inquiryId}
                      onChange={(e) => setCtrForm({ ...ctrForm, inquiryId: e.target.value })} /></Field>
                    <Field label="quotationId"><input className="ipt" value={ctrForm.quotationId}
                      onChange={(e) => setCtrForm({ ...ctrForm, quotationId: e.target.value })} /></Field>
                    <Field label="bookingId (nếu gắn vào tour)"><input className="ipt" value={ctrForm.bookingId}
                      onChange={(e) => setCtrForm({ ...ctrForm, bookingId: e.target.value })} /></Field>
                  </div>
                </details>
                <details open className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">2. Thông tin khách hàng</summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Họ tên KH *"><input required className="ipt" value={ctrForm.customerName}
                      onChange={(e) => setCtrForm({ ...ctrForm, customerName: e.target.value })} /></Field>
                    <Field label="SĐT *"><input required className="ipt" value={ctrForm.customerPhone}
                      onChange={(e) => setCtrForm({ ...ctrForm, customerPhone: e.target.value })} /></Field>
                    <Field label="Email"><input className="ipt" value={ctrForm.customerEmail}
                      onChange={(e) => setCtrForm({ ...ctrForm, customerEmail: e.target.value })} /></Field>
                    <Field label="CCCD/CMND *"><input required className="ipt" value={ctrForm.citizenId}
                      onChange={(e) => setCtrForm({ ...ctrForm, citizenId: e.target.value })} /></Field>
                    <Field label="Nơi cấp CCCD"><input className="ipt" value={ctrForm.citizenIdIssuePlace}
                      onChange={(e) => setCtrForm({ ...ctrForm, citizenIdIssuePlace: e.target.value })} /></Field>
                    <Field label="Ngày cấp CCCD"><input type="date" className="ipt" value={ctrForm.citizenIdIssueDate}
                      onChange={(e) => setCtrForm({ ...ctrForm, citizenIdIssueDate: e.target.value })} /></Field>
                    <Field label="Địa chỉ thường trú *"><input required className="ipt sm:col-span-2" value={ctrForm.customerAddress}
                      onChange={(e) => setCtrForm({ ...ctrForm, customerAddress: e.target.value })} /></Field>
                    <Field label="Bằng lái số"><input className="ipt" value={ctrForm.driverLicenseNumber}
                      onChange={(e) => setCtrForm({ ...ctrForm, driverLicenseNumber: e.target.value })} /></Field>
                    <Field label="Hạng bằng lái"><input className="ipt" value={ctrForm.driverLicenseClass}
                      onChange={(e) => setCtrForm({ ...ctrForm, driverLicenseClass: e.target.value })} /></Field>
                    <Field label="Sales phụ trách"><input className="ipt sm:col-span-2" value={ctrForm.ownerSalesId}
                      onChange={(e) => setCtrForm({ ...ctrForm, ownerSalesId: e.target.value })} /></Field>
                  </div>
                </details>
                <details open className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">3. Lịch trình & Xe</summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Ngày nhận *"><input required type="datetime-local" className="ipt" value={ctrForm.pickupDateTime}
                      onChange={(e) => setCtrForm({ ...ctrForm, pickupDateTime: e.target.value })} /></Field>
                    <Field label="Điểm nhận *"><input required className="ipt" value={ctrForm.pickupLocation}
                      onChange={(e) => setCtrForm({ ...ctrForm, pickupLocation: e.target.value })} /></Field>
                    <Field label="Ngày trả *"><input required type="datetime-local" className="ipt" value={ctrForm.returnDateTime}
                      onChange={(e) => setCtrForm({ ...ctrForm, returnDateTime: e.target.value })} /></Field>
                    <Field label="Điểm trả *"><input required className="ipt" value={ctrForm.returnLocation}
                      onChange={(e) => setCtrForm({ ...ctrForm, returnLocation: e.target.value })} /></Field>
                    <Field label="Số ngày *"><input required type="number" min="1" className="ipt" value={ctrForm.rentalDays}
                      onChange={(e) => setCtrForm({ ...ctrForm, rentalDays: e.target.value })} /></Field>
                    <Field label="Có tài xế?"><Select value={ctrForm.withDriver ? '1' : '0'} onChange={(v) => setCtrForm({ ...ctrForm, withDriver: v === '1' })}
                      options={[{ value: '1', label: 'Có tài xế' }, { value: '0', label: 'Tự lái' }]} /></Field>
                    <Field label="assignedVehicleIds (csv) *"><input required className="ipt lg:col-span-2"
                      value={ctrForm.assignedVehicleIds.join(', ')}
                      onChange={(e) => setCtrForm({ ...ctrForm, assignedVehicleIds: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} /></Field>
                  </div>
                  <div className="mt-3 rounded-md bg-white p-3 ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-800">Gợi ý xe theo khoảng ngày (không trùng lịch)</div>
                      <div className="flex gap-2">
                        <Select className="w-[160px]" value={ctrForm.vehicleType || ''}
                          onChange={(v) => setCtrForm({ ...ctrForm, vehicleType: v as any })} placeholder="Loại xe"
                          options={VEHICLE_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
                        <Select className="w-[180px]" value={ctrForm.vehicleClass || ''}
                          onChange={(v) => setCtrForm({ ...ctrForm, vehicleClass: v as any })} placeholder="Phân loại xe"
                          options={VEHICLE_CLASS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
                        <button type="button" className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
                          disabled={suggestLoading} onClick={() => void loadSuggest()}>{suggestLoading ? '…' : 'Gợi ý xe'}</button>
                      </div>
                    </div>
                    {suggestItems.length > 0 && (
                      <div className="mt-2 overflow-x-auto">
                        <table className="min-w-full text-xs">
                          <thead className="bg-slate-50 text-slate-700">
                            <tr>
                              <th className="px-2 py-2 text-left w-[40px]"></th>
                              <th className="px-2 py-2 text-left">Biển số</th>
                              <th className="px-2 py-2 text-left">Loại / chỗ</th>
                              <th className="px-2 py-2 text-left">Phân loại</th>
                              <th className="px-2 py-2 text-left">Hãng / Màu</th>
                              <th className="px-2 py-2 text-right text-slate-800">Giá/ngày</th>
                              <th className="px-2 py-2 text-right text-indigo-700">Tổng ({suggestItems[0]?.estimatedTotalVnd != null ? 'ngày' : ''})</th>
                              <th className="px-2 py-2 text-left">Trạng thái xe</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {suggestItems.map((x) => {
                              const checked = ctrForm.assignedVehicleIds.includes(x.id)
                              return (
                                <tr key={x.id} className={cn(checked ? 'bg-indigo-50/60' : '')}>
                                  <td className="px-2 py-1.5"><input type="checkbox" checked={checked}
                                    onChange={() => {
                                      const next = checked
                                        ? ctrForm.assignedVehicleIds.filter((z) => z !== x.id)
                                        : [...ctrForm.assignedVehicleIds, x.id]
                                      setCtrForm({ ...ctrForm, assignedVehicleIds: next })
                                    }} /></td>
                                  <td className="px-2 py-1.5 font-mono font-semibold">{x.plateNumber}</td>
                                  <td className="px-2 py-1.5">{x.vehicleTypeLabel} ({x.seatCount} chỗ)</td>
                                  <td className="px-2 py-1.5"><Badge tone={x.vehicleClassTone}>{x.vehicleClassLabel}</Badge></td>
                                  <td className="px-2 py-1.5 text-slate-700">{x.brand || '-'} {x.color ? `· ${x.color}` : ''} {x.manufactureYear ? `· ${x.manufactureYear}` : ''}</td>
                                  <td className="px-2 py-1.5 text-right tabular-nums">{fmtMoney(x.rentalPricePerDayVnd)}</td>
                                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{fmtMoney(x.estimatedTotalVnd)}</td>
                                  <td className="px-2 py-1.5"><Badge tone={x.statusTone}>{x.statusLabel}</Badge></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {!suggestLoading && suggestItems.length === 0 && ctrForm.pickupDateTime && (
                      <div className="mt-2 text-xs text-slate-500">Nhấn Gợi ý xe để tìm xe sẵn sàng không trùng lịch.</div>
                    )}
                  </div>
                </details>
                <details className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">4. Giá trị & Thanh toán & VAT</summary>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="Tổng giá trị HĐ (₫) *"><input required type="number" min="0" className="ipt" value={ctrForm.totalGrandVnd}
                      onChange={(e) => setCtrForm({ ...ctrForm, totalGrandVnd: e.target.value })} /></Field>
                    <Field label="Cọc cần đặt (₫)"><input type="number" min="0" className="ipt" value={ctrForm.depositRequiredVnd}
                      onChange={(e) => setCtrForm({ ...ctrForm, depositRequiredVnd: e.target.value })} /></Field>
                    <Field label="Cọc đã nhận (₫)"><input type="number" min="0" className="ipt" value={ctrForm.depositPaidVnd}
                      onChange={(e) => setCtrForm({ ...ctrForm, depositPaidVnd: e.target.value })} /></Field>
                    <Field label="Tổng đã thanh toán (₫)"><input type="number" min="0" className="ipt" value={ctrForm.paidVnd}
                      onChange={(e) => setCtrForm({ ...ctrForm, paidVnd: e.target.value })} /></Field>
                    <Field label="Giấy tờ thế chấp đã giữ?"><Select value={ctrForm.depositPapersHeld ? '1' : '0'} onChange={(v) => setCtrForm({ ...ctrForm, depositPapersHeld: v === '1' })}
                      options={[{ value: '0', label: 'Chưa giữ' }, { value: '1', label: 'Đã giữ' }]} /></Field>
                    <Field label="Tiền thế chấp (₫)"><input type="number" min="0" className="ipt" value={ctrForm.collateralCashVnd}
                      onChange={(e) => setCtrForm({ ...ctrForm, collateralCashVnd: e.target.value })} /></Field>
                    <Field label="Tài sản thế chấp khác"><input className="ipt sm:col-span-2" value={ctrForm.collateralOther}
                      onChange={(e) => setCtrForm({ ...ctrForm, collateralOther: e.target.value })} /></Field>
                    <Field label="Xuất hóa đơn VAT?"><Select value={ctrForm.requireVatInvoice ? '1' : '0'} onChange={(v) => setCtrForm({ ...ctrForm, requireVatInvoice: v === '1' })}
                      options={[{ value: '0', label: 'Không' }, { value: '1', label: 'Có' }]} /></Field>
                    <Field label="Tên công ty (HĐ VAT)"><input className="ipt" value={ctrForm.invoiceCompanyName}
                      onChange={(e) => setCtrForm({ ...ctrForm, invoiceCompanyName: e.target.value })} /></Field>
                    <Field label="Mã số thuế"><input className="ipt" value={ctrForm.invoiceTaxCode}
                      onChange={(e) => setCtrForm({ ...ctrForm, invoiceTaxCode: e.target.value })} /></Field>
                    <Field label="Địa chỉ in HĐ"><input className="ipt sm:col-span-2" value={ctrForm.invoiceAddress}
                      onChange={(e) => setCtrForm({ ...ctrForm, invoiceAddress: e.target.value })} /></Field>
                  </div>
                </details>
                <details className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                  <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">5. Điều khoản & Ghi chú</summary>
                  <div className="mt-2 space-y-2">
                    <Field label="Điều khoản HĐ (HTML/text)"><textarea rows={4} className="ipt" value={ctrForm.termsHtml}
                      onChange={(e) => setCtrForm({ ...ctrForm, termsHtml: e.target.value })} /></Field>
                    <Field label="Ghi chú nội bộ"><textarea rows={2} className="ipt" value={ctrForm.internalNotes}
                      onChange={(e) => setCtrForm({ ...ctrForm, internalNotes: e.target.value })} /></Field>
                    {ctrEditingId && <Field label="Lý do chấm dứt / hủy HĐ (nếu có)"><input className="ipt" value={ctrForm.cancelOrTerminateReason}
                      onChange={(e) => setCtrForm({ ...ctrForm, cancelOrTerminateReason: e.target.value })} /></Field>}
                  </div>
                </details>
                {ctrSaveErr && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{ctrSaveErr}</div>}
                <div className="flex justify-end gap-2 border-t pt-3">
                  <button type="button" className="btn ghost" onClick={() => setCtrFormOpen(false)}>Đóng</button>
                  <button type="submit" disabled={ctrSaving} className="btn primary">{ctrSaving ? 'Đang lưu…' : (ctrEditingId ? 'Cập nhật HĐ' : 'Tạo HĐ')}</button>
                </div>
              </form>
            </Modal>
          )}
        </div>
      )}
    </div>
  )
}

/* ========== Small UI atoms (inline) ========== */
function StatCard({ label, value, tone, money }: { label: string; value?: number; tone?: string; money?: boolean }) {
  const shown = money ? fmtMoney(value) : (value ?? 0).toLocaleString('vi-VN')
  return (
    <div className={cn('rounded-lg p-3 ring-1', tone)}>
      <div className="text-xs font-medium opacity-80">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums">{shown}</div>
    </div>
  )
}
function TableWrap({ loading, empty, colSpan, children }: { loading: boolean; empty: boolean; colSpan: number; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          {children}
        </table>
      </div>
      {loading && <div className="px-4 py-10 text-center text-sm text-slate-500">Đang tải…</div>}
      {!loading && empty && (
        <div className="col-span-full px-4 py-10 text-center text-sm text-slate-500">
          <div className="mb-2 text-4xl opacity-30">📭</div>
          <div>Chưa có dữ liệu</div>
        </div>
      )}
    </div>
  )
}
function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider', className)}>{children}</th>
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-2 text-slate-700', className)}>{children}</td>
}
function PageInfo({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const from = Math.min(total, (page - 1) * pageSize + 1)
  const to = Math.min(total, page * pageSize)
  return (
    <div className="flex items-center justify-between text-xs text-slate-500">
      <div>Trang {page}: {total ? `${from} - ${to} / ${total}` : '0 bản ghi'}</div>
    </div>
  )
}
function FlowBtn({ children, onClick, tone }: { children: React.ReactNode; onClick?: () => void; tone?: string }) {
  const t = tone || 'zinc'
  const mapTone: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200 hover:bg-zinc-200',
  }
  return (
    <button type="button" onClick={onClick}
      className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', mapTone[t] ?? mapTone.zinc)}>
      {children}
    </button>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-slate-700">{label}</div>
      {children}
    </label>
  )
}
function Modal({ title, onClose, size, children }: { title: string; onClose: () => void; size?: 'md' | 'lg' | 'xl' | '3xl'; children: React.ReactNode }) {
  const maxW = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', '3xl': 'max-w-6xl' }[size ?? 'xl']
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-6" onClick={onClose}>
      <div className={cn('max-h-[92vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-slate-200', maxW)} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button type="button" className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={onClose}>✕</button>
        </div>
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
