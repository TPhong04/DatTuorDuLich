import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AdminSettings, adminGetSettings, adminUpdateSettingsSection, adminUploadImage } from '@/features/admin/admin'
import { SETTINGS_VERSION_KEY } from '@/features/settings/settings'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/utils/date'

export type AdminSettingsContext = {
  settings: AdminSettings
  reload: () => Promise<void>
  saveSection: (section: string, patch: unknown) => Promise<void>
  uploadImage: (file: File, category: string) => Promise<string>
}

const tabClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all',
    isActive
      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
      : 'bg-blue-50 text-blue-900 ring-1 ring-inset ring-blue-200 hover:bg-blue-100',
  )

function getErrorText(e: unknown) {
  if (!e) return 'Lỗi không xác định'
  if (typeof e === 'string') return e
  if (typeof (e as any).message === 'string') return (e as any).message as string
  try {
    return JSON.stringify(e)
  } catch {
    return 'Lỗi không xác định'
  }
}

export default function AdminSettingsLayout() {
  const toast = useToast()
  const location = useLocation()

  const [settings, setSettings] = useState<AdminSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminGetSettings()
      setSettings(data)
    } catch (e) {
      toast.error('Không tải được cấu hình hệ thống')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    reload().catch(() => null)
  }, [reload])

  const ctx = useMemo<AdminSettingsContext | null>(() => {
    if (!settings) return null
    return {
      settings,
      reload,
      saveSection: async (section: string, patch: unknown) => {
        try {
          const next = await adminUpdateSettingsSection(section, patch)
          setSettings(next)
          if (next.updatedAt) {
            localStorage.setItem(SETTINGS_VERSION_KEY, next.updatedAt)
            window.dispatchEvent(new CustomEvent('settings-changed', { detail: { updatedAt: next.updatedAt } }))
          } else {
            window.dispatchEvent(new Event('settings-changed'))
          }
          toast.success('Đã lưu cấu hình')
        } catch (e) {
          const msg = getErrorText(e)
          const details = (e as any)?.details
          const errors = Array.isArray((details as any)?.errors) ? ((details as any).errors as any[]) : null
          const detailText =
            errors && errors.length
              ? errors
                  .slice(0, 5)
                  .map((x) => {
                    const path = typeof x?.path === 'string' && x.path ? `${x.path}: ` : ''
                    const m = typeof x?.message === 'string' ? x.message : ''
                    return `${path}${m}`.trim()
                  })
                  .filter(Boolean)
                  .join('\n')
              : ''
          toast.error(detailText ? `Lưu cấu hình thất bại: ${msg}\n${detailText}` : `Lưu cấu hình thất bại: ${msg}`)
        }
      },
      uploadImage: async (file: File, category: string) => {
        try {
          const res = await adminUploadImage({ file, category })
          toast.success('Upload ảnh thành công')
          return res.url
        } catch (e) {
          toast.error('Upload ảnh thất bại')
          throw e
        }
      },
    }
  }, [settings, toast])

  const tabs = [
    { label: 'Doanh nghiệp', to: '/admin/settings/company' },
    { label: 'Nhận diện', to: '/admin/settings/branding' },
    { label: 'Trang chủ', to: '/admin/settings/home' },
    { label: 'Đặt tour', to: '/admin/settings/booking' },
    { label: 'Thanh toán', to: '/admin/settings/payment' },
    { label: 'Thông báo', to: '/admin/settings/notifications' },
    { label: 'Bảo mật', to: '/admin/settings/security' },
    { label: 'Tích hợp', to: '/admin/settings/integrations' },
    { label: 'Danh mục', to: '/admin/settings/master-data' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Cấu hình hệ thống: doanh nghiệp, hiển thị, đặt tour, thanh toán, thông báo." title="Cấu hình" />

      <div className="overflow-hidden rounded-3xl bg-white p-4 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <NavLink key={t.to} className={tabClassName} to={t.to}>
              {t.label}
            </NavLink>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-blue-100 pt-3 text-xs text-slate-500">
          <div>
            {loading
              ? 'Đang tải cấu hình…'
              : settings?.updatedAt
                ? `Cập nhật: ${formatDateTime(settings.updatedAt)}`
                : ''}
            {!loading && !settings ? ` • URL: ${location.pathname}` : ''}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 shadow" />
            <span className="font-semibold text-slate-700">Lưu để áp dụng ngay</span>
          </div>
        </div>
      </div>

      {ctx ? <Outlet context={ctx satisfies AdminSettingsContext} /> : <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">Đang tải…</div>}
    </div>
  )
}
