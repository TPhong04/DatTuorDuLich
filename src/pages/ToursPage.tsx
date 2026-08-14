import { Link, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'

import PageHeader from '@/components/ui/PageHeader'
import { useToast } from '@/components/notifications/ToastProvider'
import { PublicTourCard, getPublicTours } from '@/features/tours/tours'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

function formatMoney(n: number | null | undefined) {
  if (typeof n !== 'number') return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

export default function ToursPage() {
  const toast = useToast()
  const [sp] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<PublicTourCard[]>([])

  const q = sp.get('q') || undefined
  const region = sp.get('region') || undefined
  const tag = sp.get('tag') || undefined
  const transport = sp.get('transport') || undefined
  const view = sp.get('view') || undefined

  useEffect(() => {
    let alive = true
    setLoading(true)
    getPublicTours({ q, region, tag, transport, view })
      .then((r) => {
        if (!alive) return
        setItems(Array.isArray(r.items) ? r.items : [])
      })
      .catch((e) => toast.error((e as any)?.message || 'Không tải được danh sách tour'))
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [q, region, tag, transport, view])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tìm tour du lịch"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((t) => {
          const discount = t.discountFrom ?? null
          const original = t.originalPriceFrom ?? null
          const rating = t.avgRating ?? null
          return (
            <Link
              className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              key={t.id}
              to={`/tours/${t.slug}`}
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
                  <div className="h-full w-full" />
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
                <div className="text-sm font-semibold text-slate-900 line-clamp-2">{t.title}</div>
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
                  <div>{t.hotelText ? `Lưu trú: ${t.hotelText}` : 'Lưu trú: -'}</div>
                </div>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <div className="text-sm font-extrabold text-orange-600">{formatMoney(t.priceFrom)}</div>
                      {original && original > (t.priceFrom ?? 0) && discount &&
                      Math.abs(Math.round(((original - (t.priceFrom ?? 0)) / original) * 100) - discount) <= 2 ? (
                        <span className="text-xs line-through text-slate-400">
                          {original.toLocaleString('vi-VN')}đ
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-slate-500">/ 1 người lớn</div>
                  </div>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                      (t.seatsAvailable ?? 0) > 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700',
                    )}
                  >
                    {typeof t.seatsAvailable === 'number' ? `Còn ${t.seatsAvailable} chỗ` : 'Còn chỗ'}
                  </span>
                </div>
              </div>
            </Link>
          )
        })}

        {!items.length && !loading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-3">
            Chưa có tour nào đang hiển thị.
          </div>
        ) : null}
      </div>
    </div>
  )
}
