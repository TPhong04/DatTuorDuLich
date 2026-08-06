import { FormEvent, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import {
  AdminBanner,
  AdminBannerTargetType,
  adminCreateBanner,
  adminDeleteBanner,
  adminListBanners,
  adminReorderBanners,
  adminUpdateBanner,
  adminUploadImage,
} from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

export default function AdminContentBannersPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminBanner[]>([])

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [targetType, setTargetType] = useState<AdminBannerTargetType>('none')
  const [targetValue, setTargetValue] = useState('')
  const [openInNewTab, setOpenInNewTab] = useState(false)
  const [order, setOrder] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminListBanners()
      setItems(res.items)
    } catch (e: any) {
      toast.error(e?.message || 'Không tải được danh sách banner.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const sortedItems = useMemo(() => [...items].sort((a, b) => (a.order - b.order) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))), [items])

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setImageUrl('')
    setTargetType('none')
    setTargetValue('')
    setOpenInNewTab(false)
    setOrder('0')
    setIsActive(true)
    setStartAt('')
    setEndAt('')
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = (b: AdminBanner) => {
    setEditingId(b.id)
    setTitle(b.title ?? '')
    setImageUrl(b.imageUrl ?? '')
    setTargetType(b.targetType ?? 'none')
    setTargetValue(b.targetValue ?? '')
    setOpenInNewTab(Boolean(b.openInNewTab))
    setOrder(String(b.order ?? 0))
    setIsActive(Boolean(b.isActive))
    setStartAt(toDateTimeLocalValue(b.startAt))
    setEndAt(toDateTimeLocalValue(b.endAt))
    setFormOpen(true)
  }

  const onUpload = async (file: File) => {
    try {
      setSaving(true)
      const res = await adminUploadImage({ file, category: 'banners' })
      setImageUrl(res.url)
      toast.success('Upload ảnh thành công.')
    } catch (e: any) {
      toast.error(e?.message || 'Upload ảnh thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!imageUrl.trim()) {
      toast.error('Vui lòng upload ảnh banner.')
      return
    }
    if (targetType !== 'none' && !targetValue.trim()) {
      toast.error('Vui lòng nhập đường dẫn banner.')
      return
    }

    const nextOrder = Number(order)
    if (!Number.isFinite(nextOrder) || nextOrder < 0) {
      toast.error('Thứ tự không hợp lệ.')
      return
    }

    const payload = {
      title: title.trim() || null,
      imageUrl: imageUrl.trim(),
      targetType,
      targetValue: targetType === 'none' ? null : targetValue.trim(),
      openInNewTab: targetType === 'external' ? openInNewTab : false,
      order: nextOrder,
      isActive,
      startAt: startAt ? new Date(startAt).toISOString() : null,
      endAt: endAt ? new Date(endAt).toISOString() : null,
    }

    try {
      setSaving(true)
      if (editingId) {
        await adminUpdateBanner(editingId, payload)
        toast.success('Cập nhật banner thành công.')
      } else {
        await adminCreateBanner(payload)
        toast.success('Tạo banner thành công.')
      }
      setFormOpen(false)
      resetForm()
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Lưu banner thất bại.')
    } finally {
      setSaving(false)
    }
  }

  const onToggleActive = async (b: AdminBanner, next: boolean) => {
    try {
      await adminUpdateBanner(b.id, { isActive: next })
      toast.success(next ? 'Đã bật banner.' : 'Đã tắt banner.')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Cập nhật trạng thái thất bại.')
    }
  }

  const onDelete = async (b: AdminBanner) => {
    const ok = window.confirm('Xóa banner này?')
    if (!ok) return
    try {
      await adminDeleteBanner(b.id)
      toast.success('Đã xóa banner.')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Xóa banner thất bại.')
    }
  }

  const onMove = async (id: string, dir: -1 | 1) => {
    const idx = sortedItems.findIndex((x) => x.id === id)
    if (idx < 0) return
    const nextIdx = idx + dir
    if (nextIdx < 0 || nextIdx >= sortedItems.length) return
    const next = [...sortedItems]
    ;[next[idx], next[nextIdx]] = [next[nextIdx], next[idx]]
    try {
      await adminReorderBanners(next.map((x) => x.id))
      toast.success('Đã cập nhật thứ tự banner.')
      await load()
    } catch (e: any) {
      toast.error(e?.message || 'Sắp xếp banner thất bại.')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Quản lý banner/slider trang chủ: thêm, sắp xếp, bật/tắt."
        title="Banners"
        right={
          <button
            className="inline-flex rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            onClick={() => {
              if (formOpen) {
                setFormOpen(false)
                resetForm()
              } else {
                openCreate()
              }
            }}
            type="button"
          >
            {formOpen ? 'Đóng' : 'Thêm banner'}
          </button>
        }
      />

      {formOpen ? (
        <form className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSave}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Ảnh banner</div>
              <div className="mt-2 grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2">
                    <label
                      className={cn(
                        'inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50',
                        saving && 'pointer-events-none opacity-60',
                      )}
                    >
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) onUpload(f)
                        }}
                        type="file"
                      />
                      Upload ảnh
                    </label>
                    <input
                      className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="/uploads/banners/..."
                      value={imageUrl}
                    />
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="aspect-[16/5] w-full">
                    {imageUrl ? <img alt="Preview" className="h-full w-full object-cover" src={imageUrl} /> : <div className="h-full w-full" />}
                  </div>
                </div>
              </div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Tiêu đề (tuỳ chọn)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setTitle(e.target.value)}
                value={title}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Thứ tự</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                min={0}
                onChange={(e) => setOrder(e.target.value)}
                type="number"
                value={order}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Loại link</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setTargetType(e.target.value as any)}
                value={targetType}
              >
                <option value="none">Không điều hướng</option>
                <option value="internal">Link nội bộ</option>
                <option value="external">Link ngoài</option>
              </select>
            </label>

            <label className={cn('block', targetType === 'none' && 'opacity-50')}>
              <div className="text-sm font-semibold text-slate-900">Đường dẫn</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={targetType === 'none'}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={targetType === 'external' ? 'https://...' : '/tours?...'}
                value={targetValue}
              />
            </label>

            <label className={cn('flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3', targetType !== 'external' && 'opacity-50')}>
              <input
                checked={openInNewTab}
                disabled={targetType !== 'external'}
                onChange={(e) => setOpenInNewTab(e.target.checked)}
                type="checkbox"
              />
              <div className="text-sm font-semibold text-slate-900">Mở tab mới (link ngoài)</div>
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <input checked={isActive} onChange={(e) => setIsActive(e.target.checked)} type="checkbox" />
              <div className="text-sm font-semibold text-slate-900">Bật banner</div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Bắt đầu (tuỳ chọn)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setStartAt(e.target.value)}
                type="datetime-local"
                value={startAt}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Kết thúc (tuỳ chọn)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setEndAt(e.target.value)}
                type="datetime-local"
                value={endAt}
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              className={cn(
                'inline-flex h-11 items-center justify-center rounded-2xl bg-blue-700 px-5 text-sm font-semibold text-white transition hover:bg-blue-800',
                saving && 'pointer-events-none opacity-60',
              )}
              type="submit"
            >
              {editingId ? 'Cập nhật' : 'Tạo banner'}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              onClick={() => {
                setFormOpen(false)
                resetForm()
              }}
              type="button"
            >
              Hủy
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-900">Danh sách banner</div>
          <div className="text-xs font-semibold text-slate-500">{loading ? 'Đang tải...' : `${sortedItems.length} items`}</div>
        </div>

        <div className="mt-4 space-y-3">
          {sortedItems.map((b) => (
            <div key={b.id} className="grid gap-3 rounded-3xl border border-slate-200 p-4 md:grid-cols-[200px_1fr_auto] md:items-center">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="aspect-[16/5] w-full">
                  <img alt={b.title ?? 'Banner'} className="h-full w-full object-cover" src={b.imageUrl} />
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="truncate text-sm font-semibold text-slate-900">{b.title || '(Không tiêu đề)'}</div>
                <div className="truncate text-xs text-slate-600">
                  {b.targetType === 'none' ? 'Không điều hướng' : b.targetType === 'internal' ? `Nội bộ: ${b.targetValue}` : `Ngoài: ${b.targetValue}`}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-slate-100 px-2 py-1">Order: {b.order}</span>
                  {b.startAt || b.endAt ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1">
                      {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                    </span>
                  ) : null}
                  <span className={cn('rounded-full px-2 py-1', b.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700')}>
                    {b.isActive ? 'Đang bật' : 'Đang tắt'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => onMove(b.id, -1)}
                  type="button"
                >
                  Lên
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => onMove(b.id, 1)}
                  type="button"
                >
                  Xuống
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => openEdit(b)}
                  type="button"
                >
                  Sửa
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => onToggleActive(b, !b.isActive)}
                  type="button"
                >
                  {b.isActive ? 'Tắt' : 'Bật'}
                </button>
                <button
                  className="inline-flex h-9 items-center justify-center rounded-2xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                  onClick={() => onDelete(b)}
                  type="button"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}

          {!sortedItems.length && !loading ? (
            <div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-600">Chưa có banner nào.</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateTimeLocalValue(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
