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
import clsx from 'clsx'
import { Users, Phone, Building2, MapPin, CalendarDays, AlertTriangle } from 'lucide-react'
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
  const statusF: GroupTourRequestStatus | undefined = (tab && TABS.find((t) => t.key === tab && t.countOf)?.countOf) as GroupTourRequestStatus | undefined
  const priorityF: GroupTourRequestPriority | undefined = tab === 'urgent' ? 'urgent' : undefined
  const wonFilter = tab === 'won'
  const [search, setSearch] = useState(sp.get('search') || '')
  const [searchDeb, setSearchDeb] = useState(search)
  const [minGuests, setMinGuests] = useState<number | ''>(Number(sp.get('ming') || '') || '')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority' | 'follow_up'>((sp.get('sort') as any) || 'newest')
  const assignedStaff = sp.get('assignee') || ''
  const [staffList, setStaffList] = useState<StaffBrief[]>([])
  const [bulkStaffId, setBulkStaffId] = useState('')
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
        subtitle="Quản lý pipeline bán hàng Tour đoàn: Yêu cầu → Liên hệ → Báo giá → Đàm phán → Won → Booking."
        title="👔 Tour đoàn (Yêu cầu báo giá)"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none ring-blue-50 focus:border-blue-500 focus:ring-4"
            >
              <option value="">👷 Chọn nhân viên...</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>👷 {s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
            </select>
            <button
              disabled={!bulkStaffId}
              onClick={() => bulkAssign(bulkStaffId || null)}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-xs font-black uppercase text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700 disabled:opacity-50"
            >Giao nhân viên</button>
            <button onClick={() => bulkAssign(null)} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-xs font-black uppercase text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100">🔓 Thu hồi</button>
            <button onClick={() => bulkStatus('won')} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-xs font-black uppercase text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700">✅ Xác nhận Booking</button>
            <button onClick={() => bulkStatus('lost')} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black uppercase text-white shadow-sm shadow-rose-600/10 hover:bg-rose-700">❌ Hủy yêu cầu</button>
            <a href="tel:19001009" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">📞 1900 1009</a>
          </div>
        }
      />
      <div className="flex flex-wrap gap-2.5 2xl:gap-3">
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
                'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-extrabold transition shadow-sm',
                active ? 'border-indigo-400 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20' : meta ? meta.chip + ' hover:border-blue-400 hover:bg-blue-50' : t.chip + ' hover:border-blue-400 hover:bg-blue-50',
              )}
            >
              <span className="text-base 2xl:text-lg">{t.icon}</span>
              <span className="uppercase tracking-wider whitespace-nowrap">{t.label}</span>
              <span className={clsx('rounded-full px-3 py-1 text-xs font-black whitespace-nowrap', active ? 'bg-white/20 text-white ring-1 ring-white/30' : 'bg-white text-slate-700 border border-slate-200 shadow-sm')}>{badge}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4.5 shadow-sm md:grid-cols-12 2xl:px-6 2xl:py-5">
        <div className="md:col-span-3">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Tìm kiếm (Mã / Tên / Công ty / SĐT / Đích)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập từ khóa..." className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Độ ưu tiên</label>
          <select value={priorityF || ''} onChange={(e) => applySearch({ priority: e.target.value })} className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4">
            <option value="">Tất cả</option>
            <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">🔴 Khẩn cấp</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Min số hành khách</label>
          <input type="number" min={0} value={minGuests} onChange={(e) => setMinGuests(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => applySearch({ ming: minGuests === '' ? '' : String(minGuests) })} placeholder="VD: 20" className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Sắp xếp</label>
          <select value={sort} onChange={(e) => applySearch({ sort: e.target.value })} className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="priority">Ưu tiên cao trước</option>
            <option value="follow_up">Theo giờ theo dõi (CSKH)</option>
          </select>
        </div>
        <div className="md:col-span-3 flex items-end gap-2.5">
          <button onClick={() => load()} className="h-11 inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 hover:bg-white ring-1 ring-slate-100">🔄 Tải lại</button>
          <button onClick={() => { setSearch(''); setMinGuests(''); setSort('newest'); applySearch({ tab: 'all', page: '1', search: '', sort: 'newest', assignee: '', ming: '' }) }} className="h-11 inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-xs font-black uppercase text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20">↺ Reset</button>
        </div>
      </div>

      <div className={clsx('relative overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm min-h-[640px]', stale && 'opacity-80 blur-[0.4px] transition')}>
        {initialLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[56px_180px_320px_300px_380px_120px_220px_240px_160px_200px_260px_200px_200px_400px] gap-4 px-6 py-5">
                <div className="h-5 w-5 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-12 w-64 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-96 animate-pulse rounded bg-slate-200" />
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
            <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white text-[11px] 2xl:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left w-14"><input type="checkbox" className="accent-orange-500 h-5 w-5" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                <th className="px-6 py-4 text-left">Mã</th>
                <th className="px-6 py-4 text-left">Liên hệ</th>
                <th className="px-6 py-4 text-left">Công ty / Đoàn</th>
                <th className="px-6 py-4 text-left">Đích / Dịch vụ</th>
                <th className="px-6 py-4 text-center">👥 Số khách</th>
                <th className="px-6 py-4 text-left">Ngày đi / Thời gian</th>
                <th className="px-6 py-4 text-left">Ngân sách</th>
                <th className="px-6 py-4 text-left">Ưu tiên</th>
                <th className="px-6 py-4 text-left">Trạng thái</th>
                <th className="px-6 py-4 text-left">Nhân viên phụ trách</th>
                <th className="px-6 py-4 text-left">Giờ theo dõi</th>
                <th className="px-6 py-4 text-left">Tạo lúc</th>
                <th className="px-6 py-4 pr-7 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length ? (
                <tr><td colSpan={14} className="px-6 py-20 text-center text-base text-slate-400">Không có yêu cầu nào thỏa điều kiện lọc. Vui lòng thay đổi bộ lọc hoặc chờ khách gửi yêu cầu.</td></tr>
              ) : null}
              {rows.map((r) => {
                const sel = selected.has(r._id)
                const guests = totalGroupTourGuests(r)
                const priority = GROUP_TOUR_PRIORITY_META[r.priority]
                const statusMeta = GROUP_TOUR_STATUS_META[r.status]
                const isUrgent = r.priority === 'urgent'
                return (
                  <tr key={r._id} className={clsx('hover:bg-blue-50/40 align-top', sel && 'bg-blue-50/30', isUrgent && 'bg-rose-50/10')}>
                    <td className="px-6 py-5"><input type="checkbox" className="accent-orange-500 h-5 w-5" checked={sel} onChange={() => toggleOne(r._id)} /></td>
                    <td className="px-6 py-5 font-black text-slate-900 text-[15px] 2xl:text-base whitespace-nowrap font-mono">{r.code}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-lg font-black text-white shadow-sm ring-2 ring-blue-50/80">{r.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] 2xl:text-base truncate"><Users className="h-4 w-4 text-slate-400 shrink-0" />{r.contactName}</div>
                          <a href={`tel:${r.contactPhone}`} className="mt-1 flex items-center gap-2 text-sm text-blue-700 font-bold hover:underline whitespace-nowrap"><Phone className="h-3.5 w-3.5 shrink-0" />{r.contactPhone}</a>
                          {r.contactEmail ? <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 truncate">✉️ <span className="truncate">{r.contactEmail}</span></div> : null}
                          {r.contactRole ? <div className="mt-1 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">💼 {r.contactRole}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="h-5 w-5 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 leading-snug break-words text-[15px] 2xl:text-base">{r.companyOrGroupName}</div>
                          {r.companyTaxCode ? <div className="mt-1 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">🧾 MST: {r.companyTaxCode}</div> : null}
                          {r.internalStaffNote ? <div className="mt-2 text-xs 2xl:text-[13px] text-slate-600 italic border-l-2 border-orange-300 pl-3 line-clamp-3 bg-orange-50/40 py-1.5 pr-2 rounded-r-xl">📝 {r.internalStaffNote}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-2.5">
                        <MapPin className="h-5 w-5 mt-0.5 shrink-0 text-orange-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-[15px] 2xl:text-base">{r.destination}</div>
                          {r.departureCity ? <div className="mt-1 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">🚩 Khởi hành từ: {r.departureCity}</div> : null}
                          {r.approximateDurationText ? <div className="mt-1 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">⏱ Thời gian: {r.approximateDurationText}</div> : null}
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {r.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-violet-100 whitespace-nowrap">🛂 Visa</span> : null}
                            {r.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-100 whitespace-nowrap">✈️ Vé máy bay</span> : null}
                            {r.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 whitespace-nowrap">🚌 Xe du lịch</span> : null}
                            {r.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-100 whitespace-nowrap">🏨 KS {r.hotelClassRequested || ''}</span> : null}
                            {r.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-100 whitespace-nowrap">🍱 Bữa ăn</span> : null}
                            {r.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100 whitespace-nowrap">🧭 HDV hướng dẫn</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="font-black text-2xl 2xl:text-3xl text-slate-900 tabular-nums">{guests}</div>
                      <div className="text-xs 2xl:text-[13px] text-slate-500 uppercase tracking-wide mt-0.5">khách</div>
                      <div className="mt-2 space-y-1">
                        <div className="text-xs 2xl:text-[13px] text-slate-600 whitespace-nowrap"><span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-bold">NL {r.adultCount}</span> <span className="inline-flex rounded-md bg-orange-50 px-2 py-1 font-bold text-orange-700 ml-1">TE {r.childCount}</span> <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-700 ml-1">EB {r.infantCount}</span></div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <CalendarDays className="h-4 w-4 mb-1 inline-block text-slate-400 shrink-0" />
                      <div className="text-sm 2xl:text-[15px] font-bold text-slate-800 inline-block ml-1.5 whitespace-nowrap">{r.preferredStartDate ? formatDate(r.preferredStartDate) : 'Chưa xác định'}</div>
                      {r.approximateDurationText ? <div className="mt-1.5 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">{r.approximateDurationText}</div> : null}
                      {isUrgent ? <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs 2xl:text-[13px] font-black uppercase text-rose-700 ring-1 ring-rose-200 whitespace-nowrap"><AlertTriangle className="h-3.5 w-3.5" /> KHẨN CẤP</div> : null}
                    </td>
                    <td className="px-6 py-5">
                      {r.budgetPerPersonVnd ? <div className="font-black text-orange-600 text-[17px] 2xl:text-xl tabular-nums whitespace-nowrap">{formatMoney(r.budgetPerPersonVnd)}đ<span className="text-xs 2xl:text-[13px] font-semibold text-slate-400 ml-1.5">/khách</span></div> : null}
                      {r.totalBudgetVnd ? <div className="mt-1.5 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">Tổng dự kiến: <span className="font-bold text-slate-700">{formatMoney(r.totalBudgetVnd)}đ</span></div> : null}
                      {r.lastQuoteSummary ? <div className="mt-2.5 text-sm text-emerald-700 border-l-2 border-emerald-300 pl-3 line-clamp-3 bg-emerald-50/40 py-1.5 pr-2 rounded-r-xl font-semibold">💰 {r.lastQuoteSummary}</div> : null}
                    </td>
                    <td className="px-6 py-5">
                      <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs 2xl:text-[13px] font-black uppercase ring-1', priority?.chip)}>
                        <span className="text-base">{priority?.icon || '🔵'}</span><span>{priority?.label || r.priority}</span>
                      </span>
                      <div className="mt-2 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">Đã báo giá: <b className="text-slate-700">{r.quoteCount}</b> lần</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={clsx('inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs 2xl:text-[13px] font-black uppercase ring-1', statusMeta?.chip)}>
                        <span className={clsx('h-2 w-2 rounded-full', statusMeta?.dot)} />
                        {statusMeta?.label || r.status}
                      </span>
                      {r.lostReason ? <div className="mt-2 text-xs 2xl:text-[13px] text-rose-600 italic line-clamp-3 bg-rose-50/60 rounded-xl border border-rose-100 px-3 py-1.5 whitespace-pre-wrap">💔 {r.lostReason}</div> : null}
                      {r.convertedBookingId ? <div className="mt-2 text-sm font-black text-emerald-700 whitespace-nowrap bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100 inline-flex items-center gap-2">✅ → <span className="font-mono">{r.convertedBookingId}</span></div> : null}
                    </td>
                    <td className="px-6 py-5">
                      <select
                        value={r.assignedStaffId || ''}
                        onChange={async (e) => {
                          try {
                            await patchAdminGroupTourRequest(r._id, { assignedStaffId: e.target.value || null })
                            toast.success('Đã cập nhật nhân viên phụ trách.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }}
                        className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 min-w-full focus:border-blue-500 focus:ring-4"
                      >
                        <option value="">— Chưa phân công —</option>
                        {staffList.map((s) => {
                          const staffName = `${s.name}${s.phone ? ` · ${s.phone}` : ''}`
                          return <option key={s.id} value={s.id}>👷 {staffName}</option>
                        })}
                      </select>
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-[11px] 2xl:text-xs text-slate-500 uppercase tracking-wide font-black whitespace-nowrap">Theo dõi kế tiếp</div>
                      <div className="text-sm 2xl:text-[15px] font-bold text-slate-800 mt-1 whitespace-nowrap">{r.followUpAt ? formatDate(r.followUpAt) : '—'}</div>
                      {r.lastContactedAt ? <div className="mt-1.5 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">LH gần nhất: {formatDate(r.lastContactedAt)}</div> : <div className="mt-1.5 text-xs 2xl:text-[13px] text-amber-700 whitespace-nowrap bg-amber-50 rounded-xl px-3 py-1.5 ring-1 ring-amber-100 inline-flex items-center gap-1.5 font-semibold">⚠️ Chưa gọi khách</div>}
                    </td>
                    <td className="px-6 py-5">
                      <span className="text-sm 2xl:text-[15px] text-slate-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</span>
                    </td>
                    <td className="px-6 py-5 pr-7">
                      <div className="flex flex-wrap items-center justify-end gap-2.5">
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'contacted', lastContactedAt: new Date().toISOString(), followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }); toast.success('Đánh dấu Đã liên hệ khách.'); await load() }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-sky-600/10 hover:bg-sky-700 whitespace-nowrap">📞 Đã LH</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'quoting' }); toast.success('Chuyển trạng thái: Đang báo giá khách.'); await load() }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 whitespace-nowrap">💵 Báo giá</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'won' }); toast.success('🎉 Đã chốt đơn Tour đoàn - chuyển qua tạo Booking.'); await load() }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700 whitespace-nowrap">✅ Chốt đơn</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-6 py-4.5 shadow-sm border border-slate-200">
        <div className="text-sm 2xl:text-[15px] text-slate-500">
          Hiện thị <b className="text-slate-800">{rows.length}</b> / tổng <b className="text-slate-800">{total || 0}</b> yêu cầu · Chọn <b className="text-orange-600">{selected.size}</b> dòng
        </div>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => applySearch({ page: String(Math.max(1, page - 1)) })} className="h-11 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">← Trước</button>
          {Array.from({ length: Math.min(5, totalPages) }).map((_, off) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
            const p = start + off
            if (p > totalPages) return null
            return (
              <button key={p} onClick={() => applySearch({ page: String(p) })} className={clsx('h-11 min-w-[2.75rem] inline-flex items-center justify-center rounded-2xl px-4 text-sm font-black', page === p ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:border-blue-300')}>{p}</button>
            )
          })}
          <button disabled={page >= totalPages} onClick={() => applySearch({ page: String(page + 1) })} className="h-11 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Sau →</button>
        </div>
      </div>
    </div>
  )
}
