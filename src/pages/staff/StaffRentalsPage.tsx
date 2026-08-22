import { FormEvent, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  HANDOVER_STATUS_OPTIONS,
  HANDOVER_TYPE_OPTIONS,
  ChecklistItem,
  HandoverPhoto,
  VehicleClass,
  VehicleHandover,
  VehicleRentalContract,
  handoverTypeLabel,
  hoStatusInfo,
  staffCreateHandover,
  staffDefaultChecklist,
  staffGetHandover,
  staffHandoverAction,
  staffListContracts,
  staffListHandovers,
  staffUpdateHandover,
} from '@/features/rentals/rentals'
import { labelVehicleType } from '@/features/vehicles/vehicles'
import { cn } from '@/lib/utils'

type HandoverTab = 'pickup' | 'return'

const TABS: { key: HandoverTab; label: string; icon: string; hint: string }[] = [
  { key: 'pickup', label: 'Giao xe cho khách', icon: '🗝️', hint: 'Kiểm tra trước khi giao, ký BB' },
  { key: 'return', label: 'Thu hồi xe từ khách', icon: '🛻', hint: 'Đối chiếu với BB giao, kiểm tra trả' },
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

function Badge({ tone, children }: { tone?: string; children: React.ReactNode }) {
  const t = tone || 'bg-slate-100 text-slate-700 ring-slate-200'
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', t)}>
      {children}
    </span>
  )
}

function Select({ value, onChange, options, placeholder, className }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
  placeholder?: string; className?: string
}) {
  return (
    <select
      className={cn('block w-full rounded-md border-0 py-2 pl-3 pr-10 text-sm text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-indigo-500 bg-white', className)}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
    </select>
  )
}

type FormState = {
  contractId: string
  vehicleId: string
  pairedPickupHandoverId: string
  checklist: ChecklistItem[]
  damagePhotos: HandoverPhoto[]
  mileageKm: string
  fuelPercent: string
  dailyKmLimit: string
  customerSignerName: string
  customerSignerCitizenId: string
  notes: string
  cancelReason: string
}
const EMPTY: FormState = {
  contractId: '', vehicleId: '', pairedPickupHandoverId: '',
  checklist: [], damagePhotos: [],
  mileageKm: '0', fuelPercent: '100', dailyKmLimit: '300',
  customerSignerName: '', customerSignerCitizenId: '', notes: '', cancelReason: '',
}

function formFromEntity(v: VehicleHandover | null, defCls: ChecklistItem[] = []): FormState {
  if (!v) return EMPTY
  const mergeCls: ChecklistItem[] = (defCls.length ? defCls : []).map((d) => {
    const ex = (v.checklist || []).find((x) => x.key === d.key)
    return { ...d, passed: ex?.passed ?? d.passed, note: ex?.note ?? d.note ?? null }
  })
  const extras = (v.checklist || []).filter((x) => !mergeCls.find((m) => m.key === x.key))
  return {
    contractId: String(v.contractId ?? ''),
    vehicleId: String(v.vehicleId ?? ''),
    pairedPickupHandoverId: v.pairedPickupHandoverId ?? '',
    checklist: [...mergeCls, ...extras],
    damagePhotos: Array.isArray(v.damagePhotos) ? v.damagePhotos.map((p) => ({ ...p })) : [],
    mileageKm: v.mileageKm != null ? String(v.mileageKm) : '0',
    fuelPercent: v.fuelPercent != null ? String(v.fuelPercent) : '100',
    dailyKmLimit: v.dailyKmLimit != null ? String(v.dailyKmLimit) : '300',
    customerSignerName: v.customerSignerName ?? '',
    customerSignerCitizenId: v.customerSignerCitizenId ?? '',
    notes: v.notes ?? '',
    cancelReason: '',
  }
}

