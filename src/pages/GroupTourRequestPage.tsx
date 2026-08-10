import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { getStoredUser } from '@/features/auth/auth'
import {
  createPublicGroupTourRequest,
  GroupTourServicePreference,
} from '@/features/group-tour-requests/group-tour-requests'
import { formatMoney } from '@/utils/format'

const DEFAULT_SERVICES: GroupTourServicePreference = {
  needVisa: false,
  needFlight: false,
  needBus: false,
  needHotel: true,
  needMeals: true,
  needGuide: true,
}

const SERVICE_OPTS: Array<{ key: keyof GroupTourServicePreference; label: string; icon: string; hint: string }> = [
  { key: 'needVisa', label: 'Visa / Thủ tục xuất cảnh', icon: '🛂', hint: 'Cần làm visa theo đoàn' },
  { key: 'needFlight', label: 'Vé máy bay', icon: '✈️', hint: 'Cần book vé máy bay khứ hồi' },
  { key: 'needBus', label: 'Xe du lịch', icon: '🚌', hint: 'Cần xe 16 chỗ / 29 chỗ / 45 chỗ...' },
  { key: 'needHotel', label: 'Khách sạn', icon: '🏨', hint: 'Cần đặt phòng theo hạng sao' },
  { key: 'needMeals', label: 'Bữa ăn', icon: '🍱', hint: 'Ăn sáng/trưa/tối theo tiêu chuẩn' },
  { key: 'needGuide', label: 'HDV', icon: '🧭', hint: 'Cần hướng dẫn viên Việt/Quốc tế' },
]

