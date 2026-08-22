import { apiFetch } from '@/lib/api'

export type VehicleType = 'seater_4' | 'seater_7' | 'seater_16' | 'seater_29' | 'seater_45'
export type VehicleStatus = 'available' | 'in_trip' | 'maintenance' | 'repairing' | 'damaged' | 'out_of_service'
export type VehicleClass = 'seat' | 'sleeper' | 'limousine' | 'cabin'

export const VEHICLE_TYPE_OPTIONS: { value: VehicleType; label: string; seats: number }[] = [
  { value: 'seater_4', label: 'Xe 4 chỗ', seats: 4 },
  { value: 'seater_7', label: 'Xe 7 chỗ', seats: 7 },
  { value: 'seater_16', label: 'Xe 16 chỗ', seats: 16 },
  { value: 'seater_29', label: 'Xe 29 chỗ', seats: 29 },
  { value: 'seater_45', label: 'Xe 45 chỗ', seats: 45 },
]

export const VEHICLE_CLASS_OPTIONS: { value: VehicleClass; label: string; tone: string }[] = [
  { value: 'seat', label: 'Ghế ngồi', tone: 'bg-sky-100 text-sky-800 ring-sky-200' },
  { value: 'sleeper', label: 'Giường nằm', tone: 'bg-indigo-100 text-indigo-800 ring-indigo-200' },
  { value: 'limousine', label: 'Limousine', tone: 'bg-amber-100 text-amber-800 ring-amber-200' },
  { value: 'cabin', label: 'Giường riêng (Cabin)', tone: 'bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200' },
]

