import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  AdminPost,
  PostCategory,
  PostCreatePayload,
  PostStatus,
  POST_CATEGORY_META,
  POST_STATUS_META,
  canUserCreatePost,
  canUserDeletePost,
  canUserEditPost,
  canUserImportRss,
  canUserPublishPost,
  canUserSetPostPermissions,
  createAdminPost,
  deleteAdminPost,
  fetchAdminPosts,
  importAdminPostRss,
  setAdminPostPermissions,
  setAdminPostStatus,
  updateAdminPost,
} from '@/features/posts/posts'
import { getStoredUser } from '@/features/auth/auth'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

const STATUS_TABS: (PostStatus | 'all')[] = ['all', 'pending', 'published', 'scheduled', 'draft']
const CATEGORY_TABS: (PostCategory | 'all')[] = ['all', 'promotion', 'experience', 'tour_launch', 'company', 'culture', 'guide']

export default function AdminContentPostsPage() {
  const toast = useToast()
  const user = getStoredUser()

  const nonceRef = useRef(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)

  const [rows, setRows] = useState<AdminPost[]>([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRows, setTotalRows] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  const [status, setStatus] = useState<PostStatus | 'all'>('all')
  const [category, setCategory] = useState<PostCategory | 'all'>('all')
  const [authorId, setAuthorId] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [rssLoading, setRssLoading] = useState(false)

  const [fTitle, setFTitle] = useState('')
  const [fSlug, setFSlug] = useState('')
  const [fCategory, setFCategory] = useState<PostCategory>('experience')
  const [fStatus, setFStatus] = useState<PostStatus>('draft')
  const [fTags, setFTags] = useState('')
  const [fExcerpt, setFExcerpt] = useState('')
  const [fContent, setFContent] = useState('')
  const [fCover, setFCover] = useState('')
  const [fSeoTitle, setFSeoTitle] = useState('')
  const [fSeoDesc, setFSeoDesc] = useState('')
  const [fScheduledAt, setFScheduledAt] = useState('')
  const [fPinned, setFPinned] = useState(false)
  const [fSourceUrl, setFSourceUrl] = useState('')
  const [fSourceName, setFSourceName] = useState('')

  const canCreate = canUserCreatePost(user?.role)
  const canPublish = canUserPublishPost(user?.role)
  const canSetPerms = canUserSetPostPermissions(user?.role)
  const canImportRss = canUserImportRss(user?.role)

  const load = async (opts?: { forceInitial?: boolean }) => {
    const myNonce = ++nonceRef.current
    if (opts?.forceInitial) setInitialLoading(true)
    else setStale(true)
    try {
      const res = await fetchAdminPosts({ status, category, authorId: authorId === 'all' ? undefined : authorId, search, page, pageSize })
      if (myNonce !== nonceRef.current) return
      setRows(res.rows)
      setTotalPages(res.totalPages)
      setTotalRows(res.totalRows)
      setPendingCount(res.pendingCount ?? 0)
      setSelectedIds(new Set())
    } catch (e: any) {
      if (myNonce !== nonceRef.current) return
      const demo = buildDemoAdminPosts(pageSize)
      setRows(demo.slice((page - 1) * pageSize, page * pageSize))
      setTotalPages(Math.ceil(demo.length / pageSize))
      setTotalRows(demo.length)
      setPendingCount(demo.filter((x) => x.status === 'pending').length)
    } finally {
      if (myNonce !== nonceRef.current) return
      setInitialLoading(false)
      setStale(false)
    }
  }

  useEffect(() => {
    load({ forceInitial: true })
  }, [status, category, authorId, page, pageSize])

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      if (page !== 1) setPage(1)
      else load()
    }, 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    if (search !== undefined && page === 1) load()
  }, [search])

  const resetForm = () => {
    setEditingId(null)
    setFTitle('')
    setFSlug('')
    setFCategory('experience')
    setFStatus(user?.role === 'admin' ? 'draft' : 'pending')
    setFTags('')
    setFExcerpt('')
    setFContent('')
    setFCover('')
    setFSeoTitle('')
    setFSeoDesc('')
    setFScheduledAt('')
    setFPinned(false)
    setFSourceUrl('')
    setFSourceName('')
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (p: AdminPost) => {
    setEditingId(p.id)
    setFTitle(p.title)
    setFSlug(p.slug)
    setFCategory(p.category)
    setFStatus(p.status)
    setFTags((p.tags ?? []).join(', '))
    setFExcerpt(p.excerpt ?? '')
    setFContent(p.content ?? '')
    setFCover(p.coverImageUrl ?? '')
    setFSeoTitle(p.seoTitle ?? '')
    setFSeoDesc(p.seoDescription ?? '')
    setFScheduledAt(toDateTimeLocalValue(p.scheduledAt))
    setFPinned(Boolean(p.isPinned))
    setFSourceUrl(p.sourceUrl ?? '')
    setFSourceName(p.sourceName ?? '')
    setFormOpen(true)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!fTitle.trim()) return toast.error('Vui lòng nhập tiêu đề bài viết.')
    if (!fCategory) return toast.error('Vui lòng chọn chuyên mục.')
    const tags = fTags
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    const payload: PostCreatePayload = {
      title: fTitle.trim(),
      slug: fSlug.trim() || undefined,
      category: fCategory,
      tags: tags.length ? tags : undefined,
      excerpt: fExcerpt.trim() || null,
      content: fContent.trim() || null,
      coverImageUrl: fCover.trim() || null,
      status: canPublish ? fStatus : 'pending',
      scheduledAt: fScheduledAt ? new Date(fScheduledAt).toISOString() : null,
      seoTitle: fSeoTitle.trim() || null,
      seoDescription: fSeoDesc.trim() || null,
      isPinned: canPublish ? fPinned : false,
      sourceUrl: fSourceUrl.trim() || null,
      sourceName: fSourceName.trim() || null,
    }
    try {
      setSaving(true)
      if (editingId) {
        await updateAdminPost(editingId, payload)
        toast.success('Cập nhật bài viết thành công.')
      } else {
        await createAdminPost(payload)
        toast.success(user?.role === 'staff' ? 'Tạo bài viết thành công, đang chờ duyệt.' : 'Tạo bài viết thành công.')
      }
      setFormOpen(false)
      resetForm()
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Lưu bài viết thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const onSetStatus = async (p: AdminPost, next: PostStatus) => {
    if (!canPublish) return toast.error('Bạn không có quyền duyệt / cập nhật trạng thái bài viết.')
    try {
      await setAdminPostStatus(p.id, { status: next })
      toast.success(`Đã cập nhật trạng thái: ${POST_STATUS_META[next].label}`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Cập nhật trạng thái thất bại.')
    }
  }

  const onTogglePermission = async (p: AdminPost, key: 'canStaffEdit' | 'canStaffDelete', next: boolean) => {
    if (!canSetPerms) return toast.error('Bạn không có quyền quản lý quyền sửa/xóa cho staff.')
    try {
      const payload = { canStaffEdit: key === 'canStaffEdit' ? next : p.canStaffEdit, canStaffDelete: key === 'canStaffDelete' ? next : p.canStaffDelete }
      await setAdminPostPermissions(p.id, payload)
      toast.success(next ? `Đã bật quyền ${key === 'canStaffEdit' ? 'sửa' : 'xóa'} cho staff.` : `Đã tắt quyền ${key === 'canStaffEdit' ? 'sửa' : 'xóa'} cho staff.`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Cập nhật quyền thất bại.')
    }
  }

  const onDelete = async (p: AdminPost) => {
    if (!canUserDeletePost(user?.role, user?.id, p)) return toast.error('Bạn không có quyền xóa bài viết này.')
    if (!window.confirm(`Xóa bài viết "${p.title}"?`)) return
    try {
      await deleteAdminPost(p.id)
      toast.success('Đã xóa bài viết.')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Xóa bài viết thất bại.')
    }
  }

  const onBulkApprove = async () => {
    if (!canPublish) return toast.error('Bạn không có quyền duyệt bài.')
    const items = rows.filter((r) => selectedIds.has(r.id) && r.status === 'pending')
    if (!items.length) return toast.error('Vui lòng chọn bài chờ duyệt.')
    try {
      await Promise.all(items.map((r) => setAdminPostStatus(r.id, { status: 'published' })))
      toast.success(`Đã duyệt ${items.length} bài.`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Duyệt hàng loạt thất bại.')
    }
  }

  const onBulkDelete = async () => {
    const items = rows.filter((r) => selectedIds.has(r.id) && canUserDeletePost(user?.role, user?.id, r))
    if (!items.length) return toast.error('Không có bài nào được xóa (bạn thiếu quyền với các bài đã chọn).')
    if (!window.confirm(`Xóa ${items.length} bài đã chọn?`)) return
    try {
      await Promise.all(items.map((r) => deleteAdminPost(r.id)))
      toast.success(`Đã xóa ${items.length} bài.`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Xóa hàng loạt thất bại.')
    }
  }

  const onImportRss = async () => {
    if (!canImportRss) return toast.error('Bạn không có quyền import RSS.')
    try {
      setRssLoading(true)
      const res = await importAdminPostRss({ createAs: 'pending' })
      toast.success(`Import RSS thành công, đã tạo ${res.imported} bài chờ duyệt.`)
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Import RSS thất bại.')
    } finally {
      setRssLoading(false)
    }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tin tức"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canCreate && (
              <button
                className="inline-flex h-10 items-center rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-4 text-xs font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 active:scale-[0.97]"
                onClick={() => (formOpen ? (setFormOpen(false), resetForm()) : openCreate())}
                type="button"
              >
                {formOpen ? 'Đóng' : '+ Tạo bài viết'}
              </button>
            )}
            {canPublish && (
              <button
                className="inline-flex h-10 items-center rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-emerald-700 active:scale-[0.97]"
                onClick={onBulkApprove}
                type="button"
              >
                {pendingCount ? `⏳ Duyệt (${pendingCount})` : 'Duyệt chọn'}
              </button>
            )}
            {canImportRss && (
              <button
                className={cn(
                  'inline-flex h-10 items-center rounded-full bg-sky-600 px-4 text-xs font-semibold text-white shadow transition hover:bg-sky-700 active:scale-[0.97]',
                  rssLoading && 'pointer-events-none opacity-70',
                )}
                onClick={onImportRss}
                type="button"
              >
                {rssLoading ? 'Đang import...' : '📡 Import RSS'}
              </button>
            )}
            <button
              className="inline-flex h-10 items-center rounded-full border border-red-200 bg-white px-4 text-xs font-semibold text-red-700 transition hover:bg-red-50 active:scale-[0.97]"
              onClick={onBulkDelete}
              type="button"
            >
              🗑 Xóa chọn
            </button>
          </div>
        }
      />

      {formOpen && (
        <form className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSave}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-bold tracking-wide text-slate-900">{editingId ? '✏️ Sửa bài viết' : '➕ Tạo bài viết mới'}</div>
            <div className="text-xs text-slate-500">{user?.role === 'staff' ? 'Bài viết sẽ ở trạng thái CHỜ DUYỆT sau khi lưu.' : canPublish ? 'Bạn có thể chọn trạng thái / đặt lịch xuất bản.' : ''}</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="text-xs font-semibold text-slate-700">Tiêu đề <span className="text-red-500">*</span></div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFTitle(e.target.value)}
                placeholder="Tiêu đề bài viết..."
                value={fTitle}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Slug (tự tạo nếu bỏ trống)</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-'))}
                placeholder="tin-tuc-khuyen-mai"
                value={fSlug}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Chuyên mục <span className="text-red-500">*</span></div>
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFCategory(e.target.value as PostCategory)}
                value={fCategory}
              >
                {(Object.keys(POST_CATEGORY_META) as PostCategory[]).map((c) => (
                  <option key={c} value={c}>{POST_CATEGORY_META[c].icon} {POST_CATEGORY_META[c].label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Trạng thái</div>
              <select
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4 disabled:opacity-60"
                disabled={!canPublish}
                onChange={(e) => setFStatus(e.target.value as PostStatus)}
                value={fStatus}
              >
                {(Object.keys(POST_STATUS_META) as PostStatus[]).map((s) => (
                  <option key={s} value={s}>{POST_STATUS_META[s].icon} {POST_STATUS_META[s].label}</option>
                ))}
              </select>
              {!canPublish && <div className="mt-1 text-[10px] text-amber-600">Staff chỉ có thể tạo bài ở trạng thái Chờ duyệt.</div>}
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Tags (phân cách dấu phẩy)</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFTags(e.target.value)}
                placeholder="sapa, tour núi, khuyến mãi..."
                value={fTags}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Ảnh bìa (URL)</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFCover(e.target.value)}
                placeholder="https://..."
                value={fCover}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Đặt lịch xuất bản (nếu Trạng thái = Đặt lịch)</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={!canPublish}
                onChange={(e) => setFScheduledAt(e.target.value)}
                type="datetime-local"
                value={fScheduledAt}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-semibold text-slate-700">Tóm tắt / Excerpt</div>
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFExcerpt(e.target.value)}
                placeholder="Mô tả ngắn gọn 1-2 câu..."
                value={fExcerpt}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-xs font-semibold text-slate-700">Nội dung bài viết (HTML / Markdown)</div>
              <textarea
                className="mt-1 min-h-[180px] w-full rounded-2xl border border-slate-200 px-4 py-2 font-mono text-xs outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFContent(e.target.value)}
                placeholder="<p>Nội dung chi tiết...</p>"
                value={fContent}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">SEO Title</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFSeoTitle(e.target.value)}
                value={fSeoTitle}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">SEO Description</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setFSeoDesc(e.target.value)}
                value={fSeoDesc}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">Nguồn (tên, URL - bài RSS import)</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={!canPublish}
                onChange={(e) => setFSourceName(e.target.value)}
                placeholder="VnExpress Du lịch"
                value={fSourceName}
              />
            </label>
            <label className="block">
              <div className="text-xs font-semibold text-slate-700">URL nguồn</div>
              <input
                className="mt-1 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={!canPublish}
                onChange={(e) => setFSourceUrl(e.target.value)}
                placeholder="https://..."
                value={fSourceUrl}
              />
            </label>
            {canPublish && (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:col-span-2">
                <input checked={fPinned} onChange={(e) => setFPinned(e.target.checked)} type="checkbox" />
                <div className="text-sm font-semibold text-slate-900">📌 Ghim bài này lên đầu danh sách trang tin tức công khai</div>
              </label>
            )}
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button
              className={cn(
                'inline-flex h-11 items-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-6 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 active:scale-[0.97]',
                saving && 'pointer-events-none opacity-60',
              )}
              type="submit"
            >
              {editingId ? '💾 Cập nhật' : '✨ Tạo bài viết'}
            </button>
            <button
              className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => { setFormOpen(false); resetForm() }}
              type="button"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className={cn('rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100 transition-opacity duration-300', stale && 'opacity-80 blur-[0.4px]')}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
            {STATUS_TABS.map((s) => {
              const active = status === s
              const count = s === 'pending' ? pendingCount : 0
              return (
                <button
                  key={s}
                  className={cn(
                    'inline-flex h-8 items-center rounded-xl px-3 text-xs font-semibold transition active:scale-[0.97]',
                    active
                      ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow'
                      : 'text-slate-700 hover:bg-white hover:ring-1 hover:ring-slate-200',
                  )}
                  onClick={() => { setStatus(s); setPage(1) }}
                  type="button"
                >
                  {s === 'all' ? '📋 Tất cả' : `${POST_STATUS_META[s].icon} ${POST_STATUS_META[s].label}`}
                  {count ? <span className="ml-2 rounded-full bg-white/25 px-1.5 py-0.5 text-[10px]">{count}</span> : null}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200">
            {CATEGORY_TABS.map((c) => {
              const active = category === c
              return (
                <button
                  key={c}
                  className={cn(
                    'inline-flex h-8 items-center rounded-xl px-3 text-xs font-semibold transition active:scale-[0.97]',
                    active
                      ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow'
                      : 'text-slate-700 hover:bg-white hover:ring-1 hover:ring-slate-200',
                  )}
                  onClick={() => { setCategory(c); setPage(1) }}
                  type="button"
                >
                  {c === 'all' ? '🏷️ Tất cả chuyên mục' : `${POST_CATEGORY_META[c].icon} ${POST_CATEGORY_META[c].label}`}
                </button>
              )
            })}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <input
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-10 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setSearch(searchInput.trim()); if (page !== 1) setPage(1) } }}
              placeholder="🔍 Tìm kiếm theo tiêu đề, tóm tắt, tags, nội dung..."
              value={searchInput}
            />
            {searchInput && (
              <button
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                onClick={() => { setSearchInput(''); setSearch(''); setPage(1) }}
                type="button"
              >
                ✕
              </button>
            )}
          </div>
          <select
            className="h-11 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
            value={pageSize}
          >
            {[25, 50, 100].map((n) => <option key={n} value={n}>{n} / trang</option>)}
          </select>
          {(status !== 'all' || category !== 'all' || search || authorId !== 'all') && (
            <button
              className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => { setStatus('all'); setCategory('all'); setAuthorId('all'); setSearchInput(''); setSearch(''); setPage(1) }}
              type="button"
            >
              Xóa lọc
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs">
          <div className="text-slate-500">
            {selectedIds.size ? <span className="font-semibold text-blue-700">Đã chọn {selectedIds.size} / {rows.length} bài trên trang.</span> : `Tổng cộng ${totalRows} bài trên ${totalPages} trang.`}
            {pendingCount ? <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200">⏳ {pendingCount} bài chờ duyệt</span> : null}
          </div>
        </div>

        <div className="mt-3 min-h-[1000px] overflow-auto rounded-2xl ring-1 ring-slate-200">
          <table className="w-full min-w-[1700px] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-blue-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th className="w-10 p-3">
                  <input checked={rows.length > 0 && selectedIds.size === rows.length} onChange={toggleSelectAll} type="checkbox" />
                </th>
                <th className="p-3">ID</th>
                <th className="w-[28%] p-3">Tiêu đề / Slug</th>
                <th className="p-3">Chuyên mục</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3 text-right">Lượt xem</th>
                <th className="p-3">Tác giả</th>
                <th className="p-3">📌 Ghim</th>
                <th className="p-3">Lên lịch</th>
                <th className="p-3">Xuất bản</th>
                <th className="p-3">Nguồn</th>
                {canSetPerms && <th className="p-3 text-center">Staff Sửa</th>}
                {canSetPerms && <th className="p-3 text-center">Staff Xóa</th>}
                <th className="w-[180px] p-3 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {initialLoading
                ? Array.from({ length: 12 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="border-t border-slate-100">
                      <td className="p-3" colSpan={canSetPerms ? 15 : 13}>
                        <div className="h-10 animate-pulse rounded-xl bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%]" />
                      </td>
                    </tr>
                  ))
                : rows.map((p) => {
                    const canEdit = canUserEditPost(user?.role, user?.id, p)
                    const canDelete = canUserDeletePost(user?.role, user?.id, p)
                    return (
                      <tr key={p.id} className="border-t border-slate-100 transition hover:bg-slate-50/60">
                        <td className="p-3">
                          <input checked={selectedIds.has(p.id)} onChange={() => toggleSelectOne(p.id)} type="checkbox" />
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-500">{p.id.slice(0, 8)}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 line-clamp-2">{p.title}</div>
                          <div className="mt-1 truncate font-mono text-[10px] text-slate-500">/{p.slug}</div>
                          {p.tags?.length ? (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {p.tags.slice(0, 3).map((t) => (
                                <span key={t} className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 ring-1 ring-slate-200">#{t}</span>
                              ))}
                            </div>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset', POST_CATEGORY_META[p.category].chip)}>
                            {POST_CATEGORY_META[p.category].icon} {POST_CATEGORY_META[p.category].label}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={cn('inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold ring-1 ring-inset', POST_STATUS_META[p.status].chip)}>
                            {POST_STATUS_META[p.status].icon} {POST_STATUS_META[p.status].label}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-700">{p.viewCount.toLocaleString('vi-VN')}</td>
                        <td className="p-3 text-slate-700">
                          <div className="font-mono text-[10px]">{p.authorId.slice(0, 8)}</div>
                          {p.approvedBy ? <div className="mt-0.5 text-[10px] text-emerald-700">✔ Admin duyệt</div> : p.status !== 'draft' ? <div className="mt-0.5 text-[10px] text-amber-700">Chưa duyệt</div> : null}
                        </td>
                        <td className="p-3 text-center">
                          {p.isPinned ? <span className="inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-200">📌 PIN</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-3 text-slate-700">
                          {p.scheduledAt ? <div className="font-mono text-[11px]">{formatDateTime(p.scheduledAt)}</div> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-3 text-slate-700">
                          {p.publishedAt ? <div className="font-mono text-[11px]">{formatDateTime(p.publishedAt)}</div> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="p-3">
                          {p.sourceName ? (
                            <div>
                              <div className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-800 ring-1 ring-sky-200">📡 {p.sourceName}</div>
                              {p.sourceUrl ? <a className="mt-1 block truncate font-mono text-[10px] text-blue-700 underline hover:text-blue-900" href={p.sourceUrl} rel="noreferrer" target="_blank">{p.sourceUrl}</a> : null}
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        {canSetPerms && (
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center gap-2">
                              <Switch checked={p.canStaffEdit} onChange={(next) => onTogglePermission(p, 'canStaffEdit', next)} />
                              <span className={cn('text-[10px] font-semibold', p.canStaffEdit ? 'text-emerald-700' : 'text-slate-400')}>{p.canStaffEdit ? 'Cho phép' : 'Khóa'}</span>
                            </label>
                          </td>
                        )}
                        {canSetPerms && (
                          <td className="p-3 text-center">
                            <label className="inline-flex items-center gap-2">
                              <Switch checked={p.canStaffDelete} onChange={(next) => onTogglePermission(p, 'canStaffDelete', next)} />
                              <span className={cn('text-[10px] font-semibold', p.canStaffDelete ? 'text-red-700' : 'text-slate-400')}>{p.canStaffDelete ? 'Cho phép' : 'Khóa'}</span>
                            </label>
                          </td>
                        )}
                        <td className="p-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {canEdit ? (
                              <button
                                className="inline-flex h-7 items-center rounded-xl border border-blue-200 bg-blue-50 px-2.5 text-[10px] font-semibold text-blue-800 transition hover:bg-blue-100 active:scale-[0.97]"
                                onClick={() => openEdit(p)}
                                type="button"
                              >
                                ✏ Sửa
                              </button>
                            ) : user?.role === 'staff' && p.authorId === user.id ? (
                              <span className="inline-flex h-7 items-center rounded-xl bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200" title="Admin chưa cho phép sửa bài này">🔒 Chưa cho sửa</span>
                            ) : null}
                            {canPublish && p.status === 'pending' && (
                              <button
                                className="inline-flex h-7 items-center rounded-xl bg-emerald-600 px-2.5 text-[10px] font-semibold text-white transition hover:bg-emerald-700 active:scale-[0.97]"
                                onClick={() => onSetStatus(p, 'published')}
                                type="button"
                              >
                                ✔ Duyệt
                              </button>
                            )}
                            {canPublish && (
                              <select
                                className="h-7 rounded-xl border border-slate-200 bg-white px-1.5 text-[10px] font-semibold outline-none hover:bg-slate-50"
                                onChange={(e) => {
                                  const v = e.target.value as PostStatus
                                  if (!v) return
                                  onSetStatus(p, v)
                                  e.target.value = ''
                                }}
                                defaultValue=""
                              >
                                <option value="">Trạng thái ↓</option>
                                {(Object.keys(POST_STATUS_META) as PostStatus[]).map((s) => (
                                  <option key={s} value={s}>{POST_STATUS_META[s].icon} {POST_STATUS_META[s].label}</option>
                                ))}
                              </select>
                            )}
                            {canDelete ? (
                              <button
                                className="inline-flex h-7 items-center rounded-xl border border-red-200 bg-red-50 px-2.5 text-[10px] font-semibold text-red-800 transition hover:bg-red-100 active:scale-[0.97]"
                                onClick={() => onDelete(p)}
                                type="button"
                              >
                                🗑 Xóa
                              </button>
                            ) : user?.role === 'staff' && p.authorId === user.id ? (
                              <span className="inline-flex h-7 items-center rounded-xl bg-slate-50 px-2.5 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200" title="Admin chưa cho phép xóa bài này">🔒 Chưa cho xóa</span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>

          {!initialLoading && !rows.length ? (
            <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
              Không có bài viết nào khớp bộ lọc.
            </div>
          ) : null}
        </div>

        {totalPages > 1 && !initialLoading && (
          <div className="mt-5 flex items-center justify-between">
            <div className="text-xs text-slate-500">Trang {page} / {totalPages}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                type="button"
              >
                ← Trước
              </button>
              {pageNumbers.map((pn, idx) =>
                typeof pn === 'number' ? (
                  <button
                    key={`p-${idx}-${pn}`}
                    className={cn(
                      'inline-flex h-8 min-w-[32px] items-center justify-center rounded-xl px-2 text-xs font-semibold transition active:scale-[0.97]',
                      pn === page
                        ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-white shadow'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                    onClick={() => setPage(pn)}
                    type="button"
                  >
                    {pn}
                  </button>
                ) : (
                  <span key={`dot-${idx}`} className="px-1 text-slate-400">…</span>
                )
              )}
              <button
                className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                type="button"
              >
                Sau →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition active:scale-[0.97]',
        checked ? 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500' : 'bg-slate-200',
      )}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span
        className={cn(
          'inline-block h-5 w-5 transform rounded-full bg-white shadow transition',
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]',
        )}
      />
    </button>
  )
}

function pad2(n: number) { return String(n).padStart(2, '0') }

function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function computePageNumbers(current: number, total: number): (number | 'dot')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const out: (number | 'dot')[] = []
  const window = 2
  out.push(1)
  if (current - window > 2) out.push('dot')
  const start = Math.max(2, current - window)
  const end = Math.min(total - 1, current + window)
  for (let i = start; i <= end; i++) out.push(i)
  if (end < total - 1) out.push('dot')
  out.push(total)
  return out
}

function buildDemoAdminPosts(count: number): AdminPost[] {
  const cats: PostCategory[] = ['promotion', 'experience', 'tour_launch', 'company', 'culture', 'guide']
  const statuses: PostStatus[] = ['draft', 'pending', 'published', 'scheduled']
  const titles = [
    'FLASH SALE 25% toàn bộ tour Miền Nam đầu tháng 9',
    'Kinh nghiệm đi Sapa 3 ngày 2 đêm tiết kiệm chi phí',
    'Khởi hành tour mới: Khám phá Hà Giang vòng cung 5N4Đ',
    'Thông báo: VPBank hoàn tiền 15% khi đặt tour dùng thẻ tín dụng',
    'Khuyến mãi đặc biệt Tết Dương lịch 2026 - Early Bird giảm 30%',
    'Chợ nổi Cần Thơ - Nét đẹp văn hóa sông nước miền Tây',
    'Hướng dẫn làm visa du lịch Nhật Bản năm 2026',
    'Review tour Phú Quốc 4N3Đ - Trải nghiệm nghỉ dưỡng 5 sao',
    'Văn hóa ẩm thực miền Trung - Quảng Bình đến Huế',
    'Công ty tổ chức team building Côn Đảo quý 3 thành công tốt đẹp',
    'Hướng dẫn chọn tour du lịch phù hợp với gia đình có trẻ em',
    'Khuyến mãi vé máy bay Vietnam Airlines giảm tới 40%',
    'Tour mới: Du thuyền Hạ Long 2N1Đ - Tàu cao cấp 5 sao',
    'Kinh nghiệm chụp ảnh đẹp khi đi du lịch Đà Lạt',
    'Thông báo: Lịch nghỉ lễ Quốc Khánh 2/9 - Giờ làm việc',
    'Hướng dẫn đặt tour trên website - Step by step đơn giản',
    'Văn hóa người Dao ở Bắc Giang - Lễ hội Lồng Đồng',
    'Cẩm nang du lịch Mũi Né Phan Thiết cho tín đồ dạo biển',
    'Top 5 địa điểm check-in "sống ảo" nhất Đà Nẵng',
    'Hợp tác cùng Saigontourist mở tour xuyên Việt 10 ngày',
    'Hướng dẫn đổi / trả tour - Chính sách hoàn tiền mới',
    'Kinh nghiệm du lịch Tây Nguyên - Buôn Ma Thuột & Đắk Lắk',
    'Khuyến mãi dành cho thành viên VIP - Giảm thêm 10%',
    'Thư cảm ơn: 2000+ khách hàng đã tin tưởng trong quý 2',
    'Trải nghiệm tour Ninh Bình 2N1Đ - Tam Cốc, Tràng An, Múa',
  ]
  const staffAuthors = ['staff_id_001_NguyenVan', 'staff_id_002_TranThi', 'staff_id_003_Lee']
  const adminAuthors = ['admin_id_001_Admin']
  return Array.from({ length: Math.max(count, 25) }, (_, i): AdminPost => {
    const status = statuses[i % statuses.length]
    const cat = cats[i % cats.length]
    const isAdminAuthor = i % 7 === 0
    const authorId = isAdminAuthor ? adminAuthors[0] : staffAuthors[i % staffAuthors.length]
    const now = Date.now() - i * 1000 * 60 * 60 * 17
    const pub = status === 'published' || status === 'scheduled' ? new Date(now + 1000 * 60 * 60 * 24 * (status === 'scheduled' ? 3 : -2)) : null
    const sched = status === 'scheduled' ? new Date(now + 1000 * 60 * 60 * 24 * 3) : null
    return {
      id: `demo_post_${String(i + 1).padStart(5, '0')}_${Math.random().toString(36).slice(2, 8)}`,
      title: titles[i % titles.length] + (i >= titles.length ? ` (lần ${Math.floor(i / titles.length) + 1})` : ''),
      slug: `tin-tuc-${i + 1}-${cat}-${status}`,
      category: cat,
      status,
      tags: i % 3 === 0 ? ['sapa', 'giảm-giá', 'sale'] : i % 3 === 1 ? ['phú-quốc', 'nghỉ-dưỡng'] : ['kinh-nghiệm', 'dalat'],
      relatedTourIds: [],
      excerpt: 'Tóm tắt demo bài viết...',
      content: '<p>Nội dung demo (kết nối API server thành công sẽ thay thế bằng dữ liệu thật).</p>',
      coverImageUrl: null,
      publishedAt: pub ? pub.toISOString() : null,
      scheduledAt: sched ? sched.toISOString() : null,
      authorId,
      seoTitle: null,
      seoDescription: null,
      viewCount: Math.floor(Math.random() * 9000) + 100,
      isPinned: i % 11 === 0,
      sourceUrl: i % 8 === 0 ? 'https://vnexpress.net/du-lich' : null,
      sourceName: i % 8 === 0 ? 'VnExpress Du lịch' : null,
      canStaffEdit: i % 3 === 0,
      canStaffDelete: i % 5 === 0,
      approvedBy: status === 'published' || status === 'scheduled' ? 'admin_id_001_Admin' : null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now + 1000 * 60 * 60).toISOString(),
    }
  })
}
