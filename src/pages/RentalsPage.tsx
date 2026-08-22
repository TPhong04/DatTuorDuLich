import { useEffect, useMemo, useState } from 'react'
import {
  CarFront, ShieldCheck, FileSignature, Clock3, AlertTriangle,
  BadgeCheck, HandCoins, MapPin, CalendarDays, Users, Luggage,
  Car, ChevronDown, ChevronUp, CheckCircle2, Phone, Mail,
  Sparkles, ArrowRight, LogIn, User,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  classVehicleInfo, labelVehicleClass, labelVehicleType,
  publicCreateInquiry, publicRentalsVehicleOptions,
  type RentalPolicyHighlight, type RentalVehicleClassOption,
  type RentalVehicleTypeOption,
  VEHICLE_CLASS_OPTIONS, VEHICLE_TYPE_OPTIONS,
} from '@/features/rentals/rentals'
import { useAuth } from '@/features/auth/auth.hooks'
import PageHeader from '@/components/ui/PageHeader'

type InqForm = {
  customerName: string
  customerPhone: string
  customerEmail: string
  citizenId: string
  customerAddress: string
  vehicleType: string
  vehicleClass: string
  seatCountMin: string
  pickupDate: string
  pickupTime: string
  pickupLocation: string
  returnDate: string
  returnTime: string
  returnLocation: string
  withDriver: boolean
  passengerCount: string
  luggageCount: string
  routeNotes: string
  specialRequests: string
  agreementAccepted: boolean
}
const F_EMPTY: InqForm = {
  customerName: '', customerPhone: '', customerEmail: '', citizenId: '', customerAddress: '',
  vehicleType: '', vehicleClass: '', seatCountMin: '',
  pickupDate: '', pickupTime: '08:00', pickupLocation: '',
  returnDate: '', returnTime: '18:00', returnLocation: '',
  withDriver: true, passengerCount: '', luggageCount: '0',
  routeNotes: '', specialRequests: '', agreementAccepted: false,
}
function combineLocalToIso(dateStr: string, timeStr: string): string {
  if (!dateStr) return ''
  const t = timeStr || '00:00'
  return `${dateStr}T${t}:00`
}

const fmt = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