export default function GroupTourRequestPage() {
  const toast = useToast()
  const nav = useNavigate()
  const u = getStoredUser()
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(() => ({
    contactName: u?.name || '',
    contactPhone: u?.phone || '',
    contactEmail: u?.email || '',
    contactRole: '',
    companyOrGroupName: '',
    companyTaxCode: '',
    adultCount: 30,
    childCount: 0,
    infantCount: 0,
    departureCity: 'Hà Nội',
    destination: '',
    approximateDurationText: '4 ngày 3 đêm',
    preferredStartDate: '',
    preferredEndDate: '',
    hotelClassRequested: '4 sao',
    transportRequestedNotes: '',
    budgetPerPersonVnd: 0,
    totalBudgetVnd: 0,
    specialRequirements: '',
    servicesPreference: { ...DEFAULT_SERVICES },
    sourceChannel: 'website_group_form',
  }))
  const totalGuests = Number(form.adultCount || 0) + Number(form.childCount || 0) + Number(form.infantCount || 0)
  const estTotalBudget = useMemo(() => {
    const per = Number(form.budgetPerPersonVnd || 0)
    const fixed = Number(form.totalBudgetVnd || 0)
    if (fixed > 0) return fixed
    return per * totalGuests
  }, [form.budgetPerPersonVnd, form.totalBudgetVnd, totalGuests])
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggleService = (k: keyof GroupTourServicePreference) => {
    set('servicesPreference', { ...form.servicesPreference, [k]: !form.servicesPreference[k] })
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.contactName.trim()) return toast.error('Vui lòng nhập Họ và tên liên hệ.')
    if (!form.contactPhone.trim() || form.contactPhone.replace(/\D/g, '').length < 8) return toast.error('Số điện thoại không hợp lệ.')
    if (!form.companyOrGroupName.trim()) return toast.error('Vui lòng nhập Tên công ty / Tên đoàn.')
    if (totalGuests < 5) return toast.error('Số lượng hành khách tối thiểu 5 người cho Tour đoàn. Nếu ít người hơn vui lòng đặt Tour lẻ.')
    if (!form.destination.trim()) return toast.error('Vui lòng nhập Điểm đến / Tour mong muốn.')
    try {
      setSubmitting(true)
      const r = await createPublicGroupTourRequest({
        contactName: form.contactName.trim(),
        contactPhone: form.contactPhone.trim(),
        contactEmail: form.contactEmail.trim() || null,
        contactRole: form.contactRole.trim() || null,
        companyOrGroupName: form.companyOrGroupName.trim(),
        companyTaxCode: form.companyTaxCode.trim() || null,
        adultCount: Math.max(0, Number(form.adultCount) || 0),
        childCount: Math.max(0, Number(form.childCount) || 0),
        infantCount: Math.max(0, Number(form.infantCount) || 0),
        departureCity: form.departureCity.trim() || null,
        destination: form.destination.trim(),
        approximateDurationText: form.approximateDurationText.trim() || null,
        preferredStartDate: form.preferredStartDate || null,
        preferredEndDate: form.preferredEndDate || null,
        hotelClassRequested: form.hotelClassRequested.trim() || null,
        servicesPreference: form.servicesPreference,
        transportRequestedNotes: form.transportRequestedNotes.trim() || null,
        budgetPerPersonVnd: Number(form.budgetPerPersonVnd) > 0 ? Number(form.budgetPerPersonVnd) : null,
        totalBudgetVnd: Number(form.totalBudgetVnd) > 0 ? Number(form.totalBudgetVnd) : null,
        specialRequirements: form.specialRequirements.trim() || null,
        sourceChannel: form.sourceChannel,
      })
      toast.success(`Đã gửi yêu cầu ${r.code}. Nhân viên sẽ gọi bạn trong 30 phút.`)
      nav(`/group-tour?created=${r.code}`)
    } catch (err) {
      toast.error((err as any)?.message || 'Gửi yêu cầu thất bại, vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        subtitle="Điền thông tin dưới đây, chuyên viên Tour đoàn sẽ gọi điện tư vấn + báo giá 3 phương án chi tiết trong 30 phút."
        title="📋 Gửi yêu cầu báo giá Tour đoàn"
        right={
          <Link to="/group-tour" className="inline-flex h-11 items-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
            ← Giới thiệu Tour đoàn
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">👤 Thông tin liên hệ</h3>
            <p className="mt-1 text-xs text-slate-500">SĐT người liên hệ — Nhân viên sẽ gọi lại số này.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Họ và tên liên hệ *</label>
                <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Anh Nguyễn Văn A" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Số điện thoại *</label>
                <input value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="09xx xxx xxx" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Email</label>
                <input value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="email@congty.vn" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Chức vụ</label>
                <input value={form.contactRole} onChange={(e) => set('contactRole', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Trưởng phòng Nhân sự" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Tên công ty / Tên đoàn *</label>
                <input value={form.companyOrGroupName} onChange={(e) => set('companyOrGroupName', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Công ty CPH XYZ / Đoàn Gia đình A" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Mã số thuế (nếu cần VAT)</label>
                <input value={form.companyTaxCode} onChange={(e) => set('companyTaxCode', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Bỏ trống nếu không cần hóa đơn VAT" />
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">🗺️ Chuyến đi</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Nơi khởi hành</label>
                <input value={form.departureCity} onChange={(e) => set('departureCity', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Hà Nội / HCM..." />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Điểm đến / Tour mong muốn *</label>
                <input value={form.destination} onChange={(e) => set('destination', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Hạ Long 2N1Đ / Miền Tây 3N2Đ / Lào Cai Sapa..." />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ngày đi dự kiến</label>
                <input type="date" value={form.preferredStartDate} onChange={(e) => set('preferredStartDate', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ngày về dự kiến</label>
                <input type="date" value={form.preferredEndDate} onChange={(e) => set('preferredEndDate', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Thời gian tour</label>
                <input value={form.approximateDurationText} onChange={(e) => set('approximateDurationText', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="4 ngày 3 đêm / 5N4Đ..." />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Hạng khách sạn</label>
                <select value={form.hotelClassRequested} onChange={(e) => set('hotelClassRequested', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4">
                  <option value="">Chưa xác định (chuyên viên đề xuất)</option>
                  <option value="2 sao">2 sao (tiết kiệm)</option>
                  <option value="3 sao">3 sao (chất lượng tốt)</option>
                  <option value="4 sao">4 sao (cao cấp)</option>
                  <option value="5 sao">5 sao (sang trọng)</option>
                  <option value="Resort 5 sao">Resort 5 sao (sang trọng nhất)</option>
                </select>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">👥 Số lượng hành khách</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Người lớn (NL ≥ 11t)</label>
                <input type="number" min={0} max={2000} step={1} value={form.adultCount} onChange={(e) => set('adultCount', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Trẻ em (TE 2-10t)</label>
                <input type="number" min={0} max={2000} step={1} value={form.childCount} onChange={(e) => set('childCount', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Em bé (EB nhỏ hơn 2t)</label>
                <input type="number" min={0} max={2000} step={1} value={form.infantCount} onChange={(e) => set('infantCount', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-blue-50 to-orange-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Tổng hành khách dự kiến</div>
              <div className="text-2xl font-black text-orange-600">{totalGuests} người</div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">🧩 Dịch vụ cần trong tour</h3>
            <p className="mt-1 text-xs text-slate-500">Tick những dịch vụ bạn cần, bỏ trống nếu chưa xác định.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {SERVICE_OPTS.map((o) => {
                const on = Boolean(form.servicesPreference[o.key])
                return (
                  <label key={o.key} className={'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ' + (on ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-slate-200 bg-white hover:bg-orange-50/30')}>
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-orange-500" checked={on} onChange={() => toggleService(o.key)} />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900">{o.icon} {o.label}</div>
                      <div className="text-xs text-slate-500">{o.hint}</div>
                    </div>
                  </label>
                )
              })}
            </div>
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ghi chú về xe / phương tiện</label>
              <input value={form.transportRequestedNotes} onChange={(e) => set('transportRequestedNotes', e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Cần xe 45 chỗ Limousine / Đón ở Văn phòng Quận 1 HCM 7h..." />
            </div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-black text-slate-900">💰 Ngân sách (không bắt buộc)</h3>
            <p className="mt-1 text-xs text-slate-500">Điền ngân sách để chuyên viên đề xuất phương án phù hợp nhanh hơn, hoặc bỏ trống nếu muốn nhận 3 phương án gợi ý.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ngân sách / người (VND)</label>
                <input type="number" min={0} step={100000} value={form.budgetPerPersonVnd || ''} onChange={(e) => set('budgetPerPersonVnd', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Ví dụ: 5000000" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Ngân sách tổng (VND)</label>
                <input type="number" min={0} step={100000} value={form.totalBudgetVnd || ''} onChange={(e) => set('totalBudgetVnd', Math.max(0, parseInt(e.target.value || '0', 10) || 0))} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="Ví dụ: 150000000" />
              </div>
            </div>
            {estTotalBudget > 0 ? (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 via-orange-50 to-rose-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Tổng ngân sách dự kiến</div>
                <div className="text-2xl font-black text-emerald-700">{formatMoney(estTotalBudget)}đ</div>
              </div>
            ) : null}
            <div className="mt-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">Yêu cầu riêng / Đặc biệt</label>
              <textarea rows={5} value={form.specialRequirements} onChange={(e) => set('specialRequirements', e.target.value)} className="w-full resize-y rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none ring-orange-100 focus:border-orange-400 focus:ring-4" placeholder="15 phòng 2 người + 1 phòng 3 người · Ăn chay 5 người · Cần quà tặng công ty mỗi người · Chỉ đi ngày thứ 7 Chủ Nhật..." />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4 space-y-5">
          <div className="sticky top-6 rounded-3xl border border-slate-200 bg-gradient-to-br from-blue-900 via-blue-800 to-orange-700 p-6 text-white shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-2xl backdrop-blur-sm">🎯</div>
            <h3 className="mt-4 text-lg font-black">Chuyên viên Tour đoàn</h3>
            <p className="mt-1 text-sm text-white/80">Gửi form → bạn sẽ nhận được điện thoại tư vấn <span className="font-bold">trong 30 phút</span> vào giờ hành chính.</p>
            <ul className="mt-4 space-y-2 text-sm text-white/90">
              <li className="flex gap-2">✅ Báo giá 3 phương án chi tiết (Tốt / Vừa / Cao cấp)</li>
              <li className="flex gap-2">✅ Hỗ trợ HĐ VAT 0% cho công ty</li>
              <li className="flex gap-2">✅ Giá tốt hơn đặt lẻ khi đoàn từ 15 người+</li>
              <li className="flex gap-2">✅ Miễn phí đổi danh sách hành khách 5 ngày trước khởi hành</li>
              <li className="flex gap-2">✅ Cân bằng thanh toán trả chậm 30 ngày (HĐ doanh nghiệp)</li>
            </ul>
            <button disabled={submitting} type="submit" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white px-6 text-sm font-black uppercase text-blue-900 shadow-lg hover:bg-orange-50 disabled:opacity-70">
              {submitting ? 'Đang gửi yêu cầu...' : '🚀 Gửi yêu cầu báo giá'}
            </button>
            <p className="mt-3 text-center text-[11px] text-white/70">Thông tin của bạn bảo mật 100%. Không chia sẻ ra bên ngoài.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Hoặc gọi trực tiếp</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-600">📞</div>
              <div>
                <div className="text-lg font-black text-slate-900">Hotline Tour đoàn</div>
                <div className="text-sm text-slate-500">Giờ hành chính 8h → 18h hàng ngày</div>
              </div>
            </div>
            <a href="tel:19001009" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-2xl border-2 border-orange-500 bg-orange-500 text-sm font-black uppercase text-white hover:bg-orange-600">📞 1900 1009</a>
          </div>
        </div>
      </div>
    </form>
  )
}
