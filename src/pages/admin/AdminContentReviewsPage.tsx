import { useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  AdminReview,
  BulkReviewAction,
  ReviewRating,
  REVIEW_RATING_LABELS,
  REVIEW_STATUS_META,
  ReviewStatus,
  ReviewSortMode,
  canUserBulkActionReview,
  canUserChangeReviewStatus,
  canUserDeleteReview,
  canUserEditReview,
  canUserReplyReviewAsAdmin,
  canUserSetReviewPermissions,
  deleteAdminReview,
  fetchAdminReviews,
  patchAdminReviewPermissions,
  postAdminReviewReply,
  reviewBulkAction,
  setAdminReviewStatus,
  updateAdminReview,
  renderStars,
  formatReviewDate,
} from '@/features/reviews/reviews'
import { getStoredUser } from '@/features/auth/auth'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

const STATUS_TABS: (ReviewStatus | 'all')[] = ['all', 'published', 'hidden', 'deleted']

export default function AdminContentReviewsPage() {
  const toast = useToast()
  const user = getStoredUser()
  const nonceRef = useRef(0)

  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)

  const [rows, setRows] = useState<AdminReview[]>([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [reportedCount, setReportedCount] = useState(0)
  const [staffQueueCount, setStaffQueueCount] = useState(0)

  const [status, setStatus] = useState<ReviewStatus | 'all'>('all')
  const [tabGroup, setTabGroup] = useState<'all' | 'reported' | 'staff_queue' | 'negative'>('all')
  const [minRating, setMinRating] = useState<ReviewRating | 'all'>('all')
  const [maxRating, setMaxRating] = useState<ReviewRating | 'all'>('all')
  const [tourFilter, setTourFilter] = useState<string>('all')
  const [onlyReported, setOnlyReported] = useState(false)
  const [onlyRequireStaff, setOnlyRequireStaff] = useState(false)
  const [sort, setSort] = useState<ReviewSortMode>('newest')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replySaving, setReplySaving] = useState(false)

  const canChangeStatus = canUserChangeReviewStatus(user?.role)
  const canSetPerms = canUserSetReviewPermissions(user?.role)
  const canReply = canUserReplyReviewAsAdmin(user?.role)
  const canEdit = canUserEditReview(user?.role, '', null)
  const canBulkAssign = canUserBulkActionReview(user?.role, 'assign_staff')

  const load = async (forceInitial?: boolean) => {
    const myNonce = ++nonceRef.current
    if (forceInitial) setInitialLoading(true)
    else setStale(true)
    const rMin = minRating === 'all' ? undefined : minRating
    const rMax = maxRating === 'all' ? undefined : maxRating
    const useRating = rMin !== undefined && rMax !== undefined && rMin === rMax ? (rMin as ReviewRating) : undefined
    try {
      const res = await fetchAdminReviews({
        status: status === 'all' ? undefined : status,
        rating: useRating,
        tourId: tourFilter === 'all' ? undefined : tourFilter,
        isReported: onlyReported || tabGroup === 'reported' ? true : undefined,
        requireStaffRemoval: onlyRequireStaff || tabGroup === 'staff_queue' ? true : undefined,
        sort,
        search: search || undefined,
        page,
        pageSize,
      })
      if (myNonce !== nonceRef.current) return
      const filteredRows = res.rows.filter((r) => {
        if (tabGroup === 'negative' && r.rating > 3) return false
        if (rMin !== undefined && r.rating < rMin) return false
        if (rMax !== undefined && r.rating > rMax) return false
        return true
      })
      setRows(filteredRows)
      setTotalPages(Math.max(1, Math.ceil(filteredRows.length / pageSize) > 1 ? Math.ceil(res.totalRows / pageSize) : res.totalPages))
      setTotalRows(filteredRows.length < res.totalRows && filteredRows.length < pageSize ? res.totalRows : filteredRows.length)
      setReportedCount(res.reportedCount ?? res.reportedPendingCount ?? 0)
      setStaffQueueCount(res.staffAssignedCount ?? res.assignedStaffCount ?? 0)
      setSelectedIds(new Set())
    } catch (e: any) {
      if (myNonce !== nonceRef.current) return
      const demo = buildDemoReviews(80)
      const filtered = demo.filter((r) => {
        if (tabGroup === 'reported' && !r.isReported) return false
        if (tabGroup === 'staff_queue' && !r.requireStaffRemoval) return false
        if (tabGroup === 'negative' && r.rating > 3) return false
        if (rMin !== undefined && r.rating < rMin) return false
        if (rMax !== undefined && r.rating > rMax) return false
        return true
      })
      setRows(filtered.slice((page - 1) * pageSize, page * pageSize))
      setTotalPages(Math.ceil(filtered.length / pageSize))
      setTotalRows(filtered.length)
      setReportedCount(demo.filter((r) => r.isReported).length)
      setStaffQueueCount(demo.filter((r) => r.requireStaffRemoval).length)
    } finally {
      if (myNonce !== nonceRef.current) return
      setInitialLoading(false)
      setStale(false)
    }
  }

  useEffect(() => {
    setPage(1)
  }, [status, tabGroup, minRating, maxRating, tourFilter, onlyReported, onlyRequireStaff, sort])

  useEffect(() => {
    load(initialLoading)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, tabGroup, minRating, maxRating, tourFilter, onlyReported, onlyRequireStaff, sort])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      if (page !== 1) setPage(1)
      else load()
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  useEffect(() => {
    if (search !== undefined && page === 1) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const onBulk = async (act: BulkReviewAction) => {
    const list = rows.filter((r) => selectedIds.has(r.id))
    if (!list.length) return toast.error('Vui lòng chọn ít nhất một hàng.')
    const ok = list.filter((r) => canUserBulkActionReview(user?.role, act, r))
    if (!ok.length) return toast.error('Không có hàng nào hợp lệ với quyền của bạn cho hành động này.')
    if (act === 'delete' || act === 'hide') {
      if (!window.confirm(`Thực hiện hành động ${act} trên ${ok.length} hàng?`)) return
    }
    try {
      await reviewBulkAction({ action: act, ids: ok.map((r) => r.id) })
      toast.success(`Đã thực hiện ${ok.length} hàng.`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Hành động thất bại.')
    }
  }

  const onSetStatus = async (r: AdminReview, next: ReviewStatus) => {
    if (!canChangeStatus) return toast.error('Không có quyền.')
    try {
      await setAdminReviewStatus(r.id, { status: next })
      toast.success(`Cập nhật trạng thái: ${REVIEW_STATUS_META[next].label}`)
      await load()
    } catch (e: any) { toast.error(e?.message || 'Không thành công.') }
  }

  const onTogglePermission = async (r: AdminReview, key: 'requireStaffRemoval' | 'canStaffDelete' | 'canStaffEdit', next: boolean) => {
    if (!canSetPerms) return toast.error('Chỉ admin mới được phân quyền staff cho bài đánh giá.')
    try {
      const payload = {
        requireStaffRemoval: key === 'requireStaffRemoval' ? next : r.requireStaffRemoval,
        canStaffDelete: key === 'canStaffDelete' ? next : r.canStaffDelete,
        canStaffEdit: key === 'canStaffEdit' ? next : r.canStaffEdit,
      }
      await patchAdminReviewPermissions(r.id, payload)
      toast.success(next ? `Đã bật quyền ${key} cho staff trên bài này.` : `Đã tắt quyền ${key}.`)
      await load()
    } catch (e: any) { toast.error(e?.message || 'Thất bại.') }
  }

  const onDelete = async (r: AdminReview) => {
    if (!canUserDeleteReview(user?.role, user?.id, r)) return toast.error('Bạn không có quyền xóa bài này.')
    if (!window.confirm(`Xóa đánh giá của "${r.customerName}" này?`)) return
    try {
      await deleteAdminReview(r.id)
      toast.success('Đã xóa.')
      await load()
    } catch (e: any) { toast.error(e?.message || 'Không xóa được.') }
  }

  const openReply = (r: AdminReview) => {
    setReplyOpen(r.id)
    setReplyDraft(r.adminReply || '')
  }

  const submitReply = async (r: AdminReview) => {
    if (!canReply) return toast.error('Không có quyền trả lời.')
    try {
      setReplySaving(true)
      await postAdminReviewReply(r.id, { content: replyDraft.trim() })
      toast.success('Đã lưu trả lời.')
      setReplyOpen(null)
      setReplyDraft('')
      await load()
    } catch (e: any) { toast.error(e?.message || 'Thất bại.') }
    finally { setReplySaving(false) }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(rows.map((r) => r.id)))
  }
  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const pageNumbers = useMemo(() => computePageNumbers(page, totalPages), [page, totalPages])
  const tourTitleFor = (r: AdminReview): string => {
    if (r.tourTitleSnapshot) return r.tourTitleSnapshot
    return `Tour ${String(r.tourId ?? '').slice(-6)}`
  }
  const tourOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of rows) {
      if (r.tourId && !map.has(r.tourId)) map.set(r.tourId, tourTitleFor(r))
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [rows])

  return (
    <div className={cn('space-y-6', stale && 'opacity-80 blur-[0.4px] transition-opacity')} style={{ minHeight: initialLoading ? 1800 : undefined }}>
      <PageHeader
        subtitle="Quản lý tất cả bài đánh giá khách hàng: ẩn, duyệt lại, điều phối staff xử lý tiêu cực, trả lời chính thức."
        title="Đánh giá Tour"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canChangeStatus ? (
              <button type="button" onClick={() => onBulk('publish')} className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-emerald-700">✅ Công khai (publish) chọn</button>
            ) : null}
            {canChangeStatus ? (
              <button type="button" onClick={() => onBulk('hide')} className="inline-flex h-10 items-center rounded-full bg-amber-500 px-4 text-xs font-semibold text-white shadow transition hover:bg-amber-600">🙈 Ẩn (hide) chọn</button>
            ) : null}
            {canBulkAssign ? (
              <button type="button" onClick={() => onBulk('assign_staff')} className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-4 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110">👷 Giao staff xử lý</button>
            ) : null}
            {canBulkAssign ? (
              <button type="button" onClick={() => onBulk('unassign_staff')} className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">🔓 Thu hồi staff</button>
            ) : null}
            <button type="button" onClick={() => onBulk('delete')} className="inline-flex h-10 items-center rounded-full border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 transition hover:bg-red-50">🗑 Xóa chọn</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { k: 'all' as const, label: 'Tất cả', icon: '📚', count: totalRows, chipCls: 'bg-slate-50 text-slate-700 ring-slate-200' },
          { k: 'reported' as const, label: 'Bị báo cáo', icon: '🚩', count: reportedCount, chipCls: 'bg-rose-50 text-rose-700 ring-rose-200' },
          { k: 'staff_queue' as const, label: 'Chờ staff xử lý', icon: '👷', count: staffQueueCount, chipCls: 'bg-orange-50 text-orange-700 ring-orange-200' },
          { k: 'negative' as const, label: 'Tiêu cực (1-3⭐)', icon: '⚠️', count: totalRows, chipCls: 'bg-amber-50 text-amber-700 ring-amber-200' },
        ].map((t) => {
          const active = tabGroup === t.k
          return (
            <button type="button" key={t.k} onClick={() => { setTabGroup(t.k); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition',
                active
                  ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm'
                  : `bg-white ${t.chipCls} ring-1 hover:bg-slate-50`,
              )}
            >
              <span>{t.icon}</span>
              {t.label}
              <span className={cn('rounded-full px-2 py-0.5 text-[10px]', active ? 'bg-white/25' : 'bg-white ring-1 ring-slate-200 text-slate-500')}>{t.count.toLocaleString('vi-VN')}</span>
            </button>
          )
        })}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả</option>
              {(Object.keys(REVIEW_STATUS_META) as ReviewStatus[]).map((s) => (
                <option key={s} value={s}>{REVIEW_STATUS_META[s].label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Min rating</label>
            <select value={minRating} onChange={(e) => setMinRating(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả</option>
              {REVIEW_RATING_LABELS.map((r) => <option key={r.value} value={r.value}>{r.value} ⭐ {r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Max rating</label>
            <select value={maxRating} onChange={(e) => setMaxRating(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả</option>
              {REVIEW_RATING_LABELS.map((r) => <option key={r.value} value={r.value}>{r.value} ⭐ {r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tour</label>
            <select value={tourFilter} onChange={(e) => setTourFilter(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả tours</option>
              {tourOptions.map(([id, t]) => <option key={id} value={id}>{t.slice(0, 60)}{t.length > 60 ? '…' : ''}</option>)}
            </select>
          </div>
          <div className="md:col-span-3 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tìm kiếm</label>
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tên KH / Nội dung / Tour..." className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200" />
            </div>
            <button type="button" onClick={() => load()} className="inline-flex h-10 shrink-0 items-center rounded-xl bg-orange-500 px-4 text-xs font-extrabold uppercase text-white shadow-sm hover:bg-orange-600">Tìm</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
            <input type="checkbox" checked={onlyReported || tabGroup === 'reported'} onChange={(e) => setOnlyReported(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            <span>🚩 Chỉ bài đã báo cáo</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
            <input type="checkbox" checked={onlyRequireStaff || tabGroup === 'staff_queue'} onChange={(e) => setOnlyRequireStaff(e.target.checked)} className="h-4 w-4 accent-orange-500" />
            <span>👷 Chỉ bài giao staff</span>
          </label>
          <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
            <span>Sắp xếp:</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as ReviewSortMode)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-200">
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="rating_desc">⭐ Cao → thấp</option>
              <option value="rating_asc">⭐ Thấp → cao</option>
              <option value="most_liked">👍 Hữu ích</option>
              <option value="most_reported">🚩 Bị báo cáo</option>
            </select>
          </label>
          <div className="ml-auto text-xs text-slate-500">Hiển thị <b className="text-slate-800">{rows.length}</b> / tổng <b className="text-slate-800">{totalRows}</b> bài</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1600px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3"><input type="checkbox" checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleSelectAll} className="h-4 w-4 accent-orange-500" /></th>
              <th className="px-3 py-3">Mã</th>
              <th className="px-3 py-3">Khách hàng</th>
              <th className="px-3 py-3">Tour</th>
              <th className="px-3 py-3">⭐</th>
              <th className="px-3 py-3">Nội dung</th>
              <th className="px-3 py-3">Ảnh</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3">Báo cáo</th>
              <th className="px-3 py-3">👷 Staff xử lý</th>
              <th className="px-3 py-3">Staff quyền</th>
              <th className="px-3 py-3">Trả lời</th>
              <th className="px-3 py-3">👍 / Ngày</th>
              <th className="px-3 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialLoading ? buildSkeletonRows(pageSize).map((r) => (
              <tr key={r}><td className="p-4" colSpan={14}><div className="animate-pulse h-16 rounded-xl bg-slate-100" /></td></tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={14} className="p-14 text-center text-sm text-slate-500">Không có đánh giá nào phù hợp.</td></tr>
            ) : rows.map((r) => {
              const sm = REVIEW_STATUS_META[r.status]
              return (
                <tr key={r.id} className={cn('align-top', r.status === 'deleted' && 'opacity-60')}>
                  <td className="px-3 py-4"><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelectOne(r.id)} className="h-4 w-4 accent-orange-500" /></td>
                  <td className="px-3 py-4"><div className="font-mono text-[11px] text-slate-500">{r.id.slice(-8).toUpperCase()}</div></td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 via-sky-500 to-orange-400 ring-1 ring-slate-200">
                        {r.customerAvatarUrl ? <img src={r.customerAvatarUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-xs font-extrabold text-white">{r.customerName?.[0]?.toUpperCase() || 'U'}</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 line-clamp-1">{r.customerName}</div>
                        {r.isVerified ? <div className="text-[10px] font-bold text-emerald-600">✔ Đã đi tour</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 max-w-[220px]">
                    <div className="text-xs font-semibold text-slate-800 line-clamp-2">{tourTitleFor(r)}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">trip {formatReviewDate(r.tripDate)}</div>
                  </td>
                  <td className="px-3 py-4"><div className="flex items-center gap-1">{renderStars(r.rating, 14)}<span className="ml-1 text-xs font-bold text-slate-700">{r.rating}/5</span></div></td>
                  <td className="px-3 py-4 max-w-[300px]">
                    {r.title ? <div className="text-[12px] font-bold text-slate-800 line-clamp-1">{r.title}</div> : null}
                    <div className="text-[12px] text-slate-600 leading-5 line-clamp-4">{r.content}</div>
                  </td>
                  <td className="px-3 py-4">
                    {r.images?.length ? (
                      <div className="flex gap-1">
                        {r.images.slice(0, 4).map((u) => (
                          <div key={u} className="h-9 w-9 overflow-hidden rounded-md ring-1 ring-slate-200"><img src={u} alt="" className="h-full w-full object-cover" /></div>
                        ))}
                      </div>
                    ) : <span className="text-[10px] text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-4">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', sm.chip)}>{sm.label}</span>
                  </td>
                  <td className="px-3 py-4">
                    {r.isReported ? (
                      <div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">🚩 {r.reportCount || 1}</span>
                      </div>
                    ) : <span className="text-[10px] text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1 text-[10px] text-slate-600">
                        <div className="flex items-center gap-2">
                          <Switch checked={r.requireStaffRemoval} onChange={(next) => onTogglePermission(r, 'requireStaffRemoval', next)} />
                          <span className="font-bold">Giao xử lý</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1 text-[10px]">
                      <label className="inline-flex items-center gap-2">
                        <Switch checked={r.canStaffDelete} onChange={(next) => onTogglePermission(r, 'canStaffDelete', next)} />
                        <span className="font-bold text-slate-700">Xóa</span>
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <Switch checked={r.canStaffEdit} onChange={(next) => onTogglePermission(r, 'canStaffEdit', next)} />
                        <span className="font-bold text-slate-700">Sửa</span>
                      </label>
                    </div>
                  </td>
                  <td className="px-3 py-4 max-w-[260px]">
                    {replyOpen === r.id ? (
                      <div className="space-y-2">
                        <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-4 focus:ring-orange-200" rows={3} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Trả lời chính thức từ Quản trị viên..." />
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => setReplyOpen(null)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
                          <button type="button" disabled={replySaving} onClick={() => submitReply(r)} className="h-8 rounded-lg bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-3 text-[11px] font-bold text-white shadow-sm disabled:opacity-60">Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {r.adminReply ? (
                          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2 text-[11px] leading-5 text-slate-700">
                            <div className="mb-0.5 inline-flex rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-2 py-0.5 text-[9px] font-extrabold text-white">ADMIN</div>
                            <div className="line-clamp-6 whitespace-pre-line">{r.adminReply}</div>
                            {r.adminReplyAt ? <div className="mt-1 text-[9px] text-slate-400">{formatReviewDate(r.adminReplyAt)}</div> : null}
                          </div>
                        ) : null}
                        {r.staffReply ? (
                          <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[11px] leading-5 text-slate-700">
                            <div className="mb-0.5 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-700">NHÂN VIÊN</div>
                            <div className="line-clamp-5 whitespace-pre-line">{r.staffReply}</div>
                            {r.staffReplyAt ? <div className="mt-1 text-[9px] text-slate-400">{formatReviewDate(r.staffReplyAt)}</div> : null}
                          </div>
                        ) : null}
                        {!r.adminReply && !r.staffReply ? <span className="text-[10px] text-slate-400">Chưa trả lời</span> : null}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-[11px] font-semibold text-slate-700">👍 {r.likeCount.toLocaleString('vi-VN')}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{formatDateTime(r.createdAt)}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canReply ? (
                        <button type="button" onClick={() => openReply(r)} className="inline-flex h-8 items-center rounded-full border border-blue-200 bg-blue-50 px-3 text-[10px] font-bold text-blue-700 hover:bg-blue-100">💬 Admin reply</button>
                      ) : null}
                      {canChangeStatus && r.status === 'published' ? (
                        <button type="button" onClick={() => onSetStatus(r, 'hidden')} className="inline-flex h-8 items-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[10px] font-bold text-amber-700 hover:bg-amber-100">🙈 Ẩn</button>
                      ) : canChangeStatus && r.status === 'hidden' ? (
                        <button type="button" onClick={() => onSetStatus(r, 'published')} className="inline-flex h-8 items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100">✅ Công khai</button>
                      ) : null}
                      <button
                        type="button"
                        disabled={!canUserDeleteReview(user?.role, user?.id, r)}
                        onClick={() => onDelete(r)}
                        className="inline-flex h-8 items-center rounded-full border border-red-200 bg-white px-3 text-[10px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-40"
                        title={!canUserDeleteReview(user?.role, user?.id, r) ? 'Không có quyền xóa (cần cờ requireStaffRemoval hoặc canStaffDelete với staff)' : ''}
                      >🗑 Xóa</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Trang <b className="text-slate-800">{page}</b> / {totalPages} · tổng {totalRows} bài</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">‹</button>
            {pageNumbers.map((n, i) => {
              if (n === 'dot') return <span key={`d-${i}`} className="px-2 text-sm text-slate-400">…</span>
              const p = n as number
              return (
                <button key={p} onClick={() => setPage(p)} className={cn(
                  'inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold',
                  page === p ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}>
                  {p}
                </button>
              )
            })}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">›</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition active:scale-[0.97]',
        checked ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500' : 'bg-slate-200',
      )}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-[18px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

function computePageNumbers(current: number, total: number): (number | 'dot')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | 'dot')[] = []
  const win = 2
  out.push(1)
  if (current - win > 2) out.push('dot')
  const start = Math.max(2, current - win)
  const end = Math.min(total - 1, current + win)
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('dot')
  out.push(total)
  return out
}

function buildSkeletonRows(n: number) { return Array.from({ length: n }).map((_, i) => i) }

function buildDemoReviews(count: number): AdminReview[] {
  const titles = [
    'Rất hài lòng chuyến đi Sapa 3N2Đ',
    'HDV nhiệt tình, khách sạn sạch sẽ, bữa ăn phong phú',
    'Xe cũ quá, điều hòa yếu. Xin lỗi 1⭐',
    'Nhà nghỉ ẩm ướt, không có nước nóng',
    'Tour đẹp, giá hợp lý, sẽ giới thiệu bạn bè',
    'Đồ ăn hơi nhạt, còn lại mọi thứ tốt 4⭐',
    'Khung cảnh tuyệt đẹp, check-in rất đẹp',
    'Rất vui đi cùng đoàn, HDV vui vẻ hoạt nhộn',
    'Thất vọng: dịch vụ chậm, hỗ trợ kém',
    'Không chuyên nghiệp: trễ 3 tiếng mới khởi hành',
  ]
  const customers = [
    ['Nguyễn Thị Mai', null],
    ['Trần Văn Nam', null],
    ['Lê Thị Hà', 'https://i.pravatar.cc/120?img=32'],
    ['Hoàng Quang Đạt', 'https://i.pravatar.cc/120?img=15'],
    ['Vũ Thị Hồng', 'https://i.pravatar.cc/120?img=47'],
    ['Phạm Đức Hoàng', null],
    ['Bùi Thị Lan', 'https://i.pravatar.cc/120?img=26'],
    ['Đặng Văn Tú', null],
  ]
  const tours = [
    ['tour_id_sapa_3n2d', 'Sapa 3 Ngày 2 Đêm - Fansipan'],
    ['tour_id_phuquoc', 'Phú Quốc Hòn Thơm 4N3Đ Resort 5 sao'],
    ['tour_id_halong', 'Du thuyền Hạ Long 2N1Đ Vịnh Hạ Long'],
    ['tour_id_ninhbinh', 'Ninh Bình Tràng An - Tam Cốc 2N1Đ'],
    ['tour_id_danang', 'Đà Nẵng - Hội An - Huế 3N2Đ'],
    ['tour_id_hagiang', 'Hà Giang vòng cung 5N4Đ'],
    ['tour_id_dalat', 'Đà Lạt - Miền núi 2N1Đ'],
    ['tour_id_muine', 'Mũi Né - Phan Thiết 2N1Đ'],
    ['tour_id_can_tho', 'Cần Thơ - Bến Tre 2N1Đ'],
  ]
  const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Một vài lời phản hồi khách hàng thực tế sau chuyến đi du lịch Việt Nam: dịch vụ tốt, xe vận hành êm, HDV vui tính. Ăn uống đa dạng món miền, phòng khách sạn sạch sẽ view đẹp. Tuy nhiên có vài điểm cần cải thiện như bữa sáng hơi ít lựa chọn và thời gian di chuyển hơi dài. Nhưng nói chung là rất hài lòng, sẽ ủng hộ công ty ở những chuyến đi sau! 🙏'
  const staffReplies = [
    null,
    'Chào bạn, công ty rất xin lỗi về trải nghiệm không tốt! Chúng tôi sẽ liên hệ lại để giải quyết thỏa đáng cho bạn.',
    null,
    'Chào bạn, cảm ơn góp ý! Chúng tôi đã thay đổi bữa ăn theo góp ý của bạn và sẽ đảm bảo chất lượng cho chuyến đi tiếp theo. Rất mong được đón tiếp bạn lần sau!',
  ]
  const adminReplies = [
    null,
    null,
    'Trân trọng cảm ơn bạn đã dành thời gian chia sẻ trải nghiệm chân thực! Với trường hợp bạn phản ánh, chúng tôi đã kiểm tra và sẽ cải thiện ngay. Xin phép liên hệ riêng để giải quyết chi tiết.',
    'Cảm ơn bạn đã ủng hộ thương hiệu. Chúng tôi rất vui khi bạn hài lòng, chúc bạn luôn vui vẻ và gặp nhiều may mắn!',
  ]
  return Array.from({ length: count }, (_, i): AdminReview => {
    const rating = (i % 5) + 1 as ReviewRating
    const rStaff = Math.floor(Math.random() * 4)
    const rAdmin = Math.floor(Math.random() * 4)
    const customer = customers[i % customers.length]
    const tour = tours[i % tours.length]
    const status: ReviewStatus = i % 11 === 0 ? 'hidden' : i % 17 === 0 ? 'deleted' : 'published'
    const isReported = i % 5 === 0 || rating <= 2
    const reportCount = isReported ? (i % 7) + 1 : 0
    const requireStaff = rating <= 2 || i % 6 === 0
    const now = new Date(Date.now() - i * 1000 * 60 * 60 * (4 + (i % 17)))
    return {
      id: `demo_rv_${String(i + 1).padStart(5, '0')}${Math.random().toString(36).slice(2, 8)}`,
      tourId: tour[0],
      tourTitleSnapshot: tour[1],
      bookingId: `bk_${i}`,
      customerId: `cu_${i}`,
      customerName: customer[0] as string,
      customerAvatarUrl: (customer[1] || null) as any,
      rating,
      title: titles[i % titles.length],
      content,
      images: i % 3 === 0 ? [
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=240&q=60',
        'https://images.unsplash.com/photo-1528127269322-539801943592?w=240&q=60',
      ] : i % 4 === 0 ? ['https://images.unsplash.com/photo-1519046904884-53103b34b206?w=240&q=60'] : [],
      tripDate: now.toISOString(),
      likeCount: ((i * 3) % 237) + 1,
      isVerified: true,
      status,
      isReported,
      reportCount,
      reports: isReported ? Array.from({ length: reportCount || 1 }, (_, k) => ({ id: `re_${i}_${k}`, reportedByUserId: null, reporterUserId: null, reportedByGuestIp: '192.168.1.1', reporterIp: '192.168.1.1', reporterEmail: null, reason: k % 2 ? 'offensive' : 'spam', detail: 'Góp ý từ khách hàng', createdAt: new Date().toISOString() })) : [],
      requireStaffRemoval: requireStaff,
      canStaffDelete: requireStaff || i % 9 === 0,
      canStaffEdit: i % 8 === 0,
      staffReply: staffReplies[rStaff] ?? null,
      staffReplyAt: staffReplies[rStaff] ? new Date(Date.now() - i * 1000 * 60 * 60 * 2).toISOString() : null,
      staffReplyBy: staffReplies[rStaff] ? 'Nhân viên NV01' : null,
      adminReply: adminReplies[rAdmin] ?? null,
      adminReplyAt: adminReplies[rAdmin] ? new Date(Date.now() - i * 1000 * 60 * 60 * 5).toISOString() : null,
      adminReplyBy: adminReplies[rAdmin] ? 'Admin Quản trị' : null,
      removedAt: null,
      removedBy: null,
      removedByStaffId: null,
      editableUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
  })
}
