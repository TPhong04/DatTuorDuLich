import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AuditLog, adminListAuditLogs } from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

function asRecord(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object') return null
  if (Array.isArray(meta)) return null
  return meta as Record<string, unknown>
}

function shortId(id: string) {
  if (!id) return ''
  return id.length > 10 ? `${id.slice(0, 6)}...${id.slice(-4)}` : id
}

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin'
  if (role === 'staff') return 'Staff'
  if (role === 'customer') return 'Customer'
  return role
}

function entityLabel(l: AuditLog) {
  if (!l.entityType) return ''
  if (l.entityType === 'user') return 'Tài khoản'
  if (l.entityType === 'settings') return 'Cấu hình'
  if (l.entityType === 'banner') return 'Banner'
  if (l.entityType === 'tour') return 'Tour'
  if (l.entityType === 'upload') return 'Upload'
  return String(l.entityType)
}

function displayTextValue(v: unknown) {
  if (v === null) return 'null'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function settingSectionLabel(section: string) {
  if (section === 'company') return 'Thông tin công ty'
  if (section === 'branding') return 'Nhận diện'
  if (section === 'home') return 'Trang chủ'
  if (section === 'booking') return 'Đặt tour'
  if (section === 'payment') return 'Thanh toán'
  if (section === 'notifications') return 'Thông báo'
  if (section === 'security') return 'Bảo mật'
  if (section === 'integrations') return 'Tích hợp'
  if (section === 'masterData') return 'Dữ liệu danh mục'
  return section
}

function settingFieldLabel(section: string, key: string) {
  if (section === 'company') {
    if (key === 'name') return 'Tên công ty'
    if (key === 'slogan') return 'Slogan'
    if (key === 'hotline') return 'Hotline'
    if (key === 'email') return 'Email'
  }
  if (section === 'branding') {
    if (key === 'logoHeaderUrl') return 'Logo header'
    if (key === 'logoFooterUrl') return 'Logo footer'
    if (key === 'faviconUrl') return 'Favicon'
    if (key === 'topbarText') return 'Topbar text'
    if (key === 'primaryColor') return 'Màu chủ đạo'
    if (key === 'accentColor') return 'Màu nhấn'
  }
  if (section === 'home') {
    if (key === 'heroTitle') return 'Tiêu đề hero'
    if (key === 'heroSubtitle') return 'Mô tả hero'
    if (key === 'showQuickSearch') return 'Tìm tour nhanh'
  }
  return key
}

function actionTitle(l: AuditLog) {
  const r = asRecord(l.meta)

  if (l.action === 'admin.user.create') return 'Tạo tài khoản'
  if (l.action === 'admin.user.update') {
    const changes = asRecord(r?.changes)
    const isActive = typeof changes?.isActive === 'boolean' ? changes.isActive : null
    const role = typeof changes?.role === 'string' ? changes.role : null
    if (isActive === false) return 'Khóa tài khoản'
    if (isActive === true) return 'Mở khóa tài khoản'
    if (role) return 'Đổi vai trò tài khoản'
    return 'Cập nhật tài khoản'
  }
  if (l.action === 'admin.settings.update') {
    const section = typeof r?.section === 'string' ? r.section : ''
    const patch = asRecord(r?.patch)
    if (section === 'company' && typeof patch?.name === 'string') return 'Đổi tên công ty'
    return `Cập nhật cấu hình - ${settingSectionLabel(section)}`
  }
  if (l.action === 'admin.upload.image') {
    const category = typeof r?.category === 'string' ? r.category : ''
    if (category === 'banners') return 'Upload ảnh banner'
    return 'Upload ảnh'
  }
  if (l.action === 'admin.banner.create') return 'Tạo banner'
  if (l.action === 'admin.banner.update') {
    const patch = asRecord(r?.patch)
    const isActive = typeof patch?.isActive === 'boolean' ? patch.isActive : null
    if (isActive === true) return 'Bật banner'
    if (isActive === false) return 'Tắt banner'
    if (patch && 'imageUrl' in patch) return 'Đổi ảnh banner'
    return 'Cập nhật banner'
  }
  if (l.action === 'admin.banner.delete') return 'Xóa banner'
  if (l.action === 'admin.banner.reorder') return 'Sắp xếp banner'
  if (l.action === 'admin.tour.create') return 'Tạo tour'
  if (l.action === 'admin.tour.update') return 'Cập nhật tour'
  if (l.action === 'admin.tour.delete') return 'Xóa tour'

  return l.action
}

function metaBadges(l: AuditLog) {
  const r = asRecord(l.meta)
  const badges: { text: string; className: string }[] = []

  if (l.action === 'admin.user.create') {
    const email = typeof r?.email === 'string' ? r.email : null
    const role = typeof r?.role === 'string' ? r.role : null
    if (email) badges.push({ text: email, className: 'bg-slate-100 text-slate-800' })
    if (role) badges.push({ text: roleLabel(role), className: 'bg-blue-50 text-blue-800' })
    return badges
  }

  if (l.action === 'admin.user.update') {
    const changes = asRecord(r?.changes)
    const role = typeof changes?.role === 'string' ? changes.role : null
    const isActive = typeof changes?.isActive === 'boolean' ? changes.isActive : null

    if (role) badges.push({ text: `Role: ${roleLabel(role)}`, className: 'bg-blue-50 text-blue-800' })
    if (isActive === false) badges.push({ text: 'Khóa tài khoản', className: 'bg-orange-50 text-orange-800' })
    if (isActive === true) badges.push({ text: 'Mở khóa tài khoản', className: 'bg-emerald-50 text-emerald-800' })
    return badges
  }

  if (l.action === 'admin.settings.update') {
    const section = typeof r?.section === 'string' ? r.section : ''
    if (section) badges.push({ text: settingSectionLabel(section), className: 'bg-slate-100 text-slate-800' })
    return badges
  }

  if (l.action === 'admin.upload.image') {
    const category = typeof r?.category === 'string' ? r.category : ''
    if (category) badges.push({ text: `Category: ${category}`, className: 'bg-slate-100 text-slate-800' })
    return badges
  }

  if (l.action === 'admin.banner.reorder') {
    const ids = Array.isArray(r?.ids) ? r?.ids : null
    if (ids) badges.push({ text: `Số lượng: ${ids.length}`, className: 'bg-slate-100 text-slate-800' })
    return badges
  }

  if (l.action === 'admin.banner.update') {
    const patch = asRecord(r?.patch)
    if (patch) {
      const keys = Object.keys(patch)
      if (keys.length) badges.push({ text: `Thay đổi: ${keys.join(', ')}`, className: 'bg-slate-100 text-slate-800' })
    }
    return badges
  }

  if (l.action === 'admin.tour.update') {
    const patch = asRecord(r?.patch)
    if (patch) {
      const keys = Object.keys(patch)
      if (keys.length) badges.push({ text: `Thay đổi: ${keys.join(', ')}`, className: 'bg-slate-100 text-slate-800' })
    }
    return badges
  }

  return badges
}

function metaDetailText(l: AuditLog) {
  const r = asRecord(l.meta)

  if (l.action === 'admin.user.update') {
    const changes = asRecord(r?.changes)
    const keys = changes ? Object.keys(changes) : []
    if (!keys.length) return ''
    return keys.map((k) => `${k}: ${displayTextValue((changes as any)[k])}`).join(' • ')
  }

  if (l.action === 'admin.settings.update') {
    const section = typeof r?.section === 'string' ? r.section : ''
    const patch = asRecord(r?.patch)
    const keys = patch ? Object.keys(patch) : []
    if (!keys.length) return ''
    return keys.map((k) => `${settingFieldLabel(section, k)}: ${displayTextValue((patch as any)[k])}`).join(' • ')
  }

  if (l.action === 'admin.upload.image') {
    const url = typeof r?.url === 'string' ? r.url : null
    return url ? `URL: ${url}` : ''
  }

  if (l.action === 'admin.banner.create') {
    const banner = asRecord(r?.banner)
    const t = typeof banner?.title === 'string' ? banner.title : null
    const url = typeof banner?.imageUrl === 'string' ? banner.imageUrl : null
    return [t ? `Tiêu đề: ${t}` : null, url ? `Ảnh: ${url}` : null].filter(Boolean).join(' • ')
  }

  if (l.action === 'admin.banner.delete') {
    const banner = asRecord(r?.banner)
    const t = typeof banner?.title === 'string' ? banner.title : null
    return t ? `Tiêu đề: ${t}` : ''
  }

  if (l.action === 'admin.banner.update') {
    const patch = asRecord(r?.patch)
    const keys = patch ? Object.keys(patch) : []
    if (!keys.length) return ''
    return keys.map((k) => `${k}: ${displayTextValue((patch as any)[k])}`).join(' • ')
  }

  if (l.action === 'admin.banner.reorder') {
    const ids = Array.isArray(r?.ids) ? (r?.ids as unknown[]) : []
    return ids.length ? `IDs: ${ids.map((x) => (typeof x === 'string' ? shortId(x) : '')).filter(Boolean).join(', ')}` : ''
  }

  if (l.action === 'admin.tour.create') {
    const tour = asRecord(r?.tour)
    const t = typeof tour?.title === 'string' ? tour.title : null
    const slug = typeof tour?.slug === 'string' ? tour.slug : null
    return [t ? `Tên: ${t}` : null, slug ? `Slug: ${slug}` : null].filter(Boolean).join(' • ')
  }

  if (l.action === 'admin.tour.update') {
    const patch = asRecord(r?.patch)
    const keys = patch ? Object.keys(patch) : []
    if (!keys.length) return ''
    return keys.map((k) => `${k}: ${displayTextValue((patch as any)[k])}`).join(' • ')
  }

  if (l.action === 'admin.tour.delete') {
    const tour = asRecord(r?.tour)
    const t = typeof tour?.title === 'string' ? tour.title : null
    return t ? `Tên: ${t}` : ''
  }

  return ''
}

export default function AdminAuditLogsPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AuditLog[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [actorEmail, setActorEmail] = useState('')
  const [action, setAction] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const limit = 20

  const query = useMemo(
    () => ({
      actorEmail: actorEmail.trim() || undefined,
      action: action.trim() || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit,
    }),
    [action, actorEmail, from, page, to],
  )

  useEffect(() => {
    let alive = true
    setLoading(true)
    adminListAuditLogs(query)
      .then((res) => {
        if (!alive) return
        setItems(res.items)
        setTotal(res.total)
        setPage(res.page)
      })
      .catch(() => {
        if (!alive) return
        toast.error('Không tải được audit log.')
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [query])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Theo dõi thao tác quản trị: tài khoản, cấu hình, upload, banner..." title="Audit logs" />
      <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actor email</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setActorEmail(e.target.value)
                setPage(1)
              }}
              placeholder="admin@..."
              value={actorEmail}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Action</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setAction(e.target.value)
                setPage(1)
              }}
              placeholder="admin.user.update"
              value={action}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Từ ngày (ISO)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
              placeholder="2026-08-03"
              value={from}
            />
          </label>
          <label className="block">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Đến ngày (ISO)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
              placeholder="2026-08-04"
              value={to}
            />
          </label>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl ring-1 ring-blue-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 text-[11px] font-bold uppercase tracking-wider text-blue-900/70">
              <tr>
                <th className="px-5 py-3.5">Time</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Object</th>
                <th className="px-5 py-3.5">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-100/60">
              {items.map((l) => (
                <tr key={l.id} className="transition hover:bg-blue-50/30">
                  <td className="px-5 py-4 text-slate-700">{formatDateTime(l.createdAt) || l.createdAt || ''}</td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-900">{l.actorEmail}</div>
                    <div className="text-xs text-slate-500">{roleLabel(l.actorRole)}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-900">{actionTitle(l)}</div>
                    <div className="text-xs text-slate-500">{l.action}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-900">{entityLabel(l)}</div>
                    <div className="text-xs text-slate-500">{l.entityId ? shortId(l.entityId) : ''}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div className="flex flex-wrap gap-2">
                      {metaBadges(l).map((b) => (
                        <span key={b.text} className={cn('inline-flex rounded-full px-3 py-1 text-xs font-semibold', b.className)}>
                          {b.text}
                        </span>
                      ))}
                    </div>
                    {metaDetailText(l) ? (
                      <div className="mt-2 text-xs text-slate-500">{metaDetailText(l)}</div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading ? (
                <tr>
                  <td className="px-5 py-8 text-center text-slate-600" colSpan={5}>
                    Không có dữ liệu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-sm text-slate-600">{loading ? 'Đang tải...' : `Tổng: ${total}`}</div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50 disabled:opacity-50"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              type="button"
            >
              Trước
            </button>
            <div className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-800 to-blue-900 px-3 text-sm font-bold text-white shadow">
              {page}/{totalPages}
            </div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50 disabled:opacity-50"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              type="button"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
