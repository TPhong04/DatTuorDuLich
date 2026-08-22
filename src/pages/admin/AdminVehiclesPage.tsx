import { FormEvent, useEffect, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  VEHICLE_CLASS_OPTIONS,
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  Vehicle,
  VehicleClass,
  VehicleStatus,
  VehicleType,
  adminCreateVehicle,
  adminDeleteVehicle,
  adminListVehicles,
  adminUpdateVehicle,
  classVehicleInfo,
  labelVehicleClass,
  labelVehicleType,
  statusVehicleInfo,
} from '@/features/vehicles/vehicles'
import { cn } from '@/lib/utils'

type FormState = {
  licensePlate: string
  vehicleType: VehicleType
  vehicleClass: VehicleClass
  brand: string
  color: string
  manufactureYear: string
  mileageKm: string
  nextMaintenanceDate: string
  rentalPricePerDayVnd: string
  rentalSelfDrivePricePerDayVnd: string
  seatCount: string
  publicDisplayName: string
  publicSuitability: string
  showInPublicOptions: boolean
  status: VehicleStatus
  statusReason: string
  notes: string
}

const EMPTY_FORM: FormState = {
  licensePlate: '',
  vehicleType: 'seater_7',
  vehicleClass: 'seat',
  brand: '',
  color: '',
  manufactureYear: '',
  mileageKm: '0',
  nextMaintenanceDate: '',
  rentalPricePerDayVnd: '0',
  rentalSelfDrivePricePerDayVnd: '0',
  seatCount: '',
  publicDisplayName: '',
  publicSuitability: '',
  showInPublicOptions: true,
  status: 'available',
  statusReason: '',
  notes: '',
}

