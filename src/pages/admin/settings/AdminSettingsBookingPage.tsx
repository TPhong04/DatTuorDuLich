import { FormEvent, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'
import { AdminSettingsContext } from './AdminSettingsLayout'

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

function getText(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function getNumber(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function getStatus(v: unknown): BookingStatus {
  if (v === 'pending' || v === 'confirmed' || v === 'cancelled' || v === 'completed') return v
  return 'pending'
}

export default function AdminSettingsBookingPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const booking = settings.booking ?? {}

  const [defaultStatus, setDefaultStatus] = useState<BookingStatus>('pending')
  const [holdMinutes, setHoldMinutes] = useState(0)
  const [cancelPolicyText, setCancelPolicyText] = useState('')

  useEffect(() => {
    setDefaultStatus(getStatus((booking as any).defaultStatus))
    setHoldMinutes(getNumber((booking as any).holdMinutes, 0))
    setCancelPolicyText(getText((booking as any).cancelPolicyText))
  }, [booking])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('booking', {
      defaultStatus,
      holdMinutes,
      cancelPolicyText: cancelPolicyText || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Trạng thái mặc định, giữ chỗ, nội dung chính sách huỷ/đổi." title="Đặt tour" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Trạng thái mặc định</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setDefaultStatus(e.target.value as BookingStatus)}
              value={defaultStatus}
            >
              <option value="pending">pending</option>
              <option value="confirmed">confirmed</option>
              <option value="cancelled">cancelled</option>
              <option value="completed">completed</option>
            </select>
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Giữ chỗ (phút)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              min={0}
              onChange={(e) => setHoldMinutes(Number(e.target.value))}
              type="number"
              value={holdMinutes}
            />
          </label>
        </div>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Chính sách huỷ/đổi (hiển thị cho khách)</div>
          <textarea
            className="mt-2 min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setCancelPolicyText(e.target.value)}
            value={cancelPolicyText}
          />
        </label>

        <div className="flex justify-end">
          <button className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-600" type="submit">
            Lưu
          </button>
        </div>
      </form>
    </div>
  )
}