export default function StaffRentalsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<HandoverTab>('pickup')

  /* Contracts (read-only list - để chọn trong form) */
  const [contracts, setContracts] = useState<VehicleRentalContract[]>([])
  const [contractsLoading, setContractsLoading] = useState(false)
  const refreshContracts = async () => {
    try {
      setContractsLoading(true)
      const r = await staffListContracts({ page: 1, limit: 200 })
      setContracts(Array.isArray(r.items) ? (r.items as VehicleRentalContract[]) : [])
    } catch (e: any) { toast.error('Không tải được danh sách HĐ: ' + (e?.message || 'Lỗi')) }
    finally { setContractsLoading(false) }
  }
  useEffect(() => { void refreshContracts() }, [])

  /* List tab data */
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<VehicleHandover[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState<string>('')

  const refresh = async (targetPage = 1) => {
    try {
      setLoading(true)
      const r = await staffListHandovers({
        page: targetPage, limit: 20,
        handoverType: tab,
        q: q.trim() || undefined,
        status: fStatus || undefined,
      })
      setItems(Array.isArray(r.items) ? (r.items as VehicleHandover[]) : [])
      setTotal(Number(r.total) || 0)
      setPage(targetPage)
    } catch (e: any) { toast.error('Không tải được biên bản: ' + (e?.message || 'Lỗi')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh(1) }, [tab])

  /* Pending handovers to pair (for return tab) */
  const pendingPickups = useMemo(
    () => contracts.map((c) => c.pickupHandoverId).filter(Boolean) as string[],
    [contracts],
  )
  const pickupHandoverOptions = useMemo(() => {
    // In real life we'd fetch, but we use "items" from pickup tab via quick reload lookup via contracts[].pickupHandoverId text:
    const opts: { value: string; label: string }[] = []
    contracts.forEach((c) => {
      if (c.pickupHandoverId) {
        opts.push({ value: String(c.pickupHandoverId), label: `HĐ ${c.code} · BB Giao xe (${c.customerName})` })
      }
    })
    return opts
  }, [contracts])

  /* Form state */
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saveErr, setSaveErr] = useState<string | null>(null)
  const [loadingDefault, setLoadingDefault] = useState(false)

  const selectedContract = useMemo(() => contracts.find((c) => c.id === form.contractId) || null, [contracts, form.contractId])
  const vehicleOptionsForContract = useMemo(() => {
    const opts: { value: string; label: string }[] = []
    if (selectedContract) {
      if (Array.isArray(selectedContract.assignedVehicles) && selectedContract.assignedVehicles.length) {
        selectedContract.assignedVehicles.forEach((v) => {
          if (!v) return
          opts.push({ value: v.id, label: `${(v as any).plateNumber || '(xe)'} · ${labelVehicleType((v as any).vehicleType)} · ${(v as any).vehicleClassLabel || (v as any).vehicleClass || ''}` })
        })
      } else if (Array.isArray(selectedContract.assignedVehicleIds)) {
        selectedContract.assignedVehicleIds.forEach((vid) => opts.push({ value: String(vid), label: `Xe #${vid.slice(-6)}` }))
      }
    }
    return opts
  }, [selectedContract])

  const loadDefaultForContract = async (overrides?: { vehicleClass?: VehicleClass }) => {
    try {
      setLoadingDefault(true)
      const vehicleClass = overrides?.vehicleClass ?? (() => {
        const v = selectedContract?.assignedVehicles?.[0] as any
        return v?.vehicleClass as VehicleClass | undefined
      })()
      const r = await staffDefaultChecklist({ handoverType: tab, vehicleClass })
      setForm((f) => ({ ...f, checklist: Array.isArray(r.items) ? r.items : [] }))
    } catch (e: any) { toast.error('Không lấy mẫu checklist: ' + (e?.message || 'Lỗi')) }
    finally { setLoadingDefault(false) }
  }

  const openNew = async () => {
    setEditingId(null); setSaveErr(null)
    const base: FormState = { ...EMPTY }
    // Auto load default checklist loại tab hiện tại
    try {
      setLoadingDefault(true)
      const r = await staffDefaultChecklist({ handoverType: tab })
      base.checklist = Array.isArray(r.items) ? r.items : []
    } finally { setLoadingDefault(false) }
    setForm(base); setFormOpen(true)
  }
  const openEdit = async (v: VehicleHandover) => {
    try {
      setLoadingDefault(true); setSaveErr(null)
      // Lấy checklist default cho loại này để merge vói existing passed/note
      const vClass = (v as any).vehicleSummary?.vehicleClass as VehicleClass | undefined
      const def = await staffDefaultChecklist({ handoverType: v.handoverType as any, vehicleClass: vClass })
      const full = await staffGetHandover(v.id)
      setEditingId(v.id)
      setForm(formFromEntity(full, Array.isArray(def.items) ? def.items : []))
      setFormOpen(true)
    } catch (e: any) { toast.error(e?.message || 'Lỗi mở BB') }
    finally { setLoadingDefault(false) }
  }

  const onContractChange = async (cid: string) => {
    setForm((f) => ({ ...f, contractId: cid, vehicleId: f.vehicleId && selectedContract?.assignedVehicleIds.includes(f.vehicleId) ? f.vehicleId : '' }))
    if (cid) {
      // Khi đổi contract, mặc định lấy xe đầu tiên nếu có
      const c = contracts.find((x) => x.id === cid) || null
      const firstVid = c?.assignedVehicles?.[0]?.id || c?.assignedVehicleIds?.[0] || ''
      setForm((f) => ({ ...f, vehicleId: firstVid || f.vehicleId }))
      // Tải checklist default theo class của xe đầu tiên
      const firstVehicleClass = (c?.assignedVehicles?.[0] as any)?.vehicleClass as VehicleClass | undefined
      if (firstVehicleClass || !form.checklist.length) {
        try {
          setLoadingDefault(true)
          const r = await staffDefaultChecklist({ handoverType: tab, vehicleClass: firstVehicleClass })
          setForm((f) => ({ ...f, checklist: Array.isArray(r.items) ? r.items : f.checklist }))
        } finally { setLoadingDefault(false) }
      }
      // Nếu tab return, tự điền pairedPickupHandoverId từ HĐ pickupHandoverId
      if (tab === 'return' && c?.pickupHandoverId) {
        setForm((f) => ({ ...f, pairedPickupHandoverId: String(c.pickupHandoverId!) }))
      }
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true); setSaveErr(null)
      const payload = {
        handoverType: tab,
        contractId: form.contractId || undefined,
        vehicleId: form.vehicleId || undefined,
        pairedPickupHandoverId: trimOrNull(form.pairedPickupHandoverId),
        checklist: form.checklist.map((c) => ({
          key: c.key.trim() || `check_${Math.random().toString(36).slice(2, 7)}`,
          label: c.label.trim() || '(chưa có tên)',
          group: c.group || undefined,
          required: !!c.required,
          passed: !!c.passed,
          note: trimOrNull(c.note),
        })),
        damagePhotos: form.damagePhotos.map((p) => ({
          url: p.url,
          caption: trimOrNull(p.caption),
          takenAt: p.takenAt || undefined,
        })),
        mileageKm: form.mileageKm === '' ? null : numOrZero(form.mileageKm),
        fuelPercent: form.fuelPercent === '' ? null : Math.min(100, Math.max(0, numOrZero(form.fuelPercent))),
        dailyKmLimit: form.dailyKmLimit === '' ? null : numOrZero(form.dailyKmLimit),
        customerSignerName: trimOrNull(form.customerSignerName),
        customerSignerCitizenId: trimOrNull(form.customerSignerCitizenId),
        notes: trimOrNull(form.notes),
        cancelReason: trimOrNull(form.cancelReason),
      }
      if (editingId) await staffUpdateHandover(editingId, payload as any)
      else await staffCreateHandover(payload as any)
      toast.success(editingId ? 'Đã cập nhật biên bản' : 'Đã tạo biên bản')
      setFormOpen(false); setEditingId(null); setForm(EMPTY)
      await Promise.all([refresh(page), refreshContracts()])
    } catch (e: any) {
      setSaveErr(e?.message || 'Lỗi lưu')
      toast.error(e?.message || 'Lỗi lưu biên bản')
    } finally { setSaving(false) }
  }

  const doAction = async (v: VehicleHandover, actionObj: any) => {
    try { await staffHandoverAction(v.id, actionObj); toast.success('Thành công'); await Promise.all([refresh(page), refreshContracts()]) }
    catch (e: any) { toast.error(e?.message || 'Lỗi') }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Giao / Thu hồi xe (Staff)"
        subtitle={tab === 'pickup' ? 'Lập biên bản Giao xe, kiểm tra 10 điểm, lấy chữ ký khách' : 'Lập biên bản Thu hồi xe, đối chiếu BB giao, ghi nhận phụ thu nếu có'}
      />

      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1 ring-1 ring-slate-200 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              tab === t.key ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60')}
            onClick={() => setTab(t.key)}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
            <span className="ml-2 text-xs text-slate-500">{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input placeholder="Tìm code / biển số / khách / HĐ…" className="w-full rounded-md px-3 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500"
            value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={fStatus} onChange={setFStatus} placeholder="Trạng thái BB"
            options={HANDOVER_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
          <div className="flex items-center text-xs text-slate-500 md:col-span-1">
            {contractsLoading ? 'Đang tải danh sách HĐ…' : `${contracts.length} hợp đồng đang hoạt động`}
            <button className="ml-2 underline hover:text-indigo-600" onClick={() => void refreshContracts()}>Làm mới</button>
          </div>
          <div className="flex gap-2">
            <button className="flex-1 rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200" onClick={() => void refresh(1)} disabled={loading}>
              {loading ? '…' : 'Tìm'}
            </button>
            <button className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={openNew}>
              + Tạo biên bản {handoverTypeLabel(tab)}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <Th>Code BB</Th>
                <Th>Hợp đồng</Th>
                <Th>Xe</Th>
                <Th>Khách hàng</Th>
                <Th>Ghi số KM / Xăng</Th>
                <Th>Giới hạn KM/ngày</Th>
                <Th>Checklist</Th>
                <Th>Ảnh</Th>
                <Th>Ngày ký</Th>
                <Th>Trạng thái</Th>
                <Th>Flow</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading && (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-slate-500">Đang tải…</td></tr>
              )}
              {!loading && items.length === 0 && (
                <tr><td colSpan={12} className="px-3 py-10 text-center text-sm text-slate-500">
                  <div className="mb-2 text-4xl opacity-30">{tab === 'pickup' ? '🗝️' : '🛻'}</div>
                  Chưa có biên bản {handoverTypeLabel(tab)} nào. Nhấn nút "Tạo biên bản" ở trên.
                </td></tr>
              )}
              {items.map((raw) => {
                const v: any = raw
                if (!v?.id) return null
                const passedCount = (v.checklist || []).filter((c: any) => c.passed).length
                const total = (v.checklist || []).length
                return (
                  <tr key={v.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-mono text-xs">{v.code}</td>
                    <td className="px-3 py-2 text-xs">{v.contractSummary?.code || v.contractId?.slice(-8) || '—'}</td>
                    <td className="px-3 py-2 text-xs">{v.vehicleSummary?.plateNumber || v.vehicleId?.slice(-6) || '—'}
                      <div className="text-slate-500">{v.vehicleSummary?.vehicleType ? labelVehicleType(v.vehicleSummary.vehicleType) : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {v.customerSignerName || selectedContractName(v.contractSummary, contracts)}
                      <div className="text-slate-500">{v.customerSignerCitizenId || ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      <div>{v.mileageKm != null ? `${Number(v.mileageKm).toLocaleString('vi-VN')} km` : '— km'}</div>
                      <div className="text-slate-500">{v.fuelPercent != null ? `${v.fuelPercent}% xăng` : ''}</div>
                    </td>
                    <td className="px-3 py-2 text-xs">{v.dailyKmLimit != null ? `${v.dailyKmLimit} km` : '—'}</td>
                    <td className="px-3 py-2 text-xs">{total > 0 ? `${passedCount}/${total} đạt` : '—'}
                      {total > 0 && passedCount < total && <Badge tone="bg-amber-50 text-amber-700 ring-amber-200">chưa đủ</Badge>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {(v.damagePhotos || []).length > 0 ? <Badge tone="bg-rose-50 text-rose-700 ring-rose-200">{v.damagePhotos.length} ảnh</Badge> : '0 ảnh'}
                    </td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{fmtDate(v.signedAt) || v.verifiedAt ? fmtDate(v.signedAt) : 'Chưa ký'}</td>
                    <td className="px-3 py-2"><Badge tone={hoStatusInfo(v.status).tone}>{hoStatusInfo(v.status).label}</Badge></td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {v.status === 'pending' && <FlowBtn onClick={() => doAction(v, { action: 'start' })} tone="amber">Bắt đầu kiểm tra</FlowBtn>}
                        {['pending', 'in_progress'].includes(v.status) && <FlowBtn onClick={() => doAction(v, { action: 'sign' })} tone="emerald">Khách & Staff ký</FlowBtn>}
                        {v.status === 'signed' && <FlowBtn onClick={() => doAction(v, { action: 'verify' })} tone="indigo" title="Văn phòng xác nhận BB">VP xác nhận</FlowBtn>}
                        {!['verified', 'canceled'].includes(v.status) && <FlowBtn onClick={() => {
                          const r = prompt('Lý do hủy biên bản?') || ''
                          doAction(v, { action: 'cancel', cancelReason: r })
                        }} tone="rose">Hủy</FlowBtn>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button className="rounded px-2 py-1 text-xs text-slate-700 hover:bg-slate-100" onClick={() => openEdit(v)}>Mở / Sửa</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          <div>Trang {page}: {total ? `${(page - 1) * 20 + 1} - ${Math.min(page * 20, total)} / ${total}` : '0 bản ghi'}</div>
        </div>
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-2 sm:p-6" onClick={() => setFormOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-xl ring-1 ring-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-4 py-3 backdrop-blur">
              <div>
                <div className="text-sm font-semibold text-slate-900">{editingId ? `Chỉnh sửa BB ${handoverTypeLabel(tab)}` : `Tạo biên bản ${handoverTypeLabel(tab)}`}</div>
                <div className="text-xs text-slate-500">{loadingDefault ? 'Đang tải mẫu checklist…' : ''}</div>
              </div>
              <button type="button" className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100" onClick={() => setFormOpen(false)}>✕</button>
            </div>
            <form onSubmit={submit} className="space-y-4 px-4 py-3">
              <details open className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">1. Thông tin biên bản</summary>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Hợp đồng *</div>
                    <Select value={form.contractId} onChange={onContractChange}
                      placeholder="Chọn HĐ đã ký / đặt cọc…"
                      options={contracts
                        .filter((c) => ['signed', 'deposit_paid', 'in_progress'].includes(c.status))
                        .map((c) => ({
                          value: c.id,
                          label: `${c.code} · ${c.customerName} (${fmtDate(c.pickupDateTime)} → ${fmtDate(c.returnDateTime)})`,
                        }))} />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Xe *</div>
                    <Select value={form.vehicleId} onChange={(vid) => setForm({ ...form, vehicleId: vid })}
                      placeholder={contractsLoading ? 'Đang tải xe…' : 'Chọn xe trong HĐ'}
                      options={vehicleOptionsForContract} />
                  </label>
                  {tab === 'return' && (
                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-700">Đối chiếu BB Giao xe (paired)</div>
                      <Select value={form.pairedPickupHandoverId} onChange={(v) => setForm({ ...form, pairedPickupHandoverId: v })}
                        placeholder="(tự điền nếu HĐ có pickupHandoverId)"
                        options={pickupHandoverOptions} />
                    </label>
                  )}
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Số KM hiện tại (km) *</div>
                    <input required type="number" min="0" className="ipt" value={form.mileageKm}
                      onChange={(e) => setForm({ ...form, mileageKm: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Mực nhiên liệu (%)</div>
                    <input type="range" min={0} max={100} step={5} value={form.fuelPercent}
                      onChange={(e) => setForm({ ...form, fuelPercent: e.target.value })} className="w-full" />
                    <div className="mt-0.5 text-xs text-slate-500 tabular-nums">{form.fuelPercent}%</div>
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Giới hạn KM/ngày</div>
                    <input type="number" min="0" className="ipt" value={form.dailyKmLimit}
                      onChange={(e) => setForm({ ...form, dailyKmLimit: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Người ký (Khách hàng)</div>
                    <input className="ipt" placeholder="Họ tên khách ký nhận" value={form.customerSignerName}
                      onChange={(e) => setForm({ ...form, customerSignerName: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">CCCD người ký</div>
                    <input className="ipt" placeholder="CMND/CCCD người nhận xe" value={form.customerSignerCitizenId}
                      onChange={(e) => setForm({ ...form, customerSignerCitizenId: e.target.value })} />
                  </label>
                </div>
                <div className="mt-2 flex justify-end">
                  <button type="button" className="rounded-md bg-white px-2 py-1 text-xs text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-50"
                    onClick={() => void loadDefaultForContract()}>Tải lại mẫu checklist mặc định</button>
                </div>
              </details>

              <details open className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">2. Checklist kiểm tra (đánh dấu Đạt / chưa đạt + ghi chú)</summary>
                <div className="mt-2 space-y-1.5">
                  {form.checklist.length === 0 && (
                    <div className="rounded-md bg-white px-3 py-4 text-center text-xs text-slate-500 ring-1 ring-slate-200">
                      Chưa có checklist. Nhấn "Tải lại mẫu checklist mặc định" ở trên hoặc thêm dòng dưới.
                    </div>
                  )}
                  {form.checklist.map((c, idx) => (
                    <div key={`${c.key}-${idx}`} className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                      <div className="flex items-start gap-2">
                        <label className="mt-1 flex-shrink-0">
                          <input type="checkbox" checked={!!c.passed}
                            onChange={(e) => {
                              const arr = [...form.checklist]; arr[idx] = { ...c, passed: e.target.checked }; setForm({ ...form, checklist: arr })
                            }} />
                        </label>
                        <div className="grid flex-1 grid-cols-1 gap-1 sm:grid-cols-12">
                          <div className="sm:col-span-3">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Key</div>
                            <input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200" placeholder="ví dụ body" value={c.key}
                              onChange={(e) => { const arr = [...form.checklist]; arr[idx] = { ...c, key: e.target.value }; setForm({ ...form, checklist: arr }) }} />
                          </div>
                          <div className="sm:col-span-5">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Nội dung kiểm tra</div>
                            <input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200" placeholder="Thân xe không có vết xước mới" value={c.label}
                              onChange={(e) => { const arr = [...form.checklist]; arr[idx] = { ...c, label: e.target.value }; setForm({ ...form, checklist: arr }) }} />
                          </div>
                          <div className="sm:col-span-2">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Nhóm</div>
                            <input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200" placeholder="vd Ngoại thất" value={c.group || ''}
                              onChange={(e) => { const arr = [...form.checklist]; arr[idx] = { ...c, group: e.target.value || undefined }; setForm({ ...form, checklist: arr }) }} />
                          </div>
                          <div className="sm:col-span-2 pt-3.5 text-right">
                            <button type="button" className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                              onClick={() => setForm({ ...form, checklist: form.checklist.filter((_, i) => i !== idx) })}>✕ Xóa</button>
                          </div>
                          <div className="sm:col-span-12">
                            <div className="text-[10px] uppercase tracking-wider text-slate-500">Ghi chú chi tiết (nếu chưa đạt / có tình trạng đặc biệt)</div>
                            <textarea rows={1} className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200"
                              placeholder="Ghi rõ vị trí, kích thước vết xước…, tình trạng lốp/bình ắc quy…" value={c.note || ''}
                              onChange={(e) => { const arr = [...form.checklist]; arr[idx] = { ...c, note: e.target.value || null }; setForm({ ...form, checklist: arr }) }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button"
                    className="w-full rounded-md border border-dashed border-slate-300 bg-white/70 py-2 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700"
                    onClick={() => setForm({
                      ...form,
                      checklist: [...form.checklist, { key: '', label: '', passed: false, note: null }],
                    })}>+ Thêm mục kiểm tra</button>
                </div>
              </details>

              <details className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">3. Ảnh tình trạng xe (trước giao / sau thu hồi)</summary>
                <div className="mt-2 space-y-2">
                  {form.damagePhotos.length === 0 && (
                    <div className="rounded-md bg-white px-3 py-4 text-center text-xs text-slate-500 ring-1 ring-slate-200">
                      {tab === 'pickup' ? 'Chụp ảnh 4 góc xe + ảnh vết xước (nếu có) trước khi giao để tránh tranh chấp.' : 'Chụp ảnh đối chiếu với BB giao, đặc biệt nếu có hư hỏng mới / mức xăng thấp hơn.'}
                    </div>
                  )}
                  {form.damagePhotos.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-1 gap-2 rounded-md bg-white p-2 ring-1 ring-slate-200 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Link ảnh (URL)</div>
                        <input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200" placeholder="https://..." value={p.url}
                          onChange={(e) => { const arr = [...form.damagePhotos]; arr[idx] = { ...p, url: e.target.value }; setForm({ ...form, damagePhotos: arr }) }} />
                      </div>
                      <div className="sm:col-span-4">
                        <div className="text-[10px] uppercase tracking-wider text-slate-500">Chú thích ảnh</div>
                        <input className="w-full rounded px-2 py-1 text-xs ring-1 ring-slate-200" placeholder="Vết xước cột B bên phải" value={p.caption || ''}
                          onChange={(e) => { const arr = [...form.damagePhotos]; arr[idx] = { ...p, caption: e.target.value || null }; setForm({ ...form, damagePhotos: arr }) }} />
                      </div>
                      <div className="sm:col-span-2 pt-4 text-right">
                        <button type="button" className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
                          onClick={() => setForm({ ...form, damagePhotos: form.damagePhotos.filter((_, i) => i !== idx) })}>✕ Xóa</button>
                      </div>
                    </div>
                  ))}
                  <button type="button"
                    className="w-full rounded-md border border-dashed border-slate-300 bg-white/70 py-2 text-xs font-medium text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/60 hover:text-indigo-700"
                    onClick={() => setForm({
                      ...form,
                      damagePhotos: [...form.damagePhotos, { url: '', caption: null, takenAt: new Date().toISOString() }],
                    })}>+ Thêm ảnh</button>
                </div>
              </details>

              <details className="rounded-md bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
                <summary className="cursor-pointer select-none text-sm font-semibold text-slate-800">4. Ghi chú & Lý do hủy</summary>
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <div className="mb-1 text-xs font-medium text-slate-700">Ghi chú biên bản</div>
                    <textarea rows={2} className="ipt" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="Khách yêu cầu giao thêm khăn ướt, nước uống…, hoặc quy ước khác" />
                  </label>
                  {editingId && (
                    <label className="block">
                      <div className="mb-1 text-xs font-medium text-slate-700">Lý do hủy (khi thao tác Hủy)</div>
                      <input className="ipt" value={form.cancelReason} onChange={(e) => setForm({ ...form, cancelReason: e.target.value })} />
                    </label>
                  )}
                </div>
              </details>

              {saveErr && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{saveErr}</div>}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <div className="text-xs text-slate-500">
                  Sau khi Lưu, dùng các nút Flow <b>Bắt đầu kiểm tra → Ký → VP xác nhận</b> ở hàng bảng để hoàn tất quy trình.
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn ghost" onClick={() => setFormOpen(false)}>Đóng</button>
                  <button type="submit" disabled={saving} className="btn primary">{saving ? 'Đang lưu…' : (editingId ? 'Cập nhật BB' : 'Lưu biên bản')}</button>
                </div>
              </div>
            </form>
            <style>{`
              .ipt { display:block; width:100%; border-radius:0.375rem; border:0; padding:0.5rem 0.75rem; font-size:0.875rem; background:#fff; --tw-ring-inset:inset; --tw-ring-offset-shadow:0 0 #0000; --tw-ring-shadow:0 0 #0000; box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), 0 0 #0000; box-shadow:0 0 0 1px rgb(226 232 240 / 0.8) inset; }
              .ipt:focus { outline: 2px solid transparent; outline-offset: 2px; box-shadow: 0 0 0 2px rgb(99 102 241 / 0.6) inset; }
              .btn { border-radius: 0.375rem; padding: 0.5rem 0.85rem; font-size: 0.875rem; font-weight: 500; }
              .btn.primary { background: #4f46e5; color: #fff; }
              .btn.primary:hover { background: #6366f1; }
              .btn.ghost { background: #f1f5f9; color: #334155; }
              .btn.ghost:hover { background: #e2e8f0; }
            `}</style>
          </div>
        </div>
      )}
    </div>
  )
}

/* ================= helpers ================= */
function selectedContractName(summary: any, contracts: VehicleRentalContract[]): string {
  const cid = summary?.id || (typeof summary === 'string' ? summary : null)
  const c = contracts.find((x) => x.id === cid)
  if (c) return c.customerName
  return ''
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={cn('px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider', className)}>{children}</th>
}

function FlowBtn({ children, onClick, tone, title }: { children: React.ReactNode; onClick?: () => void; tone?: string; title?: string }) {
  const mapTone: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200 hover:bg-indigo-100',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100',
    rose: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200 hover:bg-zinc-200',
  }
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn('rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset', mapTone[tone ?? 'zinc'])}>
      {children}
    </button>
  )
}
