import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

function getText(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function getBool(v: unknown, fallback: boolean) {
  return typeof v === 'boolean' ? v : fallback
}

function getStringArray(v: unknown) {
  if (!Array.isArray(v)) return []
  return v.filter((x) => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
}

function toLines(arr: string[]) {
  return arr.join('\n')
}

function fromLines(input: string) {
  return input
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

export default function AdminSettingsHomePage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const home = settings.home ?? {}

  const [heroTitle, setHeroTitle] = useState('')
  const [heroSubtitle, setHeroSubtitle] = useState('')
  const [showQuickSearch, setShowQuickSearch] = useState(true)
  const [featuredTagsText, setFeaturedTagsText] = useState('')
  const [featuredDestinationsText, setFeaturedDestinationsText] = useState('')

  useEffect(() => {
    setHeroTitle(getText((home as any).heroTitle))
    setHeroSubtitle(getText((home as any).heroSubtitle))
    setShowQuickSearch(getBool((home as any).showQuickSearch, true))
    setFeaturedTagsText(toLines(getStringArray((home as any).featuredTags)))
    setFeaturedDestinationsText(toLines(getStringArray((home as any).featuredDestinations)))
  }, [home])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('home', {
      heroTitle: heroTitle || undefined,
      heroSubtitle: heroSubtitle || undefined,
      showQuickSearch,
      featuredTags: fromLines(featuredTagsText),
      featuredDestinations: fromLines(featuredDestinationsText),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Tiêu đề hero, bật/tắt quick search, gợi ý tag/điểm đến." title="Trang chủ" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Hero Title</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setHeroTitle(e.target.value)}
              value={heroTitle}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Hero Subtitle</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setHeroSubtitle(e.target.value)}
              value={heroSubtitle}
            />
          </label>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input checked={showQuickSearch} className="h-4 w-4" onChange={(e) => setShowQuickSearch(e.target.checked)} type="checkbox" />
          <div className="text-sm font-semibold text-slate-900">Hiển thị Quick Search</div>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Featured Tags (mỗi dòng 1 tag)</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setFeaturedTagsText(e.target.value)}
              value={featuredTagsText}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Featured Destinations (mỗi dòng 1 điểm đến)</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setFeaturedDestinationsText(e.target.value)}
              value={featuredDestinationsText}
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

