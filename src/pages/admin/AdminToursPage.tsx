import { Link, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AdminTour, adminDeleteTour, adminListTours, adminUpdateTour } from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

export default function AdminToursPage() {
  const toast = useToast()
  const [sp, setSp] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminTour[]>([])
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [bulkPublishing, setBulkPublishing] = useState(false)

  const [fQ, setFQ] = useState(sp.get('q') || '')
  const [fStatus, setFStatus] = useState<'all' | 'published' | 'draft'>(
    sp.get('status') === 'published' ? 'published' : sp.get('status') === 'draft' ? 'draft' : 'all'
  )
  const [fRegion, setFRegion] = useState(sp.get('region') || '')

  const reload = useCallback(() => {
    setLoading(true)
    adminListTours()
      .then((r) => setItems(Array.isArray(r.items) ? r.items : []))
      .catch((e) => toast.error((e as any)?.message || 'Không tải được danh sách tour'))
      .finally(() => setLoading(false))
  }, [toast])

  const applySearch = useCallback((next: Partial<Record<string, string>>) => {
    const merged = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(next)) {
      if (v === '' || v === null || v === undefined) merged.delete(k)
      else merged.set(k, String(v))
    }
    setSp(merged, { replace: true })
  }, [sp, setSp])

  useEffect(() => { applySearch({ q: fQ, status: fStatus === 'all' ? '' : fStatus, region: fRegion }) }, [applySearch, fQ, fStatus, fRegion]) // eslint-disable-line

  useEffect(() => {
    reload()
  }, [reload])

  const drafts = useMemo(() => items.filter((t) => !t.isPublished), [items])

  const togglePublish = async (id: string, next: boolean) => {
    if (publishingIds.has(id)) return
    setPublishingIds((prev) => {
      const nextSet = new Set(prev)
      nextSet.add(id)
      return nextSet
    })
    try {
      const saved = await adminUpdateTour(id, { isPublished: next })
      setItems((prev) => prev.map((t) => (t.id === id ? ({ ...t, ...saved, isPublished: next }) as AdminTour : t)))
      toast.success(next ? '✅ Đã xuất bản tour lên trang chủ' : '🔒 Đã ẩn tour khỏi trang chủ (chuyển sang Nháp)')
    } catch (e: any) {
      toast.error((e as any)?.message || 'Không cập nhật được trạng thái tour')
    } finally {
      setPublishingIds((prev) => {
        const nextSet = new Set(prev)
        nextSet.delete(id)
        return nextSet
      })
    }
  }

  const publishAllDrafts = async () => {
    if (!drafts.length) {
      toast.success('💚 Tất cả tour đã ở trạng thái Published, không còn Nháp cần xử lý.')
      return
    }
    const ok = window.confirm(`🚀 Xác nhận Xuất bản TOÀN BỘ ${drafts.length} tour đang bị ẨN (chế độ Nháp) lên trang chủ ngay lập tức?\n\nSau khi xác nhận tất cả các tour này sẽ xuất hiện ở trang chủ FE & trang danh mục /tours.`)
    if (!ok) return
    setBulkPublishing(true)
    let okCount = 0
    let failCount = 0
    for (const t of drafts) {
      try {
        await adminUpdateTour(t.id, { isPublished: true })
        okCount++
      } catch {
        failCount++
      }
    }
    try {
      reload()
    } catch {
      /* ignore */
    }
    if (failCount === 0) {
      toast.success(`🎉 Đã Xuất bản thành công ${okCount}/${drafts.length} tour → F5 trang chủ FE để thấy chúng.`)
    } else {
      toast.warning(`📣 Đã xuất bản ${okCount} tour · thất bại ${failCount} tour. Vui lòng kiểm tra từng tour bị lỗi.`)
    }
    setBulkPublishing(false)
  }

  const filtered = useMemo(() => {
    let arr = items
    if (fStatus === 'published') arr = arr.filter((t) => t.isPublished)
    else if (fStatus === 'draft') arr = arr.filter((t) => !t.isPublished)
    if (fRegion) arr = arr.filter((t) => t.region === fRegion)
    if (fQ && fQ.trim()) {
      const kw = fQ.trim().toLowerCase()
      arr = arr.filter(
        (t) =>
          (t.title || '').toLowerCase().includes(kw) ||
          (t.slug || '').toLowerCase().includes(kw) ||
          (t.code || '').toLowerCase().includes(kw) ||
          Array.isArray(t.highlights) && t.highlights.some((h: string) => h.toLowerCase().includes(kw)),
      )
    }
    return arr
  }, [items, fStatus, fRegion, fQ])

  const regions = useMemo(() => {
    const s = new Set<string>()
    for (const t of items) if (t.region) s.add(t.region)
    return Array.from(s).sort()
  }, [items])

  const rows = useMemo(() => {
    return filtered.map((t) => {
      const nextDepartureDate =
        t.departures
          .map((d) => d.departureDate)
          .filter(Boolean)
          .map((x) => new Date(String(x)).getTime())
          .filter((x) => Number.isFinite(x))
          .sort((a, b) => a - b)[0] ?? null
      return { t, nextDepartureDate }
    })
  }, [filtered])

  return (
    <div className="space-y-5">
      <PageHeader
        title="👔 Quản lý Tours"
        right={
          <Link
            className="inline-flex h-8 items-center justify-center rounded-lg bg-orange-500 px-3 text-sm font-semibold text-white transition hover:bg-orange-600 shadow-sm shadow-orange-500/10"
            to="/admin/tours/new"
          >
            + Tạo tour
          </Link>
        }
      />

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm md:grid-cols-12">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tìm kiếm tour</label>
          <input
            value={fQ}
            onChange={(e) => setFQ(e.target.value)}
            placeholder="Tiêu đề / Mã / Slug / Nổi bật..."
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Trạng thái</label>
          <select
            value={fStatus}
            onChange={(e) => setFStatus(e.target.value as any)}
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2"
          >
            <option value="all">Tất cả</option>
            <option value="published">✅ Đã xuất bản</option>
            <option value="draft">📋 Nháp / Ẩn</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Region / Miền</label>
          <select
            value={fRegion}
            onChange={(e) => setFRegion(e.target.value)}
            className="mt-1 h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-blue-50 focus:border-blue-500 focus:ring-2"
          >
            <option value="">— Tất cả miền —</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="md:col-span-3 flex items-end gap-2">
          <button
            onClick={reload}
            className={cn(
              'h-9 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-white ring-1 ring-slate-100',
              loading && 'opacity-60 pointer-events-none',
            )}
            type="button"
          >
            🔄 {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
          <button
            onClick={() => { setFQ(''); setFStatus('all'); setFRegion('') }}
            className="h-9 inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-3 text-sm font-semibold text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20"
            type="button"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      <div className={cn(
        'rounded-2xl border-2 px-4 py-3 shadow-sm',
        drafts.length
          ? 'border-amber-300 bg-gradient-to-r from-amber-50 via-white to-amber-50/60 ring-1 ring-inset ring-amber-200'
          : 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 ring-1 ring-inset ring-emerald-200',
      )}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4 text-[12px] font-semibold text-slate-800">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 items-center rounded-full bg-emerald-100 px-2.5 text-emerald-800 ring-1 ring-inset ring-emerald-200">
                ✅ Đã xuất bản <b className="ml-1">{items.length - drafts.length}</b> tour
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                'inline-flex h-6 items-center rounded-full px-2.5 ring-1 ring-inset',
                drafts.length
                  ? 'bg-amber-100 text-amber-900 ring-amber-200'
                  : 'bg-slate-100 text-slate-600 ring-slate-200',
              )}>
                📋 Tour đang ẨN (Nháp): <b className="ml-1">{drafts.length}</b> tour
                {drafts.length ? <span className="ml-2 text-[10px] font-bold text-amber-800">→ KHÔNG hiện trên FE</span> : null}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={publishAllDrafts}
              disabled={!drafts.length || bulkPublishing || loading}
              className={cn(
                'inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-lg transition',
                drafts.length && !bulkPublishing
                  ? 'bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 shadow-emerald-500/30 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-600'
                  : 'bg-slate-200 text-slate-500 shadow-none cursor-not-allowed',
              )}
              title={drafts.length ? `Xuất bản ngay ${drafts.length} tour đang ẩn` : 'Tất cả tour đã công khai rồi'}
              type="button"
            >
              {bulkPublishing ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                  Đang publish {drafts.length} tour...
                </>
              ) : drafts.length ? (
                <>
                  📣 Publish TOÀN BỘ {drafts.length} tour draft
                </>
              ) : (
                <>
                  ✅ Tất cả tour đã Published
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-blue-100">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-blue-50 via-white to-blue-50/50 px-4 py-3">
          <div className="text-sm font-semibold tracking-wide text-slate-900">
            📋 Danh sách tour · <b className="text-slate-700">{rows.length}</b> / tổng <b className="text-slate-700">{items.length}</b>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-separate border-spacing-0">
            <thead className="bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-700 text-white text-[11px] font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Tour</th>
                <th className="px-4 py-3">Miền / Region</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Khởi hành sớm nhất</th>
                <th className="px-4 py-3 text-right pr-5">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ t, nextDepartureDate }) => (
                <tr key={t.id} className="transition hover:bg-blue-50/30">
                  <td className="px-4 py-3.5">
                    <div className="font-semibold text-slate-900 line-clamp-1">{t.title}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{t.code ? `${t.code} · /${t.slug}` : `/${t.slug}`}</div>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-700">{t.region || '—'}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
                        t.isPublished
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                          : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200',
                      )}
                    >
                      {t.isPublished ? '✅ Công khai' : '📋 Nháp'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                    {formatDate(nextDepartureDate) || '—'}
                  </td>
                  <td className="px-4 py-3.5 pr-5">
                    <div className="flex justify-end gap-1.5">
                      {t.isPublished ? (
                        <button
                          onClick={() => togglePublish(t.id, false)}
                          disabled={publishingIds.has(t.id)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
                          type="button"
                          title="Ẩn tour khỏi trang chủ FE (chuyển sang chế độ Nháp)"
                        >
                          {publishingIds.has(t.id) ? '↻ Đang ẩn...' : '🔒 Ẩn'}
                        </button>
                      ) : (
                        <button
                          onClick={() => togglePublish(t.id, true)}
                          disabled={publishingIds.has(t.id)}
                          className="inline-flex h-8 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700 ring-1 ring-inset ring-emerald-300 transition hover:bg-emerald-100 whitespace-nowrap disabled:opacity-50 disabled:cursor-wait shadow-sm shadow-emerald-500/10"
                          type="button"
                          title="Xuất bản ngay tour này lên trang chủ FE"
                        >
                          {publishingIds.has(t.id) ? '↻ Đang publish...' : '📣 Xuất bản'}
                        </button>
                      )}
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-blue-50 hover:border-blue-200 whitespace-nowrap"
                        to={`/admin/tours/${t.id}/edit`}
                      >
                        ✏️ Sửa
                      </Link>
                      <Link
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-blue-50 whitespace-nowrap"
                        target="_blank"
                        to={`/tours/${t.slug}`}
                      >
                        🔗 Xem FE
                      </Link>
                      <button
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-orange-50 px-2.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 transition hover:bg-orange-100 whitespace-nowrap"
                        onClick={async () => {
                          const ok = window.confirm(`Xác nhận xóa tour "${t.title}"?`)
                          if (!ok) return
                          try {
                            await adminDeleteTour(t.id)
                            toast.success('Đã xóa tour.')
                            reload()
                          } catch (e) {
                            toast.error((e as any)?.message || 'Xóa tour thất bại')
                          }
                        }}
                        type="button"
                      >
                        🗑 Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && !loading ? (
                <tr>
                  <td className="px-4 py-16 text-center text-sm text-slate-500" colSpan={5}>
                    Không có tour nào thỏa điều kiện lọc. Vui lòng thay đổi bộ lọc hoặc tạo tour mới.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
