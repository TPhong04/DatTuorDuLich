import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { getStoredUser } from '@/features/auth/auth'
import {
  fetchAdminGroupTourRequests,
  fetchAdminStaffList,
  GROUP_TOUR_PRIORITY_META,
  GROUP_TOUR_STATUS_META,
  GroupTourRequest,
  GroupTourRequestPriority,
  GroupTourRequestStatus,
  patchAdminGroupTourRequest,
  StaffBrief,
  totalGroupTourGuests,
} from '@/features/group-tour-requests/group-tour-requests'
import { GtrTodosChecklist } from '@/features/todos/GtrTodosChecklist'
import clsx from 'clsx'
import { Users, Phone, Building2, MapPin, CalendarDays, AlertTriangle, X, Eye } from 'lucide-react'
import { formatDateTime, formatDate } from '@/utils/date'
import { formatMoney } from '@/utils/format'

const TABS = [
  { key: 'all', label: 'Tất cả', countOf: null as GroupTourRequestStatus | null, chip: 'bg-slate-50 text-slate-700 border border-slate-200', icon: '📋' },
  { key: 'new', label: 'Mới tạo', countOf: 'new', chip: 'bg-blue-50 text-blue-700 border border-blue-100', icon: '🆕' },
  { key: 'quoting', label: 'Đang báo giá', countOf: 'quoting', chip: 'bg-amber-50 text-amber-700 border border-amber-100', icon: '💵' },
  { key: 'negotiating', label: 'Đàm phán', countOf: 'negotiating', chip: 'bg-violet-50 text-violet-700 border border-violet-100', icon: '🤝' },
  { key: 'urgent', label: '🔴 KHẨN CẤP', countOf: null, chip: 'bg-rose-50 text-rose-700 border border-rose-200', icon: '🚨' },
  { key: 'won', label: 'Đã chốt → Booking', countOf: null, chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: '🏆' },
  { key: 'lost', label: 'Hủy yêu cầu', countOf: 'lost', chip: 'bg-rose-50 text-rose-600 border border-rose-100', icon: '💔' },
]

function countStatuses(rows: GroupTourRequest[]) {
  const out: Record<string, number> = { all: rows.length, urgent: 0, won: 0 }
  for (const r of rows) {
    out[r.status] = (out[r.status] || 0) + 1
    if (r.priority === 'urgent') out.urgent += 1
    if (r.status === 'won' || r.status === 'converted_booking') out.won += 1
  }
  return out
}

