import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '@/components/ui/PageHeader'
import { formatMoney } from '@/utils/format'

const FEATURES: Array<{ icon: string; title: string; desc: string }> = [
  { icon: '💸', title: 'Giá TỐT hơn đặt lẻ', desc: 'Đoàn từ 15 người+ nhận chiết khấu hàng loạt từ nhà cung cấp (khách sạn / xe / vé khu vui chơi).' },
  { icon: '📋', title: 'KHÔNG nhập từng tên 100 người', desc: 'Chỉ cần Upload file Excel danh sách hành khách, hoặc gửi sau 7 ngày trước khởi hành. Không cần card 100 người.' },
  { icon: '🧾', title: 'Hỗ trợ HĐ VAT 0%', desc: 'Cung cấp đầy đủ Hóa đơn VAT 0%, Biên lai thuế, Hợp đồng dịch vụ du lịch theo quy định pháp luật doanh nghiệp.' },
  { icon: '🤝', title: 'Trả chậm đến 30 ngày', desc: 'Hợp đồng doanh nghiệp: đặt cọc 30%, số còn lại trả sau tour 30 ngày (công ty có lịch sử hợp tác).' },
  { icon: '👔', title: 'Chuyên viên riêng 1-1', desc: '1 chuyên viên Tour đoàn đi theo suốt từ tư vấn, báo giá → điều phối tour → báo cáo cuối tour.' },
  { icon: '🎁', title: 'Custom hoàn toàn', desc: 'Tương tác ngay lịch trình, menu ăn, loại phòng, dịch vụ add-on theo đúng văn hóa công ty bạn.' },
]

const STEPS: Array<{ n: number; icon: string; title: string; body: string }> = [
  { n: 1, icon: '📋', title: 'Gửi yêu cầu báo giá', body: 'Điền form 2 phút: số người, điểm đến, thời gian, dịch vụ cần (Visa, MB, xe, KS, ăn, HDV).' },
  { n: 2, icon: '📞', title: 'Chuyên viên gọi trong 30 phút', body: 'Gọi điện tư vấn, làm rõ yêu cầu, đề xuất 3 phương án (Cao cấp / Vừa phải / Tiết kiệm).' },
  { n: 3, icon: '📧', title: 'Nhận báo giá chi tiết', body: 'File PDF báo giá từng hạng mục (xe / KS / tour / ăn / phụ thu) + Hợp đồng mẫu.' },
  { n: 4, icon: '🚀', title: 'Ký HĐ & Tổ chức tour', body: 'Ký HĐ, đặt cọc → team điều phối vận hành, HDV, xe, KS. Trả file danh sách hành khách sau cũng được.' },
]

