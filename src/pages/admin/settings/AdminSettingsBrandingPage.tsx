import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import { AdminSettingsContext } from './AdminSettingsLayout'

function getText(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function getUrl(v: unknown) {
  return typeof v === 'string' && v ? v : ''
}

function getHexColor(v: string, fallback: string) {
  const trimmed = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed
  return fallback
}

export default function AdminSettingsBrandingPage() {
  const { settings, saveSection, uploadImage } = useOutletContext<AdminSettingsContext>()
  const branding = settings.branding ?? {}

  const [logoHeaderUrl, setLogoHeaderUrl] = useState('')
  const [logoFooterUrl, setLogoFooterUrl] = useState('')
  const [faviconUrl, setFaviconUrl] = useState('')
  const [topbarText, setTopbarText] = useState('')
  const [primaryColor, setPrimaryColor] = useState('')
  const [accentColor, setAccentColor] = useState('')
  const [busy, setBusy] = useState(false)

  const primaryColorHex = getHexColor(primaryColor, '#1d4ed8')
  const accentColorHex = getHexColor(accentColor, '#f97316')

  useEffect(() => {
    setLogoHeaderUrl(getUrl((branding as any).logoHeaderUrl))
    setLogoFooterUrl(getUrl((branding as any).logoFooterUrl))
    setFaviconUrl(getUrl((branding as any).faviconUrl))
    setTopbarText(getText((branding as any).topbarText))
    setPrimaryColor(getText((branding as any).primaryColor))
    setAccentColor(getText((branding as any).accentColor))
  }, [branding])

  const onPick = async (file: File | null, setter: (url: string) => void) => {
    if (!file) return
    setBusy(true)
    try {
      const url = await uploadImage(file, 'branding')
      setter(url)
    } finally {
      setBusy(false)
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('branding', {
      logoHeaderUrl: logoHeaderUrl || null,
      logoFooterUrl: logoFooterUrl || null,
      faviconUrl: faviconUrl || null,
      topbarText: topbarText || undefined,
      primaryColor: primaryColor || undefined,
      accentColor: accentColor || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Logo header/footer, favicon, topbar text, màu nhận diện." title="Nhận diện" />

      <form className="space-y-5 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Logo Header</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                {logoHeaderUrl ? <img alt="Logo header" className="h-full w-full object-contain" src={logoHeaderUrl} /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs text-slate-600">{logoHeaderUrl || 'Chưa có'}</div>
                <label className={cn('mt-2 inline-flex cursor-pointer rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-blue-800 ring-1 ring-slate-200', busy ? 'opacity-60 pointer-events-none' : '')}>
                  Upload
                  <input
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null, setLogoHeaderUrl)}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Logo Footer</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                {logoFooterUrl ? <img alt="Logo footer" className="h-full w-full object-contain" src={logoFooterUrl} /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs text-slate-600">{logoFooterUrl || 'Chưa có'}</div>
                <label className={cn('mt-2 inline-flex cursor-pointer rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-blue-800 ring-1 ring-slate-200', busy ? 'opacity-60 pointer-events-none' : '')}>
                  Upload
                  <input
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null, setLogoFooterUrl)}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Favicon</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                {faviconUrl ? <img alt="Favicon" className="h-full w-full object-contain" src={faviconUrl} /> : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs text-slate-600">{faviconUrl || 'Chưa có'}</div>
                <label className={cn('mt-2 inline-flex cursor-pointer rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-blue-800 ring-1 ring-slate-200', busy ? 'opacity-60 pointer-events-none' : '')}>
                  Upload
                  <input
                    className="hidden"
                    onChange={(e) => onPick(e.target.files?.[0] ?? null, setFaviconUrl)}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Topbar Text</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setTopbarText(e.target.value)}
            value={topbarText}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-sm font-semibold text-slate-900">Màu chủ đạo</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                className="h-11 w-14 cursor-pointer rounded-2xl border border-slate-200 bg-white p-1"
                onChange={(e) => setPrimaryColor(e.target.value)}
                type="color"
                value={primaryColorHex}
              />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-mono outline-none ring-orange-400/40 focus:ring-4"
                onBlur={() => {
                  const v = primaryColor.trim()
                  if (/^[0-9a-fA-F]{6}$/.test(v)) setPrimaryColor(`#${v}`)
                }}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder={primaryColorHex}
                value={primaryColor}
              />
              <div className="h-11 w-11 rounded-2xl border border-slate-200" style={{ backgroundColor: primaryColorHex }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{`Mã màu: ${primaryColorHex}`}</div>
          </div>

          <div>
            <div className="text-sm font-semibold text-slate-900">Màu nhấn</div>
            <div className="mt-2 flex items-center gap-3">
              <input
                className="h-11 w-14 cursor-pointer rounded-2xl border border-slate-200 bg-white p-1"
                onChange={(e) => setAccentColor(e.target.value)}
                type="color"
                value={accentColorHex}
              />
              <input
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-mono outline-none ring-orange-400/40 focus:ring-4"
                onBlur={() => {
                  const v = accentColor.trim()
                  if (/^[0-9a-fA-F]{6}$/.test(v)) setAccentColor(`#${v}`)
                }}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder={accentColorHex}
                value={accentColor}
              />
              <div className="h-11 w-11 rounded-2xl border border-slate-200" style={{ backgroundColor: accentColorHex }} />
            </div>
            <div className="mt-2 text-xs text-slate-500">{`Mã màu: ${accentColorHex}`}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600',
              busy ? 'opacity-70 pointer-events-none' : '',
            )}
            type="submit"
          >
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}