function trimUpper(s: string | null | undefined): string {
  return typeof s === 'string' ? s.trim().toUpperCase() : ''
}
function trimOrNull(s: string | null | undefined): string | null {
  return typeof s === 'string' && s.trim() ? s.trim() : null
}
function numOrNull(s: string | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
function numOrZero(s: string | null | undefined): number {
  if (s === null || s === undefined || s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function asTypeVehicleType(s: unknown): VehicleType {
  const str = String(s ?? 'seater_7')
  if (str === 'seater_4' || str === 'seater_7' || str === 'seater_16' || str === 'seater_29' || str === 'seater_45') return str
  return 'seater_7'
}
function asTypeVehicleStatus(s: unknown): VehicleStatus {
  const str = String(s ?? 'available')
  if (str === 'available' || str === 'in_trip' || str === 'maintenance' || str === 'repairing' || str === 'damaged' || str === 'out_of_service') return str
  return 'available'
}
function asTypeVehicleClass(s: unknown): VehicleClass {
  const str = String(s ?? 'seat')
  if (str === 'seat' || str === 'sleeper' || str === 'limousine' || str === 'cabin') return str as VehicleClass
  return 'seat'
}

export default function AdminVehiclesPage() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Vehicle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const [q, setQ] = useState('')
  const [fType, setFType] = useState<'' | VehicleType>('')
  const [fClass, setFClass] = useState<'' | VehicleClass>('')
  const [fStatus, setFStatus] = useState<'' | VehicleStatus>('')

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null)

  const refreshList = async (targetPage = 1) => {
    try {
      setLoading(true)
      const res = await adminListVehicles({
        page: targetPage,
        limit,
        q: q.trim() || undefined,
        vehicleType: fType || undefined,
        vehicleClass: fClass || undefined,
        status: fStatus || undefined,
      })
      setItems(Array.isArray(res.items) ? (res.items as Vehicle[]) : [])
      setTotal(Number(res.total) || 0)
      setPage(targetPage)
    } catch (e: any) {
      toast.error(e?.message || 'Không tải được danh sách xe.')
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let canceled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await adminListVehicles({
          page,
          limit,
          q: q.trim() || undefined,
          vehicleType: fType || undefined,
          vehicleClass: fClass || undefined,
          status: fStatus || undefined,
        })
        if (canceled) return
        setItems(Array.isArray(res.items) ? (res.items as Vehicle[]) : [])
        setTotal(Number(res.total) || 0)
      } catch (e: any) {
        if (canceled) return
        toast.error(e?.message || 'Không tải được danh sách xe.')
        setItems([])
        setTotal(0)
      } finally {
        if (!canceled) setLoading(false)
      }
    })()
    return () => {
      canceled = true
    }
  }, [page, limit, q, fType, fClass, fStatus, toast])

  const resetForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setSaveErrorMsg(null)
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (v: Vehicle | null | undefined) => {
    if (!v) return
    setEditingId(typeof v.id === 'string' ? v.id : String((v as any).id ?? ''))
    try {
      const raw: any = v
      setForm({
        licensePlate: String(raw.licensePlate ?? ''),
        vehicleType: asTypeVehicleType(raw.vehicleType),
        vehicleClass: asTypeVehicleClass(raw.vehicleClass),
        brand: String(raw.brand ?? ''),
        color: String(raw.color ?? ''),
        manufactureYear: raw.manufactureYear ? String(raw.manufactureYear) : '',
        mileageKm: String(Number(raw.mileageKm) || 0),
        nextMaintenanceDate: raw.nextMaintenanceDate ? String(raw.nextMaintenanceDate).slice(0, 10) : '',
        rentalPricePerDayVnd: String(Number(raw.rentalPricePerDayVnd) || 0),
        rentalSelfDrivePricePerDayVnd: String(Number(raw.rentalSelfDrivePricePerDayVnd) || 0),
        seatCount: (typeof raw.seatCount === 'number' && raw.seatCount > 0) ? String(raw.seatCount) : '',
        publicDisplayName: String(raw.publicDisplayName ?? ''),
        publicSuitability: String(raw.publicSuitability ?? ''),
        showInPublicOptions: typeof raw.showInPublicOptions === 'boolean' ? raw.showInPublicOptions : true,
        status: asTypeVehicleStatus(raw.status),
        statusReason: String(raw.statusReason ?? ''),
        notes: String(raw.notes ?? ''),
      })
    } catch {
      setForm(EMPTY_FORM)
    }
    setSaveErrorMsg(null)
    setFormOpen(true)
  }

  const onSave = async (e: FormEvent) => {
    try {
      e.preventDefault()
      e.stopPropagation()
    } catch {
      /* noop */
    }
    setSaveErrorMsg(null)
    if (!form?.licensePlate || !String(form.licensePlate).trim()) {
      const errMsg = 'Vui lòng nhập biển số xe.'
      toast.error(errMsg)
      setSaveErrorMsg(errMsg)
      return
    }
    let payload: Record<string, unknown> = {}
    try {
      payload = {
        licensePlate: trimUpper(form.licensePlate),
        vehicleType: asTypeVehicleType(form.vehicleType),
        vehicleClass: asTypeVehicleClass(form.vehicleClass),
        brand: trimOrNull(form.brand),
        color: trimOrNull(form.color),
        manufactureYear: numOrNull(form.manufactureYear),
        mileageKm: numOrZero(form.mileageKm),
        nextMaintenanceDate: form.nextMaintenanceDate ? String(form.nextMaintenanceDate) : null,
        rentalPricePerDayVnd: numOrZero(form.rentalPricePerDayVnd),
        rentalSelfDrivePricePerDayVnd: numOrZero(form.rentalSelfDrivePricePerDayVnd),
        seatCount: numOrNull(form.seatCount),
        publicDisplayName: trimOrNull(form.publicDisplayName),
        publicSuitability: trimOrNull(form.publicSuitability),
        showInPublicOptions: !!form.showInPublicOptions,
        status: asTypeVehicleStatus(form.status),
        statusReason: trimOrNull(form.statusReason),
        notes: trimOrNull(form.notes),
      }

      if (payload.manufactureYear !== null && (typeof payload.manufactureYear !== 'number' || payload.manufactureYear < 1980 || payload.manufactureYear > 2100)) {
        const errMsg = 'Năm sản xuất không hợp lệ (1980-2100).'
        toast.error(errMsg)
        setSaveErrorMsg(errMsg)
        return
      }
      if (typeof payload.mileageKm !== 'number' || payload.mileageKm < 0) {
        const errMsg = 'Số km không được âm.'
        toast.error(errMsg)
        setSaveErrorMsg(errMsg)
        return
      }
      if (typeof payload.rentalPricePerDayVnd !== 'number' || payload.rentalPricePerDayVnd < 0) {
        const errMsg = 'Giá thuê (có tài xế) không được âm.'
        toast.error(errMsg)
        setSaveErrorMsg(errMsg)
        return
      }
      if (typeof payload.rentalSelfDrivePricePerDayVnd !== 'number' || payload.rentalSelfDrivePricePerDayVnd < 0) {
        const errMsg = 'Giá thuê tự lái không được âm.'
        toast.error(errMsg)
        setSaveErrorMsg(errMsg)
        return
      }
      if (payload.seatCount !== null && (typeof payload.seatCount !== 'number' || payload.seatCount < 1 || payload.seatCount > 80)) {
        const errMsg = 'Số chỗ ngồi không hợp lệ (1-80).'
        toast.error(errMsg)
        setSaveErrorMsg(errMsg)
        return
      }
    } catch (e: any) {
      const errMsg = 'Dữ liệu nhập không hợp lệ: ' + (e?.message ?? '')
      toast.error(errMsg)
      setSaveErrorMsg(errMsg)
      return
    }

    try {
      setSaving(true)
      if (editingId) {
        await adminUpdateVehicle(String(editingId), payload as any)
        toast.success('Cập nhật xe thành công.')
      } else {
        await adminCreateVehicle(payload as any)
        toast.success('Tạo xe thành công.')
      }
      setFormOpen(false)
      resetForm()
      setSaveErrorMsg(null)
      await refreshList(1)
    } catch (e: any) {
      const msg = e?.message || 'Lưu xe thất bại.'
      toast.error(msg)
      setSaveErrorMsg(msg)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (v: Vehicle | null | undefined) => {
    if (!v) return
    const lp = String((v as any).licensePlate ?? '')
    const ok = window.confirm(`Xóa xe ${lp}?\nLưu ý: Xe đã từng phục vụ booking sẽ không được xóa.`)
    if (!ok) return
    try {
      await adminDeleteVehicle(String((v as any).id ?? ''))
      toast.success('Đã xóa xe.')
      await refreshList(1)
    } catch (e: any) {
      toast.error(e?.message || 'Xóa xe thất bại.')
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Quản lý toàn bộ xe vận hành: 4 chỗ, 7 chỗ, 16 chỗ, 29 chỗ, 45 chỗ + trạng thái + giá thuê."
        title="Quản lý xe"
        right={
          <button
            className="inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            onClick={() => {
              if (formOpen) {
                setFormOpen(false)
                resetForm()
              } else {
                openCreate()
              }
            }}
            type="button"
          >
            {formOpen ? 'Đóng' : 'Thêm xe'}
          </button>
        }
      />

      {formOpen ? (
        <form
          className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100"
          noValidate
          onSubmit={(e) => {
            try {
              void onSave(e)
            } catch (err: any) {
              try { toast.error('Lỗi hệ thống khi lưu: ' + (err?.message ?? '')) } catch {
                /* swallow */
              }
            }
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-bold text-slate-900">{editingId ? 'Chỉnh sửa xe' : 'Thêm xe mới'}</div>
            {saveErrorMsg ? (
              <div className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[12px] font-semibold text-rose-800 max-w-[60%] truncate" title={saveErrorMsg}>
                {saveErrorMsg}
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Biển số xe *</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
                placeholder="VD: 30A-123.45"
                value={form.licensePlate}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Loại xe (số chỗ) *</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, vehicleType: asTypeVehicleType(e.target.value) })}
                value={form.vehicleType}
              >
                {VEHICLE_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Phân loại xe (Ghế / Giường) *</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, vehicleClass: asTypeVehicleClass(e.target.value) })}
                value={form.vehicleClass}
              >
                {VEHICLE_CLASS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Hãng xe</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="VD: Toyota, Hyundai, Ford..."
                value={form.brand}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Màu sắc</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="VD: Trắng, Đen, Xám..."
                value={form.color}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Năm sản xuất</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, manufactureYear: e.target.value })}
                placeholder="VD: 2023"
                type="number"
                value={form.manufactureYear}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Số km đã chạy</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, mileageKm: e.target.value })}
                placeholder="0"
                type="number"
                value={form.mileageKm}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Ngày bảo dưỡng tiếp theo</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, nextMaintenanceDate: e.target.value })}
                type="date"
                value={form.nextMaintenanceDate}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Giá thuê 1 ngày (có tài xế - VNĐ)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, rentalPricePerDayVnd: e.target.value })}
                placeholder="VD: 2500000"
                type="number"
                value={form.rentalPricePerDayVnd}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Giá thuê 1 ngày (tự lái - VNĐ)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, rentalSelfDrivePricePerDayVnd: e.target.value })}
                placeholder="VD: 1500000"
                type="number"
                value={form.rentalSelfDrivePricePerDayVnd}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Số chỗ ngồi (thực tế)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, seatCount: e.target.value })}
                placeholder="Để trống dùng mặc định theo loại xe"
                type="number"
                value={form.seatCount}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Tên hiển thị (khách hàng thấy)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, publicDisplayName: e.target.value })}
                placeholder="VD: Xe 7 chỗ Toyota Fortuner 2024 (để trống dùng tên mặc định)"
                value={form.publicDisplayName}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Phù hợp sử dụng (khách hàng thấy)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, publicSuitability: e.target.value })}
                placeholder="VD: Gia đình nhỏ 4-6 người, thuê cưới, công tác nội thành 1-2 ngày"
                value={form.publicSuitability}
              />
            </label>
            <label className="block md:col-span-2 lg:col-span-3">
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  checked={form.showInPublicOptions}
                  className="h-5 w-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                  onChange={(e) => setForm({ ...form, showInPublicOptions: e.target.checked })}
                  type="checkbox"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Hiển thị trong danh mục thuê xe (trang khách hàng)</div>
                  <div className="text-xs text-slate-500">Bỏ tick để ẩn loại xe này khỏi bảng giá tham khảo bên trang thuê xe, vẫn thấy ở quản trị.</div>
                </div>
              </div>
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Trạng thái *</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, status: asTypeVehicleStatus(e.target.value) })}
                value={form.status}
              >
                {VEHICLE_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block md:col-span-2 lg:col-span-3">
              <div className="text-sm font-semibold text-slate-900">Ghi chú trạng thái</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, statusReason: e.target.value })}
                placeholder="VD: Đang thay lốp, hết bảo hành..."
                value={form.statusReason}
              />
            </label>
            <label className="block md:col-span-2 lg:col-span-3">
              <div className="text-sm font-semibold text-slate-900">Ghi chú / Tài xế phụ trách</div>
              <textarea
                className="mt-2 min-h-[88px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="VD: Tài xế: Nguyễn Văn A - SĐT: 090xxxxxxx; xe trang bị wifi, nước uống miễn phí..."
                value={form.notes}
              />
            </label>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
              type="button"
            >
              Hủy
            </button>
            <button
              className={cn(
                'inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600',
                saving && 'pointer-events-none opacity-70',
              )}
              disabled={saving}
              type="submit"
            >
              {saving ? 'Đang lưu...' : editingId ? 'Lưu thay đổi' : 'Tạo xe'}
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="block md:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tìm kiếm</div>
            <input
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              placeholder="Tìm biển số, hãng, màu, ghi chú..."
              value={q}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Loại xe (chỗ)</div>
            <select
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setFType(e.target.value === '' ? '' : asTypeVehicleType(e.target.value)); setPage(1) }}
              value={fType}
            >
              <option value="">Tất cả loại</option>
              {VEHICLE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phân loại xe</div>
            <select
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setFClass(e.target.value === '' ? '' : asTypeVehicleClass(e.target.value)); setPage(1) }}
              value={fClass}
            >
              <option value="">Tất cả (Ghế/Giường)</option>
              {VEHICLE_CLASS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</div>
            <select
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setFStatus(e.target.value === '' ? '' : asTypeVehicleStatus(e.target.value)); setPage(1) }}
              value={fStatus}
            >
              <option value="">Tất cả trạng thái</option>
              {VEHICLE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Biển số</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Loại (chỗ)</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Phân loại</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Hãng / Màu</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Năm / Km</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Giá thuê / ngày</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Lịch sử</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 ? (
                <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={9}>Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={9}>Chưa có xe nào. Nhấn "Thêm xe" để tạo đầu tiên.</td></tr>
              ) : (
                items.map((raw) => {
                  const v: any = raw
                  if (!v || typeof v !== 'object') return null
                  const safeId = String(v.id ?? '')
                  if (!safeId) return null
                  const st = statusVehicleInfo(v.status)
                  const cls = classVehicleInfo(v.vehicleClass)
                  const shortId = safeId.length >= 8 ? safeId.slice(0, 8) : safeId
                  const nmd = v.nextMaintenanceDate
                  const nmdShort = typeof nmd === 'string' && nmd.length >= 10 ? nmd.slice(0, 10) : ''
                  return (
                    <tr key={safeId} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="text-sm font-bold text-slate-900">{String(v.licensePlate ?? '')}</div>
                        {shortId ? <div className="text-[11px] text-slate-500">ID: {shortId}…</div> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">
                          {labelVehicleType(v.vehicleType)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', String(cls.tone || 'bg-slate-100 text-slate-700 ring-slate-200'))}>
                          {String(v.vehicleClassLabel ?? labelVehicleClass(v.vehicleClass) ?? '-')}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="text-sm text-slate-800">{v.brand ?? '-'}</div>
                        <div className="text-[11px] text-slate-500">{v.color ?? '-'}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-700">
                        <div>{v.manufactureYear ?? '-'}</div>
                        <div className="text-[11px] text-slate-500">{(Number(v.mileageKm) || 0).toLocaleString('vi-VN')} km</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-800">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(v.rentalPricePerDayVnd) || 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', String(st.tone || 'bg-slate-100 text-slate-700 ring-slate-200'))}>
                          {String(st.label || '-')}
                        </span>
                        {v.statusReason ? <div className="mt-0.5 text-[10px] text-slate-500 max-w-[180px] truncate" title={String(v.statusReason)}>{String(v.statusReason)}</div> : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[12px] text-slate-700">
                        <div className="font-semibold">{Array.isArray(v.bookingHistoryIds) ? v.bookingHistoryIds.length : 0} đơn</div>
                        {nmdShort ? (
                          <div className="text-[10px] text-amber-700">BD tiếp: {nmdShort}</div>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            onClick={() => openEdit(raw)}
                            type="button"
                          >
                            Sửa
                          </button>
                          <button
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            onClick={() => onDelete(raw)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 sm:flex-row">
          <div className="text-xs text-slate-500">
            Tổng <span className="font-semibold text-slate-800">{total}</span> xe · Trang <span className="font-semibold text-slate-800">{page}</span>/{totalPages}
          </div>
          <div className="inline-flex items-center gap-1.5">
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Trước
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
