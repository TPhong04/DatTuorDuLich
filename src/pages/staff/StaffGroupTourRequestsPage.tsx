import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { getStoredUser } from '@/features/auth/auth'
import { formatMoney } from '@/utils/format'
import {
  fetchAdminStaffList,
  fetchStaffGroupTourRequests,
  GROUP_TOUR_PRIORITY_META,
  GROUP_TOUR_STATUS_META,
  GroupTourRequest,
  GroupTourRequestPriority,
  GroupTourRequestStatus,
  patchStaffGroupTourRequest,
  StaffBrief,
  totalGroupTourGuests,
} from '@/features/group-tour-requests/group-tour-requests'
import clsx from 'clsx'
import { Users, Phone, Building2, MapPin, CalendarDays, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { formatDate, formatDateTime } from '@/utils/date'

const TABS = [
  { key: 'mine', label: 'Yêu cầu tôi phụ trách', countOf: null as GroupTourRequestStatus | null, chip: 'bg-orange-50 text-orange-700 border border-orange-200', icon: '🎯' },
  { key: 'new', label: 'Mới cần gọi', countOf: 'new', chip: 'bg-blue-50 text-blue-700 border border-blue-100', icon: '🆕' },
  { key: 'quoting', label: 'Đang báo giá', countOf: 'quoting', chip: 'bg-amber-50 text-amber-700 border border-amber-100', icon: '💵' },
  { key: 'negotiating', label: 'Đàm phán', countOf: 'negotiating', chip: 'bg-violet-50 text-violet-700 border border-violet-100', icon: '🤝' },
  { key: 'urgent', label: '🔴 KHẨN CẤP', countOf: null, chip: 'bg-rose-50 text-rose-700 border border-rose-200', icon: '🚨' },
  { key: 'won', label: 'Đã chốt', countOf: null, chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: '🏆' },
  { key: 'all', label: 'Tất cả (hỏi all=0 để xem)', countOf: null, chip: 'bg-slate-50 text-slate-700 border border-slate-200', icon: '📋' },
]

function buildDemoStaff(n = 30, staffId = 'demo_staff_A'): GroupTourRequest[] {
  const base: GroupTourRequest[] = []
  const companies = ['Công ty TNHH FPT Software', 'Vingroup', 'FECON', 'Trường Đại học Quốc Gia Hà Nội', 'Câu lạc bộ Việt Nam Vô Cực', 'Công ty VNM', 'BIDV', 'SHB', 'Phòng GĐX Điện lực TPHCM']
  const destinations = ['Hạ Long', 'Sa Pa', 'Ninh Bình', 'Phú Quốc', 'Đà Lạt', 'Côn Đảo', 'Hà Giang', 'Bà Nà Hills', 'Nha Trang']
  const statuses: GroupTourRequestStatus[] = ['new', 'contacted', 'quoting', 'negotiating', 'won', 'lost', 'converted_booking']
  const priorities: GroupTourRequestPriority[] = ['low', 'normal', 'high', 'urgent']
  const now = Date.now()
  for (let i = 0; i < n; i += 1) {
    const adults = 15 + Math.floor(Math.random() * 90)
    const child = Math.floor(Math.random() * 10)
    const infant = Math.floor(Math.random() * 3)
    const dest = destinations[i % destinations.length]
    const status = statuses[i % statuses.length]
    const priority: GroupTourRequestPriority = (i % 9 === 0 ? 'urgent' : i % 5 === 0 ? 'high' : priorities[i % priorities.length])
    const created = new Date(now - Math.floor(Math.random() * 25 * 24 * 60 * 60 * 1000))
    const start = new Date(now + Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000)
    const budget = 3000000 + Math.floor(Math.random() * 7) * 500000
    const id = 'd_staff_' + i + '_' + Math.floor(Math.random() * 1e6)
    // 80% assigned to current staff; 20% someone else
    const assigned = i % 5 === 0 ? 'demo_staff_B' : staffId
    base.push({
      _id: id, id,
      code: `GTR${String(created.getFullYear() % 100).padStart(2, '0')}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}-${String(100 + i).padStart(3, '0')}`,
      status, priority,
      contactName: 'Chị/Ông ' + ['Lan', 'Mai', 'Dung', 'Đạt', 'Hùng', 'Nga', 'Thanh', 'Tuấn'][i % 8] + ' ' + String.fromCharCode(65 + (i % 24)),
      contactPhone: '09' + String(10000000 + Math.floor(Math.random() * 89999999)),
      contactEmail: i % 2 ? `sale.${i}@company${i % 4}.vn` : null,
      contactRole: i % 2 ? 'Trưởng bộ phận Hành chính' : null,
      companyOrGroupName: companies[i % companies.length],
      companyTaxCode: i % 3 ? '031' + String(100000 + Math.floor(Math.random() * 899999)) : null,
      adultCount: adults, childCount: child, infantCount: infant,
      departureCity: i % 2 ? 'Hà Nội' : 'TP. Hồ Chí Minh',
      destination: dest,
      approximateDurationText: `${2 + (i % 4)} ngày ${1 + (i % 3)} đêm`,
      preferredStartDate: i % 7 === 0 ? null : start.toISOString().slice(0, 10),
      preferredEndDate: null,
      hotelClassRequested: i % 3 === 0 ? '5 sao' : '4 sao',
      servicesPreference: {
        needVisa: i % 5 === 0, needFlight: i % 3 === 0, needBus: true,
        needHotel: true, needMeals: i % 10 !== 0, needGuide: true,
      },
      transportRequestedNotes: i % 3 === 0 ? 'Cần xe 29 chỗ - có nước uống lạnh + khăn lạnh' : null,
      budgetPerPersonVnd: budget,
      totalBudgetVnd: budget * (adults + child),
      specialRequirements: i % 3 === 0 ? 'Có 11 người ăn chay; Cần bàn Gala tối cuối tuần' : null,
      quoteCount: Math.floor(Math.random() * 5),
      lastQuoteSummary: i % 5 === 0 ? null : `Gửi v2: phương án 4 sao 3 ngày 2 đêm ${formatMoney(budget)}/ người`,
      followUpAt: new Date(now + (i % 7) * 24 * 3600 * 1000).toISOString(),
      lastContactedAt: i % 3 === 0 ? null : new Date(now - (i % 3) * 24 * 3600 * 1000).toISOString(),
      wonAt: status === 'won' || status === 'converted_booking' ? new Date(now - (i % 2) * 86400000).toISOString() : null,
      assignedStaffId: assigned,
      convertedBookingId: status === 'converted_booking' ? 'BK_STAFF_' + i : null,
      lostReason: status === 'lost' ? 'Khách chọn đối thủ vì rẻ hơn 5%' : null,
      internalStaffNote: i % 3 === 0 ? 'Đã gọi 2 lần - máy bận - gọi lại 17h.' : null,
      createdByUserId: i % 4 === 0 ? null : 'user_' + i,
      sourceChannel: 'website_group_form', ipAddress: null,
      createdAt: created.toISOString(), updatedAt: created.toISOString(),
    })
  }
  return base.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
}

function countStatuses(rows: GroupTourRequest[]) {
  const out: Record<string, number> = { mine: 0, urgent: 0, won: 0, all: rows.length }
  for (const r of rows) {
    out[r.status] = (out[r.status] || 0) + 1
    if (r.assignedStaffId === 'demo_staff_A') out.mine += 1
    if (r.priority === 'urgent') out.urgent += 1
    if (r.status === 'won' || r.status === 'converted_booking') out.won += 1
  }
  return out
}

export default function StaffGroupTourRequestsPage() {
  const storedUser = getStoredUser()
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const nonceRef = useRef(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [rows, setRows] = useState<GroupTourRequest[]>([])
  const [total, setTotal] = useState(0)
  const pageSize = 25
  const page = Math.max(1, Number(sp.get('page') || '1'))
  const currentStaffId = storedUser?.id || 'demo_staff_A'
  const tab = (sp.get('tab') || 'mine') as string
  const seeAll = sp.get('all') === '0'
  const statusF: GroupTourRequestStatus | undefined = (tab && TABS.filter((t) => t.countOf && t.key !== 'all' && t.key !== 'mine' && t.key !== 'urgent' && t.key !== 'won').find((t) => t.key === tab)?.countOf) as GroupTourRequestStatus | undefined
  const priorityF: GroupTourRequestPriority | undefined = tab === 'urgent' ? 'urgent' : undefined
  const wonFilter = tab === 'won'
  const mineFilter = tab === 'mine'
  const [search, setSearch] = useState(sp.get('search') || '')
  const [searchDeb, setSearchDeb] = useState(search)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority' | 'follow_up'>((sp.get('sort') as any) || 'follow_up')
  const [staffList, setStaffList] = useState<StaffBrief[]>([])
  const loadStaff = useCallback(async () => {
    try {
      const res = await fetchAdminStaffList()
      setStaffList(res.rows || [])
    } catch {
      // ignore (staff list is only for name display)
    }
  }, [])
  useEffect(() => { void loadStaff() }, [loadStaff])
  const staffName = (id: string | null | undefined, fallback?: string) => {
    if (!id) return fallback ?? '—'
    const s = staffList.find((x) => x.id === id)
    if (s) return s.name + (s.phone ? ` · ${s.phone}` : '')
    return fallback ?? String(id).slice(0, 8)
  }
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
      const res = await fetchStaffGroupTourRequests({
        page, pageSize, status: statusF, priority: priorityF,
        search: searchDeb, sort, onlyMine: seeAll ? '0' : '1',
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
  }, [page, statusF, priorityF, wonFilter, mineFilter, searchDeb, sort, seeAll, currentStaffId])
  useEffect(() => { void load() }, [load])
  const countStatusesReal = (list: GroupTourRequest[]) => {
    const out: Record<string, number> = { all: 0, mine: 0, new: 0, quoting: 0, negotiating: 0, urgent: 0, won: 0 }
    for (const r of list) {
      out.all += 1
      const isMine = !r.assignedStaffId || String(r.assignedStaffId) === String(currentStaffId)
      if (isMine) {
        out.mine += 1
        if (r.status === 'new') out.new += 1
        else if (r.status === 'quoting') out.quoting += 1
        else if (r.status === 'negotiating') out.negotiating += 1
        else if (r.status === 'won' || r.status === 'converted_booking') out.won += 1
        if (r.priority === 'urgent') out.urgent += 1
      }
    }
    return out
  }
  const totalStats = useMemo(() => {
    if (total > 0 || rows.length > 0) return countStatusesReal(rows)
    const all = total || 0
    return { all, mine: 0, new: 0, quoting: 0, negotiating: 0, urgent: 0, won: 0 }
  }, [rows, total, initialLoading, currentStaffId])
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
  const pendingMine = rows.filter((r) => r.status === 'new' || !r.lastContactedAt).length
  void storedUser
  return (
    <div className="space-y-5">
      <PageHeader
        subtitle="Danh sách yêu cầu Tour đoàn được quản lý giao cho bạn. Ưu tiên KHẨN CẤP trước, sau đó theo giờ theo dõi Follow-up."
        title="👔 Tour đoàn (Của tôi)"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!seeAll ? (
              <button onClick={() => applySearch({ all: '0', tab: 'all' })} className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">🌐 Xem Tất cả yêu cầu (đọc-only)</button>
            ) : (
              <button onClick={() => applySearch({ all: '', tab: 'mine' })} className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-4 text-xs font-black uppercase text-white hover:opacity-95">🎯 Xem của tôi</button>
            )}
            <div className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 text-xs font-black uppercase text-amber-700">⏰ Cần gọi ngay: <b className="text-rose-700">{pendingMine}</b></div>
            <a href="tel:19001009" className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">📞 Hotline</a>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-blue-700">Tổng yêu cầu tôi xử lý</div>
          <div className="mt-2 text-2xl font-black text-blue-900">{totalStats.mine}</div>
          <div className="mt-1 text-[11px] text-slate-500">trong tổng {totalStats.all} yêu cầu hệ thống</div>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-rose-700">🔴 Khẩn cấp</div>
          <div className="mt-2 text-2xl font-black text-rose-700">{totalStats.urgent}</div>
          <div className="mt-1 text-[11px] text-slate-500">Gọi trong 30 phút</div>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-amber-700">Đang báo giá / Đàm phán</div>
          <div className="mt-2 text-2xl font-black text-amber-700">{(totalStats.quoting || 0) + (totalStats.negotiating || 0)}</div>
          <div className="mt-1 text-[11px] text-slate-500">Cập nhật tối thiểu 1 lần/ngày</div>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700">🏆 Đã chốt tháng này</div>
          <div className="mt-2 text-2xl font-black text-emerald-700">{totalStats.won}</div>
          <div className="mt-1 text-[11px] text-slate-500">Bấm nút "Chốt đơn" để ghi nhận</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const k = t.key
          const active = tab === k
          const c = t.countOf
          const meta = c && GROUP_TOUR_STATUS_META[c as GroupTourRequestStatus]
          const badge = k === 'urgent' ? totalStats.urgent : k === 'won' ? totalStats.won : k === 'mine' ? totalStats.mine : c ? totalStats[c as string] : totalStats.all
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
        <div className="md:col-span-5">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Tìm (Tên / Công ty / Mã / SĐT / Điểm đến)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhanh khách hàng..." className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Ưu tiên hiển thị (Sort)</label>
          <select value={sort} onChange={(e) => applySearch({ sort: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400">
            <option value="follow_up">⌛ Theo giờ theo dõi (Follow up)</option>
            <option value="priority">🔴 Ưu tiên cao trước</option>
            <option value="newest">🆕 Mới nhất</option>
            <option value="oldest">⏮ Cũ nhất</option>
          </select>
        </div>
        <div className="md:col-span-4 flex items-end gap-2">
          <button onClick={() => load()} className="h-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-white">🔄 Tải lại</button>
          <button onClick={() => { setSearch(''); setSort('follow_up'); applySearch({ tab: 'mine', page: '1', search: '', sort: 'follow_up' }) }} className="h-10 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 text-xs font-black uppercase text-white hover:bg-orange-600">↺ Reset bộ lọc</button>
        </div>
      </div>

      <div className={clsx('relative overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm min-h-[640px]', stale && 'opacity-80 blur-[0.4px] transition')}>
        {initialLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[40px_130px_200px_1fr_80px_180px_180px_160px_160px_180px] gap-3 px-4 py-4">
                <div className="h-4 w-4 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-16 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <table className="min-w-[1640px] w-full text-sm">
            <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-orange-600 text-white text-[11px] uppercase tracking-wide">
              <tr>
                <th className="px-3 py-3 text-left w-10">#</th>
                <th className="px-3 py-3 text-left">Mã</th>
                <th className="px-3 py-3 text-left">Liên hệ</th>
                <th className="px-3 py-3 text-left">Công ty / Đoàn + Đích</th>
                <th className="px-3 py-3 text-center">👥</th>
                <th className="px-3 py-3 text-left">Ngày khởi hành dự kiến</th>
                <th className="px-3 py-3 text-left">Ngân sách + Báo giá</th>
                <th className="px-3 py-3 text-left">Ưu tiên</th>
                <th className="px-3 py-3 text-left">Trạng thái</th>
                <th className="px-3 py-3 text-left">Follow up</th>
                <th className="px-3 py-3 pr-5 text-right">Hành động nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length ? (
                <tr><td colSpan={11} className="px-5 py-16 text-center text-sm text-slate-400 flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-10 w-10 text-emerald-300" />
                  <div>Không có yêu cầu nào. 🎉 Bạn đã xong hết công việc hôm nay!</div>
                  <button onClick={() => applySearch({ tab: 'all' })} className="mt-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black uppercase text-white hover:bg-orange-600">Xem toàn bộ để nhận thêm (khi Admin chưa giao)</button>
                </td></tr>
              ) : null}
              {rows.map((r, idx) => {
                const guests = totalGroupTourGuests(r)
                const priority = GROUP_TOUR_PRIORITY_META[r.priority]
                const statusMeta = GROUP_TOUR_STATUS_META[r.status]
                const isUrgent = r.priority === 'urgent'
                const notMine = r.assignedStaffId && String(r.assignedStaffId) !== String(currentStaffId)
                return (
                  <tr key={r._id} className={clsx('hover:bg-orange-50/50', isUrgent && 'bg-rose-50/20', notMine && 'opacity-70')}>
                    <td className="px-3 py-3 align-top text-slate-400 font-bold text-xs">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-3 py-3 align-top font-black text-slate-900">{r.code}</td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 via-rose-500 to-amber-400 text-sm font-black text-white shadow-sm">{r.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900"><Users className="h-3.5 w-3.5 text-slate-400" />{r.contactName}</div>
                          <a href={`tel:${r.contactPhone}`} className="mt-0.5 flex items-center gap-1.5 text-xs text-blue-700 hover:underline"><Phone className="h-3 w-3" />{r.contactPhone}</a>
                          {r.contactRole ? <div className="mt-0.5 text-[11px] text-slate-500">💼 {r.contactRole}</div> : null}
                          {r.contactEmail ? <div className="mt-0.5 text-[11px] text-slate-500 truncate max-w-[200px]">✉️ {r.contactEmail}</div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 break-words max-w-[300px]">{r.companyOrGroupName}</div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-700">
                            <MapPin className="h-3 w-3 text-orange-500 shrink-0" />
                            <b>{r.destination}</b> · 🚩 {r.departureCity} · ⏱ {r.approximateDurationText}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {r.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">🛂</span> : null}
                            {r.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">✈️</span> : null}
                            {r.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">🚌</span> : null}
                            {r.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">🏨 {r.hotelClassRequested || ''}</span> : null}
                            {r.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">🍱</span> : null}
                            {r.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700">🧭</span> : null}
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
                      {isUrgent ? <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase text-rose-700"><AlertTriangle className="h-3 w-3" /> KHẨN</div> : null}
                      {r.internalStaffNote ? <div className="mt-1.5 text-[11px] text-slate-500 italic border-l-2 border-orange-300 pl-2 line-clamp-2">📝 {r.internalStaffNote}</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {r.budgetPerPersonVnd ? <div className="font-black text-orange-600">{formatMoney(r.budgetPerPersonVnd)}đ<span className="text-[10px] font-semibold text-slate-400 ml-1">/ng</span></div> : null}
                      {r.totalBudgetVnd ? <div className="mt-0.5 text-[11px] text-slate-500">Tổng: <span className="font-semibold text-slate-700">{formatMoney(r.totalBudgetVnd)}đ</span></div> : null}
                      {r.lastQuoteSummary ? <div className="mt-1.5 text-[11px] text-emerald-700 border-l-2 border-emerald-300 pl-2 line-clamp-2">💰 {r.lastQuoteSummary}</div> : <div className="mt-1.5 text-[11px] text-rose-600">⚠️ CHƯA GỬI BÁO GIÁ</div>}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase', priority?.chip)}>
                        <span>{priority?.icon || '🔵'}</span><span>{priority?.label || r.priority}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase', statusMeta?.chip)}>
                        <span className={clsx('h-1.5 w-1.5 rounded-full', statusMeta?.dot)} />
                        {statusMeta?.label || r.status}
                      </span>
                      {notMine ? <div className="mt-1 text-[10px] text-amber-700">👷 Nhân viên khác</div> : null}
                      {r.lostReason ? <div className="mt-1 text-[11px] text-rose-600 italic">💔 {r.lostReason}</div> : null}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="text-[11px] text-slate-500 uppercase tracking-wide">Theo dõi</div>
                      <div className="text-xs font-bold text-slate-800">{r.followUpAt ? formatDateTime(r.followUpAt) : '—'}</div>
                      {r.lastContactedAt ? <div className="mt-1 text-[10px] text-slate-400">LH gần: {formatDate(r.lastContactedAt)}</div> : <div className="mt-1 text-[10px] text-amber-700 font-bold">⚠️ CHƯA GỌI LẦN NÀO</div>}
                    </td>
                    <td className="px-3 py-3 align-top pr-4">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <a href={`tel:${r.contactPhone}`} className="inline-flex h-8 items-center gap-1 rounded-xl bg-blue-600 px-3 text-[11px] font-black uppercase text-white hover:bg-blue-700">📞 Gọi</a>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            await patchStaffGroupTourRequest(r._id, { status: 'contacted', lastContactedAt: new Date().toISOString(), followUpAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() })
                            toast.success('✅ Đánh dấu Đã liên hệ. Follow-up tự động: 24h sau.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi. Chỉ được cập nhật yêu cầu được giao cho bạn.') }
                        }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-sky-500 px-3 text-[11px] font-black uppercase text-white hover:bg-sky-600 disabled:opacity-40">👍 Đã LH</button>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            await patchStaffGroupTourRequest(r._id, { status: 'quoting' })
                            toast.success('→ Đang báo giá.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-amber-500 px-3 text-[11px] font-black uppercase text-white hover:bg-amber-600 disabled:opacity-40">💵 Báo giá</button>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            await patchStaffGroupTourRequest(r._id, { status: 'negotiating' })
                            toast.success('→ Đàm phán.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-violet-600 px-3 text-[11px] font-black uppercase text-white hover:bg-violet-700 disabled:opacity-40">🤝 Đàm phán</button>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            await patchStaffGroupTourRequest(r._id, { status: 'won' })
                            toast.success('🏆 Chốt đơn thành công! Vui lòng báo Admin tạo Booking.')
                            await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }} className="inline-flex h-8 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[11px] font-black uppercase text-white hover:bg-emerald-700 disabled:opacity-40">🏆 Chốt</button>
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
        <div className="text-xs text-slate-500">Hiện thị <b>{rows.length}</b> / tổng <b>{total || 0}</b> yêu cầu</div>
        <div className="flex items-center gap-1">
          {(() => {
            const totalPages = Math.max(1, Math.ceil(total / pageSize))
            return (
              <>
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
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
