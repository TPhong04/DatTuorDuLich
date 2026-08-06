import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

function getText(v: unknown) {
  return typeof v === 'string' ? v : ''
}

export default function AdminSettingsCompanyPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const company = settings.company ?? {}

  const [name, setName] = useState('')
  const [slogan, setSlogan] = useState('')
  const [address, setAddress] = useState('')
  const [hotline, setHotline] = useState('')
  const [email, setEmail] = useState('')
  const [workingHours, setWorkingHours] = useState('')
  const [facebook, setFacebook] = useState('')
  const [youtube, setYoutube] = useState('')
  const [tiktok, setTiktok] = useState('')

  useEffect(() => {
    setName(getText((company as any).name))
    setSlogan(getText((company as any).slogan))
    setAddress(getText((company as any).address))
    setHotline(getText((company as any).hotline))
    setEmail(getText((company as any).email))
    setWorkingHours(getText((company as any).workingHours))
    setFacebook(getText((company as any)?.socials?.facebook))
    setYoutube(getText((company as any)?.socials?.youtube))
    setTiktok(getText((company as any)?.socials?.tiktok))
  }, [company])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('company', {
      name: name || undefined,
      slogan: slogan || undefined,
      address: address || undefined,
      hotline: hotline || undefined,
      email: email || undefined,
      workingHours: workingHours || undefined,
      socials: {
        facebook: facebook || undefined,
        youtube: youtube || undefined,
        tiktok: tiktok || undefined,
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Tên công ty, hotline, email, địa chỉ, social links." title="Doanh nghiệp" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Tên công ty</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Slogan</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setSlogan(e.target.value)}
              value={slogan}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Hotline</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setHotline(e.target.value)}
              value={hotline}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Email CSKH</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Địa chỉ</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setAddress(e.target.value)}
            value={address}
          />
        </label>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Giờ làm việc</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setWorkingHours(e.target.value)}
            value={workingHours}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Facebook</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setFacebook(e.target.value)}
              value={facebook}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">YouTube</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setYoutube(e.target.value)}
              value={youtube}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">TikTok</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setTiktok(e.target.value)}
              value={tiktok}
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600"
            type="submit"
          >
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}

