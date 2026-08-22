import { useEffect, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  VEHICLE_STATUS_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  Vehicle,
  VehicleStatus,
  VehicleType,
  labelVehicleType,
  staffListVehicles,
  statusVehicleInfo,
} from '@/features/vehicles/vehicles'
import { cn } from '@/lib/utils'

export default function StaffVehiclesPage() {
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Vehicle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  const [q, setQ] = useState('')
  const [fType, setFType] = useState<'' | VehicleType>('')
  const [fStatus, setFStatus] = useState<'' | VehicleStatus>('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await staffListVehicles({
        page,
        limit,
        q: q.trim() || undefined,
        vehicleType: fType || undefined,
        status: fStatus || undefined,
      })
      setItems(res.items || [])
      setTotal(res.total || 0)
    } catch (e: any) {
      toast.error(e?.message || 'Không tải được danh sách xe.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [page, limit, q, fType, fStatus])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Xem danh sách xe và trạng thái vận hành. Liên hệ Admin để thêm / cập nhật thông tin xe."
        title="Quản lý xe (chỉ xem)"
      />

      <div className="rounded-3xl bg-white p-5 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="grid gap-3 md:grid-cols-4">
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
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Loại xe</div>
            <select
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setFType(e.target.value as VehicleType | ''); setPage(1) }}
              value={fType}
            >
              <option value="">Tất cả loại</option>
              {VEHICLE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trạng thái</div>
            <select
              className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => { setFStatus(e.target.value as VehicleStatus | ''); setPage(1) }}
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
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Loại</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Hãng / Màu</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Năm / Km</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Giá thuê / ngày</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Trạng thái</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Ghi chú / Tài xế</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && items.length === 0 ? (
                <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={7}>Đang tải...</td></tr>
              ) : items.length === 0 ? (
                <tr><td className="px-5 py-8 text-center text-slate-500" colSpan={7}>Chưa có xe nào.</td></tr>
              ) : (
                items.map((v) => {
                  const st = statusVehicleInfo(v.status)
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="text-sm font-bold text-slate-900">{v.licensePlate}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">
                          {labelVehicleType(v.vehicleType)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="text-sm text-slate-800">{v.brand ?? '-'}</div>
                        <div className="text-[11px] text-slate-500">{v.color ?? '-'}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-700">
                        <div>{v.manufactureYear ?? '-'}</div>
                        <div className="text-[11px] text-slate-500">{(v.mileageKm ?? 0).toLocaleString('vi-VN')} km</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-800">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v.rentalPricePerDayVnd ?? 0)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', st.tone)}>
                          {st.label}
                        </span>
                        {v.statusReason ? <div className="mt-0.5 text-[10px] text-slate-500 max-w-[180px] truncate">{v.statusReason}</div> : null}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-slate-700">
                        <div className="max-w-[320px] whitespace-pre-wrap">{v.notes ?? '-'}</div>
                        {v.nextMaintenanceDate ? (
                          <div className="mt-1 text-[10px] text-amber-700">Bảo dưỡng tiếp: {v.nextMaintenanceDate.slice(0, 10)}</div>
                        ) : null}
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
