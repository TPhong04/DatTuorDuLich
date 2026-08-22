import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import { DateInput } from '@/components/ui/DateInput'
import { BookingWizardProvider, useBookingWizard } from '@/features/bookings/BookingWizardContext'
import { BookingPassenger, BookingSurchargeLine, BookingVehicleRequest, createPublicBooking } from '@/features/bookings/bookings'
import { VEHICLE_CLASS_OPTIONS, VEHICLE_TYPE_OPTIONS } from '@/features/rentals/rentals'
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

const VIETNAM_PHONE_REGEX_FE = /^(?:\+84|84|0)(?:3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9]|2[0-9]{2})\d{6,7}$/
function isValidVnPhone(raw: string): boolean {
  const cleaned = String(raw || '').replace(/[^\d+]/g, '').replace(/^00/, '+')
  if (!cleaned) return false
  if (VIETNAM_PHONE_REGEX_FE.test(cleaned)) return true
  const digitsOnly = cleaned.replace(/\D+/g, '')
  return digitsOnly.length >= 9 && digitsOnly.length <= 11 && /^[0-9]+$/.test(digitsOnly)
}

function StickyMobileCtaBar({ step, tour, dep, onNextStep, onPrevStep }: { step: 1 | 2 | 3 | 4; tour: PublicTourDetail | null; dep: PublicTourDeparture | null; onNextStep: () => void; onPrevStep: () => void }) {
  const { totalPax, draft } = useBookingWizard()
  const subtotal = useMemo(() => {
    if (!dep) return 0
    const a = (draft.pax.adult || 0) * (dep.priceAdult || 0)
    const c = (draft.pax.child || 0) * (typeof dep.priceChild === 'number' ? dep.priceChild : 0)
    const i = (draft.pax.infant || 0) * (typeof dep.priceInfant === 'number' ? dep.priceInfant : 0)
    return a + c + i
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, dep])
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
      <div className="mx-auto flex h-16 w-full max-w-[640px] items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tour?.code || ''} · {totalPax} khách</div>
          <div className="text-lg font-black text-orange-600 leading-none">{formatMoney(subtotal)}</div>
          <div className="truncate text-[11px] text-slate-500">{dep ? formatDate(dep.departureDate) : 'Chưa chọn đợt'}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step === 2 || step === 3 ? (
            <button type="button" onClick={onPrevStep} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-extrabold uppercase text-slate-700 hover:bg-slate-50">←</button>
          ) : null}
          <button
            type="button"
            onClick={onNextStep}
            className={
              'inline-flex h-12 items-center justify-center rounded-2xl px-5 text-[12px] font-black uppercase text-white shadow-sm ' +
              (step === 3 ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-800/20' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20')
            }
          >
            {step === 3 ? 'Đặt tour' : 'Tiếp tục'} →
          </button>
        </div>
      </div>
    </div>
  )
}

