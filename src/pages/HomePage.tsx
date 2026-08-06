import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'

import { PublicBanner, getPublicBanners } from '@/features/banners/banners'
import { PublicTourCard, getPublicTours } from '@/features/tours/tours'
import { formatDate } from '@/utils/date'

export default function HomePage() {
  const navigate = useNavigate()
  const [banners, setBanners] = useState<PublicBanner[]>([])
  const [bannerIndex, setBannerIndex] = useState(0)
  const [tours, setTours] = useState<PublicTourCard[]>([])

  useEffect(() => {
    let alive = true
    getPublicBanners()
      .then((res) => {
        if (!alive) return
        setBanners(Array.isArray(res.items) ? res.items : [])
      })
      .catch(() => null)
    getPublicTours()
      .then((res) => {
        if (!alive) return
        setTours(Array.isArray(res.items) ? res.items : [])
      })
      .catch(() => null)
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
          {currentBanner?.imageUrl ? (
            <img alt={currentBanner.title ?? 'Banner'} className="h-full w-full object-cover" src={currentBanner.imageUrl} />
          ) : (
            <div className="h-full w-full bg-slate-100" />
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
          <div className="text-sm font-extrabold">TOUR HOT GIỜ CHÓT</div>
          <button
            className="text-xs font-semibold text-white/95 hover:text-white"
            onClick={() => navigate('/tours')}
            type="button"
          >
            Xem thêm »
          </button>
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          {tours.slice(0, 6).map((t) => {
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
                <div className="aspect-[16/10] bg-slate-100">
                  {t.coverImageUrl ? (
                    <img alt={t.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" src={t.coverImageUrl} />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                  {discount ? (
                    <span className="absolute left-3 top-3 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-md shadow-orange-500/30">
                      -{discount}%
                    </span>
                  ) : null}
                  {t.themes?.[0] ? (
                    <span className="absolute right-3 top-3 inline-flex rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-sm ring-1 ring-black/5">
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
                    <div>Khởi hành: {formatDate(t.nextDepartureDate)}</div>
                    <div>{t.transportText ? `Phương tiện: ${t.transportText}` : 'Phương tiện: -'}</div>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-sm font-extrabold text-orange-600">
                          {typeof t.priceFrom === 'number' ? `${t.priceFrom.toLocaleString('vi-VN')}đ` : '-'}
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

          {!tours.length ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-3">
              Chưa có tour nào đang hiển thị.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