const SAMPLE_TOURS: Array<{ title: string; cover: string; duration: string; from: string; to: string; minPax: number; perPerson: number; tags: string[] }> = [
  { title: 'Tour Hà Nội - Hạ Long - Yên Tử 3N2Đ', cover: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=900&q=80', duration: '3 Ngày 2 Đêm', from: 'Hà Nội', to: 'Hạ Long', minPax: 20, perPerson: 2890000, tags: ['Vịnh Hạ Long', 'Chùa Yên Tử', 'Team building'] },
  { title: 'Tour Sapa - Fansipan - Ninh Bình 4N3Đ', cover: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=900&q=80', duration: '4 Ngày 3 Đêm', from: 'Hà Nội', to: 'Sa Pa', minPax: 15, perPerson: 4350000, tags: ['Leo Fansipan', 'Thung Nham', 'Team building lớn'] },
  { title: 'Tour TP.HCM - Mũi Né - Đà Lạt 4N3Đ', cover: 'https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=900&q=80', duration: '4 Ngày 3 Đêm', from: 'TP. Hồ Chí Minh', to: 'Đà Lạt', minPax: 20, perPerson: 3890000, tags: ['Trượt cát', 'Xông đất', 'Gala dinner'] },
  { title: 'Tour Phú Quốc - Nam Đảo - Grand World 5N4Đ', cover: 'https://images.unsplash.com/photo-1559494007-9f5847c49d94?auto=format&fit=crop&w=900&q=80', duration: '5 Ngày 4 Đêm', from: 'Hà Nội / HCM', to: 'Phú Quốc', minPax: 25, perPerson: 7490000, tags: ['Sun World', 'Vé máy bay', 'Resort 5 sao'] },
  { title: 'Tour Côn Đảo - Lịch sử - Nghỉ dưỡng 3N2Đ', cover: 'https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=900&q=80', duration: '3 Ngày 2 Đêm', from: 'HCM / Vũng Tàu', to: 'Côn Đảo', minPax: 15, perPerson: 5780000, tags: ['Di tích lịch sử', 'Tắm biển', 'Máy bay'] },
  { title: 'Tour Lào Cai - Hà Giang - Mèo Vạc 4N3Đ', cover: 'https://images.unsplash.com/photo-1646007198480-3109ff0606b4?auto=format&fit=crop&w=900&q=80', duration: '4 Ngày 3 Đêm', from: 'Hà Nội', to: 'Hà Giang', minPax: 12, perPerson: 4890000, tags: ['Đèo Mã Pí Lèng', 'Khách sạn bản', 'Team 12+'] },
]

const FAQ: Array<{ q: string; a: string }> = [
  { q: 'Đoàn dưới 5 người có đặt Tour đoàn được không?', a: 'Từ 1-4 người bạn vui lòng đặt Tour lẻ theo form chính (bỏ qua form này). Từ 5 người+ trở lên bạn đã có thể gửi yêu cầu báo giá đoàn.' },
  { q: 'Tôi không có danh sách hành khách ngay bây giờ?', a: 'Hoàn toàn OK. Chỉ cần gửi số lượng NL/TE/EB trước, bổ sung file danh sách (Excel) cuối cùng trước 5-7 ngày khởi hành.' },
  { q: 'Có thể thanh toán trả chậm không?', a: 'Có. Hợp đồng doanh nghiệp: đặt cọc 30-50% trước, số còn lại thanh toán sau tour 15-30 ngày (áp dụng cho công ty có HĐ lần 2+).' },
  { q: 'Có thể đổi lịch trình / dịch vụ không?', a: 'Tất nhiên Tour đoàn 100% custom được: lịch trình, hạng KS, loại xe, menu ăn, giờ start, thêm team building / gala dinner / quà tặng...' },
  { q: 'Cần hóa đơn VAT 0% cho công ty thì sao?', a: 'Chỉ cần cung cấp MST công ty. Chúng tôi xuất Full VAT 0% + HĐ dịch vụ đúng quy định thuế.' },
]

export default function GroupTourPage() {
  const [sp] = useSearchParams()
  const created = sp.get('created')
  const bannerSuccess = useMemo(() => created ? (
    <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-orange-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-emerald-700">✅ Gửi yêu cầu báo giá thành công</div>
          <h2 className="mt-1 text-xl font-black text-slate-900">Mã yêu cầu: <span className="text-orange-600">{created}</span></h2>
          <p className="mt-1 text-sm text-slate-600">Chuyên viên Tour đoàn sẽ gọi điện xác nhận + báo giá chi tiết trong <span className="font-bold text-slate-900">30 phút tới</span> (giờ hành chính).</p>
        </div>
        <Link to="/group-tour/request" className="inline-flex h-11 shrink-0 items-center rounded-2xl bg-emerald-600 px-5 text-xs font-black uppercase text-white hover:bg-emerald-700">Gửi thêm yêu cầu khác</Link>
      </div>
    </div>
  ) : null, [created])
  return (
    <div className="space-y-8">
      <PageHeader
        title="👔 Tour đoàn doanh nghiệp & nhóm lớn"
        right={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <a href="tel:19001009" className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50">📞 1900 1009</a>
            <Link
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-5 text-xs font-extrabold uppercase text-white shadow-sm shadow-orange-500/15 hover:opacity-95"
              to="/group-tour/request"
            >
              🚀 Gửi yêu cầu báo giá
            </Link>
          </div>
        }
      />
      {bannerSuccess}
      <section className="overflow-hidden rounded-[32px] bg-gradient-to-br from-blue-900 via-blue-800 to-orange-600 p-8 text-white shadow-2xl">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-wide backdrop-blur">🎯 Dành riêng cho đoàn & doanh nghiệp</div>
            <h2 className="mt-4 text-4xl font-black leading-tight 2xl:text-5xl">
              Team building · Hội thảo · Tour tri ân khách hàng · <span className="underline decoration-orange-400 decoration-[6px] decoration-solid">Tour đoàn 5 - 500 người</span>
            </h2>
            <p className="mt-4 max-w-3xl text-base text-white/90">
              Từ công ty 10 người đến tập đoàn 500 người. 1 chuyên viên phụ trách 1-1 từ lúc gửi form, báo giá 3 phương án, điều phối suốt tour → báo cáo cuối dự án.
              Không cần nhập 100 tên ngay: chỉ cần <span className="font-black">Upload file Excel</span> hoặc gửi danh sách sau.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/group-tour/request" className="inline-flex h-12 items-center rounded-2xl bg-white px-8 text-xs font-black uppercase text-blue-900 hover:bg-orange-50 shadow-lg">
                Bắt đầu gửi yêu cầu →
              </Link>
              <a href="tel:19001009" className="inline-flex h-12 items-center rounded-2xl border-2 border-white/40 bg-white/5 px-8 text-xs font-black uppercase text-white hover:bg-white/10">
                📞 Tư vấn 1900 1009
              </a>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { k: '+21.4%', l: 'Tiết kiệm vs lẻ' },
                { k: '30 phút', l: 'Gọi lại' },
                { k: '3 phương án', l: 'Báo giá' },
                { k: '12 tháng', l: 'Bảo hành tour' },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
                  <div className="text-2xl font-black text-orange-300">{s.k}</div>
                  <div className="mt-1 text-xs font-semibold text-white/80">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-orange-600">💎 Vì sao chọn Tour đoàn của chúng tôi</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">6 lợi ích khi đặt Tour đoàn</h3>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:border-orange-300 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-orange-100 text-2xl">{f.icon}</div>
              <h4 className="mt-4 text-base font-black text-slate-900">{f.title}</h4>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-orange-50/40 p-8 shadow-sm">
        <div className="text-center">
          <div className="text-xs font-bold uppercase tracking-wide text-orange-600">⚡ Quy trình đặt Tour đoàn</div>
          <h3 className="mt-1 text-2xl font-black text-slate-900">4 bước đơn giản - Đặt tour đoàn trong 1 ngày</h3>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-3xl border border-white bg-white p-5 shadow-sm">
              <div className="absolute -top-3 -left-3 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-700 to-orange-500 text-sm font-black text-white shadow-md">B{s.n}</div>
              <div className="text-4xl">{s.icon}</div>
              <h4 className="mt-3 text-base font-black text-slate-900">{s.title}</h4>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-orange-600">🧩 Tour đoàn mẫu</div>
            <h3 className="mt-1 text-2xl font-black text-slate-900">6 lộ trình Tour đoàn phổ biến năm 2026</h3>
            <p className="mt-1 text-sm text-slate-500">Giá tham khảo cho đoàn 25+ người. Click gửi form để nhận báo giá chi tiết chính xác theo số lượng đoàn của bạn.</p>
          </div>
          <Link to="/group-tour/request" className="inline-flex h-10 items-center rounded-2xl bg-slate-900 px-5 text-[10px] font-extrabold uppercase text-white hover:bg-slate-800">
            Nhận báo giá riêng →
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SAMPLE_TOURS.map((t) => (
            <article key={t.title} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm hover:shadow-lg transition">
              <div className="relative h-44 bg-slate-100">
                <img src={t.cover} alt={t.title} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 inline-flex items-center rounded-full bg-white/90 px-3 py-1 text-[11px] font-black text-slate-900 shadow-sm backdrop-blur">👥 Đoàn từ {t.minPax}+ người</div>
                <div className="absolute right-3 top-3 inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-[11px] font-black uppercase text-white shadow">🏷 Best</div>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5">
                  {t.tags.map((tag) => (<span key={tag} className="inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">#{tag}</span>))}
                </div>
                <h4 className="mt-3 text-lg font-black leading-tight text-slate-900">{t.title}</h4>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div><div className="font-bold uppercase tracking-wide text-slate-400">Thời gian</div><div className="mt-1 font-bold text-slate-800">{t.duration}</div></div>
                  <div><div className="font-bold uppercase tracking-wide text-slate-400">Điểm đi</div><div className="mt-1 font-bold text-slate-800">{t.from}</div></div>
                  <div><div className="font-bold uppercase tracking-wide text-slate-400">Điểm đến</div><div className="mt-1 font-bold text-slate-800">{t.to}</div></div>
                </div>
                <div className="mt-5 flex items-end justify-between border-t border-slate-100 pt-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Giá tham khảo / người</div>
                    <div className="text-xl font-black text-orange-600">{formatMoney(t.perPerson)}đ</div>
                  </div>
                  <Link to={`/group-tour/request?preset=${encodeURIComponent(t.title)}`} className="inline-flex h-10 items-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-4 text-[10px] font-black uppercase text-white hover:opacity-95">
                    Báo giá ngay
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="text-xs font-bold uppercase tracking-wide text-orange-600">❓ FAQ</div>
          <h3 className="mt-1 text-2xl font-black text-slate-900">Câu hỏi thường gặp Tour đoàn</h3>
          <div className="mt-6 space-y-4">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 open:bg-white open:border-orange-200 transition">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-bold text-slate-900">
                  <span>Q: {f.q}</span>
                  <span className="shrink-0 text-orange-500 transition group-open:rotate-45 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-50 text-base">+</span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed pl-1 border-l-2 border-orange-300 ml-1 pl-4">A: {f.a}</p>
              </details>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-blue-900 via-blue-800 to-orange-600 p-8 text-white shadow-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur-sm">📞</div>
            <h3 className="mt-4 text-2xl font-black">Cần tư vấn ngay?</h3>
            <p className="mt-2 text-white/85">Gọi trực tiếp cho Chuyên viên Tour đoàn, được báo giá sơ bộ qua điện thoại 10 phút.</p>
            <a href="tel:19001009" className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-white px-6 text-xs font-black uppercase text-blue-900 shadow-lg hover:bg-orange-50">
              📞 Hotline: 1900 1009
            </a>
            <p className="mt-3 text-center text-[11px] text-white/70">8h00 → 20h00 | Tất cả các ngày trong tuần (kể cả thứ 7, Chủ Nhật)</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Hoặc gửi yêu cầu 2 phút</div>
            <h4 className="mt-1 text-lg font-black text-slate-900">Điền form & nhận báo giá chi tiết</h4>
            <p className="mt-1 text-sm text-slate-500">Bao gồm: giá từng hạng mục + hợp đồng mẫu + phương án thanh toán.</p>
            <Link to="/group-tour/request" className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-6 text-xs font-black uppercase text-white hover:opacity-95">
              🚀 Bắt đầu gửi yêu cầu
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
