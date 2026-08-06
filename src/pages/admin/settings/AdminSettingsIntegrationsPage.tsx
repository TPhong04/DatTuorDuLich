import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

function getText(v: unknown) {
  return typeof v === 'string' ? v : ''
}

type EmailProvider = 'smtp' | 'none'
type SmsProvider = 'none' | 'twilio' | 'other'
type ZaloProvider = 'none' | 'zalo_oa'

function getEmailProvider(v: unknown): EmailProvider {
  return v === 'smtp' || v === 'none' ? v : 'none'
}
function getSmsProvider(v: unknown): SmsProvider {
  return v === 'none' || v === 'twilio' || v === 'other' ? v : 'none'
}
function getZaloProvider(v: unknown): ZaloProvider {
  return v === 'none' || v === 'zalo_oa' ? v : 'none'
}

export default function AdminSettingsIntegrationsPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const integrations = settings.integrations ?? {}

  const [publicBaseUrl, setPublicBaseUrl] = useState('')
  const [emailProvider, setEmailProvider] = useState<EmailProvider>('none')
  const [smsProvider, setSmsProvider] = useState<SmsProvider>('none')
  const [zaloProvider, setZaloProvider] = useState<ZaloProvider>('none')

  useEffect(() => {
    setPublicBaseUrl(getText((integrations as any).publicBaseUrl))
    setEmailProvider(getEmailProvider((integrations as any).emailProvider))
    setSmsProvider(getSmsProvider((integrations as any).smsProvider))
    setZaloProvider(getZaloProvider((integrations as any).zaloProvider))
  }, [integrations])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('integrations', {
      publicBaseUrl: publicBaseUrl || undefined,
      emailProvider,
      smsProvider,
      zaloProvider,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Chọn provider và các thông số công khai. Secrets sẽ để trong .env theo môi trường." title="Tích hợp" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Public Base URL</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setPublicBaseUrl(e.target.value)}
            placeholder="https://your-domain.com"
            value={publicBaseUrl}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Email Provider</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setEmailProvider(e.target.value as EmailProvider)}
              value={emailProvider}
            >
              <option value="none">none</option>
              <option value="smtp">smtp</option>
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">SMS Provider</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setSmsProvider(e.target.value as SmsProvider)}
              value={smsProvider}
            >
              <option value="none">none</option>
              <option value="twilio">twilio</option>
              <option value="other">other</option>
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Zalo Provider</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setZaloProvider(e.target.value as ZaloProvider)}
              value={zaloProvider}
            >
              <option value="none">none</option>
              <option value="zalo_oa">zalo_oa</option>
            </select>
          </label>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Các khóa bí mật (SMTP user/pass, API key SMS/Zalo) sẽ cấu hình trong .env theo môi trường dev/prod.
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