export default function AdminGroupTourRequestsPage() {
  const user = getStoredUser()
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const nonceRef = useRef(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [rows, setRows] = useState<GroupTourRequest[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 25
  const page = Math.max(1, Number(sp.get('page') || '1'))
  const tab = (sp.get('tab') || 'all') as string
  const isWonTab = tab === 'won'
  const statusF: GroupTourRequestStatus | undefined = (tab && !isWonTab && TABS.find((t) => t.key === tab && t.countOf)?.countOf) as GroupTourRequestStatus | undefined
  const urlPriority = sp.get('priority') as GroupTourRequestPriority | '' | null
  const priorityF: GroupTourRequestPriority | undefined = tab === 'urgent' ? 'urgent' : (urlPriority || undefined)
  const wonFilter = isWonTab
  const [search, setSearch] = useState(sp.get('search') || '')
  const [searchDeb, setSearchDeb] = useState(search)
  const [minGuests, setMinGuests] = useState<number | ''>(Number(sp.get('ming') || '') || '')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority' | 'follow_up'>((sp.get('sort') as any) || 'newest')
  const assignedStaff = sp.get('assignee') || ''
  const [staffList, setStaffList] = useState<StaffBrief[]>([])
  const [bulkStaffId, setBulkStaffId] = useState('')
  const [detailOpen, setDetailOpen] = useState<{ row: GroupTourRequest; tab: 'info' | 'checklist' } | null>(null)
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetchAdminStaffList()
      setStaffList(res.rows || [])
    } catch (e) {
      toast.warning((e as any)?.message || 'Không tải được danh sách nhân viên (Vào Quản trị → Người dùng để tạo staff).')
      setStaffList([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])
  useEffect(() => { void loadStaff() }, [loadStaff])
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDeb(search)
      if (page !== 1) {
        const merged = new URLSearchParams(sp); merged.delete('page'); if (search) merged.set('search', search); else merged.delete('search')
        setSp(merged, { replace: true })
      }
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])
  const load = useCallback(async () => {
    const nonce = ++nonceRef.current
    if (!initialLoading) setStale(true)
    try {
      const res = await fetchAdminGroupTourRequests({
        page, pageSize, status: statusF, priority: priorityF,
        search: searchDeb, sort, assignedStaffId: assignedStaff || undefined,
        minGuests: minGuests || undefined,
        won: wonFilter ? '1' : undefined,
      })
      if (nonce !== nonceRef.current) return
      const list = (res.rows || []).map((r) => ({ ...r, assignedStaffId: r.assignedStaffId ? String(r.assignedStaffId) : null }))
      setRows(list)
      setTotal(Number(res.total || 0))
      setInitialLoading(false)
      setStale(false)
    } catch (e) {
      if (nonce !== nonceRef.current) return
      setRows([])
      setTotal(0)
      setInitialLoading(false)
      setStale(false)
      toast.warning((e as any)?.message || 'Không thể tải danh sách Tour đoàn (vui lòng kiểm tra server).')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusF, priorityF, wonFilter, searchDeb, sort, assignedStaff, minGuests])
  useEffect(() => { void load() }, [load])
  const stats = useMemo(() => countStatuses(initialLoading ? [] : rows.concat()), [rows, initialLoading])
  const totalStats = useMemo(() => {
    if (total > 0 || rows.length > 0) return countStatuses(initialLoading ? [] : [...rows])
    const all = total || 0
    return { all, new: 0, quoting: 0, negotiating: 0, urgent: 0, won: 0, lost: 0 }
  }, [rows, total, initialLoading])
  void stats
  const applySearch = (next: Partial<Record<string, string>>) => {
    const merged = new URLSearchParams(sp)
    merged.delete('page')
    for (const [k, v] of Object.entries(next)) {
      if (v === '' || v === null || v === undefined) merged.delete(k)
      else merged.set(k, String(v))
    }
    if (searchDeb) merged.set('search', searchDeb)
    setSp(merged, { replace: true })
  }
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const toggleOne = (id: string) => {
    const s = new Set(selected)
    if (s.has(id)) s.delete(id); else s.add(id)
    setSelected(s)
  }
  const toggleAll = () => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r._id)))
  }
  const bulkAssign = async (staffId: string | null) => {
    if (!selected.size) return toast.warning('Vui lòng chọn ít nhất 1 yêu cầu.')
    try {
      for (const id of Array.from(selected)) {
        await patchAdminGroupTourRequest(id, { assignedStaffId: staffId })
      }
      setSelected(new Set())
      toast.success(staffId ? `Đã giao ${selected.size} yêu cầu cho nhân viên.` : `Đã thu hồi ${selected.size} yêu cầu.`)
      await load()
    } catch (e) { toast.error((e as any)?.message || 'Lỗi bulk.') }
  }
  const bulkStatus = async (status: GroupTourRequestStatus) => {
    if (!selected.size) return toast.warning('Vui lòng chọn ít nhất 1 yêu cầu.')
    try {
      for (const id of Array.from(selected)) {
        await patchAdminGroupTourRequest(id, { status })
      }
      setSelected(new Set())
      toast.success(`Đã đổi ${selected.size} yêu cầu → ${GROUP_TOUR_STATUS_META[status]?.label || status}.`)
      await load()
    } catch (e) { toast.error((e as any)?.message || 'Lỗi bulk.') }
  }
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  void user
  return (
    <div className="space-y-5">
      <PageHeader
        title="👔 Tour đoàn (Yêu cầu báo giá)"
        right={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <select
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none ring-blue-50 focus:border-blue-500 focus:ring-2"
            >
              <option value="">👷 Chọn nhân viên...</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>👷 {s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
            </select>
            <button
              disabled={!bulkStaffId}
              onClick={() => bulkAssign(bulkStaffId || null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700 disabled:opacity-50"
            >Giao nhân viên</button>
            <button onClick={() => bulkAssign(null)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100">🔓 Thu hồi</button>
            <button onClick={() => bulkStatus('won')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700">✅ Xác nhận Booking</button>
            <button onClick={() => bulkStatus('lost')} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white shadow-sm shadow-rose-600/10 hover:bg-rose-700">❌ Hủy yêu cầu</button>
            <a href="tel:19001009" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">📞 1900 1009</a>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const k = t.key
          const active = tab === k
          const c = t.countOf
          const meta = c && GROUP_TOUR_STATUS_META[c as GroupTourRequestStatus]
          const badge = k === 'urgent' ? totalStats.urgent : k === 'won' ? totalStats.won : c ? totalStats[c as string] : totalStats.all
          return (
            <button
              key={k}
              onClick={() => applySearch({ tab: k })}
              className={clsx(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition shadow-sm',
                active ? 'border-indigo-400 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20' : meta ? meta.chip + ' hover:border-blue-400 hover:bg-blue-50' : t.chip + ' hover:border-blue-400 hover:bg-blue-50',
              )}
            >
              <span className="text-sm">{t.icon}</span>
              <span className="whitespace-nowrap">{t.label}</span>
              <span className={clsx('rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap', active ? 'bg-white/20 text-white ring-1 ring-white/30' : 'bg-white text-slate-700 border border-slate-200 shadow-sm')}>{badge}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tìm kiếm (Mã / Tên / Công ty / SĐT / Đích)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập từ khóa..." className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Độ ưu tiên</label>
          <select value={priorityF || ''} onChange={(e) => applySearch({ priority: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2">
            <option value="">Tất cả</option>
            <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">🔴 Khẩn cấp</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Min số hành khách</label>
          <input type="number" min={0} value={minGuests} onChange={(e) => setMinGuests(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => applySearch({ ming: minGuests === '' ? '' : String(minGuests) })} placeholder="VD: 20" className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sắp xếp</label>
          <select value={sort} onChange={(e) => applySearch({ sort: e.target.value })} className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="priority">Ưu tiên cao trước</option>
            <option value="follow_up">Theo giờ theo dõi (CSKH)</option>
          </select>
        </div>
        <div className="md:col-span-3 flex items-end gap-2">
          <button onClick={() => load()} className="h-9 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-white ring-1 ring-slate-100">🔄 Tải lại</button>
          <button onClick={() => { setSearch(''); setMinGuests(''); setSort('newest'); applySearch({ tab: 'all', page: '1', search: '', sort: 'newest', assignee: '', ming: '', priority: '' }) }} className="h-9 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20">↺ Reset</button>
        </div>
      </div>

      <div className={clsx('relative overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm min-h-[640px]', stale && 'opacity-80 blur-[0.4px] transition')}>
        {initialLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[56px_180px_320px_300px_380px_120px_220px_240px_160px_200px_260px_200px_200px_400px] gap-3 px-4 py-3.5">
                <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-64 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-52 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-96 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-full w-full text-sm border-separate border-spacing-0">
            <colgroup>
              <col style={{ minWidth: 56 }} />
              <col style={{ minWidth: 180 }} />
              <col style={{ minWidth: 320 }} />
              <col style={{ minWidth: 300 }} />
              <col style={{ minWidth: 380 }} />
              <col style={{ minWidth: 120 }} />
              <col style={{ minWidth: 220 }} />
              <col style={{ minWidth: 240 }} />
              <col style={{ minWidth: 160 }} />
              <col style={{ minWidth: 200 }} />
              <col style={{ minWidth: 260 }} />
              <col style={{ minWidth: 200 }} />
              <col style={{ minWidth: 200 }} />
              <col style={{ minWidth: 420 }} />
            </colgroup>
            <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left w-14"><input type="checkbox" className="accent-orange-500 h-4 w-4" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                <th className="px-4 py-3 text-left">Mã</th>
                <th className="px-4 py-3 text-left">Liên hệ</th>
                <th className="px-4 py-3 text-left">Công ty / Đoàn</th>
                <th className="px-4 py-3 text-left">Đích / Dịch vụ</th>
                <th className="px-4 py-3 text-center">👥 Số khách</th>
                <th className="px-4 py-3 text-left">Ngày đi / Thời gian</th>
                <th className="px-4 py-3 text-left">Ngân sách</th>
                <th className="px-4 py-3 text-left">Ưu tiên</th>
                <th className="px-4 py-3 text-left">Trạng thái</th>
                <th className="px-4 py-3 text-left">Nhân viên phụ trách</th>
                <th className="px-4 py-3 text-left">Giờ theo dõi</th>
                <th className="px-4 py-3 text-left">Tạo lúc</th>
                <th className="px-4 py-3 pr-5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length ? (
                <tr><td colSpan={14} className="px-4 py-16 text-center text-sm text-slate-400">Không có yêu cầu nào thỏa điều kiện lọc. Vui lòng thay đổi bộ lọc hoặc chờ khách gửi yêu cầu.</td></tr>
              ) : null}
              {rows.map((r) => {
                const sel = selected.has(r._id)
                const guests = totalGroupTourGuests(r)
                const priority = GROUP_TOUR_PRIORITY_META[r.priority]
                const statusMeta = GROUP_TOUR_STATUS_META[r.status]
                const isUrgent = r.priority === 'urgent'
                return (
                  <tr key={r._id} className={clsx('hover:bg-blue-50/40 align-top', sel && 'bg-blue-50/30', isUrgent && 'bg-rose-50/10')}>
                    <td className="px-4 py-3.5"><input type="checkbox" className="accent-orange-500 h-4 w-4" checked={sel} onChange={() => toggleOne(r._id)} /></td>
                    <td className="px-4 py-3.5 font-bold text-slate-900 text-sm whitespace-nowrap font-mono">{r.code}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-base font-bold text-white shadow-sm ring-2 ring-blue-50/80">{r.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm truncate"><Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />{r.contactName}</div>
                          <a href={`tel:${r.contactPhone}`} className="mt-0.5 flex items-center gap-2 text-sm text-blue-700 font-semibold hover:underline whitespace-nowrap"><Phone className="h-3 w-3 shrink-0" />{r.contactPhone}</a>
                          {r.contactEmail ? <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500 truncate">✉️ <span className="truncate">{r.contactEmail}</span></div> : null}
                          {r.contactRole ? <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">💼 {r.contactRole}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 leading-snug break-words text-sm">{r.companyOrGroupName}</div>
                          {r.companyTaxCode ? <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">🧾 MST: {r.companyTaxCode}</div> : null}
                          {r.internalStaffNote ? <div className="mt-1.5 text-xs text-slate-600 italic border-l-2 border-orange-300 pl-2.5 line-clamp-3 bg-orange-50/40 py-1 pr-2 rounded-r-lg">📝 {r.internalStaffNote}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-orange-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-900 text-sm">{r.destination}</div>
                          {r.departureCity ? <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">🚩 Khởi hành từ: {r.departureCity}</div> : null}
                          {r.approximateDurationText ? <div className="mt-0.5 text-xs text-slate-500 whitespace-nowrap">⏱ Thời gian: {r.approximateDurationText}</div> : null}
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {r.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100 whitespace-nowrap">🛂 Visa</span> : null}
                            {r.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 ring-1 ring-sky-100 whitespace-nowrap">✈️ Vé máy bay</span> : null}
                            {r.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100 whitespace-nowrap">🚌 Xe du lịch</span> : null}
                            {r.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-100 whitespace-nowrap">🏨 KS {r.hotelClassRequested || ''}</span> : null}
                            {r.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700 ring-1 ring-orange-100 whitespace-nowrap">🍱 Bữa ăn</span> : null}
                            {r.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700 ring-1 ring-teal-100 whitespace-nowrap">🧭 HDV hướng dẫn</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="font-bold text-xl text-slate-900 tabular-nums">{guests}</div>
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide mt-0.5">khách</div>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="text-[11px] text-slate-600 whitespace-nowrap"><span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold">NL {r.adultCount}</span> <span className="inline-flex rounded-md bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-700 ml-0.5">TE {r.childCount}</span> <span className="inline-flex rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 ml-0.5">EB {r.infantCount}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <CalendarDays className="h-3.5 w-3.5 mb-0.5 inline-block text-slate-400 shrink-0" />
                      <div className="text-sm font-semibold text-slate-800 inline-block ml-1 whitespace-nowrap">{r.preferredStartDate ? formatDate(r.preferredStartDate) : 'Chưa xác định'}</div>
                      {r.approximateDurationText ? <div className="mt-1 text-xs text-slate-500 whitespace-nowrap">{r.approximateDurationText}</div> : null}
                      {isUrgent ? <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-bold uppercase text-rose-700 ring-1 ring-rose-200 whitespace-nowrap"><AlertTriangle className="h-3 w-3" /> KHẨN CẤP</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      {r.budgetPerPersonVnd ? <div className="font-bold text-orange-600 text-[15px] tabular-nums whitespace-nowrap">{formatMoney(r.budgetPerPersonVnd)}đ<span className="text-xs font-semibold text-slate-400 ml-1">/khách</span></div> : null}
                      {r.totalBudgetVnd ? <div className="mt-1 text-xs text-slate-500 whitespace-nowrap">Tổng dự kiến: <span className="font-semibold text-slate-700">{formatMoney(r.totalBudgetVnd)}đ</span></div> : null}
                      {r.lastQuoteSummary ? <div className="mt-1.5 text-xs text-emerald-700 border-l-2 border-emerald-300 pl-2.5 line-clamp-3 bg-emerald-50/40 py-1 pr-2 rounded-r-lg font-semibold">💰 {r.lastQuoteSummary}</div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase ring-1', priority?.chip)}>
                        <span className="text-sm">{priority?.icon || '🔵'}</span><span>{priority?.label || r.priority}</span>
                      </span>
                      <div className="mt-1.5 text-xs text-slate-500 whitespace-nowrap">Đã báo giá: <b className="text-slate-700">{r.quoteCount}</b> lần</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-bold uppercase ring-1', statusMeta?.chip)}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', statusMeta?.dot)} />
                        {statusMeta?.label || r.status}
                      </span>
                      {r.lostReason ? <div className="mt-1.5 text-xs text-rose-600 italic line-clamp-3 bg-rose-50/60 rounded-lg border border-rose-100 px-2.5 py-1 whitespace-pre-wrap">💔 {r.lostReason}</div> : null}
                      {r.convertedBookingId ? <div className="mt-1.5 text-xs font-bold text-emerald-700 whitespace-nowrap bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-100 inline-flex items-center gap-1.5">✅ → <span className="font-mono">{r.convertedBookingId}</span></div> : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={r.assignedStaffId || ''}
                        onChange={async (e) => {
                          try {
                            await patchAdminGroupTourRequest(r._id, { assignedStaffId: e.target.value || null })
                            toast.success('Đã cập nhật nhân viên phụ trách.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-sm outline-none ring-blue-50 min-w-full focus:border-blue-500 focus:ring-2"
                      >
                        <option value="">— Chưa phân công —</option>
                        {staffList.map((s) => {
                          const staffName = `${s.name}${s.phone ? ` · ${s.phone}` : ''}`
                          return <option key={s.id} value={s.id}>👷 {staffName}</option>
                        })}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide font-semibold whitespace-nowrap">Theo dõi kế tiếp</div>
                      <div className="text-sm font-semibold text-slate-800 mt-0.5 whitespace-nowrap">{r.followUpAt ? formatDate(r.followUpAt) : '—'}</div>
                      {r.lastContactedAt ? <div className="mt-1 text-xs text-slate-500 whitespace-nowrap">LH gần nhất: {formatDate(r.lastContactedAt)}</div> : <div className="mt-1 text-xs text-amber-700 whitespace-nowrap bg-amber-50 rounded-lg px-2.5 py-1 ring-1 ring-amber-100 inline-flex items-center gap-1 font-semibold">⚠️ Chưa gọi khách</div>}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-sm text-slate-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3.5 pr-5">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button onClick={() => setDetailOpen({ row: r, tab: (r.status === 'won' || r.status === 'converted_booking') ? 'checklist' : 'info' })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-blue-50 hover:border-blue-200 whitespace-nowrap"><Eye size={13} />Chi tiết</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'contacted', lastContactedAt: new Date().toISOString(), followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }); toast.success('Đánh dấu Đã liên hệ khách.'); await load() }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-2.5 text-xs font-semibold text-white shadow-sm shadow-sky-600/10 hover:bg-sky-700 whitespace-nowrap">📞 Đã LH</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'quoting' }); toast.success('Chuyển trạng thái: Đang báo giá khách.'); await load() }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-2.5 text-xs font-semibold text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 whitespace-nowrap">💵 Báo giá</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'won' }); toast.success('🎉 Đã chốt đơn Tour đoàn - chuyển qua tạo Booking.'); await load() }} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700 whitespace-nowrap">✅ Chốt đơn</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {detailOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setDetailOpen(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-[980px] bg-white shadow-2xl flex flex-col">
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold uppercase text-orange-700 ring-1 ring-orange-100">🛡 Admin · Chi tiết Tour đoàn</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-white">{detailOpen.row.code}</span>
                </div>
                <div className="mt-1.5 text-xl font-bold text-slate-900 truncate">{detailOpen.row.companyOrGroupName} · <span className="text-orange-600">{detailOpen.row.destination}</span></div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ring-1', GROUP_TOUR_STATUS_META[detailOpen.row.status]?.chip)}><span className={clsx('h-1.5 w-1.5 rounded-full', GROUP_TOUR_STATUS_META[detailOpen.row.status]?.dot)} />{GROUP_TOUR_STATUS_META[detailOpen.row.status]?.label}</span>
                  <span className={clsx('inline-flex items-center gap-0.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', GROUP_TOUR_PRIORITY_META[detailOpen.row.priority]?.chip)}>{GROUP_TOUR_PRIORITY_META[detailOpen.row.priority]?.icon}{GROUP_TOUR_PRIORITY_META[detailOpen.row.priority]?.label}</span>
                  {detailOpen.row.wonAt ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-100">🏆 Won lúc {formatDateTime(detailOpen.row.wonAt)}</span> : null}
                  {detailOpen.row.assignedStaffId ? (() => {
                    const st = staffList.find((s) => String(s.id) === String(detailOpen.row!.assignedStaffId))
                    return <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">👷 Nhân viên: {st?.name || detailOpen.row!.assignedStaffId}</span>
                  })() : <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">⚠️ Chưa giao nhân viên</span>}
                </div>
              </div>
              <button onClick={() => setDetailOpen(null)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={16} /></button>
            </div>
            <div className="px-5 pt-3 border-b border-slate-100 flex items-center gap-0.5">
              {[
                { key: 'info' as const, label: 'ℹ️ Thông tin Tour đoàn', badge: null },
                { key: 'checklist' as const, label: '🗂 Checklist Operation (Won)', badge: 'NEW' },
              ].map((t) => {
                const active = detailOpen.tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setDetailOpen({ ...detailOpen, tab: t.key })}
                    className={clsx(
                      'relative inline-flex shrink-0 items-center gap-1.5 rounded-t-xl px-4 py-2 text-sm font-semibold transition',
                      active ? 'bg-white text-indigo-700 shadow-[0_1px_0_0_rgb(255,255,255),inset_0_2px_0_0_#4f46e5]' : 'text-slate-500 hover:bg-slate-50',
                    )}
                  >
                    <span>{t.label}</span>
                    {t.badge ? <span className="rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t.badge}</span> : null}
                  </button>
                )
              })}
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/40">
              {detailOpen.tab === 'info' ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Thông tin liên hệ</div>
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-xl font-black text-white shadow-sm ring-2 ring-blue-50/80">{detailOpen.row.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-slate-900 text-lg flex items-center gap-2"><Users size={16} className="text-slate-400 shrink-0" />{detailOpen.row.contactName}</div>
                          <a href={`tel:${detailOpen.row.contactPhone}`} className="mt-1 flex items-center gap-2 text-sm font-bold text-blue-700 hover:underline whitespace-nowrap"><Phone size={14} />{detailOpen.row.contactPhone}</a>
                          {detailOpen.row.contactRole ? <div className="mt-1 text-sm text-slate-500">💼 {detailOpen.row.contactRole}</div> : null}
                          {detailOpen.row.contactEmail ? <div className="mt-1 text-sm text-slate-500 truncate">✉️ {detailOpen.row.contactEmail}</div> : null}
                        </div>
                      </div>
                      <div className="flex items-start gap-3 pt-3 border-t border-slate-100">
                        <Building2 size={18} className="mt-0.5 text-blue-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-base break-words">{detailOpen.row.companyOrGroupName}</div>
                          {detailOpen.row.companyTaxCode ? <div className="mt-0.5 text-xs 2xl:text-[13px] text-slate-500">MST: {detailOpen.row.companyTaxCode}</div> : null}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Hành trình &amp; Số khách</div>
                      <div className="flex items-start gap-3">
                        <MapPin size={18} className="mt-0.5 text-orange-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-black text-slate-900">Đích đến: <span className="text-orange-600">{detailOpen.row.destination}</span></div>
                          {detailOpen.row.departureCity ? <div className="mt-0.5 text-sm text-slate-500">🚩 Khởi hành từ: {detailOpen.row.departureCity}</div> : null}
                          {detailOpen.row.approximateDurationText ? <div className="mt-0.5 text-sm text-slate-500">⏱ Thời gian: {detailOpen.row.approximateDurationText}</div> : null}
                          <div className="mt-1 text-sm text-slate-500 flex items-center gap-1.5"><CalendarDays size={14} />Ngày đi ưu tiên: <b className="text-slate-700">{detailOpen.row.preferredStartDate ? formatDate(detailOpen.row.preferredStartDate) : 'Chưa xác định'}</b>{detailOpen.row.preferredEndDate ? ` → ${formatDate(detailOpen.row.preferredEndDate)}` : ''}</div>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                        <div className="text-center px-3 py-2 rounded-2xl bg-slate-50 border border-slate-100 min-w-[80px]">
                          <div className="text-2xl font-black text-slate-900 tabular-nums">{totalGroupTourGuests(detailOpen.row)}</div><div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Tổng KH</div>
                        </div>
                        <div className="text-center px-3 py-2 rounded-2xl bg-slate-50 border border-slate-100 min-w-[70px]">
                          <div className="text-xl font-black text-slate-900 tabular-nums">{detailOpen.row.adultCount}</div><div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">NL</div>
                        </div>
                        <div className="text-center px-3 py-2 rounded-2xl bg-orange-50 border border-orange-100 min-w-[70px]">
                          <div className="text-xl font-black text-orange-700 tabular-nums">{detailOpen.row.childCount}</div><div className="text-[11px] font-bold text-orange-600 uppercase tracking-wide">TE</div>
                        </div>
                        <div className="text-center px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 min-w-[70px]">
                          <div className="text-xl font-black text-emerald-700 tabular-nums">{detailOpen.row.infantCount}</div><div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide">EB</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-xs font-black uppercase tracking-wide text-slate-500">Ngân sách &amp; Báo giá</div>
                      <div className="text-xs 2xl:text-[13px] font-bold text-slate-500">Đã báo giá: <b className="text-slate-700">{detailOpen.row.quoteCount}</b> lần</div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        {detailOpen.row.budgetPerPersonVnd ? <div className="text-2xl 2xl:text-3xl font-black tabular-nums text-orange-600 whitespace-nowrap">{formatMoney(detailOpen.row.budgetPerPersonVnd)}đ<span className="text-xs 2xl:text-[13px] font-semibold text-slate-400 ml-1.5">/khách</span></div> : <div className="text-sm font-bold text-rose-600">⚠️ Chưa có ngân sách / khách</div>}
                        {detailOpen.row.totalBudgetVnd ? <div className="mt-1.5 text-sm text-slate-500">Tổng dự kiến: <b className="font-black text-slate-700 tabular-nums">{formatMoney(detailOpen.row.totalBudgetVnd)}đ</b></div> : null}
                      </div>
                      <div>
                        {detailOpen.row.lastQuoteSummary ? (
                          <div className="text-sm text-emerald-700 border-l-2 border-emerald-300 pl-3 bg-emerald-50/40 py-2.5 pr-3 rounded-r-xl font-semibold whitespace-pre-wrap">💰 {detailOpen.row.lastQuoteSummary}</div>
                        ) : (
                          <div className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2.5 ring-1 ring-rose-100 inline-flex items-center gap-1.5 font-semibold">⚠️ Chưa gửi báo giá</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="text-xs font-black uppercase tracking-wide text-slate-500">Dịch vụ yêu cầu &amp; Yêu cầu đặc biệt</div>
                    <div className="flex flex-wrap gap-2">
                      {detailOpen.row.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-4 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-violet-100 whitespace-nowrap">🛂 Visa</span> : null}
                      {detailOpen.row.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-4 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-100 whitespace-nowrap">✈️ Vé máy bay</span> : null}
                      {detailOpen.row.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 whitespace-nowrap">🚌 Xe du lịch</span> : null}
                      {detailOpen.row.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-4 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-100 whitespace-nowrap">🏨 Khách sạn {detailOpen.row.hotelClassRequested || ''}</span> : null}
                      {detailOpen.row.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-4 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-100 whitespace-nowrap">🍱 Bữa ăn</span> : null}
                      {detailOpen.row.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-4 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100 whitespace-nowrap">🧭 Hướng dẫn viên</span> : null}
                      {Object.values(detailOpen.row.servicesPreference).every((v) => v === false) ? <span className="rounded-full bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600 ring-1 ring-slate-100 whitespace-nowrap">📍 Không có yêu cầu dịch vụ cụ thể</span> : null}
                    </div>
                    {detailOpen.row.transportRequestedNotes ? <div className="text-sm text-slate-600 italic border-l-2 border-amber-300 pl-3 bg-amber-50/40 py-2 pr-3 rounded-r-xl">🚍 {detailOpen.row.transportRequestedNotes}</div> : null}
                    {detailOpen.row.specialRequirements ? <div className="text-sm text-slate-700 italic border-l-2 border-indigo-300 pl-3 bg-indigo-50/40 py-2 pr-3 rounded-r-xl whitespace-pre-wrap">📝 {detailOpen.row.specialRequirements}</div> : null}
                    {detailOpen.row.internalStaffNote ? <div className="text-sm text-slate-700 border-l-2 border-orange-400 pl-3 bg-orange-50/50 py-2 pr-3 rounded-r-xl whitespace-pre-wrap font-semibold">📝 (Nội bộ) {detailOpen.row.internalStaffNote}</div> : null}
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wide text-slate-500">Phân công nhân viên</div>
                        <div className="mt-1 text-sm text-slate-500">Admin có thể giao / đổi nhân viên phụ trách ngay tại đây.</div>
                      </div>
                      <select
                        value={detailOpen.row.assignedStaffId || ''}
                        onChange={async (e) => {
                          try {
                            await patchAdminGroupTourRequest(detailOpen.row._id, { assignedStaffId: e.target.value || null })
                            toast.success('Đã cập nhật nhân viên phụ trách.')
                            setDetailOpen({ ...detailOpen, row: { ...detailOpen.row, assignedStaffId: e.target.value || null } })
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 min-w-[260px] focus:border-blue-500 focus:ring-2"
                      >
                        <option value="">— Chưa phân công —</option>
                        {staffList.map((s) => <option key={s.id} value={s.id}>👷 {s.name}{s.phone ? ` · ${s.phone}` : ''}</option>)}
                      </select>
                    </div>
                  </div>
                  {detailOpen.row.convertedBookingId ? (
                    <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-xs font-black uppercase tracking-wide text-emerald-600">✅ Đã chuyển đổi thành Booking</div>
                          <div className="mt-1 text-lg font-black text-emerald-800 font-mono">{detailOpen.row.convertedBookingId}</div>
                        </div>
                        <span className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-black uppercase text-white">🏆 WON</span>
                      </div>
                    </div>
                  ) : (detailOpen.row.status === 'won' || detailOpen.row.status === 'converted_booking') ? (
                    <div className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-sm">
                      <div className="text-xs font-black uppercase tracking-wide text-orange-700">⏳ Chờ chuyển đổi Booking</div>
                      <div className="mt-1 text-sm text-slate-600">Hệ thống sẽ tự động tạo Booking cho Tour đoàn này trong 15 phút. Nếu chậm hơn vui lòng kiểm tra Job Cron.</div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <GtrTodosChecklist gtrId={detailOpen.row._id} role="admin" />
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-200">
        <div className="text-sm text-slate-500">
          Hiện thị <b className="text-slate-800">{rows.length}</b> / tổng <b className="text-slate-800">{total || 0}</b> yêu cầu · Chọn <b className="text-orange-600">{selected.size}</b> dòng
        </div>
        <div className="flex items-center gap-1.5">
          <button disabled={page <= 1} onClick={() => applySearch({ page: String(Math.max(1, page - 1)) })} className="h-9 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">← Trước</button>
          {Array.from({ length: Math.min(5, totalPages) }).map((_, off) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
            const p = start + off
            if (p > totalPages) return null
            return (
              <button key={p} onClick={() => applySearch({ page: String(p) })} className={clsx('h-9 min-w-[2.25rem] inline-flex items-center justify-center rounded-xl px-3 text-sm font-semibold', page === p ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300')}>{p}</button>
            )
          })}
          <button disabled={page >= totalPages} onClick={() => applySearch({ page: String(page + 1) })} className="h-9 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Sau →</button>
        </div>
      </div>
    </div>
  )
}