export const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string; tone: string }[] = [
  { value: 'available', label: 'Sẵn sàng', tone: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  { value: 'in_trip', label: 'Đang phục vụ', tone: 'bg-blue-100 text-blue-800 ring-blue-200' },
  { value: 'maintenance', label: 'Bảo dưỡng', tone: 'bg-amber-100 text-amber-800 ring-amber-200' },
  { value: 'repairing', label: 'Sửa chữa', tone: 'bg-orange-100 text-orange-800 ring-orange-200' },
  { value: 'damaged', label: 'Hỏng', tone: 'bg-rose-100 text-rose-800 ring-rose-200' },
  { value: 'out_of_service', label: 'Ngừng hoạt động', tone: 'bg-slate-200 text-slate-700 ring-slate-300' },
]

export function labelVehicleType(t: VehicleType | string | null | undefined) {
  return VEHICLE_TYPE_OPTIONS.find((x) => x.value === t)?.label ?? String(t ?? '-')
}
export function labelVehicleClass(c: VehicleClass | string | null | undefined) {
  return VEHICLE_CLASS_OPTIONS.find((x) => x.value === c)?.label ?? String(c ?? '-')
}
export function classVehicleInfo(c: VehicleClass | string | null | undefined) {
  return VEHICLE_CLASS_OPTIONS.find((x) => x.value === c) ?? { label: String(c ?? '-'), tone: 'bg-slate-100 text-slate-700 ring-slate-200' }
}
export function statusVehicleInfo(s: VehicleStatus | string | null | undefined) {
  return VEHICLE_STATUS_OPTIONS.find((x) => x.value === s) ?? { label: String(s ?? '-'), tone: 'bg-slate-100 text-slate-700 ring-slate-200' }
}

export type VehicleBookingHistoryMini = { id: string; code: string | null; departureDate: string | null; status: string }

export type Vehicle = {
  id: string
  licensePlate: string
  vehicleType: VehicleType
  vehicleClass: VehicleClass
  vehicleClassLabel?: string
  brand: string | null
  color: string | null
  manufactureYear: number | null
  mileageKm: number
  nextMaintenanceDate: string | null
  rentalPricePerDayVnd: number
  rentalSelfDrivePricePerDayVnd: number
  seatCount: number | null
  publicDisplayName: string | null
  publicSuitability: string | null
  showInPublicOptions: boolean
  status: VehicleStatus
  statusReason: string | null
  notes: string | null
  bookingHistoryIds: string[]
  bookingHistory?: (VehicleBookingHistoryMini | null)[]
  createdAt?: string | null
  updatedAt?: string | null
}

export type VehicleSimple = {
  id: string
  licensePlate: string
  vehicleType: VehicleType
  vehicleClass: VehicleClass
  vehicleClassLabel?: string
  brand: string | null
  color: string | null
  status: VehicleStatus
  rentalPricePerDayVnd: number
}

export type VehicleListParams = {
  page?: number
  limit?: number
  vehicleType?: VehicleType
  vehicleClass?: VehicleClass
  status?: VehicleStatus
  q?: string
}

export async function adminListVehicles(p: VehicleListParams = {}) {
  const params = new URLSearchParams()
  if (p.page) params.set('page', String(p.page))
  if (p.limit) params.set('limit', String(p.limit))
  if (p.vehicleType) params.set('vehicleType', p.vehicleType)
  if (p.vehicleClass) params.set('vehicleClass', p.vehicleClass)
  if (p.status) params.set('status', p.status)
  if (p.q) params.set('q', p.q)
  const qs = params.toString()
  return apiFetch<{ items: Vehicle[]; total: number; page: number; limit: number }>(
    `/admin/vehicles${qs ? `?${qs}` : ''}`,
  )
}

export async function adminListVehiclesSimple(filter?: { status?: VehicleStatus; vehicleType?: VehicleType; vehicleClass?: VehicleClass }) {
  const params = new URLSearchParams()
  if (filter?.status) params.set('status', filter.status)
  if (filter?.vehicleType) params.set('vehicleType', filter.vehicleType)
  if (filter?.vehicleClass) params.set('vehicleClass', filter.vehicleClass)
  const qs = params.toString()
  return apiFetch<{ items: VehicleSimple[] }>(`/admin/vehicles/simple${qs ? `?${qs}` : ''}`)
}

export async function adminGetVehicle(id: string) {
  return apiFetch<Vehicle>(`/admin/vehicles/${id}`)
}

export async function adminCreateVehicle(input: {
  licensePlate: string
  vehicleType: VehicleType
  vehicleClass?: VehicleClass
  brand?: string | null
  color?: string | null
  manufactureYear?: number | null
  mileageKm?: number
  nextMaintenanceDate?: string | null
  rentalPricePerDayVnd?: number
  rentalSelfDrivePricePerDayVnd?: number
  seatCount?: number | null
  publicDisplayName?: string | null
  publicSuitability?: string | null
  showInPublicOptions?: boolean
  status?: VehicleStatus
  statusReason?: string | null
  notes?: string | null
}) {
  return apiFetch<Vehicle>('/admin/vehicles', { method: 'POST', body: JSON.stringify(input) })
}

export async function adminUpdateVehicle(
  id: string,
  input: {
    licensePlate?: string
    vehicleType?: VehicleType
    vehicleClass?: VehicleClass
    brand?: string | null
    color?: string | null
    manufactureYear?: number | null
    mileageKm?: number
    nextMaintenanceDate?: string | null
    rentalPricePerDayVnd?: number
    rentalSelfDrivePricePerDayVnd?: number
    seatCount?: number | null
    publicDisplayName?: string | null
    publicSuitability?: string | null
    showInPublicOptions?: boolean
    status?: VehicleStatus
    statusReason?: string | null
    notes?: string | null
  },
) {
  return apiFetch<Vehicle>(`/admin/vehicles/${id}`, { method: 'PATCH', body: JSON.stringify(input) })
}

export async function adminDeleteVehicle(id: string) {
  return apiFetch<{ ok: true }>(`/admin/vehicles/${id}`, { method: 'DELETE' })
}

export async function adminGetVehiclesDashboardStats() {
  return apiFetch<{
    total: number
    byType: { type: VehicleType; label: string; count: number }[]
    byClass: { class: VehicleClass; label: string; count: number }[]
    byStatus: { status: VehicleStatus; label: string; count: number }[]
  }>('/admin/vehicles/dashboard-stats')
}

export async function staffListVehicles(p: VehicleListParams = {}) {
  const params = new URLSearchParams()
  if (p.page) params.set('page', String(p.page))
  if (p.limit) params.set('limit', String(p.limit))
  if (p.vehicleType) params.set('vehicleType', p.vehicleType)
  if (p.vehicleClass) params.set('vehicleClass', p.vehicleClass)
  if (p.status) params.set('status', p.status)
  if (p.q) params.set('q', p.q)
  const qs = params.toString()
  return apiFetch<{ items: Vehicle[]; total: number; page: number; limit: number }>(
    `/staff/vehicles${qs ? `?${qs}` : ''}`,
  )
}

export async function staffListVehiclesSimple(filter?: { status?: VehicleStatus; vehicleType?: VehicleType; vehicleClass?: VehicleClass }) {
  const params = new URLSearchParams()
  if (filter?.status) params.set('status', filter.status)
  if (filter?.vehicleType) params.set('vehicleType', filter.vehicleType)
  if (filter?.vehicleClass) params.set('vehicleClass', filter.vehicleClass)
  const qs = params.toString()
  return apiFetch<{ items: VehicleSimple[] }>(`/staff/vehicles/simple${qs ? `?${qs}` : ''}`)
}

export async function staffGetVehicleMeta() {
  return apiFetch<{ types: { value: VehicleType; label: string; seats?: number }[]; classes: { value: VehicleClass; label: string }[]; statuses: { value: VehicleStatus; label: string }[] }>(
    '/staff/vehicles/meta',
  )
}

export async function assignVehiclesToBooking(bookingId: string, vehicleIds: string[], actor: 'admin' | 'staff' = 'admin') {
  const prefix = actor === 'admin' ? '/admin/bookings' : '/admin/bookings'
  return apiFetch<any>(`${prefix}/${bookingId}/assign-vehicles`, {
    method: 'PATCH',
    body: JSON.stringify({ vehicleIds }),
  })
}
