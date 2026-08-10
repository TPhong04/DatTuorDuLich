import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import { cn } from '@/lib/utils'
import {
  PendingBookingReviewRow,
  PublicReview,
  ReviewRating,
  ReviewSortMode,
  ReviewSummary,
  createCustomerReview,
  fetchMyPendingReviewBookings,
  fetchPublicReviews,
  fetchReviewSummary,
  formatReviewDate,
  likeReviewToggle,
  renderStars,
  reportReview,
  REVIEW_RATING_LABELS,
  starRatingColor,
} from '@/features/reviews/reviews'
import { AuthUser, getStoredUser, isAuthed } from '@/features/auth/auth'

type FilterTab = 'all' | 'with_photo' | '5star' | '4star' | 'bad' | 'most_useful'

const FILTER_TABS: { key: FilterTab; label: string; icon: string }[] = [
  { key: 'all', label: 'Tất cả', icon: '📝' },
  { key: 'with_photo', label: 'Có ảnh', icon: '🖼️' },
  { key: '5star', label: '5 sao', icon: '⭐' },
  { key: '4star', label: '4 sao', icon: '⭐' },
  { key: 'bad', label: 'Tiêu cực (1-3 sao)', icon: '⚠️' },
  { key: 'most_useful', label: 'Hữu ích nhất', icon: '👍' },
]

function ProgressBar({ pct, active }: { pct: number; active: boolean }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100', active && 'ring-1 ring-blue-100')}>
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          active
            ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500'
            : 'bg-slate-300',
        )}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  )
}

export function ReviewsSkeleton({ count = 8 }: { count?: number }) {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-slate-200 to-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-1/4 rounded bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-3.5 w-11/12 rounded bg-slate-200" />
        <div className="h-3.5 w-10/12 rounded bg-slate-100" />
        <div className="h-3.5 w-2/3 rounded bg-slate-100" />
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-4">
        {[0, 1, 2, 3].map((k) => (
          <div key={k} className="aspect-[4/3] rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60" />
        ))}
      </div>
    </div>
  ))
}

export function ReviewReportDialog({
  open,
  onClose,
  reviewId,
  onSuccess,
}: {
  open: boolean
  onClose: () => void
  reviewId: string | null
  onSuccess?: () => void
}) {
  const [reason, setReason] = useState('spam')
  const [detail, setDetail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const toast = useToast()
  useEffect(() => {
    if (!open) return
    setReason('spam')
    setDetail('')
  }, [open, reviewId])
  if (!open || !reviewId) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold text-slate-900">🚩 Báo cáo đánh giá</div>
            <div className="text-xs text-slate-500">Chọn lý do, chúng tôi sẽ xem xét trong vòng 24h.</div>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-600">Lý do báo cáo</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {[
                { k: 'spam', label: 'Spam / Quảng cáo' },
                { k: 'offensive', label: 'Nội dung phản cảm' },
                { k: 'misleading', label: 'Thông tin sai sự thật' },
                { k: 'not_real', label: 'Không phải khách thực tế' },
                { k: 'other', label: 'Lý do khác' },
              ].map((r) => (
                <button
                  key={r.k}
                  type="button"
                  onClick={() => setReason(r.k)}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm text-left transition',
                    reason === r.k
                      ? 'border-orange-400 bg-orange-50 text-orange-800 ring-2 ring-orange-200'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700',
                  )}
                >{r.label}</button>
              ))}
            </div>
          </div>
          <textarea
            className="min-h-[96px] w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-orange-200"
            placeholder="Mô tả chi tiết (tùy chọn)"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-10 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            onClick={onClose}
            disabled={submitting}
          >Hủy</button>
          <button
            type="button"
            className="h-10 rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-5 text-sm font-bold text-white shadow-sm disabled:opacity-70"
            disabled={submitting}
            onClick={async () => {
              try {
                setSubmitting(true)
                await reportReview(reviewId, { reason, detail: detail || null })
                toast.success('Cảm ơn báo cáo, chúng tôi đã ghi nhận!')
                onSuccess?.()
                onClose()
              } catch (e: any) {
                toast.error(String(e?.message || 'Gửi báo cáo không thành công'))
              } finally {
                setSubmitting(false)
              }
            }}
          >Gửi báo cáo</button>
        </div>
      </div>
    </div>
  )
}