export default function RentalsPage() {
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const [options, setOptions] = useState<{ types: RentalVehicleTypeOption[]; classes: RentalVehicleClassOption[]; policy: RentalPolicyHighlight[] } | null>(null)
  const [form, setForm] = useState<InqForm>({ ...F_EMPTY })
  const [policyOpen, setPolicyOpen] = useState<Record<string, boolean>>({
    cancel_7d: true, cancel_late: false, deposit: false, excess_km: false, damage: false, handover: false,
  })
  const [submiting, setSubmiting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ ok: true; code: string; name: string } | { ok: false; msg: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    publicRentalsVehicleOptions().then((r) => {
      if (cancelled) return
      setOptions({ types: r.types, classes: r.classes, policy: r.policyHighlights })
      if (!form.vehicleType && r.types[0]) setForm((f) => ({ ...f, vehicleType: r.types[0].value }))
      if (!form.vehicleClass && r.classes[0]) setForm((f) => ({ ...f, vehicleClass: r.classes[0].value }))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedType = useMemo(() => options?.types.find((t) => t.value === form.vehicleType), [options, form.vehicleType])
  const rentalDays = useMemo(() => {
    const pickupIso = combineLocalToIso(form.pickupDate, form.pickupTime)
    const returnIso = combineLocalToIso(form.returnDate, form.returnTime)
    if (!pickupIso || !returnIso) return 0
    const a = new Date(pickupIso).getTime()
    const b = new Date(returnIso).getTime()
    if (!a || !b || b <= a) return 0
    return Math.max(1, Math.round((b - a) / (1000 * 60 * 60 * 24)))
  }, [form.pickupDate, form.pickupTime, form.returnDate, form.returnTime])

  const estimateVnd = useMemo(() => {
    if (!rentalDays || !selectedType) return 0
    return rentalDays * (form.withDriver ? selectedType.suggestDriverDailyVnd : selectedType.suggestSelfDriveDailyVnd || selectedType.suggestDriverDailyVnd)
  }, [rentalDays, form.withDriver, selectedType])

  const update = (k: keyof InqForm, v: any) => setForm((f) => ({ ...f, [k]: v }))
  const handlePrimaryCta = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    if (isLoggedIn) {
      const target = document.getElementById('form')
      if (target) {
        e.preventDefault()
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }
    e.preventDefault()
    const redirect = encodeURIComponent(window.location.pathname + window.location.hash + window.location.search || '/cho-thue-xe#form')
    navigate(`/auth/login?redirect=${redirect}`, { replace: false })
  }

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmiting(true)
    setSubmitResult(null)
    try {
      const pickupIso = combineLocalToIso(form.pickupDate, form.pickupTime)
      const returnIso = combineLocalToIso(form.returnDate, form.returnTime)
      if (!pickupIso || !returnIso) throw new Error('Vui lòng chọn ngày giờ nhận và trả xe')
      if (rentalDays <= 0) throw new Error('Ngày trả phải sau ngày nhận ít nhất 1 ngày')
      if (!form.pickupLocation || !form.returnLocation) throw new Error('Vui lòng điền địa điểm nhận / trả xe')
      if (!form.customerName || !form.customerPhone) throw new Error('Vui lòng điền Họ tên và Số điện thoại')
      if (!form.agreementAccepted) throw new Error('Vui lòng xác nhận đã đọc và đồng ý với chính sách cho thuê xe')
      const res = await publicCreateInquiry({
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerEmail: form.customerEmail || null,
        citizenId: form.citizenId || null,
        customerAddress: form.customerAddress || null,
        vehicleType: form.vehicleType || null,
        vehicleClass: form.vehicleClass || null,
        seatCountMin: form.seatCountMin ? Number(form.seatCountMin) : null,
        pickupDateTime: new Date(pickupIso).toISOString(),
        pickupLocation: form.pickupLocation,
        returnDateTime: new Date(returnIso).toISOString(),
        returnLocation: form.returnLocation,
        withDriver: form.withDriver,
        rentalDays,
        passengerCount: form.passengerCount ? Number(form.passengerCount) : 1,
        luggageCount: form.luggageCount ? Number(form.luggageCount) : 0,
        routeNotes: form.routeNotes || null,
        specialRequests: form.specialRequests || null,
        agreementAccepted: true,
        bookingId: null,
      })
      setSubmitResult({ ok: true, code: res.code || '', name: res.customerName || form.customerName })
      setForm({ ...F_EMPTY })
    } catch (err: any) {
      setSubmitResult({ ok: false, msg: err?.message || String(err) })
    } finally {
      setSubmiting(false)
    }
  }

  return (
    <div className="space-y-10">
      {/* ======================== SECTION 1: Hero + Giới thiệu xe ======================== */}
      <div className="gradient-sweep-br relative overflow-hidden rounded-[32px] ring-1 ring-white/10 bg-gradient-to-br from-indigo-600 via-blue-700 to-orange-500 p-1 shadow-[0_30px_80px_-30px_rgba(79,70,229,0.55)]">
        <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-white/95 via-indigo-50/80 to-orange-50/60 p-8 backdrop-blur-md">
          <div className="pointer-events-none absolute -top-24 -right-20 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-400/30 via-blue-400/20 to-orange-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/25 via-amber-300/15 to-indigo-300/20 blur-3xl" />
          <div className="grid gap-6 md:grid-cols-5 relative">
            <div className="md:col-span-3 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 backdrop-blur pill-hover">
                <Sparkles className="h-3.5 w-3.5 text-orange-500" /> Cho thuê xe chất lượng cao – 5 loại xe × 4 phân loại
              </div>
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-orange-400 p-3 shadow-lg ring-1 ring-white/30">
                  <CarFront className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black leading-tight tracking-tight bg-gradient-to-r from-indigo-800 via-blue-800 to-orange-700 bg-clip-text text-transparent">Cho thuê xe du lịch &amp; Giao hàng 4 – 45 chỗ</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Cung cấp xe mới từ 2022-2026, tài xế trên 8 năm kinh nghiệm, bảo hiểm thân thể người lên 500 triệu.
                    Có thể thuê theo <b className="text-indigo-700">lượt / ngày / tuần</b>, nội thành hoặc liên tỉnh cả nước. <b className="text-orange-600">Khách hàng 24/7</b> hỗ trợ đường dài.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs stagger-in">
                    {['Bảo hiểm đầy đủ', 'Biển số biển tỉnh / Hà Nội / TP.HCM', 'Khói bụi dưới 10% / Giường nệm mới', 'Hóa đơn VAT 10% đầy đủ', 'Checklist tình trạng xe trước & sau'].map((t) => (
                      <span key={t} className="pill-hover inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 font-semibold text-emerald-800 ring-1 ring-emerald-200 shadow-sm">
                        <BadgeCheck className="h-3 w-3 text-emerald-600" /> {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="md:col-span-2 space-y-3 relative">
              <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-indigo-100 shadow-lg backdrop-blur-md card-hover">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-black bg-gradient-to-r from-indigo-700 to-orange-600 bg-clip-text text-transparent">Ước tính chi phí</div>
                  <span className="rounded-full bg-gradient-to-r from-indigo-100 to-orange-100 px-2.5 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-200 pill-hover">{rentalDays} ngày</span>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-50/60 px-2.5 py-1.5 ring-1 ring-indigo-100">
                    <span className="text-[11px] font-bold text-indigo-700">Loại xe</span>
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[55%] text-right">{selectedType?.label || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-orange-50/60 px-2.5 py-1.5 ring-1 ring-orange-100">
                    <span className="text-[11px] font-bold text-orange-700">Hạng xe</span>
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[55%] text-right">{labelVehicleClass(form.vehicleClass) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-sky-50/60 px-2.5 py-1.5 ring-1 ring-sky-100">
                    <span className="text-[11px] font-bold text-sky-700">Tài xế</span>
                    <span className="text-xs font-semibold text-slate-800 truncate max-w-[55%] text-right">{form.withDriver ? 'Có tài xế' : 'Tự lái (<16 chỗ)'}</span>
                  </div>
                  <div className="mt-2 flex justify-between rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-orange-500 px-3 py-2 text-white shadow-md">
                    <span className="text-xs font-bold">Tổng ({rentalDays || 0} ngày)</span>
                    <span className="text-lg font-black tabular-nums tracking-tight">{fmt.format(estimateVnd || 0)}</span>
                  </div>
                </div>
                <div className="mt-2 text-[11px] leading-4 text-slate-500">* Giá trên mang tính tham khảo. Nhân viên sẽ phản hồi báo giá chi tiết trong 30 phút sau khi nhận yêu cầu.</div>
              </div>
              <button
                type="button"
                onClick={handlePrimaryCta}
                className={[
                  'group relative overflow-hidden w-full rounded-2xl p-4 text-center text-sm font-black uppercase tracking-wide text-white shadow-[0_14px_40px_-10px_rgba(79,70,229,0.55)]',
                  'gradient-sweep-x bg-gradient-to-r from-indigo-700 via-blue-600 to-orange-500 ring-1 ring-white/20',
                  'transition-all duration-300 ease-out active:translate-y-0',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/60',
                ].join(' ')}
              >
                <span className="absolute inset-0 -translate-x-full shimmer-line opacity-80" />
                <span className="relative inline-flex items-center justify-center gap-2">
                  {isLoggedIn ? (
                    <>
                      <span className="inline-flex h-7 items-center rounded-full bg-white/15 px-2.5 text-[10px] font-bold backdrop-blur">👤 {user?.name?.split(' ').slice(-1)[0] || 'Tài khoản'}</span>
                      Điền biểu mẫu ngay
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5 group-hover:scale-110" />
                      Đăng nhập &amp; gửi yêu cầu
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" />
                    </>
                  )}
                </span>
              </button>
              {!isLoggedIn && (
                <div className="mt-1 rounded-xl bg-gradient-to-r from-white/90 via-indigo-50/70 to-orange-50/70 px-3 py-2 text-[11px] leading-5 text-slate-700 ring-1 ring-indigo-100 backdrop-blur shadow-sm">
                  <span className="font-bold text-orange-600">💡 Lợi ích khi đăng nhập:</span> Lưu hồ sơ KH, xem trạng thái yêu cầu, tải báo giá PDF, quản lý lịch sử dễ dàng.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== Bảng giá tham khảo 5 loại xe ===== */}
      <div>
        <PageHeader title="Loại xe & Bảng giá tham khảo" subtitle="Xin lưu ý: giá có thể thay đổi theo mùa, tuyến đường và số km thực tế. Bảng giá dưới đây chỉ mang tính tham khảo." />
        <div className="mt-4 gradient-sweep-br overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-indigo-600/20 via-white to-orange-500/15 p-0.5 shadow-xl">
          <div className="overflow-hidden rounded-[26px] bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-gradient-to-r from-indigo-600 via-blue-700 to-orange-500 text-white">
                <tr>
                  <th className="px-4 py-3 font-black tracking-wide">Loại xe</th>
                  <th className="px-4 py-3 font-black tracking-wide text-center">Số chỗ</th>
                  <th className="px-4 py-3 font-black tracking-wide">Giá/ngày (có tài xế)</th>
                  <th className="px-4 py-3 font-black tracking-wide">Giá/ngày (tự lái)</th>
                  <th className="px-4 py-3 font-black tracking-wide">Phù hợp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 stagger-in">
                {(options?.types || []).map((t, idx) => (
                  <tr key={t.value} className="tr-hover group">
                    <td className="px-4 py-3 font-bold text-slate-900">{t.label}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-orange-100 px-2 text-xs font-black text-indigo-700 ring-1 ring-indigo-200 pill-hover">{t.seats}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-2.5 py-1 text-sm font-black text-emerald-700 ring-1 ring-emerald-200 pill-hover">🏷️ {fmt.format(t.suggestDriverDailyVnd)}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{t.suggestSelfDriveDailyVnd > 0 ? <span className="font-semibold">{fmt.format(t.suggestSelfDriveDailyVnd)}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold italic text-orange-700 ring-1 ring-orange-200">🚗 Chỉ có tài xế</span>}</td>
                    <td className="px-4 py-3">
                      <span className="text-slate-600">
                        {t.suitability || <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] italic text-slate-500 ring-1 ring-slate-200">— Đang cập nhật —</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ===== Phân loại xe 4 loại ===== */}
      <div>
        <PageHeader title="Phân loại xe (4 hạng)" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4 stagger-in">
          {(useMemo(() => {
            const fromApi: any[] = (options?.classes || []) as any
            const rawList: any[] = []
            if (fromApi.length > 0) {
              for (const c of fromApi) {
                const cc: any = c
                const info: any = classVehicleInfo(cc.value as any) || {}
                rawList.push({
                  value: cc.value,
                  label: cc.label,
                  tone: cc.tone,
                  desc: cc.desc ?? info?.desc ?? '',
                })
              }
            } else {
              const arr: any[] = VEHICLE_CLASS_OPTIONS as any
              for (const o of arr) {
                const oo: any = o
                const info: any = classVehicleInfo(oo.value as any) || {}
                rawList.push({
                  value: oo.value,
                  label: oo.label,
                  tone: oo.tone,
                  desc: info?.desc ?? '',
                })
              }
            }
            return rawList
            // eslint-disable-next-line react-hooks/rules-of-hooks
          }, [options])).map((c: any, i: number) => {
            const tone = (c.tone || '').trim()
            const hasTone = tone.length > 2
            const pillToneClass = hasTone ? tone.split(/\s+/).join(' ') : 'bg-gradient-to-r from-indigo-100 to-orange-100 text-indigo-700 ring-indigo-200'
            return (
              <div key={String(c.value || c.label || i)} className="group card-hover relative overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-white via-indigo-50/20 to-orange-50/20 p-5 shadow-md">
                <div className="pointer-events-none absolute -top-12 -right-8 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-400/20 to-orange-400/20 blur-2xl group-hover:scale-125 transition-transform duration-500" />
                <span className={`pill-hover inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${pillToneClass}`}>
                  {c.label}
                </span>
                <div className="mt-4 space-y-2">
                  <div className="h-1 w-12 rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-orange-500" />
                  <div className="text-sm leading-6 text-slate-700 font-medium">{c.desc || ''}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ======================== SECTION 2: CHÍNH SÁCH & HỢP ĐỒNG MẪU ======================== */}
      <div>
        <PageHeader
          title="Chính sách cho thuê xe & Điều khoản Hợp đồng"
          subtitle="Khách hàng vui lòng đọc kỹ điều khoản dưới đây trước khi ký hợp đồng. Bảng điều khiển trên sẽ hiển thị các trường hợp thường gặp."
        />

        {/* 9 Chính sách card + Accordion chi tiết */}
        <div className="mt-4 grid gap-4 md:grid-cols-3 stagger-in">
          {(options?.policy || []).map((p, idx) => (
            <div key={p.key} className="group card-hover relative overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br from-white via-indigo-50/20 to-orange-50/20 p-5 shadow-sm">
              <div className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-400/20 to-orange-400/20 blur-2xl group-hover:scale-125 transition-transform duration-500" />
              <div className="flex items-center justify-between relative">
                <div className="flex items-center gap-2">
                  <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-orange-400 p-2 text-white shadow-md ring-1 ring-white/20">
                    {p.key.startsWith('cancel') && <Clock3 className="h-4 w-4" />}
                    {p.key === 'deposit' && <HandCoins className="h-4 w-4" />}
                    {p.key === 'driver' && <Car className="h-4 w-4" />}
                    {p.key === 'damage' && <AlertTriangle className="h-4 w-4" />}
                    {p.key === 'excess_km' && <MapPin className="h-4 w-4" />}
                    {p.key === 'fuel' && <ShieldCheck className="h-4 w-4" />}
                    {p.key === 'handover' && <FileSignature className="h-4 w-4" />}
                    {/^(cancel|deposit|driver|damage|excess_km|fuel|handover)(_|$)/.test(p.key || '') === false && <ShieldCheck className="h-4 w-4" />}
                  </div>
                  <div className="text-sm font-black text-slate-900">{p.title}</div>
                </div>
                <button type="button" onClick={() => setPolicyOpen((m) => ({ ...m, [p.key]: !m[p.key] }))} className="btn-sweep-outline rounded-lg p-1.5 text-indigo-700 hover:bg-indigo-50 ring-1 ring-indigo-100">
                  {policyOpen[p.key] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              {policyOpen[p.key] && (
                <div className="pop-in mt-3 space-y-1 rounded-xl bg-white/70 p-3 text-xs leading-6 text-slate-700 ring-1 ring-indigo-100 backdrop-blur">
                  <p>{p.desc}</p>
                  {p.key === 'cancel_7d' && <p className="text-[11px] text-orange-700 font-semibold">💡 Đối với mùa cao điểm (Tết, 30/4, 1/9, 2/9) thời gian hủy cộng thêm 7 ngày (tổng 14 ngày).</p>}
                  {p.key === 'deposit' && <p className="text-[11px] text-indigo-700 font-semibold">💡 Hình thức cọc: Chuyển khoản ngân hàng công ty hoặc Ví Momo/ ZaloPay (đều có hóa đơn VAT). Số còn lại thanh toán trước khi nhận xe hoặc khi ký hợp đồng.</p>}
                  {p.key === 'excess_km' && <p className="text-[11px] text-sky-700 font-semibold">💡 Nếu thuê theo lượt / giờ: KM không giới hạn trong phạm vi nội thành (quận 1-12 / TP.HCM hay Q. Hoàn Kiếm, Cầu Giấy… Hà Nội).</p>}
                  {p.key === 'damage' && <p className="text-[11px] text-rose-700 font-semibold">💡 Để tránh tranh chấp: nhân viên sẽ lập biên bản tình trạng xe + chụp 4 góc xe + vết xước cả trước khi giao và sau khi thu hồi (có chụp ảnh, ký xác nhận 2 bên).</p>}
                  {p.key === 'handover' && <p className="text-[11px] text-emerald-700 font-semibold">💡 Phụ thu địa điểm: ngoài thành phố ~3.000 ₫/km cho tài xế vận chuyển xe tới nơi nhận của khách (trong 30km nội thành miễn phí).</p>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Hợp đồng mẫu tóm tắt 10 điều khoản */}
        <div className="mt-8 card-hover relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-indigo-50/30 to-orange-50/30 p-6 shadow-xl">
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-gradient-to-br from-indigo-400/20 to-orange-400/20 blur-3xl" />
          <div className="flex items-center gap-3 relative">
            <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-orange-400 p-3 text-white shadow-md ring-1 ring-white/30">
              <FileSignature className="h-6 w-6" />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight bg-gradient-to-r from-indigo-800 via-blue-700 to-orange-600 bg-clip-text text-transparent">Mẫu Hợp đồng thuê xe (tóm tắt 10 điều khoản chính)</div>
              <div className="text-sm text-slate-600">Hợp đồng đầy đủ sẽ được nhân viên gửi qua email sau khi 2 bên thống nhất báo giá và khách hàng đặt cọc.</div>
            </div>
          </div>
          <div className="relative mt-6 h-1 w-40 rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-orange-500 shadow-sm" />
          <ol className="relative mt-6 grid gap-3 md:grid-cols-2 text-sm leading-6 text-slate-700 list-none space-y-2 stagger-in">
            {[
              ['Điều 1. Đối tượng & Hiệu lực', 'Ký giữa Bên A (Công ty cho thuê xe) và Bên B (Khách hàng). Hiệu lực kể từ ngày ký đến khi hoàn tất thanh toán cuối & thu hồi xe không khiếu nại.'],
              ['Điều 2. Xe & Thời gian', 'Ghi rõ biển số, loại xe, class xe, thời gian & địa điểm giao / thu hồi (theo đúng BB giao xe - BB thu hồi).'],
              ['Điều 3. Giá trị HĐ & Thanh toán', 'Tổng giá trị HĐ = Giá thuê xe + Phụ thu (nếu) + VAT 10%. Cọc 30% trước, 70% còn lại khi nhận xe.'],
              ['Điều 4. Giấy tờ Bên B', 'CCCD + GPLX (nếu tự lái) bản gốc trình khi nhận xe + copy lưu hồ sơ. Người lái <b>không</b> được giao xe cho người lái khác chưa ký tên trong HĐ.'],
              ['Điều 5. Việc sử dụng xe', 'Không dùng xe kinh doanh vận tải, cầm cố, đua xe; Không vượt quá tải trọng (số khách + hành lý). Không hút thuốc nếu khách không đồng ý.'],
              ['Điều 6. Bảo hiểm', 'Bảo hiểm vật chất xe và TNDS (trách nhiệm dân sự) đầy đủ. Trường hợp tai nạn: Bên B báo Công ty ngay & phối hợp giải quyết bảo hiểm.'],
              ['Điều 7. Thiệt hại & Trách nhiệm', 'Hỏng hóc thông thường (hao mòn): Công ty chịu. Hỏng hóc do lỗi Bên B, vi phạm Đ5: Bên B bồi thường đúng thiệt hại (có trừ hao mòn).'],
              ['Điều 8. Dịch bổ sung', 'Wifi, đồ trẻ em, tài xế tiếng Anh, đồ ăn nhẹ, guide đồng hành: báo trước & thể hiện rõ trên báo giá.'],
              ['Điều 9. Chấm dứt & Hủy', '1 bên vi phạm nghiêm trọng, bên còn lại có quyền chấm dứt sớm và yêu cầu bồi thường. Hủy theo chính sách đã đọc.'],
              ['Điều 10. Giải quyết tranh chấp', 'Thương lượng trước 10 ngày làm việc, không giải quyết được sẽ đưa ra Tòa án nhân dân có thẩm quyền.'],
            ].map(([k, v], i) => (
              <li key={i} className="group relative flex gap-3 rounded-2xl bg-white/70 p-3 ring-1 ring-indigo-100 backdrop-blur hover:ring-indigo-200 hover:bg-white transition-all duration-300">
                <span className="pill-hover shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 via-blue-600 to-orange-500 text-xs font-black text-white shadow-md">0{i + 1}</span>
                <div className="min-w-0">
                  <div className="font-black text-indigo-800">{k}</div>
                  <div className="mt-0.5 text-[13px] leading-6 text-slate-700" dangerouslySetInnerHTML={{ __html: v }} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ======================== SECTION 3: FORM ĐĂNG KÝ ======================== */}
      <div id="form" className="scroll-mt-20">
        <PageHeader title="Biểu mẫu yêu cầu thuê xe" subtitle="Vui lòng điền chính xác thông tin. Nhân viên Kinh doanh sẽ liên hệ trong 30 phút (giờ hành chính) để gửi báo giá chi tiết & hướng dẫn đặt cọc." />
        <form onSubmit={doSubmit} className="mt-4 card-hover relative overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-indigo-50/30 to-orange-50/30 p-6 shadow-2xl">
          <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-gradient-to-br from-indigo-400/20 via-blue-400/15 to-orange-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-orange-400/18 via-amber-300/12 to-indigo-300/16 blur-3xl" />
          <div className="relative grid gap-6 md:grid-cols-3 stagger-in">
            {/* 3.1 Thông tin khách hàng */}
            <div className="md:col-span-1 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600/10 to-blue-600/10 px-3 py-1.5 text-sm font-black text-indigo-800 ring-1 ring-indigo-200/70">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-[10px] font-black text-white">1</span>
                Thông tin khách hàng
              </div>
              <Field label="Họ và tên *" required>
                <input className={ipt} value={form.customerName} onChange={(e) => update('customerName', e.target.value)} placeholder="Nguyễn Văn A" />
              </Field>
              <Field label="Số điện thoại *" required>
                <input className={ipt} value={form.customerPhone} onChange={(e) => update('customerPhone', e.target.value)} placeholder="0912 345 678" />
              </Field>
              <Field label="Email">
                <input className={ipt} value={form.customerEmail} onChange={(e) => update('customerEmail', e.target.value)} placeholder="email@cuaban.com" />
              </Field>
              <Field label="Số CCCD (để lập hợp đồng)">
                <input className={ipt} value={form.citizenId} onChange={(e) => update('citizenId', e.target.value)} placeholder="012345678901" />
              </Field>
              <Field label="Địa chỉ liên hệ">
                <input className={ipt} value={form.customerAddress} onChange={(e) => update('customerAddress', e.target.value)} placeholder="123 Đường ABC, Quận 1, TP.HCM" />
              </Field>
            </div>

            {/* 3.2 Loại xe & yêu cầu */}
            <div className="md:col-span-1 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600/10 to-orange-500/10 px-3 py-1.5 text-sm font-black text-blue-800 ring-1 ring-blue-200/70">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-orange-500 text-[10px] font-black text-white">2</span>
                Yêu cầu xe
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Loại xe *" required>
                  <select className={ipt} value={form.vehicleType} onChange={(e) => update('vehicleType', e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {VEHICLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="Class xe">
                  <select className={ipt} value={form.vehicleClass} onChange={(e) => update('vehicleClass', e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {(VEHICLE_CLASS_OPTIONS as any[]).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số chỗ tối thiểu">
                  <input type="number" min={1} max={60} className={ipt} value={form.seatCountMin} onChange={(e) => update('seatCountMin', e.target.value)} placeholder="VD: 12" />
                </Field>
                <Field label="Tài xế">
                  <select className={ipt} value={form.withDriver ? 'driver' : 'self'} onChange={(e) => update('withDriver', e.target.value === 'driver')}>
                    <option value="driver">Có tài xế (khuyên dùng)</option>
                    <option value="self">Tự lái (dưới 16 chỗ)</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Số khách *" required>
                  <div className="relative">
                    <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                    <input type="number" min={1} max={600} className={`${ipt} pl-9`}
                      value={form.passengerCount}
                      onChange={(e) => update('passengerCount', e.target.value)}
                      placeholder="VD: 12" />
                  </div>
                </Field>
                <Field label="Số hành lý (vali)">
                  <div className="relative">
                    <Luggage className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                    <input type="number" min={0} max={500} className={`${ipt} pl-9`} value={form.luggageCount} onChange={(e) => update('luggageCount', e.target.value)} placeholder="4" />
                  </div>
                </Field>
              </div>
            </div>

            {/* 3.3 Lịch trình */}
            <div className="md:col-span-1 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-orange-500/10 to-orange-600/10 px-3 py-1.5 text-sm font-black text-orange-800 ring-1 ring-orange-200/70">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-[10px] font-black text-white">3</span>
                Lịch trình
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-slate-700">Ngày giờ nhận xe <span className="ml-1 text-rose-600">*</span></div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                      <input type="date" className={`${ipt} pl-9`}
                        value={form.pickupDate}
                        onChange={(e) => update('pickupDate', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-600" />
                      <input type="time" className={`${ipt} pl-9`}
                        value={form.pickupTime}
                        onChange={(e) => update('pickupTime', e.target.value)} />
                    </div>
                  </div>
                </div>
                {form.pickupDate ? <div className="mt-1 text-[11px] font-semibold text-indigo-700">📅 {form.pickupDate.split('-').reverse().join('/')} ⏰ {form.pickupTime}</div> : null}
              </div>
              <div>
                <div className="mb-1 text-xs font-bold text-slate-700">Ngày giờ trả xe <span className="ml-1 text-rose-600">*</span></div>
                <div className="grid grid-cols-5 gap-2">
                  <div className="col-span-3">
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                      <input type="date" className={`${ipt} pl-9`}
                        value={form.returnDate}
                        onChange={(e) => update('returnDate', e.target.value)} />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="relative">
                      <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-600" />
                      <input type="time" className={`${ipt} pl-9`}
                        value={form.returnTime}
                        onChange={(e) => update('returnTime', e.target.value)} />
                    </div>
                  </div>
                </div>
                {form.returnDate ? <div className="mt-1 text-[11px] font-semibold text-orange-700">📅 {form.returnDate.split('-').reverse().join('/')} ⏰ {form.returnTime}</div> : null}
              </div>
              <Field label="Địa điểm nhận xe *" required>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500" />
                  <input className={`${ipt} pl-9`} value={form.pickupLocation} onChange={(e) => update('pickupLocation', e.target.value)} placeholder="Văn phòng / sân bay / khách sạn ..." />
                </div>
              </Field>
              <Field label="Địa điểm trả xe *" required>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                  <input className={`${ipt} pl-9`} value={form.returnLocation} onChange={(e) => update('returnLocation', e.target.value)} placeholder="Giống nhận / hoặc tỉnh khác" />
                </div>
              </Field>
            </div>

            {/* Full row Notes */}
            <div className="md:col-span-3 grid gap-3 md:grid-cols-2 relative">
              <Field label="Lộ trình / Tuyến đường dự kiến">
                <textarea className={ipt} rows={3} value={form.routeNotes} onChange={(e) => update('routeNotes', e.target.value)} placeholder="VD: TP.HCM → Đà Lạt → Mũi Né → TP.HCM (5 ngày 4 đêm)" />
              </Field>
              <Field label="Yêu cầu đặc biệt (nếu có)">
                <textarea className={ipt} rows={3} value={form.specialRequests} onChange={(e) => update('specialRequests', e.target.value)} placeholder="VD: xe mới <1 năm, tài xế nói tiếng Anh, ghế trẻ em, Wifi trên xe, v.v." />
              </Field>
            </div>
          </div>

          {/* Agreement + Submit */}
          <div className="relative mt-6 space-y-4 border-t border-gradient-to-r from-indigo-200 via-blue-200 to-orange-200 pt-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input type="checkbox" className="mt-1 h-5 w-5 rounded-xl border-indigo-300 bg-gradient-to-br from-white to-indigo-50 text-orange-600 focus:ring-orange-500" checked={form.agreementAccepted} onChange={(e) => update('agreementAccepted', e.target.checked)} />
              <span className="text-sm leading-6 text-slate-700 group-hover:text-slate-900 transition-colors duration-300">
                <b className="text-indigo-800">Tôi đã đọc và đồng ý</b> với <u className="text-blue-700">Chính sách cho thuê xe</u>, <u className="text-orange-700">Điều khoản Hủy & Hoàn tiền</u> và 10 Điều khoản chính của hợp đồng mẫu (nêu chi tiết ở trên).
                Tôi đồng ý thông tin cá nhân được Công ty xử lý để thực hiện giao dịch thuê xe & liên hệ báo giá.
              </span>
            </label>

            {submitResult?.ok && (
              <div className="pop-in rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-orange-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200/60 shadow-md">
                <div className="flex items-center gap-2 font-black text-lg"><CheckCircle2 className="h-6 w-6 text-emerald-600" /> 🎉 Gửi yêu cầu thành công!</div>
                <div className="mt-1">Mã yêu cầu của bạn: <b className="text-orange-600 text-lg">{submitResult.code || '—'}</b>. Cảm ơn <b className="text-indigo-700">{submitResult.name}</b> đã tin tưởng, nhân viên sẽ liên hệ trong 30 phút tới.</div>
              </div>
            )}
            {submitResult && !submitResult.ok && (
              <div className="shake-err rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 p-4 text-sm text-rose-800 ring-1 ring-rose-200/60 shadow-md">
                <div className="flex items-center gap-2 font-black text-lg"><AlertTriangle className="h-6 w-6 text-rose-600" /> ⚠️ Có lỗi xảy ra:</div>
                <div className="mt-1">{(submitResult as any).msg}</div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 font-bold ring-1 ring-indigo-100"><Phone className="h-3.5 w-3.5 text-indigo-600" /> Hotline: 1900 0000</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-3 py-1 font-bold ring-1 ring-orange-100"><Mail className="h-3.5 w-3.5 text-orange-600" /> booking@congtydulich.vn</span>
              </div>
              <button
                type="submit"
                disabled={submiting}
                className={[
                  'group relative inline-flex items-center gap-2 rounded-2xl px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-[0_18px_40px_-12px_rgba(79,70,229,0.5)]',
                  submiting ? 'bg-slate-400 cursor-not-allowed' : 'gradient-sweep-x bg-gradient-to-r from-indigo-700 via-blue-600 to-orange-500 hover:shadow-[0_22px_50px_-12px_rgba(249,115,22,0.55)]',
                  'focus:outline-none focus-visible:ring-4 focus-visible:ring-orange-300/60 transition-all duration-300',
                ].join(' ')}
              >
                {!submiting && <span className="absolute inset-0 -translate-x-full shimmer-line opacity-80" />}
                <span className="relative inline-flex items-center gap-2">
                  {submiting ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/50 border-t-white spin-slow" />
                      Đang gửi yêu cầu…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 icon-pop-left" />
                      Gửi yêu cầu thuê xe
                      <ArrowRight className="h-4 w-4 icon-pop" />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ============================= HELPERS ============================= */
const ipt = "w-full rounded-[14px] border border-slate-200 bg-gradient-to-r from-white via-white to-indigo-50/40 px-3 py-2.5 text-sm text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ring-1 ring-slate-100 ipt-glow transition-all duration-300 placeholder:text-slate-400 hover:border-indigo-200"
function Field({ label, children, required }: { label: string; children: any; required?: boolean }) {
  return (
    <label className="block group">
      <div className="mb-1 text-xs font-bold tracking-wide text-slate-800 group-hover:text-indigo-700 transition-colors duration-300">{label}{required && <span className="ml-1 text-rose-600">*</span>}</div>
      {children}
    </label>
  )
}
