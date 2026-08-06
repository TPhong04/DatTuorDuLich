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

export default function AdminSettingsNotificationsPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const n = settings.notifications ?? {}

  const [enableInApp, setEnableInApp] = useState(true)
  const [enableEmail, setEnableEmail] = useState(false)
  const [enableSms, setEnableSms] = useState(false)
  const [enableZalo, setEnableZalo] = useState(false)

  const [bookingCreated, setBookingCreated] = useState('')
  const [bookingConfirmed, setBookingConfirmed] = useState('')
  const [bookingCancelled, setBookingCancelled] = useState('')
  const [groupTourQuoteSent, setGroupTourQuoteSent] = useState('')

  useEffect(() => {
    setEnableInApp(getBool((n as any).enableInApp, true))
    setEnableEmail(getBool((n as any).enableEmail, false))
    setEnableSms(getBool((n as any).enableSms, false))
    setEnableZalo(getBool((n as any).enableZalo, false))

    setBookingCreated(getText((n as any)?.templates?.bookingCreated))
    setBookingConfirmed(getText((n as any)?.templates?.bookingConfirmed))
    setBookingCancelled(getText((n as any)?.templates?.bookingCancelled))
    setGroupTourQuoteSent(getText((n as any)?.templates?.groupTourQuoteSent))
  }, [n])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('notifications', {
      enableInApp,
      enableEmail,
      enableSms,
      enableZalo,
      templates: {
        bookingCreated: bookingCreated || undefined,
        bookingConfirmed: bookingConfirmed || undefined,
        bookingCancelled: bookingCancelled || undefined,
        groupTourQuoteSent: groupTourQuoteSent || undefined,
      },
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Bật/tắt kênh và template nội dung (v1.0 làm core trước, tích hợp gửi thật sau)." title="Thông báo" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <div className="grid gap-3 md:grid-cols-4">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input checked={enableInApp} className="h-4 w-4" onChange={(e) => setEnableInApp(e.target.checked)} type="checkbox" />
            <div className="text-sm font-semibold text-slate-900">In-app</div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input checked={enableEmail} className="h-4 w-4" onChange={(e) => setEnableEmail(e.target.checked)} type="checkbox" />
            <div className="text-sm font-semibold text-slate-900">Email</div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input checked={enableSms} className="h-4 w-4" onChange={(e) => setEnableSms(e.target.checked)} type="checkbox" />
            <div className="text-sm font-semibold text-slate-900">SMS</div>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input checked={enableZalo} className="h-4 w-4" onChange={(e) => setEnableZalo(e.target.checked)} type="checkbox" />
            <div className="text-sm font-semibold text-slate-900">Zalo</div>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Template: Booking Created</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setBookingCreated(e.target.value)}
              value={bookingCreated}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Template: Booking Confirmed</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setBookingConfirmed(e.target.value)}
              value={bookingConfirmed}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Template: Booking Cancelled</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setBookingCancelled(e.target.value)}
              value={bookingCancelled}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Template: Group Tour Quote Sent</div>
            <textarea
              className="mt-2 min-h-[140px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setGroupTourQuoteSent(e.target.value)}
              value={groupTourQuoteSent}
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

