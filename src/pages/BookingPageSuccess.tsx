import { Link } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth.hooks'
import type { PublicTourDetail } from '@/features/tours/tours'
import { formatDate } from '@/utils/date'

export function BookingPageSuccess({ code, tour }: { code: string; tour: PublicTourDetail | null }) {
  const auth = useAuth()
  const departure = tour?.departures?.[0]
  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code) } catch { /* ignore */ }
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col items-center bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-10 text-center text-white">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/20 backdrop-blur">
            <svg viewBox="0 0 24 24" fill="none" className="h-11 w-11 text-white" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-black uppercase tracking-wide">Đặt tour thành công</h1>
          <p className="mt-2 text-sm text-emerald-50/90 max-w-xl">
            Cảm ơn bạn đã đặt tour tại VietNamExplorer. Mã đặt chỗ của bạn đã được ghi nhận. Nhân viên sẽ gọi điện xác nhận qua SĐT bạn đăng ký trong 30 phút tới.
          </p>
        </div>

        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-orange-200 bg-orange-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-wide text-orange-700">Mã đặt chỗ</div>
              <div className="mt-1 font-mono text-2xl font-black text-orange-700">{code}</div>
              <div className="mt-1 text-[11px] italic text-orange-600/80">Lưu lại mã này để tra cứu đơn hàng.</div>
            </div>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-orange-600"
            >
              📋 Sao chép mã
            </button>
          </div>

          {tour ? (
            <div className="grid gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/50 md:grid-cols-[200px_minmax(0,1fr)]">
              <div className="aspect-[4/3] w-full bg-slate-100 md:aspect-auto">
                {tour.coverImageUrl ? <img alt={tour.title} src={tour.coverImageUrl} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="space-y-2 p-5">
                <Link to={`/tours/${tour.slug}`} className="line-clamp-2 text-base font-extrabold text-slate-900 hover:text-orange-600">{tour.title}</Link>
                {tour.code ? <div className="text-xs text-slate-500">Mã tour: <span className="font-mono font-bold text-slate-700">{tour.code}</span></div> : null}
                <div className="grid grid-cols-2 gap-y-1 gap-x-4 pt-1 text-xs">
                  <div className="text-slate-500">Ngày đi:</div>
                  <div className="font-bold text-slate-800">{departure ? formatDate(departure.departureDate) : '-'}</div>
                  <div className="text-slate-500">Thời gian:</div>
                  <div className="font-bold text-slate-800">{tour.durationDays}N{tour.durationNights}Đ</div>
                  <div className="text-slate-500">Tiêu chuẩn:</div>
                  <div className="font-bold text-slate-800">{departure?.standardText || '-'}</div>
                  <div className="text-slate-500">Khởi hành:</div>
                  <div className="font-bold text-slate-800">{tour.departureFrom || '-'}</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-6 text-slate-600">
            <div className="mb-2 font-extrabold text-slate-900 uppercase tracking-wide text-sm">⏰ Thông tin quan trọng</div>
            <ul className="list-disc space-y-1 pl-5">
              <li>Đơn đặt của bạn đang ở trạng thái <span className="font-bold text-orange-700">CHỜ XÁC NHẬN</span>.</li>
              <li>Chuyên viên tư vấn sẽ gọi điện vào số điện thoại bạn đã đăng ký trong vòng <b>30 phút</b> (giờ làm việc 8h00 - 21h00).</li>
              <li>Sau khi được xác nhận, vui lòng hoàn tất thanh toán <b>trong 24h</b> để giữ chỗ (trừ trường hợp giữ chỗ có thời hạn khác).</li>
              <li>Nếu chọn thanh toán <b>Chuyển khoản</b>, vui lòng ghi rõ <b>Mã đặt chỗ {code}</b> vào nội dung CK.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link
              to={tour ? `/tours/${tour.slug}` : '/tours'}
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border border-slate-200 bg-white px-6 text-sm font-extrabold uppercase text-slate-700 hover:bg-slate-50"
            >
              ← Quay lại tour
            </Link>
            {auth.isLoggedIn ? (
              <Link
                to="/account/bookings"
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-emerald-700 px-6 text-sm font-extrabold uppercase text-white shadow-sm shadow-emerald-700/20 hover:bg-emerald-800"
              >
                🧾 Xem đơn của tôi
              </Link>
            ) : (
              <Link
                to="/auth/login"
                className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl bg-slate-900 px-6 text-sm font-extrabold uppercase text-white shadow-sm hover:bg-slate-800"
              >
                🔑 Đăng nhập để xem đơn
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BookingPageSuccess
