import { useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  AdminReview,
  ReviewRating,
  REVIEW_RATING_LABELS,
  REVIEW_STATUS_META,
  ReviewStatus,
  ReviewSortMode,
  canUserBulkActionReview,
  canUserDeleteReview,
  canUserReplyReviewAsStaff,
  deleteStaffReview,
  fetchStaffReviews,
  postStaffReviewReply,
  renderStars,
  formatReviewDate,
} from '@/features/reviews/reviews'
import { getStoredUser } from '@/features/auth/auth'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

type StaffTab = 'assigned_queue' | 'all_readonly'

export default function StaffContentReviewsPage() {
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
  const [assignedCount, setAssignedCount] = useState(0)

  const [status, setStatus] = useState<ReviewStatus | 'all'>('all')
  const [tab, setTab] = useState<StaffTab>('assigned_queue')
  const [onlyMine, setOnlyMine] = useState<boolean>(true)
  const [ratingMin, setRatingMin] = useState<ReviewRating | 'all'>('all')
  const [ratingMax, setRatingMax] = useState<ReviewRating | 'all'>('all')
  const [onlyReported, setOnlyReported] = useState(false)
  const [sort, setSort] = useState<ReviewSortMode>('newest')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [replyOpen, setReplyOpen] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replySaving, setReplySaving] = useState(false)

  const canStaffReply = canUserReplyReviewAsStaff(user?.role)

  const load = async (forceInitial?: boolean) => {
    const myNonce = ++nonceRef.current
    if (forceInitial) setInitialLoading(true)
    else setStale(true)
    const rMin = ratingMin === 'all' ? undefined : ratingMin
    const rMax = ratingMax === 'all' ? undefined : ratingMax
    const useRating = rMin !== undefined && rMax !== undefined && rMin === rMax ? (rMin as ReviewRating) : undefined
    try {
      const res = await fetchStaffReviews({
        status: status === 'all' ? undefined : status,
        rating: useRating,
        isReported: onlyReported ? true : undefined,
        onlyMine: tab === 'assigned_queue' || onlyMine ? true : undefined,
        requireStaffRemoval: tab === 'assigned_queue' ? true : undefined,
        sort,
        search: search || undefined,
        page,
        pageSize,
      })
      if (myNonce !== nonceRef.current) return
      const filtered = res.rows.filter((r) => {
        if (rMin !== undefined && r.rating < rMin) return false
        if (rMax !== undefined && r.rating > rMax) return false
        return true
      })
      setRows(filtered)
      setTotalPages(Math.max(1, res.totalPages))
      setTotalRows(filtered.length < res.totalRows && filtered.length < pageSize ? res.totalRows : filtered.length)
      setAssignedCount(res.staffAssignedCount ?? res.assignedStaffCount ?? 0)
    } catch (e: any) {
      if (myNonce !== nonceRef.current) return
      const demoAll = buildDemoReviews(60)
      let demo = tab === 'assigned_queue' ? demoAll.filter((r) => r.requireStaffRemoval || r.canStaffDelete) : demoAll
      if (onlyMine && tab !== 'assigned_queue') demo = demo.filter((r) => r.requireStaffRemoval || r.canStaffDelete)
      const filtered = demo.filter((r) => {
        if (rMin !== undefined && r.rating < rMin) return false
        if (rMax !== undefined && r.rating > rMax) return false
        return true
      })
      setRows(filtered.slice((page - 1) * pageSize, page * pageSize))
      setTotalPages(Math.ceil(filtered.length / pageSize))
      setTotalRows(filtered.length)
      setAssignedCount(demoAll.filter((r) => r.requireStaffRemoval || r.canStaffDelete).length)
    } finally {
      if (myNonce !== nonceRef.current) return
      setInitialLoading(false)
      setStale(false)
    }
  }

  useEffect(() => { setPage(1) }, [tab, status, ratingMin, ratingMax, onlyMine, onlyReported, sort])
  useEffect(() => { load(initialLoading) }, [page, tab, status, ratingMin, ratingMax, onlyMine, onlyReported, sort]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      if (page !== 1) setPage(1)
      else load()
    }, 250)
    return () => clearTimeout(t)
  }, [searchInput]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (search !== undefined && page === 1) load() }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const onBulkDelete = async () => {
    const list = rows.filter((r) => r.requireStaffRemoval || r.canStaffDelete)
    if (!list.length) return toast.error('Không có bài nào được giao bạn xóa trong hàng đã chọn.')
    if (!canUserBulkActionReview(user?.role, 'delete')) return toast.error('Không có quyền bulk delete.')
    if (!window.confirm(`Xóa ${list.length} bài đã giao cho bạn xử lý?`)) return
    try {
      await Promise.all(list.map((r) => deleteStaffReview(r.id)))
      toast.success(`Đã xử lý xong ${list.length} bài.`)
      await load()
    } catch (e: any) { toast.error(e?.message || 'Lỗi.') }
  }

  const onDelete = async (r: AdminReview) => {
    if (!canUserDeleteReview(user?.role, user?.id, r)) return toast.error('Admin chưa giao quyền xóa bài này cho bạn. Cần cờ "requireStaffRemoval" hoặc "canStaffDelete" được bật.')
    if (!window.confirm(`Xóa bài đánh giá này (được admin giao xử lý)?`)) return
    try {
      await deleteStaffReview(r.id)
      toast.success('Đã xử lý xóa bài.')
      await load()
    } catch (e: any) { toast.error(e?.message || 'Không xóa được.') }
  }

  const openReply = (r: AdminReview) => {
    setReplyOpen(r.id)
    setReplyDraft(r.staffReply || '')
  }

  const submitReply = async (r: AdminReview) => {
    if (!canStaffReply) return toast.error('Không có quyền.')
    try {
      setReplySaving(true)
      await postStaffReviewReply(r.id, { content: replyDraft.trim() })
      toast.success('Đã lưu trả lời staff.')
      setReplyOpen(null)
      setReplyDraft('')
      await load()
    } catch (e: any) { toast.error(e?.message || 'Thất bại.') }
    finally { setReplySaving(false) }
  }

  const pageNumbers = useMemo(() => computePageNumbers(page, totalPages), [page, totalPages])
  const tourTitleFor = (r: AdminReview): string => {
    if (r.tourTitleSnapshot) return r.tourTitleSnapshot
    return `Tour ${String(r.tourId ?? '').slice(-6)}`
  }

  return (
    <div className={cn('space-y-6', stale && 'opacity-80 blur-[0.4px] transition-opacity')} style={{ minHeight: initialLoading ? 1800 : undefined }}>
      <PageHeader
        subtitle="Xem & xử lý các bài đánh giá tiêu cực / phản cảm được admin giao cho bạn. Bạn chỉ được sửa/xóa những bài đã được admin bật cờ."
        title="Đánh giá (Staff)"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={onBulkDelete} className="inline-flex h-10 items-center rounded-full border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 transition hover:bg-red-50">🗑 Xóa bài đã giao (bulk)</button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { k: 'assigned_queue' as StaffTab, label: 'Bài admin giao xử lý', icon: '👷', count: assignedCount, badge: 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white' },
          { k: 'all_readonly' as StaffTab, label: 'Tất cả (chỉ xem)', icon: '👀', count: totalRows, badge: 'bg-white ring-1 ring-slate-200 text-slate-700' },
        ].map((t) => {
          const active = tab === t.k
          return (
            <button type="button" key={t.k} onClick={() => { setTab(t.k); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition',
                active
                  ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <span>{t.icon}</span>
              {t.label}
              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', active ? 'bg-white/25' : t.badge)}>{t.count.toLocaleString('vi-VN')}</span>
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
              {(Object.keys(REVIEW_STATUS_META) as ReviewStatus[]).map((s) => <option key={s} value={s}>{REVIEW_STATUS_META[s].label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Min</label>
            <select value={ratingMin} onChange={(e) => setRatingMin(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả</option>
              {REVIEW_RATING_LABELS.map((r) => <option key={r.value} value={r.value}>{r.value} ⭐ {r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Max</label>
            <select value={ratingMax} onChange={(e) => setRatingMax(e.target.value as any)} className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200">
              <option value="all">Tất cả</option>
              {REVIEW_RATING_LABELS.map((r) => <option key={r.value} value={r.value}>{r.value} ⭐ {r.label}</option>)}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <label className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
              <input type="checkbox" checked={onlyMine || tab === 'assigned_queue'} disabled={tab === 'assigned_queue'} onChange={(e) => setOnlyMine(e.target.checked)} className="h-4 w-4 accent-orange-500 disabled:opacity-50" />
              <span>👷 Chỉ bài giao cho tôi</span>
            </label>
          </div>
          <div className="md:col-span-4 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Tìm</label>
              <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tên KH / Nội dung..." className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:ring-4 focus:ring-orange-200" />
            </div>
            <label className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
              <input type="checkbox" checked={onlyReported} onChange={(e) => setOnlyReported(e.target.checked)} className="h-4 w-4 accent-orange-500" />
              <span>🚩 Report</span>
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as ReviewSortMode)} className="h-10 rounded-xl border border-slate-200 px-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-orange-200">
              <option value="newest">Mới</option>
              <option value="rating_asc">⭐ thấp</option>
              <option value="most_reported">🚩 nhiều</option>
            </select>
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500">Hiển thị <b className="text-slate-800">{rows.length}</b> / <b className="text-slate-800">{totalRows}</b> bài.</div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[1400px] text-left text-xs">
          <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-3 w-14">Mã</th>
              <th className="px-3 py-3">Khách</th>
              <th className="px-3 py-3">Tour</th>
              <th className="px-3 py-3">⭐</th>
              <th className="px-3 py-3">Nội dung</th>
              <th className="px-3 py-3">Trạng thái</th>
              <th className="px-3 py-3">🚩 Report</th>
              <th className="px-3 py-3">👷 Quyền bạn có</th>
              <th className="px-3 py-3">Staff Reply</th>
              <th className="px-3 py-3">👍 / Ngày</th>
              <th className="px-3 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {initialLoading ? Array.from({ length: pageSize }).map((_, i) => (
              <tr key={i}><td colSpan={11} className="p-4"><div className="animate-pulse h-16 rounded-xl bg-slate-100" /></td></tr>
            )) : rows.length === 0 ? (
              <tr><td colSpan={11} className="p-14 text-center text-sm text-slate-500">Trống. Chưa có bài nào admin giao cho bạn xử lý.</td></tr>
            ) : rows.map((r) => {
              const sm = REVIEW_STATUS_META[r.status]
              const canDel = canUserDeleteReview(user?.role, user?.id, r)
              return (
                <tr key={r.id} className="align-top">
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
                  <td className="px-3 py-4 max-w-[320px]">
                    {r.title ? <div className="text-[12px] font-bold text-slate-800 line-clamp-1">{r.title}</div> : null}
                    <div className="text-[12px] text-slate-600 leading-5 line-clamp-5">{r.content}</div>
                    {r.images?.length ? (
                      <div className="mt-2 flex gap-1">
                        {r.images.slice(0, 4).map((u) => <div key={u} className="h-9 w-9 overflow-hidden rounded-md ring-1 ring-slate-200"><img src={u} alt="" className="h-full w-full object-cover" /></div>)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-4"><span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold', sm.chip)}>{sm.label}</span></td>
                  <td className="px-3 py-4">{r.isReported ? <span className="inline-flex rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 ring-1 ring-rose-200">🚩 {r.reportCount || 1}</span> : <span className="text-[10px] text-slate-400">—</span>}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-col gap-1 text-[10px] font-bold">
                      <div className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 ring-1', r.requireStaffRemoval ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white ring-orange-200' : 'bg-slate-50 text-slate-400 ring-slate-200')}>
                        <span>👷</span> {r.requireStaffRemoval ? 'ĐÃ GIAO XỬ LÝ' : 'CHƯA GIAO'}
                      </div>
                      <div className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 ring-1', r.canStaffDelete ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-slate-50 text-slate-400 ring-slate-200')}>
                        🗑 {r.canStaffDelete ? 'CÓ THỂ XÓA' : 'KHÔNG ĐƯỢC XÓA'}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 max-w-[240px]">
                    {replyOpen === r.id ? (
                      <div className="space-y-2">
                        <textarea className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-4 focus:ring-orange-200" rows={3} value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Trả lời thay mặt đội ngũ nhân viên hỗ trợ..." />
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => setReplyOpen(null)} className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Hủy</button>
                          <button type="button" disabled={replySaving} onClick={() => submitReply(r)} className="h-8 rounded-lg bg-slate-800 px-3 text-[11px] font-bold text-white shadow-sm disabled:opacity-60">Lưu</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        {r.adminReply ? (
                          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2 text-[11px] leading-5 text-slate-700">
                            <div className="mb-0.5 inline-flex rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-2 py-0.5 text-[9px] font-extrabold text-white">ADMIN</div>
                            <div className="line-clamp-4 whitespace-pre-line">{r.adminReply}</div>
                          </div>
                        ) : null}
                        {r.staffReply ? (
                          <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-[11px] leading-5 text-slate-700">
                            <div className="mb-0.5 inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-700">NHÂN VIÊN</div>
                            <div className="line-clamp-5 whitespace-pre-line">{r.staffReply}</div>
                          </div>
                        ) : <span className="text-[10px] text-slate-400">Chưa trả lời</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-[11px] font-semibold text-slate-700">👍 {r.likeCount.toLocaleString('vi-VN')}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{formatDateTime(r.createdAt)}</div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {canStaffReply ? (
                        <button type="button" onClick={() => openReply(r)} className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-slate-700 hover:bg-slate-100">💬 Staff reply</button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onDelete(r)}
                        disabled={!canDel}
                        className={cn(
                          'inline-flex h-8 items-center rounded-full px-3 text-[10px] font-bold',
                          canDel ? 'border border-red-200 bg-white text-red-700 hover:bg-red-50' : 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed',
                        )}
                        title={!canDel ? 'Admin chưa bật cờ giao xử lý (requireStaffRemoval / canStaffDelete).' : ''}
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
          <div className="text-xs text-slate-500">Trang <b className="text-slate-800">{page}</b> / {totalPages} · tổng {totalRows}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">‹</button>
            {pageNumbers.map((n, i) => {
              if (n === 'dot') return <span key={`d-${i}`} className="px-2 text-sm text-slate-400">…</span>
              const p = n as number
              return (
                <button key={p} onClick={() => setPage(p)} className={cn(
                  'inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold',
                  page === p ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                )}>{p}</button>
              )
            })}
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40">›</button>
          </div>
        </div>
      ) : null}
    </div>
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

function buildDemoReviews(count: number): AdminReview[] {
  const titles = [
    'Rất hài lòng chuyến đi Sapa 3N2Đ',
    'HDV vui vẻ hoạt nhộn, ăn uống ngon',
    'Thất vọng: Xe cũ, điều hòa yếu',
    'Nhà nghỉ ẩm ướt, không có nước nóng',
    'Tour đẹp, giá hợp lý',
    'Đồ ăn hơi nhạt, còn lại tốt',
    'Khung cảnh tuyệt đẹp, check-in đẹp',
    'Không chuyên nghiệp: trễ 3 tiếng',
  ]
  const customers = [
    ['Nguyễn Thị Mai', null], ['Trần Văn Nam', null],
    ['Lê Thị Hà', 'https://i.pravatar.cc/120?img=32'],
    ['Hoàng Quang Đạt', 'https://i.pravatar.cc/120?img=15'],
    ['Phạm Đức Hoàng', null], ['Bùi Thị Lan', 'https://i.pravatar.cc/120?img=26'],
  ]
  const tours = [
    ['t1', 'Sapa 3 Ngày 2 Đêm - Fansipan'],
    ['t2', 'Phú Quốc Hòn Thơm 4N3Đ Resort 5 sao'],
    ['t3', 'Du thuyền Hạ Long 2N1Đ Vịnh Hạ Long'],
    ['t4', 'Ninh Bình Tràng An - Tam Cốc 2N1Đ'],
    ['t5', 'Đà Nẵng - Hội An - Huế 3N2Đ'],
    ['t6', 'Hà Giang vòng cung 5N4Đ'],
    ['t7', 'Đà Lạt 2N1Đ - Miền núi'],
  ]
  const content = 'Một vài lời phản hồi thực tế sau chuyến đi: dịch vụ tốt, xe êm, HDV vui tính. Ăn uống đa dạng món miền, phòng khách sạn sạch sẽ view đẹp. Nhưng vài điểm cần cải thiện như bữa sáng hơi ít lựa chọn và thời gian di chuyển hơi dài. Hài lòng tổng thể!'
  return Array.from({ length: count }, (_, i): AdminReview => {
    const rating = (i % 5) + 1 as ReviewRating
    const rS = Math.floor(Math.random() * 4)
    const rA = Math.floor(Math.random() * 4)
    const customer = customers[i % customers.length]
    const tour = tours[i % tours.length]
    const status: ReviewStatus = i % 13 === 0 ? 'hidden' : 'published'
    const isReported = i % 4 === 0 || rating <= 2
    const reportCount = isReported ? (i % 6) + 1 : 0
    const requireStaff = rating <= 2 || i % 5 === 0
    const now = new Date(Date.now() - i * 1000 * 60 * 60 * (4 + (i % 15)))
    const staffReplies = [null, 'Chào bạn, team chúng tôi rất xin lỗi về trải nghiệm! Chúng tôi sẽ liên hệ riêng để giải quyết chi tiết.', null, 'Cảm ơn bạn đã góp ý chân thực. Chúng tôi cải thiện ngay!']
    const adminReplies = [null, null, 'Cảm ơn phản hồi, chúng tôi đã ghi nhận và xử lý!', 'Rất vui bạn hài lòng!']
    return {
      id: `demo_staff_${String(i + 1).padStart(5, '0')}${Math.random().toString(36).slice(2, 8)}`,
      tourId: tour[0],
      tourTitleSnapshot: tour[1],
      bookingId: `bk_${i}`,
      customerId: `cu_${i}`,
      customerName: customer[0] as string,
      customerAvatarUrl: customer[1] as any,
      rating,
      title: titles[i % titles.length],
      content,
      images: i % 4 === 0 ? ['https://images.unsplash.com/photo-1519681393784-d120267933ba?w=240&q=60'] : [],
      tripDate: now.toISOString(),
      likeCount: ((i * 5) % 311) + 1,
      isVerified: true,
      status,
      isReported,
      reportCount,
      reports: [],
      requireStaffRemoval: requireStaff,
      canStaffDelete: requireStaff || i % 7 === 0,
      canStaffEdit: i % 11 === 0,
      staffReply: staffReplies[rS] ?? null,
      staffReplyAt: staffReplies[rS] ? new Date(Date.now() - i * 1000 * 60 * 60 * 3).toISOString() : null,
      staffReplyBy: staffReplies[rS] ? 'NV01 - Nhân viên' : null,
      adminReply: adminReplies[rA] ?? null,
      adminReplyAt: adminReplies[rA] ? new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString() : null,
      adminReplyBy: adminReplies[rA] ? 'Admin Quản trị' : null,
      removedAt: null, removedBy: null, removedByStaffId: null,
      editableUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
  })
}
