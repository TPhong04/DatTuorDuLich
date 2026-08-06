import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

function getNumber(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export default function AdminSettingsSecurityPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const security = settings.security ?? {}

  const [loginMaxAttempts, setLoginMaxAttempts] = useState(10)
  const [loginLockMinutes, setLoginLockMinutes] = useState(0)
  const [auditRetentionDays, setAuditRetentionDays] = useState(0)

  useEffect(() => {
    setLoginMaxAttempts(getNumber((security as any).loginMaxAttempts, 10))
    setLoginLockMinutes(getNumber((security as any).loginLockMinutes, 0))
    setAuditRetentionDays(getNumber((security as any).auditRetentionDays, 0))
  }, [security])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('security', {
      loginMaxAttempts,
      loginLockMinutes,
      auditRetentionDays,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Thiết lập giới hạn đăng nhập và chính sách lưu audit log." title="Bảo mật" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Login max attempts</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              max={20}
              min={1}
              onChange={(e) => setLoginMaxAttempts(Number(e.target.value))}
              type="number"
              value={loginMaxAttempts}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Lock minutes (0 = tắt)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              max={1440}
              min={0}
              onChange={(e) => setLoginLockMinutes(Number(e.target.value))}
              type="number"
              value={loginLockMinutes}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Audit retention days (0 = không tự xoá)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              max={3650}
              min={0}
              onChange={(e) => setAuditRetentionDays(Number(e.target.value))}
              type="number"
              value={auditRetentionDays}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600" type="submit">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}