export function TourReviewsSection({
  tourId,
  tourSlug,
  tourTitle,
  avgRatingFromTour,
  reviewCountFromTour,
}: {
  tourId: string | null
  tourSlug: string
  tourTitle: string
  avgRatingFromTour: number | null
  reviewCountFromTour: number
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const nonceRef = useRef(0)
  const [user, setUser] = useState<AuthUser | null>(() => (isAuthed() ? getStoredUser() : null))
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [rows, setRows] = useState<PublicReview[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [filterTab, setFilterTab] = useState<FilterTab>('all')
  const [sortMode, setSortMode] = useState<ReviewSortMode>('newest')
  const [searchKeyword, setSearchKeyword] = useState<string>('')
  const [openWrite, setOpenWrite] = useState(false)
  const [reportDialog, setReportDialog] = useState(false)
  const [reportReviewId, setReportReviewId] = useState<string | null>(null)
  const [pendingBookings, setPendingBookings] = useState<PendingBookingReviewRow[]>([])
  const pageSize = 8
  const [formRating, setFormRating] = useState<ReviewRating>(5)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formImages, setFormImages] = useState<string[]>([])
  const [formBookingId, setFormBookingId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [hoverRating, setHoverRating] = useState<number>(0)

  useEffect(() => {
    const handler = () => setUser(isAuthed() ? getStoredUser() : null)
    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [])

  const myBookings = useMemo(
    () => pendingBookings.filter((b) => b.canReview === true && b.tourSlug === tourSlug),
    [pendingBookings, tourSlug],
  )
  const canWriteReviewNow = user?.role === 'customer' && myBookings.length > 0

  async function load(pageIdx: number, tab: FilterTab, sort: ReviewSortMode, keyword: string, force?: boolean) {
    const myNonce = ++nonceRef.current
    if (force) setStale(true)
    let rating: ReviewRating | undefined = undefined
    const onlyWithPhoto = tab === 'with_photo'
    let sortToUse: ReviewSortMode = sort
    if (tab === 'most_useful') sortToUse = 'most_liked'
    if (tab === '5star') rating = 5
    if (tab === '4star') rating = 4

    try {
      const [summaryRes, listRes, myPendingRes] = await Promise.all([
        fetchReviewSummary({ tourId: tourId ?? undefined, tourSlug }),
        fetchPublicReviews({
          tourId: tourId ?? undefined,
          tourSlug,
          rating,
          sort: sortToUse,
          search: keyword || null,
          page: pageIdx,
          pageSize,
        }),
        user?.role === 'customer'
          ? fetchMyPendingReviewBookings({ page: 1, pageSize: 200 }).catch(() => ({
              rows: [] as PendingBookingReviewRow[],
              pendingCount: 0,
              totalRows: 0,
              totalPages: 1,
            }))
          : Promise.resolve({
              rows: [] as PendingBookingReviewRow[],
              pendingCount: 0,
              totalRows: 0,
              totalPages: 1,
            }),
      ])
      if (myNonce !== nonceRef.current) return
      const rowsOut = onlyWithPhoto ? listRes.rows.filter((r) => (r.images?.length || 0) > 0) : listRes.rows
      const totalRowsOut = onlyWithPhoto ? rowsOut.length : listRes.totalRows
      const totalPagesOut = Math.max(1, Math.ceil(totalRowsOut / pageSize))
      setSummary(summaryRes)
      setRows(rowsOut)
      setTotalPages(totalPagesOut)
      setTotalRows(totalRowsOut)
      if (user?.role === 'customer') setPendingBookings(myPendingRes.rows)
    } finally {
      if (myNonce === nonceRef.current) {
        setInitialLoading(false)
        setStale(false)
      }
    }
  }

  useEffect(() => {
    setPage(1)
    load(1, filterTab, sortMode, searchKeyword, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourSlug, tourId])

  useEffect(() => {
    load(page, filterTab, sortMode, searchKeyword, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterTab, sortMode, searchKeyword])

  useEffect(() => {
    if (!openWrite) return
    if (!formBookingId && myBookings[0]) setFormBookingId(myBookings[0].bookingId)
    if (!formBookingId && pendingBookings[0] && pendingBookings[0].tourSlug === tourSlug) setFormBookingId(pendingBookings[0].bookingId)
  }, [openWrite, myBookings, pendingBookings, formBookingId, tourSlug])

  function pages(): JSX.Element[] {
    const total = totalPages
    const current = page
    const numbers: (number | 'dots')[] = []
    const push = (n: number | 'dots') => numbers.push(n)
    const win = 2
    push(1)
    if (current - win > 2) push('dots')
    for (let i = Math.max(2, current - win); i <= Math.min(total - 1, current + win); i++) push(i)
    if (current + win < total - 1) push('dots')
    if (total > 1) push(total)
    return numbers.map((n, i) => {
      if (n === 'dots') return <span key={`dots-${i}`} className="px-2 text-sm text-slate-400">…</span>
      const active = n === current
      return (
        <button
          type="button"
          key={n}
          onClick={() => setPage(n as number)}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold transition',
            active
              ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm'
              : 'bg-white text-slate-700 hover:bg-slate-100 ring-1 ring-slate-200',
          )}
        >
          {n}
        </button>
      )
    })
  }

  const ratingDistribution = summary?.ratingDistribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 }
  const distSum = summary?.totalReviews || 0
  const avg = summary?.avgRating ?? avgRatingFromTour ?? null
  const totalOut = (summary?.totalReviews ?? 0) || totalRows || reviewCountFromTour || 0
  const distPct = (star: number) => (distSum > 0 ? ((ratingDistribution[String(star) as keyof typeof ratingDistribution] || 0) / distSum) * 100 : 0)

  return (
    <section
      id="tour-reviews"
      className={cn(
        'rounded-3xl border border-slate-200 bg-slate-50/60 p-5 md:p-6 shadow-sm transition',
        stale && 'opacity-80 blur-[0.4px] transition-opacity',
      )}
      style={{ minHeight: initialLoading ? 1600 : undefined }}
    >
      <ReviewReportDialog
        open={reportDialog}
        onClose={() => { setReportDialog(false); setReportReviewId(null) }}
        reviewId={reportReviewId}
        onSuccess={() => load(page, filterTab, sortMode, searchKeyword, true)}
      />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xl font-extrabold leading-tight text-slate-900">
            <span className="mr-1">💬</span>
            Đánh giá & Trải nghiệm khách hàng
          </div>
          <div className="mt-0.5 text-xs font-semibold text-slate-500">{tourTitle}</div>
        </div>
        {canWriteReviewNow ? (
          <button
            type="button"
            onClick={() => {
              if (myBookings[0]) setFormBookingId(myBookings[0].bookingId)
              setOpenWrite(true)
            }}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-5 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
          >
            <span className="mr-1.5">⭐</span>Viết đánh giá của bạn
          </button>
        ) : user?.role !== 'customer' ? (
          <Link
            to={`/login?next=/tours/${encodeURIComponent(tourSlug)}#tour-reviews`}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Đăng nhập để viết đánh giá
          </Link>
        ) : (
          <span className="inline-flex h-11 shrink-0 items-center rounded-2xl border border-amber-100 bg-amber-50 px-4 text-xs font-bold text-amber-800">
            ⏳ Bạn cần hoàn thành tour này để được đánh giá nhé!
          </span>
        )}
      </div>

      <div className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-[280px_1fr] shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-baseline gap-2">
            <span className={cn('text-5xl font-black', starRatingColor(avg || 0))}>{avg ? avg.toFixed(1) : '—'}</span>
            <span className="text-xl text-slate-400">/ 5</span>
          </div>
          <div className="mt-2">{renderStars(avg || 0, 22)}</div>
          <div className="mt-2 text-xs font-semibold text-slate-500">{totalOut.toLocaleString('vi-VN')} đánh giá</div>
        </div>
        <div className="content-center space-y-2.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const cnt = (ratingDistribution as Record<string, number>)[String(star)] || 0
            const pct = distPct(star)
            return (
              <button
                key={star}
                type="button"
                onClick={() => {
                  if (star === 5) setFilterTab('5star')
                  else if (star === 4) setFilterTab('4star')
                  else setFilterTab('bad')
                  setPage(1)
                }}
                className="grid w-full grid-cols-[90px_1fr_70px] items-center gap-3 rounded-xl px-2 py-1 text-left hover:bg-slate-50"
              >
                <div className="flex items-center gap-1 text-sm font-bold text-slate-700">
                  {renderStars(star, 14)}
                  <span className="ml-1">{star} sao</span>
                </div>
                <ProgressBar pct={pct} active />
                <div className="text-right text-xs font-semibold text-slate-500">{cnt.toLocaleString('vi-VN')}</div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTER_TABS.map((t) => {
          const active = filterTab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setFilterTab(t.key); setPage(1) }}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3.5 py-2 text-xs font-bold transition',
                active
                  ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow-sm'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50',
              )}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          )
        })}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <input
              className="h-9 w-56 rounded-full border border-slate-200 bg-white pl-9 pr-8 text-xs outline-none focus:ring-4 focus:ring-orange-200"
              placeholder="Tìm trong đánh giá..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load(page, filterTab, sortMode, searchKeyword, true)}
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
            {searchKeyword ? (
              <button
                type="button"
                onClick={() => setSearchKeyword('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >✕</button>
            ) : null}
          </div>
          <select
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:ring-4 focus:ring-orange-200"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as ReviewSortMode)}
          >
            <option value="newest">🆕 Mới nhất</option>
            <option value="rating_desc">⭐ Cao → thấp</option>
            <option value="rating_asc">⭐ Thấp → cao</option>
            <option value="most_liked">👍 Hữu ích</option>
            <option value="most_reported">🚩 Đã báo cáo</option>
          </select>
        </div>
      </div>

      {openWrite ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold text-slate-900">⭐ Viết đánh giá tour</div>
                <div className="text-xs text-slate-500">Cảm ơn bạn đã chia sẻ trải nghiệm cho cộng đồng!</div>
              </div>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100" onClick={() => setOpenWrite(false)}>✕</button>
            </div>
            {myBookings.length > 1 ? (
              <div className="mb-3">
                <div className="mb-1 text-xs font-bold text-slate-600">Chọn đơn hàng đã đi:</div>
                <select
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:ring-4 focus:ring-orange-200"
                  value={formBookingId}
                  onChange={(e) => setFormBookingId(e.target.value)}
                >
                  {myBookings.map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      {b.bookingCode} • Khởi hành {b.departureDate ? formatReviewDate(b.departureDate) : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-bold text-slate-600">Chất lượng tour:</div>
                <div className="flex items-center gap-2 text-4xl">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const iNum = i as ReviewRating
                    const active = (hoverRating || formRating) >= i
                    return (
                      <span
                        key={i}
                        className={cn('cursor-pointer transition-colors', active ? 'text-amber-500 drop-shadow-[0_0_2px_rgba(245,158,11,0.25)]' : 'text-slate-300')}
                        onMouseEnter={() => setHoverRating(i)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setFormRating(iNum)}
                      >★</span>
                    )
                  })}
                  <span className="ml-3 text-sm font-bold text-slate-700">{REVIEW_RATING_LABELS.find((r) => r.value === formRating)?.label}</span>
                </div>
              </div>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:ring-4 focus:ring-orange-200"
                placeholder="Tiêu đề ngắn gọn (ví dụ: Rất hài lòng hướng dẫn viên)"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
              <textarea
                className={cn(
                  'w-full resize-y rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-4',
                  formContent.length >= 10
                    ? 'border-emerald-200 ring-emerald-400/20 focus:ring-emerald-400/40'
                    : 'border-slate-200 ring-orange-400/20 focus:ring-orange-400/40',
                )}
                rows={7}
                minLength={10}
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Chia sẻ chi tiết trải nghiệm của bạn (từ 10 ký tự trở lên). VD: Xe rất mới, HDV nhiệt tình, nhà sạch sẽ, ăn uống phong phú..."
              />
              <div className="text-right text-xs font-bold text-slate-500">
                {formContent.length}/2000
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-slate-600">Ảnh (tối đa 6 ảnh URL, ngăn cách bằng dấu phẩy):</div>
                <textarea
                  className="h-20 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs outline-none focus:ring-4 focus:ring-orange-200"
                  placeholder="https://.../a.jpg, https://.../b.jpg"
                  value={formImages.join(', ')}
                  onChange={(e) => {
                    const val = e.target.value.split(/,/g).map((s) => s.trim()).filter(Boolean)
                    setFormImages(val.slice(0, 6))
                  }}
                />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                className="h-11 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                onClick={() => setOpenWrite(false)}
                disabled={submitting}
              >Hủy</button>
              <button
                type="button"
                className="h-11 rounded-xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-6 text-sm font-bold text-white shadow-sm disabled:opacity-60"
                disabled={submitting || !formBookingId || formContent.length < 10}
                onClick={async () => {
                  try {
                    setSubmitting(true)
                    await createCustomerReview({
                      bookingId: formBookingId,
                      rating: formRating,
                      title: formTitle.trim() || null,
                      content: formContent.trim(),
                      images: formImages.filter(Boolean),
                    })
                    toast.success('Cảm ơn! Đánh giá của bạn đã được đăng công khai!')
                    setOpenWrite(false)
                    setFormTitle('')
                    setFormContent('')
                    setFormImages([])
                    setFormRating(5)
                    load(1, filterTab, sortMode, searchKeyword, true)
                  } catch (err: any) {
                    toast.error(err?.message || 'Gửi đánh giá không thành công. Bạn chỉ được đánh giá tour đã đi xong nhé!')
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? 'Đang gửi...' : '⭐ Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        {initialLoading ? (
          <ReviewsSkeleton count={Math.min(pageSize, 6)} />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <div className="mb-2 text-5xl">📭</div>
            <div className="text-sm font-bold text-slate-700">Chưa có đánh giá nào phù hợp bộ lọc này.</div>
            <div className="mt-1 text-xs text-slate-500">Hãy là người đầu tiên chia sẻ trải nghiệm của bạn!</div>
          </div>
        ) : (
          rows.map((r) => (
            <article key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-500 via-sky-500 to-orange-400 ring-2 ring-white">
                    {r.customerAvatarUrl ? (
                      <img alt={r.customerName} src={r.customerAvatarUrl} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-extrabold text-white">
                        {r.customerName?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-extrabold text-slate-900">{r.customerName}</div>
                      {r.isVerified ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">✔ Đã đi tour</span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      {renderStars(r.rating, 14)}
                      <span className="font-bold text-slate-500">• {formatReviewDate(r.tripDate || r.createdAt)}</span>
                      {r.title ? (
                        <span className="ml-1 rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">{r.title}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!user) return navigate(`/login?next=/tours/${encodeURIComponent(tourSlug)}#tour-reviews`)
                      try {
                        await likeReviewToggle(r.id)
                        toast.success('Cảm ơn đánh giá của bạn!')
                        load(page, filterTab, sortMode, searchKeyword, true)
                      } catch (e: any) {
                        toast.error(e?.message || 'Like không thành công')
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >👍 {r.likeCount.toLocaleString('vi-VN')}</button>
                  <button
                    type="button"
                    onClick={() => { setReportReviewId(r.id); setReportDialog(true) }}
                    className="inline-flex h-8 items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-3 text-xs font-bold text-rose-600 hover:bg-rose-100"
                  >🚩 Báo cáo</button>
                </div>
              </header>
              <p className="mt-3 whitespace-pre-line text-[14px] leading-7 text-slate-700">{r.content}</p>
              {r.images?.length ? (
                <div className="mt-4 grid gap-2 md:grid-cols-6">
                  {r.images.slice(0, 6).map((u) => (
                    <div key={u} className="group aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img alt={r.customerName} src={u} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    </div>
                  ))}
                </div>
              ) : null}
              {r.adminReply ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-orange-50 p-4">
                  <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">👤 Quản trị viên</div>
                  <div className="whitespace-pre-line text-[13px] leading-6 text-slate-700">{r.adminReply}</div>
                  {r.adminReplyAt ? <div className="mt-1 text-[11px] text-slate-400">{formatReviewDate(r.adminReplyAt)}</div> : null}
                </div>
              ) : null}
              {r.staffReply ? (
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-700">💼 Nhân viên hỗ trợ</div>
                  <div className="whitespace-pre-line text-[13px] leading-6 text-slate-700">{r.staffReply}</div>
                  {r.staffReplyAt ? <div className="mt-1 text-[11px] text-slate-400">{formatReviewDate(r.staffReplyAt)}</div> : null}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >‹</button>
          {pages()}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >›</button>
        </div>
      ) : null}
    </section>
  )
}
