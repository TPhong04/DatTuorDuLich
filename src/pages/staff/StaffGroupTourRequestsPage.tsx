import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { getStoredUser } from '@/features/auth/auth'
import { formatMoney } from '@/utils/format'
import {
  fetchStaffGroupTourRequests,
  GROUP_TOUR_PRIORITY_META,
  GROUP_TOUR_STATUS_META,
  GroupTourRequest,
  GroupTourRequestPriority,
  GroupTourRequestStatus,
  markStaffGroupTourRequestContacted,
  markStaffGroupTourRequestLost,
  markStaffGroupTourRequestNegotiating,
  markStaffGroupTourRequestQuoting,
  markStaffGroupTourRequestWon,
  totalGroupTourGuests,
} from '@/features/group-tour-requests/group-tour-requests'
import clsx from 'clsx'
import { Users, Phone, Building2, MapPin, CalendarDays, AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { formatDate, formatDateTime } from '@/utils/date'

const TABS = [
  { key: 'mine', label: 'Yêu cầu tôi phụ trách', countOf: null as GroupTourRequestStatus | null, chip: 'bg-indigo-50 text-indigo-700 border border-indigo-200', icon: '🎯' },
  { key: 'new', label: 'Mới cần gọi', countOf: 'new', chip: 'bg-blue-50 text-blue-700 border border-blue-100', icon: '🆕' },
  { key: 'quoting', label: 'Đang báo giá', countOf: 'quoting', chip: 'bg-amber-50 text-amber-700 border border-amber-100', icon: '💵' },
  { key: 'negotiating', label: 'Đàm phán', countOf: 'negotiating', chip: 'bg-violet-50 text-violet-700 border border-violet-100', icon: '🤝' },
  { key: 'urgent', label: '🔴 KHẨN CẤP', countOf: null, chip: 'bg-rose-50 text-rose-700 border border-rose-200', icon: '🚨' },
  { key: 'won', label: 'Đã chốt đơn', countOf: null, chip: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: '🏆' },
  { key: 'all', label: 'Tất cả', countOf: null, chip: 'bg-slate-50 text-slate-700 border border-slate-200', icon: '📋' },
]

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
  const currentStaffId = storedUser?.id
  const tab = (sp.get('tab') || 'mine') as string
  const seeAll = sp.get('all') === '0'
  const statusF: GroupTourRequestStatus | undefined = (tab && TABS.filter((t) => t.countOf && t.key !== 'all' && t.key !== 'mine' && t.key !== 'urgent' && t.key !== 'won').find((t) => t.key === tab)?.countOf) as GroupTourRequestStatus | undefined
  const priorityF: GroupTourRequestPriority | undefined = tab === 'urgent' ? 'urgent' : undefined
  const wonFilter = tab === 'won'
  const mineFilter = tab === 'mine'
  const [search, setSearch] = useState(sp.get('search') || '')
  const [searchDeb, setSearchDeb] = useState(search)
  const [sort, setSort] = useState<'newest' | 'oldest' | 'priority' | 'follow_up'>((sp.get('sort') as any) || 'follow_up')
  const [wonOpen, setWonOpen] = useState<{ row: GroupTourRequest; note: string } | null>(null)
  const [lostOpen, setLostOpen] = useState<{ row: GroupTourRequest; reason: string } | null>(null)
  const [quoteOpen, setQuoteOpen] = useState<{ row: GroupTourRequest; summary: string } | null>(null)
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
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="space-y-5">
      <PageHeader
        subtitle="Danh sách yêu cầu Tour đoàn được quản lý giao cho bạn. Ưu tiên KHẨN CẤP trước, sau đó theo giờ theo dõi Follow-up."
        title="👔 Tour đoàn (Của tôi)"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!seeAll ? (
              <button onClick={() => applySearch({ all: '0', tab: 'all' })} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 text-xs font-black uppercase text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100">🌐 Xem Tất cả (đọc-only)</button>
            ) : (
              <button onClick={() => applySearch({ all: '', tab: 'mine' })} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-indigo-600 px-5 text-xs font-black uppercase text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700">🎯 Xem của tôi</button>
            )}
            <div className="inline-flex h-11 items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-5 text-xs font-black uppercase text-amber-700 ring-1 ring-amber-100">⏰ Cần gọi ngay: <b className="text-rose-700">{pendingMine}</b></div>
            <a href="tel:19001009" className="inline-flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-xs font-black uppercase text-slate-700 hover:bg-slate-50">📞 Hotline</a>
          </div>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-wide text-blue-700">Tổng yêu cầu tôi xử lý</div>
          <div className="mt-2.5 text-4xl font-black text-blue-900 tabular-nums">{totalStats.mine}</div>
          <div className="mt-1 text-[13px] text-slate-500">trong tổng {totalStats.all} yêu cầu hệ thống</div>
        </div>
        <div className="rounded-3xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-wide text-rose-700">🔴 Khẩn cấp</div>
          <div className="mt-2.5 text-4xl font-black text-rose-700 tabular-nums">{totalStats.urgent}</div>
          <div className="mt-1 text-[13px] text-slate-500">Gọi trong 30 phút</div>
        </div>
        <div className="rounded-3xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-wide text-amber-700">Đang báo giá / Đàm phán</div>
          <div className="mt-2.5 text-4xl font-black text-amber-700 tabular-nums">{(totalStats.quoting || 0) + (totalStats.negotiating || 0)}</div>
          <div className="mt-1 text-[13px] text-slate-500">Cập nhật tối thiểu 1 lần/ngày</div>
        </div>
        <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-wide text-emerald-700">🏆 Đã chốt đơn</div>
          <div className="mt-2.5 text-4xl font-black text-emerald-700 tabular-nums">{totalStats.won}</div>
          <div className="mt-1 text-[13px] text-slate-500">Bấm nút "Chốt đơn" để ghi nhận</div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5 2xl:gap-3">
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
      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:grid-cols-12 2xl:px-6">
        <div className="md:col-span-5">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Tìm kiếm (Tên / Công ty / Mã / SĐT / Đích)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm nhanh khách hàng..." className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4" />
        </div>
        <div className="md:col-span-3">
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Sắp xếp</label>
          <select value={sort} onChange={(e) => applySearch({ sort: e.target.value })} className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4">
            <option value="follow_up">⌛ Theo giờ theo dõi (CSKH)</option>
            <option value="priority">🔴 Ưu tiên cao trước</option>
            <option value="newest">🆕 Mới nhất</option>
            <option value="oldest">⏮ Cũ nhất</option>
          </select>
        </div>
        <div className="md:col-span-4 flex items-end gap-2.5">
          <button onClick={() => load()} className="h-11 inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-700 hover:bg-white ring-1 ring-slate-100">🔄 Tải lại</button>
          <button onClick={() => { setSearch(''); setSort('follow_up'); applySearch({ tab: 'mine', page: '1', search: '', sort: 'follow_up' }) }} className="h-11 inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-xs font-black uppercase text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20">↺ Reset</button>
        </div>
      </div>

      <div className={clsx('relative overflow-auto rounded-3xl border border-slate-200 bg-white shadow-sm min-h-[640px]', stale && 'opacity-80 blur-[0.4px] transition')}>
        {initialLoading ? (
          <div className="divide-y divide-slate-100">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="grid grid-cols-[56px_180px_320px_380px_120px_220px_240px_160px_200px_260px_420px] gap-4 px-6 py-5">
                <div className="h-5 w-5 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-12 w-64 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-full animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
                <div className="h-5 w-48 animate-pulse rounded bg-slate-200" />
                <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-7 w-36 animate-pulse rounded bg-slate-200" />
                <div className="h-8 w-52 animate-pulse rounded bg-slate-200" />
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
              <col style={{ minWidth: 380 }} />
              <col style={{ minWidth: 120 }} />
              <col style={{ minWidth: 220 }} />
              <col style={{ minWidth: 240 }} />
              <col style={{ minWidth: 160 }} />
              <col style={{ minWidth: 200 }} />
              <col style={{ minWidth: 260 }} />
              <col style={{ minWidth: 520 }} />
            </colgroup>
            <thead className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white text-[11px] 2xl:text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 text-left w-14">#</th>
                <th className="px-6 py-4 text-left">Mã</th>
                <th className="px-6 py-4 text-left">Liên hệ</th>
                <th className="px-6 py-4 text-left">Công ty / Đoàn + Đích</th>
                <th className="px-6 py-4 text-center">👥 Số khách</th>
                <th className="px-6 py-4 text-left">Ngày đi / Thời gian</th>
                <th className="px-6 py-4 text-left">Ngân sách + Báo giá</th>
                <th className="px-6 py-4 text-left">Ưu tiên</th>
                <th className="px-6 py-4 text-left">Trạng thái</th>
                <th className="px-6 py-4 text-left">Giờ theo dõi</th>
                <th className="px-6 py-4 pr-7 text-right">Hành động nhanh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!rows.length ? (
                <tr><td colSpan={11} className="px-6 py-20 text-center text-base text-slate-400 flex flex-col items-center gap-3">
                  <CheckCircle2 className="h-12 w-12 text-emerald-300" />
                  <div>Không có yêu cầu nào. 🎉 Bạn đã xong hết công việc hôm nay!</div>
                  <button onClick={() => applySearch({ tab: 'all' })} className="mt-2 rounded-2xl bg-indigo-600 px-5 py-2.5 text-xs font-black uppercase text-white shadow-sm shadow-indigo-600/10 hover:bg-indigo-700">Xem toàn bộ để nhận thêm</button>
                </td></tr>
              ) : null}
              {rows.map((r, idx) => {
                const guests = totalGroupTourGuests(r)
                const priority = GROUP_TOUR_PRIORITY_META[r.priority]
                const statusMeta = GROUP_TOUR_STATUS_META[r.status]
                const isUrgent = r.priority === 'urgent'
                const notMine = r.assignedStaffId && String(r.assignedStaffId) !== String(currentStaffId)
                return (
                  <tr key={r._id} className={clsx('hover:bg-blue-50/40 align-top', isUrgent && 'bg-rose-50/10', notMine && 'opacity-70')}>
                    <td className="px-6 py-5 text-slate-400 font-bold text-sm tabular-nums">{(page - 1) * pageSize + idx + 1}</td>
                    <td className="px-6 py-5 font-black text-slate-900 text-[15px] 2xl:text-base whitespace-nowrap font-mono">{r.code}</td>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-lg font-black text-white shadow-sm ring-2 ring-blue-50/80">{r.contactName.slice(0, 1).toUpperCase()}</div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 font-bold text-slate-900 text-[15px] 2xl:text-base truncate"><Users className="h-4 w-4 text-slate-400 shrink-0" />{r.contactName}</div>
                          <a href={`tel:${r.contactPhone}`} className="mt-1 flex items-center gap-2 text-sm text-blue-700 font-bold hover:underline whitespace-nowrap"><Phone className="h-3.5 w-3.5 shrink-0" />{r.contactPhone}</a>
                          {r.contactRole ? <div className="mt-1 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">💼 {r.contactRole}</div> : null}
                          {r.contactEmail ? <div className="mt-1 flex items-center gap-2 text-sm text-slate-500 truncate">✉️ <span className="truncate">{r.contactEmail}</span></div> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="h-5 w-5 mt-0.5 shrink-0 text-blue-600" />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 leading-snug break-words text-[15px] 2xl:text-base">{r.companyOrGroupName}</div>
                          <div className="mt-1.5 flex items-start gap-2 text-xs 2xl:text-[13px] text-slate-700">
                            <MapPin className="h-3.5 w-3.5 mt-0.5 text-orange-500 shrink-0" />
                            <div>
                              <div className="font-bold"><b>Đích:</b> {r.destination}</div>
                              {r.departureCity ? <div className="mt-0.5 text-slate-500 whitespace-nowrap">🚩 Khởi hành từ: {r.departureCity}</div> : null}
                              {r.approximateDurationText ? <div className="mt-0.5 text-slate-500 whitespace-nowrap">⏱ Thời gian: {r.approximateDurationText}</div> : null}
                            </div>
                          </div>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {r.servicesPreference.needVisa ? <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-violet-100 whitespace-nowrap">🛂 Visa</span> : null}
                            {r.servicesPreference.needFlight ? <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-700 ring-1 ring-sky-100 whitespace-nowrap">✈️ Vé máy bay</span> : null}
                            {r.servicesPreference.needBus ? <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100 whitespace-nowrap">🚌 Xe du lịch</span> : null}
                            {r.servicesPreference.needHotel ? <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 ring-1 ring-blue-100 whitespace-nowrap">🏨 KS {r.hotelClassRequested || ''}</span> : null}
                            {r.servicesPreference.needMeals ? <span className="rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 ring-1 ring-orange-100 whitespace-nowrap">🍱 Bữa ăn</span> : null}
                            {r.servicesPreference.needGuide ? <span className="rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 ring-1 ring-teal-100 whitespace-nowrap">🧭 HDV</span> : null}
                          </div>
                          {r.internalStaffNote ? <div className="mt-2.5 text-xs 2xl:text-[13px] text-slate-600 italic border-l-2 border-orange-300 pl-3 line-clamp-3 bg-orange-50/40 py-1.5 pr-2 rounded-r-xl">📝 {r.internalStaffNote}</div> : null}
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
                      {r.lastQuoteSummary ? <div className="mt-2.5 text-sm text-emerald-700 border-l-2 border-emerald-300 pl-3 line-clamp-3 bg-emerald-50/40 py-1.5 pr-2 rounded-r-xl font-semibold">💰 {r.lastQuoteSummary}</div> : <div className="mt-2 text-xs 2xl:text-[13px] text-rose-600 whitespace-nowrap bg-rose-50 rounded-xl px-3 py-1.5 ring-1 ring-rose-100 inline-flex items-center gap-1.5 font-semibold">⚠️ Chưa gửi báo giá</div>}
                      <div className="mt-2 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">Đã báo giá: <b className="text-slate-700">{r.quoteCount}</b> lần</div>
                    </td>
                    <td className="px-6 py-5">
                      <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-xs 2xl:text-[13px] font-black uppercase ring-1', priority?.chip)}>
                        <span className="text-base">{priority?.icon || '🔵'}</span><span>{priority?.label || r.priority}</span>
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <span className={clsx('inline-flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-xs 2xl:text-[13px] font-black uppercase ring-1', statusMeta?.chip)}>
                        <span className={clsx('h-2 w-2 rounded-full', statusMeta?.dot)} />
                        {statusMeta?.label || r.status}
                      </span>
                      {notMine ? <div className="mt-2 text-xs 2xl:text-[13px] text-amber-700 whitespace-nowrap bg-amber-50 rounded-xl px-3 py-1.5 ring-1 ring-amber-100 inline-flex items-center gap-1.5 font-semibold">👷 Nhân viên khác</div> : null}
                      {r.lostReason ? <div className="mt-2 text-xs 2xl:text-[13px] text-rose-600 italic line-clamp-3 bg-rose-50/60 rounded-xl border border-rose-100 px-3 py-1.5 whitespace-pre-wrap">💔 {r.lostReason}</div> : null}
                      {r.convertedBookingId ? <div className="mt-2 text-sm font-black text-emerald-700 whitespace-nowrap bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-100 inline-flex items-center gap-2">✅ → <span className="font-mono">{r.convertedBookingId}</span></div> : null}
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-[11px] 2xl:text-xs text-slate-500 uppercase tracking-wide font-black whitespace-nowrap">Theo dõi kế tiếp</div>
                      <div className="text-sm 2xl:text-[15px] font-bold text-slate-800 mt-1 whitespace-nowrap">{r.followUpAt ? formatDateTime(r.followUpAt) : '—'}</div>
                      {r.lastContactedAt ? <div className="mt-1.5 text-xs 2xl:text-[13px] text-slate-500 whitespace-nowrap">LH gần nhất: {formatDate(r.lastContactedAt)}</div> : <div className="mt-1.5 text-xs 2xl:text-[13px] text-amber-700 whitespace-nowrap bg-amber-50 rounded-xl px-3 py-1.5 ring-1 ring-amber-100 inline-flex items-center gap-1.5 font-semibold">⚠️ Chưa gọi khách</div>}
                    </td>
                    <td className="px-6 py-5 pr-7">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <a href={`tel:${r.contactPhone}`} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-blue-600/10 hover:bg-blue-700 whitespace-nowrap">📞 Gọi</a>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            await markStaffGroupTourRequestContacted(r._id)
                            toast.success('✅ Đánh dấu Đã liên hệ. Giờ theo dõi kế tiếp: +1 ngày.')
                            setStale(true); await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi. Chỉ cập nhật đơn được giao cho bạn.') }
                        }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-sky-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-sky-600/10 hover:bg-sky-700 disabled:opacity-40 whitespace-nowrap">📞 Đã LH</button>
                        <button disabled={notMine} onClick={() => setQuoteOpen({ row: r, summary: r.lastQuoteSummary || '' })} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-40 whitespace-nowrap">💵 Báo giá ({r.quoteCount || 0})</button>
                        <button disabled={notMine} onClick={async () => {
                          try {
                            const res = await markStaffGroupTourRequestNegotiating(r._id, { followUpDays: 2 })
                            toast.success(res.message || '→ Đàm phán. Giờ theo dõi: +2 ngày.')
                            setStale(true); await load()
                          } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
                        }} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-violet-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-violet-600/10 hover:bg-violet-700 disabled:opacity-40 whitespace-nowrap">🤝 Đàm phán</button>
                        <button disabled={notMine} onClick={() => setWonOpen({ row: r, note: '' })} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-emerald-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-emerald-600/10 hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap">✅ Chốt đơn</button>
                        <button disabled={notMine} onClick={() => setLostOpen({ row: r, reason: r.lostReason || '' })} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-rose-600 px-4.5 text-[10px] 2xl:text-xs font-black uppercase text-white shadow-sm shadow-rose-600/10 hover:bg-rose-700 disabled:opacity-40 whitespace-nowrap">❌ Hủy yêu cầu</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {quoteOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-amber-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-amber-600">{quoteOpen.row.code} · {quoteOpen.row.companyOrGroupName}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">💵 Gửi báo giá Tour đoàn</div>
                <div className="mt-1 text-sm text-slate-500">Tự động +1 lần báo giá, trạng thái = Đang báo giá, giờ theo dõi +1 ngày.</div>
              </div>
              <button onClick={() => setQuoteOpen(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">Tóm tắt báo giá (sản phẩm / số tiền / phương án)</label>
            <textarea
              value={quoteOpen.summary}
              onChange={(e) => setQuoteOpen({ ...quoteOpen, summary: e.target.value })}
              rows={6}
              placeholder="VD: Gói 1: VJ Air + Novotel 4* 2 đêm + Xe 45 chỗ + Buffet trưa + English Guide = 7.200.000đ / khách (80 người = 576 triệu VAT)"
              className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4"
            />
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setQuoteOpen(null)} className="h-11 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button onClick={async () => {
                try {
                  const s = quoteOpen.summary.trim()
                  const res = await markStaffGroupTourRequestQuoting(quoteOpen.row._id, { summary: s || undefined, followUpDays: 1 })
                  toast.success(res.message || `✅ Đã gửi báo giá. Hẹn gọi lại 1 ngày.`)
                  setQuoteOpen(null); setStale(true); await load()
                } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
              }} className="h-11 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 text-xs font-black uppercase text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20">💵 Gửi báo giá</button>
            </div>
          </div>
        </div>
      )}

      {wonOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-emerald-600">{wonOpen.row.code} · {wonOpen.row.companyOrGroupName}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">✅ Xác nhận chốt đơn (Booking)</div>
                <div className="mt-1 text-sm text-slate-500">Tự động lưu thời gian chốt đơn wonAt = now. Vui lòng báo Admin tạo Booking chính thức.</div>
              </div>
              <button onClick={() => setWonOpen(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">Ghi chú chốt đơn (khách đồng ý gói nào / hình thức thanh toán / ngày ký hợp đồng)</label>
            <textarea
              value={wonOpen.note}
              onChange={(e) => setWonOpen({ ...wonOpen, note: e.target.value })}
              rows={5}
              placeholder="VD: Khách đồng ý gói 2, chuyển cọc 30% 15/8, ký hợp đồng tại VP 14h thứ 3."
              className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4"
            />
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setWonOpen(null)} className="h-11 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button onClick={async () => {
                try {
                  const res = await markStaffGroupTourRequestWon(wonOpen.row._id, { note: wonOpen.note.trim() || undefined })
                  toast.success(res.message || '🎉 Đã chốt đơn! Vui lòng báo Admin tạo Booking chính thức.')
                  setWonOpen(null); setStale(true); await load()
                } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
              }} className="h-11 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-xs font-black uppercase text-white hover:bg-emerald-700 shadow-sm shadow-emerald-600/10">✅ Xác nhận chốt đơn</button>
            </div>
          </div>
        </div>
      )}

      {lostOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-rose-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-rose-600">{lostOpen.row.code} · {lostOpen.row.companyOrGroupName}</div>
                <div className="mt-1 text-2xl font-black text-slate-900">❌ Hủy yêu cầu (nêu lý do)</div>
                <div className="mt-1 text-sm text-slate-500">Bắt buộc nêu lý do rõ ràng để hỗ trợ thống kê &amp; cải tiến quy trình.</div>
              </div>
              <button onClick={() => setLostOpen(null)} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"><X size={18} /></button>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {['Chọn đối thủ giá rẻ hơn', 'Chọn đối thủ thương hiệu lớn hơn', 'Khách hoãn / huỷ chuyến đi', 'Vượt ngân sách khách hàng', 'Đối thủ có quan hệ cá nhân với KH', 'Không liên hệ lại được'].map((t) => (
                <button key={t} onClick={() => setLostOpen({ ...lostOpen, reason: lostOpen.reason ? (lostOpen.reason + ' · ' + t) : t })} className="inline-flex h-11 items-center rounded-2xl border border-rose-100 bg-rose-50 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap">{t}</button>
              ))}
            </div>
            <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-500">Lý do chi tiết</label>
            <textarea
              value={lostOpen.reason}
              onChange={(e) => setLostOpen({ ...lostOpen, reason: e.target.value })}
              rows={5}
              placeholder="VD: Khách chọn Vietravel giá thấp hơn 6% + tặng balo / móc khóa mỗi khách. Chúng tôi không hạ thêm giá vì đã sát biên lợi nhuận."
              className="mt-1.5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-[15px] 2xl:text-base outline-none ring-blue-50 focus:border-blue-500 focus:ring-4"
            />
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setLostOpen(null)} className="h-11 inline-flex items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Hủy</button>
              <button onClick={async () => {
                const r = lostOpen.reason.trim()
                if (r.length < 2) { toast.warning('Cần nêu lý do tối thiểu 2 ký tự.'); return }
                try {
                  const res = await markStaffGroupTourRequestLost(lostOpen.row._id, { reason: r })
                  toast.success(res.message || '❌ Đã lưu lý do hủy yêu cầu.')
                  setLostOpen(null); setStale(true); await load()
                } catch (err) { toast.error((err as any)?.message || 'Lỗi.') }
              }} className="h-11 inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-5 text-xs font-black uppercase text-white hover:bg-rose-700 shadow-sm shadow-rose-600/10">❌ Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm border border-slate-200">
        <div className="text-sm 2xl:text-[15px] text-slate-500">
          Hiện thị <b className="text-slate-800">{rows.length}</b> / tổng <b className="text-slate-800">{total || 0}</b> yêu cầu
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