function WizardSteps({ step }: { step: 1 | 2 | 3 | 4 }) {
  const labels = ['Chọn đợt & số khách', 'Thông tin hành khách', 'Thanh toán & xác nhận', 'Đặt thành công'] as const
  return (
    <div className="w-full border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-[1640px] items-center gap-2 overflow-x-auto px-4 py-5 2xl:px-6">
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

function PaxStepper({ label, value, onChange, max = 20, disabledPlus }: { label: string; value: number; onChange: (n: number) => void; max?: number; disabledPlus?: boolean }) {
  const plusDisabled = disabledPlus || value >= max
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
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={plusDisabled} className={'flex h-9 w-9 items-center justify-center rounded-xl border text-lg font-bold ' + (plusDisabled ? ' border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' : 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100')}>
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
  const { draft, setDepartureId, setPax, setGroup, setSeatsAvailableLimit, setTourSlug, totalPax, remainingPaxCap } = useBookingWizard()
  useEffect(() => {
    if (tour?.slug && draft.tourSlug !== tour.slug) setTourSlug(tour.slug)
  }, [tour?.slug, draft.tourSlug])
  const selectedDep = useMemo(() => {
    if (!tour) return null
    const list = tour.departures || []
    if (draft.departureId) {
      const exact = list.find((d) => d.id === draft.departureId)
      if (exact) return exact
    }
    return list.find((d) => d.status === 'open') ?? list[0] ?? null
  }, [tour, draft.departureId])
  useEffect(() => {
    setSeatsAvailableLimit(selectedDep?.status === 'open' ? (selectedDep.seatsAvailable ?? null) : 0)
  }, [selectedDep?.id, selectedDep?.status, selectedDep?.seatsAvailable])
  const isGroup = Boolean(draft.group?.isGroupTour)
  const retailMax = isGroup ? 500 : 20
  const overLimit = (selectedDep?.seatsAvailable ?? 0) < totalPax
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
              const depId = d.id ?? String(d.departureDate)
              return (
                <button type="button" onClick={() => { if (disabled) return; setDepartureId(depId) }} key={depId} disabled={disabled} className={'grid w-full grid-cols-12 gap-3 items-center px-4 py-3 text-left text-sm transition ' + (active ? 'bg-orange-50/80' : 'hover:bg-slate-50') + (disabled ? ' opacity-60 cursor-not-allowed' : '')}>
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

      <SectionCard title="2. Chọn hình thức đặt tour" desc="Chọn Tour lẻ nếu đi ít người, Tour đoàn nếu đi nhóm 10 người trở lên / doanh nghiệp / gia đình lớn.">
        <div className="grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => { setGroup({ isGroupTour: false }) }} className={'rounded-2xl border p-4 text-left transition ' + (!isGroup ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 text-lg">🧑‍🤝‍🧑</div>
              <div>
                <div className="text-sm font-black text-slate-900">Tour Lẻ (tối đa 20 khách)</div>
                <div className="text-xs text-slate-500">Nhập thông tin từng hành khách (họ tên / ngày sinh / CCCD).</div>
              </div>
            </div>
          </button>
          <button type="button" onClick={() => { setGroup({ isGroupTour: true }) }} className={'rounded-2xl border p-4 text-left transition ' + (isGroup ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:border-orange-200 hover:bg-orange-50/30')}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 text-lg">👔</div>
              <div>
                <div className="text-sm font-black text-slate-900">Tour Đoàn (doanh nghiệp / 10+ người)</div>
                <div className="text-xs text-slate-500">Không cần nhập 100 tên. Upload file danh sách Excel / gửi sau.</div>
              </div>
            </div>
          </button>
        </div>
        {isGroup ? (
          <div className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-gradient-to-br from-amber-50/60 to-orange-50/40 p-4 text-xs text-amber-800">
            💡 Bạn không cần nhập Họ tên từng người ngay bây giờ. Hệ thống sẽ tạm tạo danh sách placeholder theo tổng số NL/TE/EB. Bạn sẽ bổ sung danh sách cuối (Excel) qua email nhân viên sau 5-7 ngày trước khởi hành. Tối đa 500 khách cho đoàn lớn.
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="3. Chọn số lượng hành khách" desc={isGroup ? 'Số lượng tối đa 500 khách cho đoàn lớn · Người lớn (≥ 11 tuổi) · Trẻ em (2–10) · Em bé (< 2 tuổi).' : 'Người lớn (≥ 11 tuổi) · Trẻ em (2–10) · Em bé (< 2 tuổi).'}>
        <div className="grid gap-3 md:grid-cols-3">
          <PaxStepper label="👤 Người lớn (NL)" value={draft.pax.adult} onChange={(n) => setPax({ adult: n })} max={Math.max(0, draft.pax.adult + remainingPaxCap)} disabledPlus={remainingPaxCap <= 0 || draft.pax.adult >= retailMax} />
          <PaxStepper label="🧒 Trẻ em (TE)" value={draft.pax.child} onChange={(n) => setPax({ child: n })} max={Math.max(0, draft.pax.child + remainingPaxCap)} disabledPlus={remainingPaxCap <= 0 || draft.pax.child >= retailMax} />
          <PaxStepper label="👶 Em bé (EB)" value={draft.pax.infant} onChange={(n) => setPax({ infant: n })} max={Math.max(0, draft.pax.infant + remainingPaxCap)} disabledPlus={remainingPaxCap <= 0 || draft.pax.infant >= retailMax} />
        </div>
        {selectedDep ? (
          <div className={'mt-3 rounded-2xl border px-3 py-2 text-xs font-semibold ' + (overLimit ? 'border-rose-200 bg-rose-50 text-rose-700' : (totalPax > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'))}>
            {overLimit
              ? `⚠️ Vượt quá giới hạn: ${totalPax} khách đã chọn > ${selectedDep.seatsAvailable} chỗ còn trống. Vui lòng giảm số lượng hành khách hoặc chọn đợt khởi hành khác.`
              : totalPax > 0
                ? `✅ ${totalPax} hành khách đã chọn · Còn ${Math.max(0, (selectedDep.seatsAvailable ?? 0) - totalPax)} chỗ trống · 1 giao dịch tối đa ${retailMax} khách${!isGroup ? ' (đoàn lớn vui lòng chọn Tour đoàn).' : ' (tối đa cho đoàn lớn).'}`
                : `Đợt này còn ${selectedDep.seatsAvailable ?? 0} chỗ trống.`
            }
          </div>
        ) : null}
      </SectionCard>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            if (!selectedDep) return toast.error('Vui lòng chọn đợt khởi hành trước khi tiếp tục.')
            if (selectedDep.status !== 'open') return toast.error('Đợt khởi hành này đã đóng bán, vui lòng chọn đợt khác.')
            if (totalPax <= 0) return toast.error('Vui lòng chọn ít nhất 1 hành khách.')
            if (totalPax > retailMax) return toast.error(`1 lần đặt tối đa ${retailMax} hành khách.`)
            if ((selectedDep.seatsAvailable ?? 0) < totalPax) return toast.error(`Chỉ còn ${selectedDep.seatsAvailable} chỗ, vui lòng giảm số lượng hành khách.`)
            onNext()
          }}
          className="inline-flex h-12 items-center justify-center rounded-2xl bg-orange-500 px-8 text-xs font-extrabold uppercase text-white shadow-sm shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-60"
        >
          Tiếp tục →
        </button>
      </div>
    </div>
  )
}

function PassengerCard({ idx, passenger, onChange, onRemove, canRemove, departureDate }: { idx: number; passenger: BookingPassenger; onChange: (p: BookingPassenger) => void; onRemove?: () => void; canRemove?: boolean; departureDate?: Date | string | null }) {
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
  const ageAtDeparture = ((): number | null => {
    if (!passenger.birthDate) return null
    const b = new Date(String(passenger.birthDate).slice(0, 10) + 'T00:00:00Z')
    if (Number.isNaN(b.getTime())) return null
    let at: Date | null = null
    if (departureDate instanceof Date) at = departureDate
    else if (typeof departureDate === 'string' && departureDate.length >= 10) at = new Date(departureDate.slice(0, 10) + 'T00:00:00Z')
    if (!at || Number.isNaN(at.getTime())) return null
    let years = at.getUTCFullYear() - b.getUTCFullYear()
    const m = at.getUTCMonth() - b.getUTCMonth()
    if (m < 0 || (m === 0 && at.getUTCDate() < b.getUTCDate())) years -= 1
    return years
  })()
  const ageMismatch = ((): string | null => {
    if (ageAtDeparture === null) return null
    const t = passenger.type
    if (ageAtDeparture < 2 && t !== 'EB') return `Hành khách ${ageAtDeparture} tuổi (tại ngày khởi hành) nên chọn loại EB (em bé < 2 tuổi).`
    if (ageAtDeparture >= 2 && ageAtDeparture <= 12 && t !== 'TE') return `Hành khách ${ageAtDeparture} tuổi (tại ngày khởi hành) nên chọn loại TE (trẻ em 2-12 tuổi).`
    if (ageAtDeparture >= 13 && t !== 'NL') return `Hành khách ${ageAtDeparture} tuổi (tại ngày khởi hành) nên chọn loại NL (người lớn ≥ 13 tuổi).`
    return null
  })()
  return (
    <div className={'rounded-2xl border bg-white p-4 ' + (ageMismatch ? 'border-rose-300 ring-4 ring-rose-50/70' : 'border-slate-200')}>
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
            {ageAtDeparture !== null ? (
              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">{ageAtDeparture} tuổi @ khởi hành</span>
            ) : null}
          </div>
          {canRemove ? (
            <button type="button" onClick={onRemove} className="text-xs font-bold text-rose-500 hover:text-rose-700">
              Xoá
            </button>
          ) : null}
        </div>
        {ageMismatch ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 px-3 py-2 text-[11px] font-semibold leading-snug text-rose-700">
            ⚠️ {ageMismatch}
          </div>
        ) : null}
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
          <div className="mt-1">
            <DateInput
              size="lg"
              variant="customer"
              value={dateVal || null}
              disabledFuture
              onChange={(iso) => {
                setDateVal(iso || '')
                if (iso) {
                  const isoOnly = toISODateOnly(iso)
                  if ((passenger.birthDate || '').slice(0, 10) !== (isoOnly || '').slice(0, 10)) {
                    onChange({ ...passenger, birthDate: isoOnly })
                  }
                } else {
                  if (passenger.birthDate) onChange({ ...passenger, birthDate: null })
                }
              }}
              placeholder="Chọn ngày sinh"
            />
          </div>
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

function Step2({ onNext, onPrev, toast, dep }: { onNext: () => void; onPrev: () => void; toast: ReturnType<typeof useToast>; dep: PublicTourDeparture | null }) {
  const { draft, totalPax, setGroup } = useBookingWizard()
  const auth = useAuth()
  const isGroup = Boolean(draft.group?.isGroupTour)
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
  const [groupFields, setGroupFields] = useState(() => ({
    companyName: draft.group?.companyName || '',
    contactPerson: draft.group?.contactPerson || '',
    contactRole: draft.group?.contactRole || '',
    uploadedListFileUrl: draft.group?.uploadedListFileUrl || '',
    note: draft.group?.note || '',
  }))
  useEffect(() => {
    setPassengers((prev) => {
      const counts = { NL: draft.pax.adult, TE: draft.pax.child, EB: draft.pax.infant }
      const cur = { NL: prev.filter((p) => p.type === 'NL').length, TE: prev.filter((p) => p.type === 'TE').length, EB: prev.filter((p) => p.type === 'EB').length }
      if (cur.NL === counts.NL && cur.TE === counts.TE && cur.EB === counts.EB && prev.length === totalPax) return prev
      const out: BookingPassenger[] = [...prev]
      for (const t of ['NL', 'TE', 'EB'] as const) {
        let curT = out.filter((p) => p.type === t).length
        while (curT > counts[t]) {
          const idx = findLastIndex(out, (p) => p.type === t && !p.fullName)
          const idxFallback = findLastIndex(out, (p) => p.type === t)
          const rm = idx >= 0 ? idx : idxFallback
          if (rm >= 0) { out.splice(rm, 1); curT -= 1 } else break
        }
      }
      for (const t of ['NL', 'TE', 'EB'] as const) {
        let curT = out.filter((p) => p.type === t).length
        while (curT < counts[t]) { out.push({ fullName: '', type: t, birthDate: null, gender: null, idCard: null, notes: null }); curT += 1 }
      }
      return out.slice(0, totalPax)
    })
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, totalPax])
  const [sharedState, setShared] = useState<{ contact: typeof contact; notes: string; passengers: BookingPassenger[]; isGroup: boolean; groupFields: typeof groupFields } | null>(null)
  useEffect(() => {
    ;(window as any)['__booking_step2'] = { contact, notes, passengers, isGroupTour: isGroup, group: groupFields }
    setShared({ contact, notes, passengers, isGroup, groupFields })
  }, [contact, notes, passengers, isGroup, groupFields])
  void sharedState
  return (
    <div className="space-y-5">
      <SectionCard title={`Hình thức đặt tour: ${isGroup ? '👔 Tour Đoàn' : '🧑‍🤝‍🧑 Tour Lẻ'}`} desc={isGroup ? 'Đặt cho doanh nghiệp / đoàn 10+ người. Bạn có thể thay đổi ở bước 1 nếu muốn đổi.' : 'Đặt cho gia đình / nhóm nhỏ (tối đa 20 khách). Bạn có thể thay đổi ở bước 1 nếu muốn đổi.'}>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50/70 to-white p-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className={'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl ' + (isGroup ? 'bg-gradient-to-br from-orange-600 to-amber-500' : 'bg-gradient-to-br from-blue-600 to-blue-500')}>{isGroup ? '👔' : '🧑‍🤝‍🧑'}</div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-slate-900">{isGroup ? 'Tour Đoàn (doanh nghiệp / 10+ khách)' : 'Tour Lẻ (tối đa 20 khách)'}</div>
              <div className="truncate text-xs text-slate-500">{isGroup ? 'Không cần nhập 100 tên ngay bây giờ. Upload file / gửi danh sách Excel sau cũng được.' : 'Nhập thông tin từng hành khách (họ tên, ngày sinh, CCCD).'}</div>
            </div>
          </div>
          <div className="shrink-0 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
            Đã chọn ở bước 1 · <span className="text-orange-600">có thể thay đổi</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Thông tin người đặt" desc="Chúng tôi sẽ gọi điện xác nhận đơn đặt của bạn qua SĐT này.">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Họ tên *</label>
            <input value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Nguyễn Văn A" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Số điện thoại *</label>
            <input
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
              className={
                'mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4 ' +
                (contact.phone.trim() && !isValidVnPhone(contact.phone)
                  ? 'border-rose-400 ring-4 ring-rose-100 focus:border-rose-500'
                  : 'border-slate-200')
              }
              placeholder="09xx xxx xxx"
            />
            {contact.phone.trim() && !isValidVnPhone(contact.phone) ? (
              <div className="mt-1.5 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-[11px] font-semibold text-rose-700 leading-snug">
                ⚠️ SĐT hợp lệ VN: 09xx/03xx/08xx/07xx/05xx (9-10 số) / 02xx (cố vấn 10-11 số) / +84 9xx. Hiện định dạng này không đúng.
              </div>
            ) : null}
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

      {isGroup ? (
        <SectionCard title="Thông tin đoàn / công ty" desc="Nhập tên công ty/đoàn + người liên hệ quản lý đoàn. Upload file danh sách hành khách nếu có.">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Tên công ty / Tên đoàn *</label>
              <input value={groupFields.companyName} onChange={(e) => { setGroupFields((g) => ({ ...g, companyName: e.target.value })); setGroup({ companyName: e.target.value }) }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Công ty Cổ phần XYZ / Đoàn du lịch gia đình A" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Người liên hệ quản lý đoàn *</label>
              <input value={groupFields.contactPerson} onChange={(e) => { setGroupFields((g) => ({ ...g, contactPerson: e.target.value })); setGroup({ contactPerson: e.target.value }) }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Chị Nguyễn Thị B - Trưởng đoàn" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Chức vụ</label>
              <input value={groupFields.contactRole} onChange={(e) => { setGroupFields((g) => ({ ...g, contactRole: e.target.value })); setGroup({ contactRole: e.target.value }) }} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Trưởng phòng Nhân sự" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Upload file danh sách hành khách (Excel / PDF / Word)</label>
              <div className="mt-1 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                <input value={groupFields.uploadedListFileUrl} onChange={(e) => { setGroupFields((g) => ({ ...g, uploadedListFileUrl: e.target.value })); setGroup({ uploadedListFileUrl: e.target.value }) }} className="flex-1 min-w-[240px] h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-400" placeholder="Link Google Drive / đường dẫn file (tùy chọn) — gửi sau cũng được" />
                {groupFields.uploadedListFileUrl ? (
                  <a href={groupFields.uploadedListFileUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center rounded-lg bg-blue-50 px-4 text-xs font-bold text-blue-700 hover:bg-blue-100">Mở file</a>
                ) : (
                  <div className="inline-flex h-11 items-center rounded-lg bg-white px-4 text-xs font-semibold text-slate-500 border border-slate-200">Bỏ trống OK · Gửi sau qua email nhân viên</div>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Yêu cầu riêng cho đoàn</label>
              <textarea rows={4} value={groupFields.note} onChange={(e) => { setGroupFields((g) => ({ ...g, note: e.target.value })); setGroup({ note: e.target.value }) }} className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Phòng 2 người, ăn chay 5 người, xe 45 chỗ, cần hóa đơn VAT 0%, vé sân bay..." />
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title={`Danh sách hành khách (${totalPax} người)`} desc={`NL: ${draft.pax.adult} · TE: ${draft.pax.child} · EB: ${draft.pax.infant}`}>
          <div className="space-y-3">
            {passengers.map((p, i) => (
              <PassengerCard
                key={i}
                idx={i}
                passenger={p}
                departureDate={dep?.departureDate || null}
                onChange={(np) => setPassengers((list) => list.map((pp, ii) => (ii === i ? np : pp)))}
              />
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title="Ghi chú chung" desc="Lời nhắn cho chuyên viên tư vấn.">
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Ghi chú..." />
      </SectionCard>

      <div className="flex items-center justify-between">
        <button type="button" onClick={onPrev} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 text-xs font-extrabold uppercase text-slate-700 hover:bg-slate-50">← Quay lại</button>
        <button
          type="button"
          onClick={() => {
            if (!contact.name.trim()) return toast.error('Vui lòng nhập Họ tên người đặt.')
            if (!contact.phone.trim() || contact.phone.replace(/\D/g, '').length < 8 || !isValidVnPhone(contact.phone)) return toast.error('Số điện thoại không đúng định dạng Việt Nam (09/03/08/07/05/02xx).')
            const emailRaw = (contact.email || '').trim()
            if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
              return toast.error('Email không hợp lệ, vui lòng nhập lại hoặc để trống.')
            }
            const finalContact = { ...contact, email: emailRaw || null, address: (contact.address || '').trim() || null }
            let finalPassengers: BookingPassenger[] = []
            if (isGroup) {
              if (!groupFields.companyName.trim()) return toast.error('Vui lòng nhập Tên công ty / Tên đoàn.')
              if (!groupFields.contactPerson.trim()) return toast.error('Vui lòng nhập Người liên hệ quản lý đoàn.')
              for (let i = 0; i < draft.pax.adult; i += 1) finalPassengers.push({ fullName: `[Đoàn] Người lớn ${i + 1}`, type: 'NL', birthDate: null, gender: null, idCard: null, notes: null })
              for (let i = 0; i < draft.pax.child; i += 1) finalPassengers.push({ fullName: `[Đoàn] Trẻ em ${i + 1}`, type: 'TE', birthDate: null, gender: null, idCard: null, notes: null })
              for (let i = 0; i < draft.pax.infant; i += 1) finalPassengers.push({ fullName: `[Đoàn] Em bé ${i + 1}`, type: 'EB', birthDate: null, gender: null, idCard: null, notes: null })
            } else {
              const missing = passengers.findIndex((p) => !p.fullName.trim())
              if (missing >= 0) return toast.error(`Hành khách ${missing + 1} chưa nhập Họ tên.`)
              const counts = { NL: 0, TE: 0, EB: 0 }
              passengers.forEach((p) => { counts[p.type] += 1 })
              if (counts.NL !== draft.pax.adult || counts.TE !== draft.pax.child || counts.EB !== draft.pax.infant) {
                return toast.error(`Tổng số lượng hành khách không khớp NL:${counts.NL}/${draft.pax.adult} · TE:${counts.TE}/${draft.pax.child} · EB:${counts.EB}/${draft.pax.infant}.`)
              }
              finalPassengers = passengers.map((p) => ({
                ...p,
                fullName: p.fullName.trim(),
                idCard: typeof p.idCard === 'string' ? p.idCard.trim() || null : p.idCard,
                notes: typeof p.notes === 'string' ? p.notes.trim() || null : p.notes,
              }))
            }
            ;(window as any)['__booking_step2_final'] = {
              contact: finalContact,
              notes: notes.trim() || null,
              passengers: finalPassengers,
              isGroupTour: isGroup,
              group: {
                companyName: groupFields.companyName.trim() || null,
                contactPerson: groupFields.contactPerson.trim() || null,
                contactRole: groupFields.contactRole.trim() || null,
                uploadedListFileUrl: groupFields.uploadedListFileUrl.trim() || null,
                note: groupFields.note.trim() || null,
              },
            }
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

function Step3({ onPrev, onConfirm, tour, dep, toast }: { onPrev: () => void; onConfirm: (ok: { method: BookingPaymentMethod; surcharges: BookingSurchargeLine[]; agree: boolean; vehicleRequest: BookingVehicleRequest | null }) => void; tour: PublicTourDetail | null; dep: PublicTourDeparture | null; toast: ReturnType<typeof useToast> }) {
  const { draft, totalPax } = useBookingWizard()
  const [method, setMethod] = useState<BookingPaymentMethod>('hold')
  const [agree, setAgree] = useState(false)
  const defaults = useMemo(() => (tour?.surcharges || []).map((s) => ({ label: s.label, quantity: 0, unitPrice: Number(s.amount || 0), note: null })), [tour?.surcharges])
  const [surcharges, setSurcharges] = useState<BookingSurchargeLine[]>(defaults)
  const [vehicleRequest, setVehicleRequest] = useState<BookingVehicleRequest>({
    enabled: false,
    vehicleType: '',
    vehicleClass: '',
    seatCountMin: null,
    vehicleCount: 1,
    withDriver: true,
    pickupLocation: null,
    returnLocation: null,
    notes: null,
  })
  useEffect(() => { setSurcharges(defaults) }, [defaults])
  const ipt = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4"
  const paxPrices = useMemo(() => {
    if (!dep) return { adult: 0, child: 0, infant: 0, subtotal: 0 }
    const a = (draft.pax.adult || 0) * (dep.priceAdult || 0)
    const c = (draft.pax.child || 0) * (typeof dep.priceChild === 'number' ? dep.priceChild : 0)
    const i = (draft.pax.infant || 0) * (typeof dep.priceInfant === 'number' ? dep.priceInfant : 0)
    return { adult: a, child: c, infant: i, subtotal: a + c + i }
  }, [draft.pax.adult, draft.pax.child, draft.pax.infant, dep])
  const surchTotal = surcharges.reduce((s, l) => s + Math.max(0, l.quantity || 0) * Math.max(0, l.unitPrice || 0), 0)
  const grand = paxPrices.subtotal + surchTotal
  const submit = useCallback(() => {
    if (!agree) return toast.error('Vui lòng đồng ý điều khoản & chính sách hủy trước khi đặt.')
    onConfirm({ method, surcharges, agree, vehicleRequest: vehicleRequest.enabled ? vehicleRequest : null })
  }, [agree, method, surcharges, vehicleRequest, onConfirm, toast])
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); submit() }
    document.addEventListener('booking-cta-step3-submit', handler as EventListener)
    return () => { document.removeEventListener('booking-cta-step3-submit', handler as EventListener) }
  }, [submit])
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

      {/* ======================== LUỒNG B: THUÊ XE KÈM TOUR ======================== */}
      <SectionCard title="🚍 Thuê xe kèm Tour (Luồng B)" desc="Thêm dịch vụ xe riêng đón trả sân bay / đi kèm cả hành trình. Nhân viên sẽ gửi báo giá xe riêng sau.">
        <label className={"flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 mb-4 transition-colors " + (vehicleRequest.enabled ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-100' : 'border-slate-200 bg-white hover:border-slate-300')}>
          <input type="checkbox" className="mt-1 h-5 w-5 accent-indigo-600" checked={vehicleRequest.enabled} onChange={(e) => setVehicleRequest((v) => ({ ...v, enabled: e.target.checked }))} />
          <div>
            <div className="text-sm font-extrabold text-slate-900">Tôi muốn thuê xe riêng đi kèm tour</div>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Khách đoàn / khách yêu cầu xe riêng đón trả sân bay, xe đi kèm cả hành trình thay vì xe chung của tour.
              Nhân viên vận hành sẽ tự động tạo Yêu cầu thuê xe gắn đơn booking sau & báo giá chi tiết trong 30 phút.
            </p>
          </div>
        </label>

        {vehicleRequest.enabled ? (
          <div className="grid gap-4 md:grid-cols-2 rounded-2xl border border-slate-200 bg-white p-5">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Loại xe yêu cầu</label>
              <select className={ipt} value={vehicleRequest.vehicleType || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, vehicleType: e.target.value || null }))}>
                <option value="">— Tự động phân bổ theo số khách —</option>
                {VEHICLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Phân loại xe</label>
              <select className={ipt} value={vehicleRequest.vehicleClass || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, vehicleClass: e.target.value || null }))}>
                <option value="">— Chọn (để trống = theo tiêu chuẩn tour) —</option>
                {VEHICLE_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Số chỗ tối thiểu</label>
              <input type="number" min={1} max={60} className={ipt} value={vehicleRequest.seatCountMin || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, seatCountMin: e.target.value ? Number(e.target.value) : null }))} placeholder={`VD: ${Math.max(4, Math.min(29, (draft.pax.adult || 1) + (draft.pax.child || 0) + 2))}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Số lượng xe</label>
              <input type="number" min={1} max={20} className={ipt} value={vehicleRequest.vehicleCount || 1} onChange={(e) => setVehicleRequest((v) => ({ ...v, vehicleCount: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Tài xế</label>
              <select className={ipt} value={vehicleRequest.withDriver ? 'driver' : 'self'} onChange={(e) => setVehicleRequest((v) => ({ ...v, withDriver: e.target.value === 'driver' }))}>
                <option value="driver">Có tài xế (khuyên dùng)</option>
                <option value="self">Tự lái (dưới 16 chỗ)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Điểm đón xe (nếu khác đi chơi)</label>
              <input className={ipt} value={vehicleRequest.pickupLocation || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, pickupLocation: e.target.value || null }))} placeholder="VD: Sân bay Tân Sơn Nhất (SGN) - Cột 4 Domestic" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Điểm trả xe (nếu khác)</label>
              <input className={ipt} value={vehicleRequest.returnLocation || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, returnLocation: e.target.value || null }))} placeholder="VD: Khách sạn InterContinental Saigon" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Ghi chú yêu cầu xe (có thể trống)</label>
              <input className={ipt} value={vehicleRequest.notes || ''} onChange={(e) => setVehicleRequest((v) => ({ ...v, notes: e.target.value || null }))} placeholder="VD: xe màu trắng, wifi trên xe, tài xế nói tiếng Anh, ghế trẻ em số 2..." />
            </div>
          </div>
        ) : null}
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
        <button type="button" onClick={onPrev} className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-8 text-xs font-extrabold uppercase text-slate-700 hover:bg-slate-50">← Quay lại</button>
        <button
          type="button"
          onClick={submit}
          className="inline-flex h-13 items-center justify-center rounded-2xl bg-emerald-700 px-8 py-3 text-xs font-extrabold uppercase text-white shadow-md shadow-emerald-800/30 hover:bg-emerald-800 disabled:opacity-60"
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

  const dFromUrl = sp.get('d')
  const appliedUrlDepRef = useRef<{ d: string | null; applied: boolean }>({ d: null, applied: false })

  useEffect(() => {
    if (!tour?.departures?.length) return
    if (dFromUrl === appliedUrlDepRef.current.d && appliedUrlDepRef.current.applied) return
    const cur = appliedUrlDepRef.current.d
    if (cur === dFromUrl) {
      appliedUrlDepRef.current.applied = true
      return
    }
    appliedUrlDepRef.current.d = dFromUrl
    if (dFromUrl) {
      const matched = tour.departures.find((x) => x.id === dFromUrl || String(x.id) === dFromUrl)
      if (matched?.id && matched.id !== draft.departureId) {
        setDepartureId(matched.id)
      } else if (!matched) {
        const fallback = tour.departures.find((d) => d.status === 'open') ?? tour.departures[0] ?? null
        if (fallback?.id && fallback.id !== draft.departureId) setDepartureId(fallback.id)
      }
    } else {
      const fallback = tour.departures.find((d) => d.status === 'open') ?? tour.departures[0] ?? null
      if (fallback?.id && !draft.departureId) setDepartureId(fallback.id)
    }
    appliedUrlDepRef.current.applied = true
  }, [tour?.departures, dFromUrl])

  const selectedDep = useMemo<PublicTourDeparture | null>(() => {
    if (!tour?.departures?.length) return null
    if (draft.departureId) {
      const exact = tour.departures.find((d) => d.id === draft.departureId)
      if (exact) return exact
    }
    return tour.departures.find((d) => d.status === 'open') ?? tour.departures[0] ?? null
  }, [tour, draft.departureId])

  if (loadingTour) return <div className="mx-auto w-full max-w-[1640px] px-4 py-16 text-sm text-slate-500 2xl:px-6">Đang tải thông tin đặt tour...</div>
  if (errTour || !tour) return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-slate-900">Không tìm thấy tour</h1>
      <p className="mt-2 text-sm text-slate-500">{errTour || 'Vui lòng quay lại trang danh sách tour và chọn lại.'}</p>
      <Link to="/tours" className="mt-6 inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-6 text-xs font-extrabold uppercase text-white hover:bg-orange-600">← Quay lại danh sách tour</Link>
    </div>
  )

  if (step === 4 && bookingCode) return <BookingPageSuccess code={bookingCode} tour={tour} />

  return (
    <div>
      <WizardSteps step={step} />
      <div className={'mx-auto grid w-full max-w-[1640px] gap-6 px-4 2xl:px-6 lg:grid-cols-[minmax(0,1fr)_420px] ' + (step !== 4 ? 'pb-24 md:pb-8 py-8' : 'py-8')}>
        <div className="min-w-0">
          <div className="mb-5">
            <h1 className="text-2xl font-black text-slate-900">
              🎫 Đặt tour: <span className="text-orange-600">{tour.title}</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">4 bước nhanh chóng. Xác nhận đơn sẽ được gửi qua SMS / email trong 30 phút.</p>
          </div>
          {step === 1 ? <Step1 toast={toast} tour={tour} onNext={() => setStep(2)} /> : null}
          {step === 2 ? <Step2 toast={toast} dep={selectedDep} onPrev={() => setStep(1)} onNext={() => setStep(3)} /> : null}
          {step === 3 ? (
            <Step3
              toast={toast}
              dep={selectedDep}
              tour={tour}
              onPrev={() => setStep(2)}
              onConfirm={async ({ method, surcharges, vehicleRequest }) => {
                try {
                  const s2 = (window as any).__booking_step2_final
                  if (!s2) return toast.error('Vui lòng điền đầy đủ thông tin hành khách ở bước 2.')
                  const contact = s2.contact
                  const passengers = s2.passengers
                  const notes = s2.notes
                  const isGroupTour = Boolean(s2.isGroupTour)
                  const group = s2.group || {}
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
                    isGroupTour,
                    groupCompanyName: group.companyName || null,
                    groupContactPerson: group.contactPerson || null,
                    groupContactRole: group.contactRole || null,
                    groupUploadedListFileUrl: group.uploadedListFileUrl || null,
                    groupNote: group.note || null,
                    vehicleRequest: vehicleRequest ?? null,
                  } as any
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
      {step !== 4 ? <StickyMobileCtaBar step={step} tour={tour} dep={selectedDep} onNextStep={() => {
        if (step === 1) setStep(2)
        else if (step === 2) setStep(3)
        else if (step === 3) document.dispatchEvent(new CustomEvent('booking-cta-step3-submit'))
      }} onPrevStep={() => { if (step === 2) setStep(1); else if (step === 3) setStep(2) }} /> : null}
    </div>
  )
}

export { BookingPage }

export function BookingPageShell({ children, slug }: { children: React.ReactNode; slug?: string | null }) {
  const [sp] = useSearchParams()
  const dParam = sp.get('d')
  return <BookingWizardProvider initialTourSlug={slug || null} initialDepartureId={dParam}>{children}</BookingWizardProvider>
}
