import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { PublicBanner, getPublicBanners } from '@/features/banners/banners'
import { PublicTourCard, getPublicTours } from '@/features/tours/tours'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

export default function HomePage() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<PublicBanner[]>([])
  const [bannerIndex, setBannerIndex] = useState(0)
  const [tours, setTours] = useState<PublicTourCard[]>([])
  const [toursError, setToursError] = useState<string | null>(null)
  const [bannersError, setBannersError] = useState<string | null>(null)
  const [toursLoading, setToursLoading] = useState(true)
  const [bannersLoading, setBannersLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setBannersLoading(true)
    getPublicBanners()
      .then((res) => {
        if (!alive) return
        setBanners(Array.isArray(res.items) ? res.items : [])
        setBannersError(null)
      })
      .catch((e: any) => {
        if (!alive) return
        console.error('[HomePage] Failed to load banners:', e)
        setBannersError((e as any)?.message || 'Kết nối server thất bại (banners)')
        setBanners([])
      })
      .finally(() => {
        if (alive) setBannersLoading(false)
      })

    setToursLoading(true)
    getPublicTours()
      .then((res) => {
        if (!alive) return
        setTours(Array.isArray(res.items) ? res.items : [])
        setToursError(null)
      })
      .catch((e: any) => {
        if (!alive) return
        console.error('[HomePage] Failed to load tours:', e)
        setToursError((e as any)?.message || 'Kết nối server thất bại (tours)')
        setTours([])
      })
      .finally(() => {
        if (alive) setToursLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (banners.length <= 1) return
    const id = window.setInterval(() => {
      setBannerIndex((i) => (i + 1) % banners.length)
    }, 6000)
    return () => window.clearInterval(id)
  }, [banners.length])

  useEffect(() => {
    if (!banners.length) return
    if (bannerIndex < 0 || bannerIndex >= banners.length) setBannerIndex(0)
  }, [bannerIndex, banners.length])

  const currentBanner = banners[bannerIndex] ?? null

  const onBannerClick = (b: PublicBanner) => {
    if (b.targetType === 'none') return
    const to = b.targetValue
    if (!to) return
    if (b.targetType === 'internal') {
      navigate(to)
      return
    }
    if (b.openInNewTab) {
      window.open(to, '_blank', 'noopener,noreferrer')
      return
    }
    window.location.href = to
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div
          className="aspect-[16/5] w-full"
          onClick={() => {
            if (currentBanner) onBannerClick(currentBanner)
          }}
          role={currentBanner?.targetType !== 'none' && currentBanner?.targetValue ? 'button' : undefined}
          tabIndex={currentBanner?.targetType !== 'none' && currentBanner?.targetValue ? 0 : -1}
        >
          {bannersLoading && !banners.length && !bannersError ? (
            <div className="h-full w-full animate-pulse bg-slate-200/70" />
          ) : bannersError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-amber-50 px-6 text-center ring-1 ring-inset ring-amber-200">
              <div className="text-sm font-bold text-amber-900">⚠️ Không tải được Banner (lỗi kết nối server)</div>
              <div className="text-xs font-semibold text-amber-800/80 break-all max-w-2xl">{bannersError}</div>
              <button
                onClick={() => window.location.reload()}
                className="mt-1 inline-flex h-9 items-center justify-center rounded-full bg-amber-500 px-4 text-xs font-semibold text-white hover:bg-amber-600 shadow-sm shadow-amber-500/20"
                type="button"
              >
                ↻ Tải lại trang
              </button>
            </div>
          ) : currentBanner?.imageUrl ? (
            <img alt={currentBanner.title ?? 'Banner'} className="h-full w-full object-cover" src={currentBanner.imageUrl} />
          ) : (
            <div className="flex h-full w-full items-center justify-center gap-3 bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 ring-1 ring-inset ring-slate-200">
              <div className="text-center">
                <div className="text-2xl font-extrabold text-slate-900 tracking-tight">✨ Chào mừng đến với hệ thống Tour Du lịch</div>
                <div className="mt-2 text-sm text-slate-600">Vào phần <b className="text-orange-600">Admin → Banners</b> để tải banner khuyến mãi lên trang chủ.</div>
              </div>
            </div>
          )}
        </div>

        {banners.length > 1 ? (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
            {banners.map((b, i) => (
              <button
                aria-label={`Banner ${i + 1}`}
                className={i === bannerIndex ? 'h-2.5 w-8 rounded-full bg-slate-900' : 'h-2.5 w-2.5 rounded-full bg-slate-400 hover:bg-slate-600'}
                key={b.id}
                onClick={() => setBannerIndex(i)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 rounded-t-3xl bg-emerald-600 px-5 py-3 text-white">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <span>🔥 TOUR HOT GIỜ CHÓT</span>
            {toursLoading ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white/90">
                <span className="h-1.5 w-1.5 animate-ping rounded-full bg-white" /> Đang tải...
              </span>
            ) : tours.length ? (
              <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold text-white/95">{tours.length} tour</span>
            ) : null}
          </div>
          <button
            className="text-xs font-semibold text-white/95 hover:text-white"
            onClick={() => navigate('/tours')}
            type="button"
          >
            Xem thêm »
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          {!toursLoading && !toursError && tours.slice(0, 6).map((t) => {
            const discount = t.discountFrom ?? null
            const original = t.originalPriceFrom ?? null
            const rating = t.avgRating ?? null
            return (
              <button
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                key={t.id}
                onClick={() => navigate(`/tours/${t.slug}`)}
                type="button"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 ring-1 ring-inset ring-slate-200/70">
                  {t.coverImageUrl ? (
                    <div className="relative h-full w-full">
                      <img
                        alt=""
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-0 h-full w-full',
                          'scale-110 blur-2xl opacity-40 saturate-150',
                          'object-cover',
                        )}
                        src={t.coverImageUrl}
                      />
                      <img
                        alt={t.title}
                        className={cn(
                          'relative z-10 h-full w-full transition duration-500 ease-out group-hover:scale-[1.04]',
                          'object-contain',
                        )}
                        src={t.coverImageUrl}
                      />
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-slate-50 text-[11px] font-semibold text-slate-400 ring-1 ring-inset ring-slate-200">
                      [Chưa upload ảnh cover]
                    </div>
                  )}
                  {discount ? (
                    <span className="absolute left-3 top-3 z-20 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-orange-500/30 ring-1 ring-inset ring-white/20">
                      -{discount}%
                    </span>
                  ) : null}
                  {t.themes?.[0] ? (
                    <span className="absolute right-3 top-3 z-20 inline-flex rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-black/5 backdrop-blur">
                      {t.themes[0]}
                    </span>
                  ) : null}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2">{t.title}</div>
                  </div>
                  {rating ? (
                    <div className="mt-2 flex items-center gap-1 text-xs">
                      <span className="text-amber-500">★</span>
                      <span className="font-semibold text-slate-900">{rating.toFixed(1)}</span>
                      {t.totalBookings ? (
                        <span className="text-slate-500">• {t.totalBookings} lượt đặt</span>
                      ) : t.reviewCount ? (
                        <span className="text-slate-500">• {t.reviewCount} đánh giá</span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    <div>{`${t.durationDays} ngày ${t.durationNights} đêm`}</div>
                    <div>Khởi hành: {formatDate(t.nextDepartureDate) || 'Chưa có lịch khởi hành'}</div>
                    <div>{t.transportText ? `Phương tiện: ${t.transportText}` : 'Phương tiện: -'}</div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-sm font-extrabold text-orange-600">
                          {typeof t.priceFrom === 'number' ? `${t.priceFrom.toLocaleString('vi-VN')}đ` : 'Liên hệ'}
                        </div>
                        {original && original > (t.priceFrom ?? 0) && discount &&
                        Math.abs(Math.round(((original - (t.priceFrom ?? 0)) / original) * 100) - discount) <= 2 ? (
                          <span className="text-xs line-through text-slate-400">
                            {original.toLocaleString('vi-VN')}đ
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-500">/ 1 người lớn</div>
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      {typeof t.seatsAvailable === 'number' ? `Còn ${t.seatsAvailable} chỗ` : ''}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}

          {toursLoading ? (
            <div className="grid gap-4 md:col-span-3 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <div className="aspect-[4/3] animate-pulse bg-slate-200/70" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200/70" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-slate-200/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : toursError ? (
            <div className="md:col-span-3 rounded-3xl border border-red-200 bg-red-50 p-6 shadow-sm ring-1 ring-inset ring-red-200">
              <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center gap-2 text-sm font-extrabold text-red-900">
                  🚨 Lỗi tải danh sách tour công khai
                </div>
                <div className="text-xs font-semibold text-red-800/90 break-all max-w-4xl">
                  Chi tiết lỗi: {toursError}
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-red-500 px-4 text-xs font-semibold text-white hover:bg-red-600 shadow-sm shadow-red-500/20"
                    type="button"
                  >
                    ↻ Tải lại
                  </button>
                  <button
                    onClick={() => navigate('/admin/tours')}
                    className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800"
                    type="button"
                  >
                    🛠 Vào Admin → Tours kiểm tra
                  </button>
                </div>
                <div className="mt-2 text-[11px] font-semibold text-red-700/80 leading-relaxed">
                  💡 Thường gặp: Server Backend chưa chạy ở cổng 4000, hoặc CORS / CSRF token bị lỗi → kiểm tra terminal BE npm run dev.
                </div>
              </div>
            </div>
          ) : !tours.length ? (
            <div className="md:col-span-3 overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/60 p-6 shadow-sm ring-1 ring-inset ring-amber-200">
              <div className="flex flex-col gap-3 text-left">
                <div className="flex items-center gap-2 text-sm font-extrabold text-amber-900">
                  👀 Không có tour nào hiển thị ở trang chủ? → 99% DO CÁC TOUR BẠN TẠO ĐANG Ở CHẾ ĐỘ NHÁP / CHƯA CÔNG KHAI.
                </div>
                <ul className="mt-1 space-y-1.5 text-[12px] font-semibold text-amber-900/90 leading-relaxed list-disc pl-5">
                  <li>
                    <b>Bước 1:</b> Vào <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-amber-200 font-mono">Admin → Tours</code>
                  </li>
                  <li>
                    <b>Bước 2:</b> Kiểm tra cột <b>"Trạng thái"</b> → nếu ghi <b>"📋 Nháp"</b> thì tour đang bị ẨN (không cho khách hàng xem). Cần tick <b>Xuất bản lên web = ON</b> (lúc tạo tour có checkbox này ở dưới cùng form).
                  </li>
                  <li>
                    <b>Bước 3 (nhanh):</b> Bấm nút <b>"📣 Publish TOÀN BỘ draft"</b> ở ngay trên bảng Admin Tours (sau khi cập nhật code này) → tất cả tour Nháp tự động chuyển sang ✅ Công khai ngay lập tức, sau đó F5 trang chủ xem.
                  </li>
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/admin/tours')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600 shadow-md shadow-orange-500/20"
                    type="button"
                  >
                    🚀 Đi đến Admin → Tours Publish
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    type="button"
                  >
                    ↻ F5 trang chủ sau khi publish
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
