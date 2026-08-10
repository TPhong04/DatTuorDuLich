import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { getStoredUser } from '@/features/auth/auth'
import {
  adminSeedSamples,
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
  { key: 'lost', label: 'Thua đơn', countOf: 'lost', chip: 'bg-rose-50 text-rose-600 border border-rose-100', icon: '💔' },
]

function buildDemo(n = 40): GroupTourRequest[] {
  const companies = ['Công ty TNHH Viễn thông ABC', 'Tập đoàn XYZ Group', 'Trường THPT Chuyên Hà Nội', 'Câu lạc bộ Chạy bộ Hanoi Runners', 'Công ty Cổ phần Dịch vụ Du lịch Miền Tây', 'Ngân hàng Đông Á', 'Văn phòng ĐKKD Quận 1', 'Đoàn Gia đình Nguyễn Thị A (50 người)', 'Công ty Phần mềm F-Corp', 'Tập đoàn Tiên Phong']
  const destinations = ['Hạ Long', 'Sa Pa', 'Ninh Bình', 'Phú Quốc', 'Đà Lạt', 'Mũi Né', 'Côn Đảo', 'Hà Giang', 'Bà Nà Hills', 'Biển Nha Trang']
  const services = [
    { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: true, needGuide: true },
    { needVisa: true, needFlight: true, needBus: true, needHotel: true, needMeals: true, needGuide: true },
    { needVisa: false, needFlight: false, needBus: true, needHotel: true, needMeals: false, needGuide: true },
  ]
  const statuses: GroupTourRequestStatus[] = ['new', 'contacted', 'quoting', 'negotiating', 'won', 'lost', 'archived', 'converted_booking']
  const priorities: GroupTourRequestPriority[] = ['low', 'normal', 'high', 'urgent']
  const firstNames = ['Nam', 'Linh', 'Tuấn', 'Hương', 'Trang', 'Khánh', 'Đức', 'Hà', 'Thảo', 'Anh']
  const rows: GroupTourRequest[] = []
  const now = Date.now()
  for (let i = 0; i < n; i += 1) {
    const adults = 10 + Math.floor(Math.random() * 120)
    const child = Math.floor(Math.random() * 15)
    const infant = Math.floor(Math.random() * 5)
    const compIdx = Math.floor(Math.random() * companies.length)
    const dest = destinations[Math.floor(Math.random() * destinations.length)]
    const status = statuses[Math.min(statuses.length - 1, Math.floor(i / (n / statuses.length)) + Math.floor(Math.random() * 2))]
    const priority: GroupTourRequestPriority = (i % 7 === 0 ? 'urgent' : i % 4 === 0 ? 'high' : priorities[Math.floor(Math.random() * priorities.length)])
    const created = new Date(now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000))
    const company = companies[compIdx]
    const start = new Date(now + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000)
    const budget = 2500000 + Math.floor(Math.random() * 8) * 500000
    const id = 'demo_' + i + '_' + Math.floor(Math.random() * 1e6)
    rows.push({
      _id: id, id,
      code: `GTR${String(created.getFullYear() % 100).padStart(2, '0')}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}-${String(i + 1).padStart(3, '0')}`,
      status, priority,
      contactName: 'Anh ' + firstNames[i % firstNames.length] + ' Văn ' + String.fromCharCode(65 + (i % 24)),
      contactPhone: '09' + String(10000000 + Math.floor(Math.random() * 89999999)),
      contactEmail: i % 3 === 0 ? null : `contact${i}@company${i % 5}.vn`,
      contactRole: i % 3 === 0 ? 'Trưởng phòng Nhân sự' : i % 5 === 0 ? 'Giám đốc hành chính' : null,
      companyOrGroupName: company,
      companyTaxCode: i % 2 === 0 ? '010' + String(100000 + Math.floor(Math.random() * 899999)) : null,
      adultCount: adults,
      childCount: child,
      infantCount: infant,
      departureCity: i % 2 ? 'Hà Nội' : 'TP. Hồ Chí Minh',
      destination: dest,
      approximateDurationText: `${3 + (i % 5)} ngày ${2 + (i % 4)} đêm`,
      preferredStartDate: i % 6 === 0 ? null : start.toISOString().slice(0, 10),
      preferredEndDate: null,
      hotelClassRequested: i % 4 === 0 ? '5 sao' : '4 sao',
      servicesPreference: services[i % services.length],
      transportRequestedNotes: i % 3 === 0 ? 'Cần xe 45 chỗ Limousine, đón ở Công ty Quận 1' : null,
      budgetPerPersonVnd: budget,
      totalBudgetVnd: budget * (adults + child),
      specialRequirements: i % 2 === 0 ? '15 phòng 2 người + 1 phòng 3 người. Ăn chay 5 người. Cần quà tặng tour cho đoàn.' : null,
      quoteCount: Math.floor(Math.random() * 4),
      lastQuoteSummary: i % 4 === 0 ? null : `Đã báo giá phương án 4 sao - xe 29 chỗ: ${formatMoney(budget)}/ người`,
      followUpAt: new Date(now + Math.floor(Math.random() * 6) * 24 * 60 * 60 * 1000).toISOString(),
      lastContactedAt: i % 3 === 0 ? null : new Date(now - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000).toISOString(),
      wonAt: status === 'won' || status === 'converted_booking' ? new Date(now - Math.floor(Math.random() * 2) * 24 * 60 * 60 * 1000).toISOString() : null,
      assignedStaffId: i % 3 === 0 ? null : 'staff_' + String.fromCharCode(65 + (i % 5)),
      convertedBookingId: status === 'converted_booking' ? 'BK_' + i + '_BOOKING' : null,
      lostReason: status === 'lost' ? ['Khách chọn đối thủ cạnh tranh', 'Chuyến bị hoãn do kế hoạch công ty', 'Vượt ngân sách của khách'][Math.floor(Math.random() * 3)] : null,
      internalStaffNote: i % 4 === 0 ? null : 'Gọi lại sau 2h chiều nay, khách đang họp hành chính.',
      createdByUserId: i % 5 === 0 ? null : 'user_' + i,
      sourceChannel: i % 6 === 0 ? 'Referral (khách cũ giới thiệu)' : 'website_group_form',
      ipAddress: null,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
    })
  }
  return rows.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

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
  const [seedLoading, setSeedLoading] = useState(false)
  const doSeedSamples = useCallback(async () => {
    try {
      setSeedLoading(true)
      const res = await adminSeedSamples()
      if (res?.skipped) toast.warning(res.message || 'Đã có dữ liệu mẫu, bỏ qua tạo thêm.')
      else toast.success(`Đã tạo ${res?.created || 0} yêu cầu Tour đoàn mẫu (${res?.staffCount || 0} staff đã tham gia phân công).`)
      await load()
      void loadStaff()
    } catch (e) { toast.error((e as any)?.message || 'Tạo mẫu thất bại.') } finally { setSeedLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast])
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetchAdminStaffList()
      setStaffList(res.rows || [])
    } catch (e) {
      setStaffList([
        { id: 'demo_staff_A', name: 'NV. A (Tours North)', email: 'staff-a@demo.local', phone: null, avatarUrl: null },
        { id: 'demo_staff_B', name: 'NV. B (Tours South)', email: 'staff-b@demo.local', phone: null, avatarUrl: null },
        { id: 'demo_staff_C', name: 'NV. C (Miền Tây)', email: 'staff-c@demo.local', phone: null, avatarUrl: null },
        { id: 'demo_staff_D', name: 'NV. D (Doanh nghiệp VIP)', email: 'staff-d@demo.local', phone: null, avatarUrl: null },
      ])
      toast.warning((e as any)?.message || 'Staff list fallback demo.')
    }
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
      setRows(res.rows || [])
      setTotal(Number(res.total || 0))
      setInitialLoading(false)
      setStale(false)
    } catch (e) {
      if (nonce !== nonceRef.current) return
      const demo = buildDemo(60)
      const filt = demo.filter((r) => {
        if (statusF && r.status !== statusF) return false
        if (priorityF && r.priority !== priorityF) return false
        if (wonFilter && r.status !== 'won' && r.status !== 'converted_booking') return false
        if (minGuests !== '' && totalGroupTourGuests(r) < Number(minGuests)) return false
        if (searchDeb) {
          const kw = searchDeb.toLowerCase()
          const hay = [r.code, r.contactName, r.companyOrGroupName, r.destination, r.contactPhone].filter(Boolean).join(' ').toLowerCase()
          if (!hay.includes(kw)) return false
        }
        return true
      })
      setTotal(filt.length)
      const start = (page - 1) * pageSize
      const sorted = [...filt]
      if (sort === 'oldest') sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
      else if (sort === 'priority') {
        const ord: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 }
        sorted.sort((a, b) => (ord[b.priority] || 0) - (ord[a.priority] || 0) || +new Date(b.createdAt) - +new Date(a.createdAt))
      } else if (sort === 'follow_up') sorted.sort((a, b) => +new Date(a.followUpAt || '2999-01-01') - +new Date(b.followUpAt || '2999-01-01'))
      else sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      setRows(sorted.slice(start, start + pageSize))
      setInitialLoading(false)
      setStale(false)
      toast.warning((e as any)?.message || 'API offline: đang hiển thị dữ liệu mẫu Tour đoàn.')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusF, priorityF, wonFilter, searchDeb, sort, assignedStaff, minGuests])
  useEffect(() => { void load() }, [load])
  const stats = useMemo(() => countStatuses(initialLoading ? [] : rows.concat()), [rows, initialLoading])
  // total stats use full demo fallback
  const totalStats = useMemo(() => {
    if (total > 0 && rows.length > 0) {
      // rough stat from current rows; accurate stat is server aggregation
      const merged = initialLoading ? [] : [...rows]
      return countStatuses(merged)
    }
    // simulate counts for demo state using full dataset rough percentages
    const all = total || 60
    return {
      all, new: Math.ceil(all * 0.22), quoting: Math.ceil(all * 0.2), negotiating: Math.ceil(all * 0.18),
      urgent: Math.ceil(all * 0.12), won: Math.ceil(all * 0.14), lost: Math.ceil(all * 0.08),
    }
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
            <button
              disabled={seedLoading}
              onClick={() => { void doSeedSamples() }}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-emerald-300 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 text-xs font-black uppercase text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60 shadow-sm"
            >🌱 {seedLoading ? 'Đang tạo...' : 'Tạo 7 mẫu YC'}</button>
            <select
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="">👷 Chọn nhân viên...</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>👷 {s.name} {s.phone ? `(${s.phone})` : ''}</option>)}
            </select>
            <button
              disabled={!bulkStaffId}
              onClick={() => bulkAssign(bulkStaffId || null)}
              className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-4 text-xs font-black uppercase text-white hover:opacity-95 disabled:opacity-50"
            >Giao staff</button>
            <button onClick={() => bulkAssign(null)} className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">🔓 Thu hồi</button>
            <button onClick={() => bulkStatus('won')} className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-emerald-600 px-4 text-xs font-black uppercase text-white hover:bg-emerald-700">✅ Chốt (Won) chọn</button>
            <button onClick={() => bulkStatus('lost')} className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-rose-500 px-4 text-xs font-black uppercase text-white hover:bg-rose-600">💔 Thua chọn</button>
            <a href="tel:19001009" className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">📞 1900 1009</a>
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
                'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-extrabold transition',
                active ? 'border-orange-400 bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-md' : meta ? meta.chip : t.chip + ' hover:border-orange-300 hover:bg-orange-50',
              )}
            >
              <span className="text-sm">{t.icon}</span>
              <span className="uppercase tracking-wide">{t.label}</span>
              <span className={clsx('rounded-full px-2 py-0.5 text-[10px]', active ? 'bg-white/20 text-white' : 'bg-white/80 text-slate-700 border border-white/40')}>{badge}</span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-12">
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tìm kiếm (Mã / Tên / Công ty / SĐT / Đích)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nhập từ khóa..." className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Độ ưu tiên</label>
          <select value={priorityF || ''} onChange={(e) => applySearch({ priority: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400">
            <option value="">Tất cả</option>
            <option value="low">Thấp</option><option value="normal">Bình thường</option><option value="high">Cao</option><option value="urgent">🔴 Khẩn cấp</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Min số hành khách</label>
          <input type="number" min={0} value={minGuests} onChange={(e) => setMinGuests(e.target.value === '' ? '' : Number(e.target.value))} onBlur={() => applySearch({ ming: minGuests === '' ? '' : String(minGuests) })} placeholder="VD: 20" className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Sort</label>
          <select value={sort} onChange={(e) => applySearch({ sort: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
            <option value="priority">Ưu tiên cao trước</option>
            <option value="follow_up">Theo giờ theo dõi (CSKH)</option>
          </select>
        </div>
        <div className="md:col-span-3 flex items-end gap-2">
          <button onClick={() => load()} className="h-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-white">🔄 Tải lại</button>
          <button onClick={() => { setSearch(''); setMinGuests(''); setSort('newest'); applySearch({ tab: 'all', page: '1', search: '', sort: 'newest', assignee: '', ming: '' }) }} className="h-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 text-xs font-black uppercase text-white hover:bg-orange-600">↺ Reset</button>
        </div>
      </div>

      <div className={clsx('relative overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm min-h-[640px]', stale && 'opacity-80 blur-[0.4px] transition')}>
        {initialLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[40px_120px_160px_1fr_160px_80px_180px_160px_140px_180px_160px] gap-3 px-4 py-4">
                <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-36 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-[1680px] w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-orange-600 text-white text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left w-12"><input type="checkbox" className="accent-orange-500 h-4 w-4" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} /></th>
                <th className="px-3 py-3 text-left">Mã</th>
                <th className="px-3 py-3 text-left">Liên hệ</th>
                <th className="px-3 py-3 text-left">Công ty / Đoàn</th>
                <th className="px-3 py-3 text-left">Đích / Tour</th>
                <th className="px-3 py-3 text-center">👥</th>
                <th className="px-3 py-3 text-left">Ngày / Thời gian</th>
                <th className="px-3 py-3 text-left">Ngân sách</th>
                <th className="px-3 py-3 text-left">Ưu tiên</th>
                <th className="px-3 py-3 text-left">Trạng thái</th>
                <th className="px-3 py-3 text-left">Nhân viên phụ trách</th>
                <th className="px-3 py-3 text-left">Giờ theo dõi</th>
                <th className="px-3 py-3 text-left">Tạo lúc</th>
                <th className="px-3 py-3 pr-5 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length ? (
                <tr><td colSpan={14} className="px-5 py-16 text-center text-sm text-slate-400">Không có yêu cầu nào thỏa điều kiện lọc.</td></tr>
              ) : null}
              {rows.map((r) => {
                const sel = selected.has(r._id)
                const guests = totalGroupTourGuests(r)
                const priority = GROUP_TOUR_PRIORITY_META[r.priority]
                const statusMeta = GROUP_TOUR_STATUS_META[r.status]
                const isUrgent = r.priority === 'urgent'
                return (
                  <tr key={r._id} className={clsx('hover:bg-orange-50/50', sel && 'bg-orange-50/40', isUrgent && 'bg-rose-50/20')}>
                    <td className="px-3 py-3 align-top"><input type="checkbox" className="accent-orange-500 h-4 w-4" checked={sel} onChange={() => toggleOne(r._id)} /></td>
                    <td className="px-3 py-3 align-top font-black text-slate-900">{r.code}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-orange-500 to-amber-400 text-sm font-black text-white shadow-sm">{r.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900 truncate max-w-[220px]"><Users className="h-3.5 w-3.5 text-slate-400" />{r.contactName}</div>
                          <a href={`tel:${r.contactPhone}`} className="mt-0.5 flex items-center gap-1.5 text-xs text-blue-700 hover:underline"><Phone className="h-3 w-3" />{r.contactPhone}</a>
                          {r.contactEmail ? <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500 truncate max-w-[220px]">✉️ {r.contactEmail}</div> : null}
                          {r.contactRole ? <div className="mt-0.5 text-[11px] text-slate-500">💼 {r.contactRole}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 leading-snug break-words max-w-[260px]">{r.companyOrGroupName}</div>
                          {r.companyTaxCode ? <div className="mt-0.5 text-[11px] text-slate-500">🧾 MST: {r.companyTaxCode}</div> : null}
                          {r.internalStaffNote ? <div className="mt-1 text-[11px] text-slate-500 italic border-l-2 border-orange-300 pl-2 line-clamp-2 max-w-[260px]">📝 {r.internalStaffNote}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-orange-600" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900">{r.destination}</div>
                          {r.departureCity ? <div className="mt-0.5 text-[11px] text-slate-500">🚩 {r.departureCity}</div> : null}
                          {r.approximateDurationText ? <div className="mt-0.5 text-[11px] text-slate-500">⏱ {r.approximateDurationText}</div> : null}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">🛂 Visa</span> : null}
                            {r.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">✈️ Vé máy bay</span> : null}
                            {r.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">🚌 Xe</span> : null}
                            {r.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">🏨 KS {r.hotelClassRequested || ''}</span> : null}
                            {r.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">🍱 Ăn</span> : null}
                            {r.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">🧭 HDV</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top text-center">
                      <div className="font-black text-lg text-slate-900">{guests}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wide">người</div>
                      <div className="mt-1 text-[10px] text-slate-500">NL {r.adultCount} · TE {r.childCount} · EB {r.infantCount}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <CalendarDays className="h-3.5 w-3.5 mb-0.5 inline-block text-slate-400" />
                      <div className="text-xs font-bold text-slate-800 inline-block ml-1">{r.preferredStartDate ? formatDate(r.preferredStartDate) : 'Chưa xác định'}</div>
                      {r.approximateDurationText ? <div className="mt-0.5 text-[11px] text-slate-500">{r.approximateDurationText}</div> : null}
                      {isUrgent ? <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700"><AlertTriangle className="h-3 w-3" /> KHẨN</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {r.budgetPerPersonVnd ? <div className="font-black text-orange-600">{formatMoney(r.budgetPerPersonVnd)}đ<span className="text-[10px] font-semibold text-slate-400 ml-1">/ng</span></div> : null}
                      {r.totalBudgetVnd ? <div className="mt-0.5 text-[11px] text-slate-500">Tổng dự kiến: <span className="font-semibold text-slate-700">{formatMoney(r.totalBudgetVnd)}đ</span></div> : null}
                      {r.lastQuoteSummary ? <div className="mt-1.5 text-[11px] text-emerald-700 border-l-2 border-emerald-300 pl-2 line-clamp-2">💰 {r.lastQuoteSummary}</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase', priority?.chip)}>
                        <span>{priority?.icon || '🔵'}</span><span>{priority?.label || r.priority}</span>
                      </span>
                      <div className="mt-1 text-[10px] text-slate-500">Báo giá {r.quoteCount} lần</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase', statusMeta?.chip)}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', statusMeta?.dot)} />
                        {statusMeta?.label || r.status}
                      </span>
                      {r.lostReason ? <div className="mt-1 text-[11px] text-rose-600 italic max-w-[180px] truncate">💔 {r.lostReason}</div> : null}
                      {r.convertedBookingId ? <div className="mt-1 text-[11px] font-bold text-emerald-700">✅ → {r.convertedBookingId}</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select
                        value={r.assignedStaffId || ''}
                        onChange={async (e) => {
                          try {
                            await patchAdminGroupTourRequest(r._id, { assignedStaffId: e.target.value || null })
                            toast.success('Đã cập nhật nhân viên.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 min-w-[170px]"
                      >
                        <option value="">— Chưa giao —</option>
                        {staffList.map((s) => {
                          const staffName = `${s.name}${s.phone ? ` · ${s.phone}` : ''}`
                          return <option key={s.id} value={s.id}>👷 {staffName}</option>
                        })}
                        {staffList.length === 0 && (
                          <>
                            <option value="demo_staff_A">👷 NV. A (Tours North)</option>
                            <option value="demo_staff_B">👷 NV. B (Tours South)</option>
                            <option value="demo_staff_C">👷 NV. C (Miền Tây)</option>
                            <option value="demo_staff_D">👷 NV. D (Doanh nghiệp VIP)</option>
                          </>
                        )}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Theo dõi</div>
                      <div className="text-xs font-bold text-slate-800">{r.followUpAt ? formatDate(r.followUpAt) : '—'}</div>
                      {r.lastContactedAt ? <div className="mt-1 text-[10px] text-slate-400">Liên hệ gần: {formatDate(r.lastContactedAt)}</div> : <div className="mt-1 text-[10px] text-amber-700">⚠️ Chưa gọi</div>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span>
                    </td>
                    <td className="px-3 py-3 align-top pr-4">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'contacted', lastContactedAt: new Date().toISOString(), followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() }); toast.success('Đánh dấu Đã liên hệ.'); await load() }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-sky-500 px-3 text-[11px] font-black uppercase text-white hover:bg-sky-600">📞 Đã LH</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'quoting' }); toast.success('Chuyển trạng thái Đang báo giá.'); await load() }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-amber-500 px-3 text-[11px] font-black uppercase text-white hover:bg-amber-600">💵 Báo giá</button>
                        <button onClick={async () => { await patchAdminGroupTourRequest(r._id, { status: 'won' }); toast.success('🎉 Chốt đơn thành công!'); await load() }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[11px] font-black uppercase text-white hover:bg-emerald-700">🏆 Chốt</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3 shadow-sm border border-slate-200">
        <div className="text-xs text-slate-500">
          Hiện thị <b>{rows.length}</b> / tổng <b>{total || 0}</b> yêu cầu · Chọn <b className="text-orange-600">{selected.size}</b> dòng
        </div>
        <div className="flex items-center gap-1">
          <button disabled={page <= 1} onClick={() => applySearch({ page: String(Math.max(1, page - 1)) })} className="h-9 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">← Trước</button>
          {Array.from({ length: Math.min(5, totalPages) }).map((_, off) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4))
            const p = start + off
            if (p > totalPages) return null
            return (
              <button key={p} onClick={() => applySearch({ page: String(p) })} className={clsx('h-9 min-w-[2.25rem] inline-flex items-center justify-center rounded-xl px-3 text-xs font-black', page === p ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-700 hover:bg-orange-50')}>{p}</button>
            )
          })}
          <button disabled={page >= totalPages} onClick={() => applySearch({ page: String(page + 1) })} className="h-9 inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Sau →</button>
        </div>
      </div>
    </div>
  )
}
