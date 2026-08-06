import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import { BookingWizardProvider, useBookingWizard } from '@/features/bookings/BookingWizardContext'
import { BookingPassenger, BookingSurchargeLine, createPublicBooking } from '@/features/bookings/bookings'
import { getPublicTour } from '@/features/tours/tours'
import { useAuth } from '@/features/auth/auth.hooks'
import type { PublicTourDetail, PublicTourDeparture } from '@/features/tours/tours'
import type { BookingPaymentMethod } from '@/features/bookings/bookings'
import { BookingPageSuccess } from '@/pages/BookingPageSuccess'
import { formatDate as fmtDate, toInputDate, toISODateOnly } from '@/utils/date'

function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i -= 1) if (pred(arr[i])) return i
  return -1
}

function formatDate(v: string | Date | null | undefined) {
  return fmtDate(v)
}
function toLocalDate(v: string | Date | null | undefined) {
  return toInputDate(v)
}
function formatMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

function WizardSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ['Chọn đợt & số khách', 'Thông tin hành khách', 'Thanh toán & xác nhận', 'Đặt thành công'] as const
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-4 py-5">
        {labels.map((label, idx) => {
          const i = (idx + 1) as 1 | 2 | 3 | 4
          const active = i === step
          const done = i < step
          return (
            <div key={label} className="flex min-w-[180px] shrink-0 items-center gap-3">
              <div
                className={
                  'flex h-9 w-9 items-center justify-center rounded-full text-sm font-extrabold shadow-sm ' +
                  (active
                    ? 'bg-orange-500 text-white ring-4 ring-orange-100'
                    : done
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500')
                }
              >
                {done ? '✓' : i}
              </div>
              <div className="min-w-0">
                <div className={'truncate text-[11px] uppercase tracking-wide ' + (active || done ? 'font-bold text-slate-800' : 'text-slate-400')}>
                  Bước {i}
                </div>
                <div className={'truncate text-sm font-semibold ' + (active || done ? 'text-slate-900' : 'text-slate-400')}>{label}</div>
              </div>
              {i < 4 ? <div className={'mx-2 h-[2px] w-14 rounded-full ' + (done ? 'bg-emerald-500' : 'bg-slate-200')} /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaxStepper({ label, value, onChange, max = 20 }: { label: string; value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3">
      <div>
        <div className="text-sm font-extrabold text-slate-800">{label}</div>
        <div className="text-xs text-slate-500">Tối đa {max} người</div>
      </div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onChange(Math.max(0, value - 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-lg font-bold text-slate-600 hover:bg-slate-100">
          −
        </button>
        <span className="w-6 text-center text-lg font-extrabold text-slate-900">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-lg font-bold text-orange-700 hover:bg-orange-100">
          +
        </button>
      </div>
    </div>
  )
}

function SectionCard({ title, desc, children, right }: { title: string; desc?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">{title}</h3>
          {desc ? <p className="mt-0.5 text-xs text-slate-500">{desc}</p> : null}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  )
}

function SidebarSummary({ tour, dep }: { tour: PublicTourDetail | null; dep: PublicTourDeparture | null }) {
  const { totalPax, draft } = useBookingWizard()
  const prices = useMemo(() => {
    if (!dep) return { adult: 0, child: 0, infant: 0, subtotal: 0 }
    const a = (draft.pax.adult || 0) * (dep.priceAdult || 0)
    const c = (draft.pax.child || 0) * (typeof dep.priceChild === 'number' ? dep.priceChild : 0)
    const i = (draft.pax.infant || 0) * (typeof dep.priceInfant === 'number' ? dep.priceInfant : 0)
    return { adult: a, child: c, infant: i, subtotal: a + c + i }
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, dep])
  return (
    <div className="sticky top-6 space-y-4">
      {tour ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative aspect-[16/9] w-full bg-slate-100">
            {tour.coverImageUrl ? <img alt={tour.title} src={tour.coverImageUrl} className="h-full w-full object-cover" /> : null}
            {dep?.discountPercent ? (
              <span className="absolute left-3 top-3 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-extrabold text-white shadow">
                -{dep.discountPercent}%
              </span>
            ) : null}
          </div>
          <div className="space-y-3 p-4">
            <Link to={`/tours/${tour.slug}`} className="line-clamp-2 text-base font-extrabold text-slate-900 hover:text-orange-600">{tour.title}</Link>
            <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-xs text-slate-600">
              <span className="text-slate-400">Ngày đi</span>
              <span className="font-semibold text-slate-800">{dep ? formatDate(dep.departureDate) : '-'}</span>
              <span className="text-slate-400">Tiêu chuẩn</span>
              <span className="font-semibold text-slate-800">{dep?.standardText || '-'}</span>
              <span className="text-slate-400">Thời gian</span>
              <span className="font-semibold text-slate-800">{tour.durationDays}N{tour.durationNights}Đ</span>
              <span className="text-slate-400">Khởi hành</span>
              <span className="font-semibold text-slate-800">{tour.departureFrom || '-'}</span>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-xs">
              {(draft.pax.adult || 0) > 0 ? <div className="flex items-center justify-between"><span>NL × {draft.pax.adult}</span><span className="font-bold text-slate-800">{formatMoney(prices.adult)}</span></div> : null}
              {(draft.pax.child || 0) > 0 ? <div className="mt-1 flex items-center justify-between"><span>TE × {draft.pax.child}</span><span className="font-bold text-slate-800">{formatMoney(prices.child)}</span></div> : null}
              {(draft.pax.infant || 0) > 0 ? <div className="mt-1 flex items-center justify-between"><span>EB × {draft.pax.infant}</span><span className="font-bold text-slate-800">{formatMoney(prices.infant)}</span></div> : null}
              <div className="mt-3 border-t border-slate-200 pt-2 flex items-center justify-between">
                <span className="font-extrabold text-slate-900">Tạm tính ({totalPax} khách)</span>
                <span className="text-base font-extrabold text-orange-600">{formatMoney(prices.subtotal)}</span>
              </div>
              <div className="mt-1 text-[11px] italic text-slate-400">Đã bao gồm VAT, chưa bao gồm phụ thu chọn thêm (nếu có)</div>
            </div>
            {dep && (dep.seatsAvailable < 20) ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                🔥 Chỉ còn {dep.seatsAvailable} chỗ — nhanh tay đặt trước khi hết
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400 shadow-sm">Đang tải thông tin tour...</div>
      )}
    </div>
  )
}

function Step1({ onNext, tour, toast }: { onNext: () => void; tour: PublicTourDetail | null; toast: ReturnType<typeof useToast> }) {
  const { draft, setDepartureId, setPax } = useBookingWizard()
  const nextDep = useMemo(() => (tour?.departures || []).find((d) => d.status === 'open'), [tour?.departures])
  const selectedDep = useMemo(() => {
    if (!tour) return null
    const list = tour.departures || []
    if (draft.departureId) {
      const exact = list.find((d) => d.id === draft.departureId)
      if (exact) return exact
    }
    return nextDep ?? null
  }, [tour, draft.departureId, nextDep])
  useEffect(() => {
    if (selectedDep?.id && selectedDep.id !== draft.departureId) setDepartureId(selectedDep.id)
  }, [selectedDep?.id])
  return (
    <div className="space-y-5">
      <SectionCard title="1. Chọn đợt khởi hành" desc="Chọn ngày khởi hành phù hợp lịch trình và ngân sách của bạn.">
        <div className="rounded-2xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-3 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div className="col-span-3">Ngày đi</div>
            <div className="col-span-2">Tiêu chuẩn</div>
            <div className="col-span-2 text-right">Giá NL</div>
            <div className="col-span-2 text-right">Còn chỗ</div>
            <div className="col-span-3 text-right">Chọn</div>
          </div>
          <div className="divide-y divide-slate-100">
            {tour?.departures?.length ? tour.departures.map((d) => {
              const active = selectedDep?.id === d.id
              const disabled = d.status === 'closed' || d.status === 'cancelled' || d.status === 'soldout'
              return (
                <button type="button" onClick={() => !disabled && d.id && setDepartureId(d.id)} key={d.id || String(d.departureDate)} disabled={disabled} className={'grid w-full grid-cols-12 gap-3 items-center px-4 py-3 text-left text-sm transition ' + (active ? 'bg-orange-50/80' : 'hover:bg-slate-50') + (disabled ? ' opacity-60 cursor-not-allowed' : '')}>
                  <div className="col-span-3 font-bold text-slate-800">{formatDate(d.departureDate)}</div>
                  <div className="col-span-2 text-slate-700">{d.standardText || '5 sao'}</div>
                  <div className="col-span-2 text-right">
                    {d.discountPercent ? <div className="inline-flex items-center gap-1.5"><span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-extrabold text-white">-{d.discountPercent}%</span><span className="font-extrabold text-orange-600">{formatMoney(d.priceAdult)}</span></div> : <span className="font-extrabold text-slate-900">{formatMoney(d.priceAdult)}</span>}
                  </div>
                  <div className="col-span-2 text-right font-semibold text-slate-700">{d.seatsAvailable || 0} / {d.seatsTotal || 0}</div>
                  <div className="col-span-3 text-right">
                    <span className={'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ' + (active ? 'bg-orange-500 text-white' : disabled ? 'bg-slate-100 text-slate-400' : 'bg-white border border-slate-200 text-slate-700 hover:border-orange-300 hover:text-orange-600')}>
                      {active ? '✓ Đã chọn' : disabled ? (d.status === 'soldout' ? 'Hết chỗ' : 'Đã đóng') : 'Chọn đợt này'}
                    </span>
                  </div>
                </button>
              )
            }) : <div className="p-6 text-center text-sm text-slate-400">Tour này chưa có lịch khởi hành, vui lòng quay lại sau.</div>}
          </div>
        </div>
      </SectionCard>
      <SectionCard title="2. Chọn số lượng hành khách" desc="Người lớn (≥ 11 tuổi) · Trẻ em (2–10) · Em bé (< 2 tuổi).">
        <div className="grid gap-3 md:grid-cols-3">
          <PaxStepper label="👤 Người lớn (NL)" value={draft.pax.adult} onChange={(n) => setPax({ adult: n })} />
          <PaxStepper label="🧒 Trẻ em (TE)" value={draft.pax.child} onChange={(n) => setPax({ child: n })} />
          <PaxStepper label="👶 Em bé (EB)" value={draft.pax.infant} onChange={(n) => setPax({ infant: n })} />
        </div>
      </SectionCard>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!selectedDep) return toast.error('Vui lòng chọn đợt khởi hành trước khi tiếp tục.')
            const total = draft.pax.adult + draft.pax.child + draft.pax.infant
            if (total <= 0) return toast.error('Vui lòng chọn ít nhất 1 hành khách.')
            if (total > 20) return toast.error('1 lần đặt tối đa 20 hành khách, đoàn lớn vui lòng liên hệ.')
            if (selectedDep.seatsAvailable < total) return toast.error(`Chỉ còn ${selectedDep.seatsAvailable} chỗ, vui lòng giảm số lượng hành khách.`)
            onNext()
          }}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-8 text-sm font-extrabold uppercase text-white shadow-sm shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-60"
        >
          Tiếp tục →
        </button>
      </div>
    </div>
  )
}

function PassengerCard({ idx, passenger, onChange, onRemove, canRemove }: { idx: number; passenger: BookingPassenger; onChange: (p: BookingPassenger) => void; onRemove?: () => void; canRemove?: boolean }) {
  const [dateVal, setDateVal] = useState<string>(() => toInputDate(passenger.birthDate))
  useEffect(() => {
    const expected = toInputDate(passenger.birthDate)
    if (expected !== dateVal) setDateVal(expected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passenger.birthDate])
  const commitBirthDateIfReady = (forceClear = false) => {
    const trimmed = dateVal.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const iso = toISODateOnly(trimmed)
      if ((passenger.birthDate || '').slice(0, 10) !== (iso || '').slice(0, 10)) {
        onChange({ ...passenger, birthDate: iso })
      }
      return true
    }
    if (forceClear && trimmed === '') {
      if (passenger.birthDate !== null) onChange({ ...passenger, birthDate: null })
      return true
    }
    return false
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-extrabold text-white">#{idx + 1}</span>
          <span className="text-sm font-extrabold text-slate-900">Hành khách</span>
          <span
            className={
              'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ' +
              (passenger.type === 'NL'
                ? 'bg-blue-50 text-blue-700'
                : passenger.type === 'TE'
                ? 'bg-violet-50 text-violet-700'
                : 'bg-pink-50 text-pink-700')
            }
          >
            {passenger.type}
          </span>
        </div>
        {canRemove ? (
          <button type="button" onClick={onRemove} className="text-xs font-bold text-rose-500 hover:text-rose-700">
            Xoá
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Loại hành khách</label>
          <select value={passenger.type} onChange={(e) => onChange({ ...passenger, type: e.target.value as any })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4">
            <option value="NL">Người lớn (NL)</option>
            <option value="TE">Trẻ em (TE)</option>
            <option value="EB">Em bé (EB)</option>
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Họ tên *</label>
          <input value={passenger.fullName} onChange={(e) => onChange({ ...passenger, fullName: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="VD: Nguyễn Văn A" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ngày sinh</label>
          <input
            type="date"
            value={dateVal}
            onChange={(e) => {
              const v = e.target.value
              setDateVal(v)
              if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
                const iso = toISODateOnly(v)
                if ((passenger.birthDate || '').slice(0, 10) !== (iso || '').slice(0, 10)) {
                  onChange({ ...passenger, birthDate: iso })
                }
              }
            }}
            onBlur={() => commitBirthDateIfReady(true)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
            className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4"
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Giới tính</label>
          <select value={passenger.gender || ''} onChange={(e) => onChange({ ...passenger, gender: (e.target.value || null) as any })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4">
            <option value="">Không chọn</option>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div className="md:col-span-2 grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">CCCD / CMND / Passport</label>
            <input value={passenger.idCard || ''} onChange={(e) => onChange({ ...passenger, idCard: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Không bắt buộc" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Yêu cầu riêng</label>
            <input value={passenger.notes || ''} onChange={(e) => onChange({ ...passenger, notes: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Ăn chay / Phòng gần thang máy..." />
          </div>
        </div>
      </div>
    </div>
  )
}

function Step2({ onNext, onPrev, toast }: { onNext: () => void; onPrev: () => void; toast: ReturnType<typeof useToast> }) {
  const { draft, totalPax } = useBookingWizard()
  const auth = useAuth()
  const [contact, setContact] = useState(() => {
    const u = auth.user
    return {
      name: u?.name || '',
      phone: u?.phone || '',
      email: u?.email || '',
      address: '',
    }
  })
  const [passengers, setPassengers] = useState<BookingPassenger[]>(() => {
    const arr: BookingPassenger[] = []
    for (let i = 0; i < draft.pax.adult; i += 1) arr.push({ fullName: '', type: 'NL', birthDate: null, gender: null, idCard: null, notes: null })
    for (let i = 0; i < draft.pax.child; i += 1) arr.push({ fullName: '', type: 'TE', birthDate: null, gender: null, idCard: null, notes: null })
    for (let i = 0; i < draft.pax.infant; i += 1) arr.push({ fullName: '', type: 'EB', birthDate: null, gender: null, idCard: null, notes: null })
    return arr
  })
  const [notes, setNotes] = useState('')
  useEffect(() => {
    setPassengers((prev) => {
      const counts = { NL: draft.pax.adult, TE: draft.pax.child, EB: draft.pax.infant }
      const cur = { NL: prev.filter((p) => p.type === 'NL').length, TE: prev.filter((p) => p.type === 'TE').length, EB: prev.filter((p) => p.type === 'EB').length }
      if (cur.NL === counts.NL && cur.TE === counts.TE && cur.EB === counts.EB && prev.length === totalPax) return prev
      const out: BookingPassenger[] = [...prev]
      // remove extras
      for (const t of ['NL', 'TE', 'EB'] as const) {
        let curT = out.filter((p) => p.type === t).length
        while (curT > counts[t]) {
          const idx = findLastIndex(out, (p) => p.type === t && !p.fullName)
          const idxFallback = findLastIndex(out, (p) => p.type === t)
          const rm = idx >= 0 ? idx : idxFallback
          if (rm >= 0) { out.splice(rm, 1); curT -= 1 } else break
        }
      }
      // add missing
      for (const t of ['NL', 'TE', 'EB'] as const) {
        let curT = out.filter((p) => p.type === t).length
        while (curT < counts[t]) { out.push({ fullName: '', type: t, birthDate: null, gender: null, idCard: null, notes: null }); curT += 1 }
      }
      return out.slice(0, totalPax)
    })
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, totalPax])
  const [sharedState, setShared] = useState<{ contact: typeof contact; notes: string; passengers: BookingPassenger[] } | null>(null)
  useEffect(() => {
    window['__booking_step2'] = { contact, notes, passengers }
    setShared({ contact, notes, passengers })
  }, [contact, notes, passengers])
  void sharedState
  return (
    <div className="space-y-5">
      <SectionCard title="Thông tin người đặt" desc="Chúng tôi sẽ gọi điện xác nhận đơn đặt của bạn qua SĐT này.">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Họ tên *</label>
            <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Số điện thoại *</label>
            <input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="09xx xxx xxx" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
            <input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="email@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Địa chỉ</label>
            <input value={contact.address} onChange={(e) => setContact((c) => ({ ...c, address: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Hà Nội / HCM..." />
          </div>
        </div>
      </SectionCard>
      <SectionCard title={`Danh sách hành khách (${totalPax} người)`} desc={`NL: ${draft.pax.adult} · TE: ${draft.pax.child} · EB: ${draft.pax.infant}`}>
        <div className="space-y-3">
          {passengers.map((p, i) => (
            <PassengerCard
              key={i}
              idx={i}
              passenger={p}
              onChange={(np) => setPassengers((list) => list.map((pp, ii) => (ii === i ? np : pp)))}
            />
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Ghi chú cho đoàn" desc="Để lại lời nhắn cho chuyên viên tư vấn, yêu cầu ăn kiêng, phòng tầng thấp...">
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Ghi chú..." />
      </SectionCard>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrev} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 text-sm font-extrabold uppercase text-slate-700 hover:bg-slate-50">← Quay lại</button>
        <button
          type="button"
          onClick={() => {
            if (!contact.name.trim()) return toast.error('Vui lòng nhập Họ tên người đặt.')
            if (!contact.phone.trim() || contact.phone.replace(/\D/g, '').length < 8) return toast.error('Vui lòng nhập số điện thoại hợp lệ.')
            const emailRaw = (contact.email || '').trim()
            if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
              return toast.error('Email không hợp lệ, vui lòng nhập lại hoặc để trống.')
            }
            const finalContact = { ...contact, email: emailRaw || null, address: (contact.address || '').trim() || null }
            const missing = passengers.findIndex((p) => !p.fullName.trim())
            if (missing >= 0) return toast.error(`Hành khách ${missing + 1} chưa nhập Họ tên.`)
            const counts = { NL: 0, TE: 0, EB: 0 }
            passengers.forEach((p) => { counts[p.type] += 1 })
            if (counts.NL !== draft.pax.adult || counts.TE !== draft.pax.child || counts.EB !== draft.pax.infant) {
              return toast.error(`Tổng số lượng hành khách không khớp NL:${counts.NL}/${draft.pax.adult} · TE:${counts.TE}/${draft.pax.child} · EB:${counts.EB}/${draft.pax.infant}.`)
            }
            const finalPassengers = passengers.map((p) => ({
              ...p,
              fullName: p.fullName.trim(),
              idCard: typeof p.idCard === 'string' ? p.idCard.trim() || null : p.idCard,
              notes: typeof p.notes === 'string' ? p.notes.trim() || null : p.notes,
            }))
            window['__booking_step2_final'] = { contact: finalContact, notes: notes.trim() || null, passengers: finalPassengers }
            onNext()
          }}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-8 text-sm font-extrabold uppercase text-white shadow-sm shadow-orange-500/30 hover:bg-orange-600"
        >
          Tiếp tục →
        </button>
      </div>
    </div>
  )
}

function Step3({ onPrev, onConfirm, tour, dep, toast }: { onPrev: () => void; onConfirm: (ok: { method: BookingPaymentMethod; surcharges: BookingSurchargeLine[]; agree: boolean }) => void; tour: PublicTourDetail | null; dep: PublicTourDeparture | null; toast: ReturnType<typeof useToast> }) {
  const { draft, totalPax } = useBookingWizard()
  const [method, setMethod] = useState<BookingPaymentMethod>('hold')
  const [agree, setAgree] = useState(false)
  const defaults = useMemo(() => (tour?.surcharges || []).map((s) => ({ label: s.label, quantity: 0, unitPrice: Number(s.amount || 0), note: null })), [tour?.surcharges])
  const [surcharges, setSurcharges] = useState<BookingSurchargeLine[]>(defaults)
  useEffect(() => { setSurcharges(defaults) }, [defaults])
  const paxPrices = useMemo(() => {
    if (!dep) return { adult: 0, child: 0, infant: 0, subtotal: 0 }
    const a = (draft.pax.adult || 0) * (dep.priceAdult || 0)
    const c = (draft.pax.child || 0) * (typeof dep.priceChild === 'number' ? dep.priceChild : 0)
    const i = (draft.pax.infant || 0) * (typeof dep.priceInfant === 'number' ? dep.priceInfant : 0)
    return { adult: a, child: c, infant: i, subtotal: a + c + i }
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, dep])
  const surchTotal = surcharges.reduce((s, l) => s + Math.max(0, l.quantity || 0) * Math.max(0, l.unitPrice || 0), 0)
  const grand = paxPrices.subtotal + surchTotal
  return (
    <div className="space-y-5">
      <SectionCard title="Dịch vụ bổ sung (phụ thu)" desc="Chọn thêm phụ thu nếu có nhu cầu đặt phòng riêng / bảo hiểm / đón trả sân bay.">
        {surcharges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-400">Tour này chưa cấu hình phụ thu. Bạn hãy để trống và tiếp tục.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              <div className="col-span-5">Tên dịch vụ</div>
              <div className="col-span-3 text-right">Đơn giá</div>
              <div className="col-span-2 text-right">Số lượng</div>
              <div className="col-span-2 text-right">Thành tiền</div>
            </div>
            <div className="divide-y divide-slate-100">
              {surcharges.map((l, idx) => (
                <div key={l.label + idx} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                  <div className="col-span-5 font-semibold text-slate-800">{l.label}</div>
                  <div className="col-span-3 text-right font-semibold text-slate-700">{formatMoney(l.unitPrice)}</div>
                  <div className="col-span-2 text-right">
                    <input type="number" min={0} step={1} value={l.quantity} onChange={(e) => setSurcharges((list) => list.map((x, i) => i === idx ? { ...x, quantity: Math.max(0, parseInt(e.target.value || '0', 10) || 0) } : x))} className="h-10 w-24 rounded-xl border border-slate-200 bg-white px-3 text-right outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
                  </div>
                  <div className="col-span-2 text-right font-extrabold text-slate-900">{formatMoney(Math.max(0, l.quantity || 0) * Math.max(0, l.unitPrice || 0))}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
      <SectionCard title="Bảng giá chi tiết" desc="Tổng hợp giá tour + dịch vụ bổ sung theo đúng ảnh mẫu Datviettour.">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <div className="col-span-5">Loại</div>
            <div className="col-span-2 text-center">SL</div>
            <div className="col-span-2 text-right">Đơn giá</div>
            <div className="col-span-3 text-right">Thành tiền</div>
          </div>
          <div className="divide-y divide-slate-100">
            {(draft.pax.adult || 0) > 0 ? (
              <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-5 font-semibold text-slate-800">Người lớn (NL)</div>
                <div className="col-span-2 text-center font-bold text-slate-900">{draft.pax.adult}</div>
                <div className="col-span-2 text-right">{formatMoney(dep?.priceAdult)}</div>
                <div className="col-span-3 text-right font-extrabold text-slate-900">{formatMoney(paxPrices.adult)}</div>
              </div>
            ) : null}
            {(draft.pax.child || 0) > 0 ? (
              <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-5 font-semibold text-slate-800">Trẻ em (TE)</div>
                <div className="col-span-2 text-center font-bold text-slate-900">{draft.pax.child}</div>
                <div className="col-span-2 text-right">{formatMoney(dep?.priceChild)}</div>
                <div className="col-span-3 text-right font-extrabold text-slate-900">{formatMoney(paxPrices.child)}</div>
              </div>
            ) : null}
            {(draft.pax.infant || 0) > 0 ? (
              <div className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-5 font-semibold text-slate-800">Em bé (EB)</div>
                <div className="col-span-2 text-center font-bold text-slate-900">{draft.pax.infant}</div>
                <div className="col-span-2 text-right">{formatMoney(dep?.priceInfant)}</div>
                <div className="col-span-3 text-right font-extrabold text-slate-900">{formatMoney(paxPrices.infant)}</div>
              </div>
            ) : null}
            {surcharges.filter((s) => (s.quantity || 0) > 0).map((l, idx) => (
              <div key={'s' + idx} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-5 font-semibold text-slate-700">◆ {l.label}</div>
                <div className="col-span-2 text-center font-bold text-slate-800">{l.quantity}</div>
                <div className="col-span-2 text-right">{formatMoney(l.unitPrice)}</div>
                <div className="col-span-3 text-right font-extrabold text-slate-900">{formatMoney((l.quantity || 0) * (l.unitPrice || 0))}</div>
              </div>
            ))}
            <div className="grid grid-cols-12 items-center gap-2 bg-slate-50/70 px-4 py-3 text-sm">
              <div className="col-span-7 font-bold text-slate-700">TẠM TÍNH ({totalPax} khách)</div>
              <div className="col-span-5 text-right font-extrabold text-slate-900">{formatMoney(paxPrices.subtotal)}</div>
            </div>
            {surchTotal > 0 ? (
              <div className="grid grid-cols-12 items-center gap-2 bg-slate-50/70 px-4 py-3 text-sm">
                <div className="col-span-7 font-bold text-slate-700">Phụ thu chọn thêm</div>
                <div className="col-span-5 text-right font-extrabold text-slate-900">{formatMoney(surchTotal)}</div>
              </div>
            ) : null}
            <div className="grid grid-cols-12 items-center gap-2 px-4 py-4 text-sm">
              <div className="col-span-7 text-[11px] italic text-slate-400">Đã bao gồm VAT</div>
              <div className="col-span-5 text-right text-[11px] text-slate-400">VAT 0đ</div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2 border-t-2 border-dashed border-orange-200 bg-orange-50/60 px-4 py-4">
              <div className="col-span-7 text-base font-extrabold uppercase tracking-wide text-orange-700">TỔNG CỘNG THÀNH TIỀN</div>
              <div className="col-span-5 text-right text-2xl font-black text-orange-600">{formatMoney(grand)}</div>
            </div>
          </div>
        </div>
      </SectionCard>
      <SectionCard title="Chọn hình thức thanh toán" desc="3 lựa chọn theo chuẩn Datviettour.">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { k: 'hold' as const, title: '💳 Giữ chỗ, thanh toán sau', desc: 'Nhân viên sẽ gọi xác nhận & hướng dẫn thanh toán tại VP / chuyển khoản.' },
            { k: 'bank_transfer' as const, title: '🏦 Chuyển khoản ngân hàng', desc: 'Quẹt mã QR / chuyển khoản vào TK ghi rõ mã đặt chỗ.' },
            { k: 'online' as const, title: '🌐 Thanh toán Online (VNPay / Momo)', desc: 'Tích hợp sau, chọn để trước nếu muốn thanh toán online nhanh.' },
          ].map((opt) => (
            <label key={opt.k} className={'flex cursor-pointer gap-3 rounded-2xl border p-4 transition ' + (method === opt.k ? 'border-orange-500 bg-orange-50/60 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
              <input type="radio" className="mt-1" value={opt.k} checked={method === opt.k} onChange={() => setMethod(opt.k)} />
              <div>
                <div className="text-sm font-extrabold text-slate-900">{opt.title}</div>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">{opt.desc}</p>
                {opt.k === 'bank_transfer' && method === opt.k ? (
                  <div className="mt-3 rounded-2xl border border-orange-200 bg-white p-3 text-xs">
                    <div className="font-bold text-slate-800">Ngân hàng Vietcombank</div>
                    <div>STK: <span className="font-extrabold text-slate-900">0231000xxxxxx</span></div>
                    <div>CTK: <span className="font-semibold">Công ty TNHH Du lịch Việt Nam Explorer</span></div>
                    <div className="mt-1 italic text-slate-500">Nội dung chuyển khoản: <span className="font-extrabold">DAT TOUR {tour?.code || 'TOUR'} [Mã đặt chỗ sẽ gửi sau xác nhận]</span></div>
                  </div>
                ) : null}
              </div>
            </label>
          ))}
        </div>
      </SectionCard>
      <SectionCard title="Điều khoản & Chính sách hủy" desc="Vui lòng đọc kỹ trước khi xác nhận.">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-orange-300">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-orange-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <div className="text-sm text-slate-700">
            <span className="font-extrabold text-slate-900">Tôi đã đọc và đồng ý với </span>
            <Link to="/terms" className="font-bold text-orange-600 hover:underline">Điều khoản dịch vụ</Link>
            <span> và </span>
            <Link to="/policy/cancel" className="font-bold text-orange-600 hover:underline">Chính sách hủy tour</Link>
            <span> của VietNamExplorer. Tôi hiểu thông tin đặt chỗ sẽ được giữ trong 15 phút và cần được nhân viên xác nhận lại qua điện thoại.</span>
          </div>
        </label>
      </SectionCard>
      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrev} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 text-sm font-extrabold uppercase text-slate-700 hover:bg-slate-50">← Quay lại</button>
        <button
          type="button"
          onClick={() => {
            if (!agree) return toast.error('Vui lòng đồng ý điều khoản & chính sách hủy trước khi đặt.')
            onConfirm({ method, surcharges, agree })
          }}
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-emerald-700 px-8 py-3 text-sm font-extrabold uppercase text-white shadow-md shadow-emerald-800/30 hover:bg-emerald-800 disabled:opacity-60"
        >
          ✅ Xác nhận đặt tour
        </button>
      </div>
    </div>
  )
}

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [sp] = useSearchParams()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [tour, setTour] = useState<PublicTourDetail | null>(null)
  const [loadingTour, setLoadingTour] = useState(true)
  const [errTour, setErrTour] = useState<string | null>(null)
  const [bookingCode, setBookingCode] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()
  const { draft, setDepartureId } = useBookingWizard()

  useEffect(() => {
    setLoadingTour(true)
    setErrTour(null)
    if (!slug) { setLoadingTour(false); setErrTour('Không tìm thấy tour'); return }
    let mounted = true
    getPublicTour(slug)
      .then((t) => { if (!mounted) return; setTour(t.tour); setLoadingTour(false) })
      .catch((e) => { if (!mounted) return; setErrTour((e as Error)?.message || 'Không tải được thông tin tour'); setLoadingTour(false) })
    return () => { mounted = false }
  }, [slug])

  useEffect(() => {
    if (!tour?.departures?.length) return
    const d = sp.get('d')
    if (d) {
      const matched = tour.departures.find((x) => x.id === d || String(x.id) === d)
      if (matched?.id && matched.id !== draft.departureId) setDepartureId(matched.id)
    }
  }, [tour?.departures, draft.departureId, setDepartureId, sp])

  const selectedDep = useMemo<PublicTourDeparture | null>(() => {
    if (!tour?.departures?.length) return null
    if (draft.departureId) {
      const exact = tour.departures.find((d) => d.id === draft.departureId)
      if (exact) return exact
    }
    return tour.departures.find((d) => d.status === 'open') ?? tour.departures[0] ?? null
  }, [tour, draft.departureId])

  if (loadingTour) return <div className="mx-auto w-full max-w-6xl px-4 py-16 text-sm text-slate-500">Đang tải thông tin đặt tour...</div>
  if (errTour || !tour) return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">Không tìm thấy tour</h1>
      <p className="mt-2 text-sm text-slate-500">{errTour || 'Vui lòng quay lại trang danh sách tour và chọn lại.'}</p>
      <Link to="/tours" className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-sm font-extrabold uppercase text-white hover:bg-orange-600">← Quay lại danh sách tour</Link>
    </div>
  )

  if (step === 4 && bookingCode) return <BookingPageSuccess code={bookingCode} tour={tour} />

  return (
    <div>
      <WizardSteps step={step} />
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="mb-5">
            <h1 className="text-2xl font-black text-slate-900">
              🎫 Đặt tour: <span className="text-orange-600">{tour.title}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">4 bước nhanh chóng. Xác nhận đơn sẽ được gửi qua SMS / email trong 30 phút.</p>
          </div>
          {step === 1 ? <Step1 toast={toast} tour={tour} onNext={() => setStep(2)} /> : null}
          {step === 2 ? <Step2 toast={toast} onPrev={() => setStep(1)} onNext={() => setStep(3)} /> : null}
          {step === 3 ? (
            <Step3
              toast={toast}
              dep={selectedDep}
              tour={tour}
              onPrev={() => setStep(2)}
              onConfirm={async ({ method, surcharges }) => {
                try {
                  const s2 = (window as any).__booking_step2_final
                  if (!s2) return toast.error('Vui lòng điền đầy đủ thông tin hành khách ở bước 2.')
                  const contact = s2.contact
                  const passengers = s2.passengers
                  const notes = s2.notes
                  if (!selectedDep?.id) return toast.error('Không xác định được đợt khởi hành, vui lòng thử lại.')
                  if (!draft.tourSlug) return toast.error('Thông tin tour không hợp lệ, hãy thử lại.')
                  // #region debug-point booking-create-500
                  const payload = {
                    departureId: selectedDep.id,
                    adultCount: draft.pax.adult,
                    childCount: draft.pax.child,
                    infantCount: draft.pax.infant,
                    contact,
                    passengers,
                    notes,
                    surcharges,
                    paymentMethod: method,
                    agreeTerms: true,
                  }
                  try {
                    await fetch('http://127.0.0.1:7777/event', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ session: 'booking-create-500', runId: 'pre', seq: 'FE', event: 'fe.submit', ts: Date.now(), draft: { tourSlug: draft.tourSlug, depId: draft.departureId }, selected: { depId: selectedDep.id, seatsAvailable: selectedDep.seatsAvailable, date: selectedDep.departureDate }, payloadKeys: Object.keys(payload as any), pax: { a: draft.pax.adult, c: draft.pax.child, i: draft.pax.infant }, passengersN: passengers?.length ?? -1, surchargesN: surcharges?.length ?? -1, passengerFirstIdCard: passengers?.[0]?.idCard ?? null, passengerFirstBirthday: passengers?.[0]?.birthDate ?? null, passengerFirstGender: passengers?.[0]?.gender ?? null }),
                    }).catch(() => {})
                  } catch {}
                  // #endregion
                  setSubmitting(true)
                  const created = await createPublicBooking(draft.tourSlug, payload)
                  setBookingCode(created.code)
                  setStep(4)
                  toast.success('Đơn đặt của bạn đã được ghi nhận. Nhân viên sẽ gọi xác nhận trong 30 phút tới.')
                } catch (e) {
                  toast.error((e as any)?.message || 'Gửi đơn đặt thất bại, xin vui lòng thử lại.')
                } finally {
                  setSubmitting(false)
                }
                void navigate
              }}
            />
          ) : null}
        </div>
        <SidebarSummary tour={tour} dep={selectedDep} />
      </div>
      {submitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-500" />
            <div className="mt-4 text-sm font-bold text-slate-900">Đang gửi đơn đặt...</div>
            <div className="mt-1 text-xs text-slate-500">Vui lòng chờ trong giây lát.</div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export { BookingPage }

export function BookingPageShell({ children, slug }: { children: React.ReactNode; slug?: string | null }) {
  const [sp] = useSearchParams()
  const dParam = sp.get('d')
  return <BookingWizardProvider initialTourSlug={slug || null} initialDepartureId={dParam}>{children}</BookingWizardProvider>
}
