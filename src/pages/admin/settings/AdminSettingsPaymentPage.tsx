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

function getNumber(v: unknown, fallback: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export default function AdminSettingsPaymentPage() {
  const { settings, saveSection } = useOutletContext<AdminSettingsContext>()
  const payment = settings.payment ?? {}

  const [enableDeposit, setEnableDeposit] = useState(true)
  const [depositPercent, setDepositPercent] = useState(30)
  const [paymentGuideText, setPaymentGuideText] = useState('')

  useEffect(() => {
    setEnableDeposit(getBool((payment as any).enableDeposit, true))
    setDepositPercent(getNumber((payment as any).depositPercent, 30))
    setPaymentGuideText(getText((payment as any).paymentGuideText))
  }, [payment])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    await saveSection('payment', {
      enableDeposit,
      depositPercent,
      paymentGuideText: paymentGuideText || undefined,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Bật/tắt đặt cọc, % đặt cọc, hướng dẫn thanh toán mô phỏng." title="Thanh toán" />
      <form className="space-y-4 rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100" onSubmit={onSubmit}>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input checked={enableDeposit} className="h-4 w-4" onChange={(e) => setEnableDeposit(e.target.checked)} type="checkbox" />
          <div className="text-sm font-semibold text-slate-900">Cho phép đặt cọc</div>
        </label>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">% đặt cọc</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            max={100}
            min={0}
            onChange={(e) => setDepositPercent(Number(e.target.value))}
            type="number"
            value={depositPercent}
          />
        </label>

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Hướng dẫn thanh toán (hiển thị cho khách)</div>
          <textarea
            className="mt-2 min-h-[160px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setPaymentGuideText(e.target.value)}
            value={paymentGuideText}
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

