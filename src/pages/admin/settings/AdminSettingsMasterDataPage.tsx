import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

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

export default function AdminSettingsMasterDataPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const md = settings.masterData ?? {}

  const [destinations, setDestinations] = useState('')
  const [departureFrom, setDepartureFrom] = useState('')
  const [transportTypes, setTransportTypes] = useState('')
  const [tags, setTags] = useState('')

  useEffect(() => {
    setDestinations(toLines(getStringArray((md as any).destinations)))
    setDepartureFrom(toLines(getStringArray((md as any).departureFrom)))
    setTransportTypes(toLines(getStringArray((md as any).transportTypes)))
    setTags(toLines(getStringArray((md as any).tags)))
  }, [md])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('masterData', {
      destinations: fromLines(destinations),
      departureFrom: fromLines(departureFrom),
      transportTypes: fromLines(transportTypes),
      tags: fromLines(tags),
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Danh mục dùng cho filter và gợi ý (mỗi dòng 1 mục)." title="Danh mục" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Điểm đến</div>
            <textarea
              className="mt-2 min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setDestinations(e.target.value)}
              value={destinations}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Khởi hành từ</div>
            <textarea
              className="mt-2 min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setDepartureFrom(e.target.value)}
              value={departureFrom}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Phương tiện</div>
            <textarea
              className="mt-2 min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setTransportTypes(e.target.value)}
              value={transportTypes}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Tags</div>
            <textarea
              className="mt-2 min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setTags(e.target.value)}
              value={tags}
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

