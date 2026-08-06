import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { PublicTourCard, PublicTourDetail, getPublicTour, postPublicTourReview } from '@/features/tours/tours'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

function formatMoney(n: number | null | undefined) {
  if (typeof n !== 'number') return '-'
  return `${n.toLocaleString('vi-VN')}đ`
}

function formatPlain(n: number | null | undefined) {
  if (typeof n !== 'number') return '-'
  return n.toLocaleString('vi-VN')
}

function parseYoutubeEmbed(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube.com/embed/${v}`
      if (u.pathname.startsWith('/embed/')) return url
    }
    if (u.hostname === 'youtu.be') {
      const v = u.pathname.replace(/^\//, '').split('/')[0]
      if (v) return `https://www.youtube.com/embed/${v}`
    }
  } catch {
    return null
  }
  return null
}

function statusBadge(s: string) {
  switch (s) {
    case 'open':
      return { label: 'Mở bán', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
    case 'closed':
      return { label: 'Đóng bán', cls: 'bg-slate-100 text-slate-600 ring-slate-200' }
    case 'cancelled':
      return { label: 'Huỷ', cls: 'bg-orange-50 text-orange-700 ring-orange-200' }
    case 'soldout':
      return { label: 'Hết chỗ', cls: 'bg-orange-50 text-orange-700 ring-orange-200' }
    default:
      return { label: s, cls: 'bg-slate-100 text-slate-600 ring-slate-200' }
  }
}

type Tab = 'program' | 'price' | 'schedule' | 'note'

function TabLink({ active, onClick, label, href }: { active: boolean; onClick: () => void; label: string; href: string }) {
  return (
    <a
      className={cn(
        'relative inline-flex items-center px-5 py-3.5 text-[15px] font-bold transition-colors',
        active ? 'text-orange-600' : 'text-slate-700 hover:text-slate-900',
      )}
      href={href}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
    >
      {label}
      {active ? (
        <span className="absolute bottom-0 left-3 right-3 h-[3px] rounded-full bg-orange-600" />
      ) : null}
    </a>
  )
}

export default function TourDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [tour, setTour] = useState<PublicTourDetail | null>(null)
  const [related, setRelated] = useState<PublicTourCard[]>([])
  const [openFaq, setOpenFaq] = useState<number>(0)
  const [tab, setTab] = useState<Tab>('program')
  const [rvRating, setRvRating] = useState<number>(5)
  const [rvHoverRating, setRvHoverRating] = useState<number>(0)
  const [rvContent, setRvContent] = useState<string>('')
  const [rvName, setRvName] = useState<string>('')
  const [rvEmail, setRvEmail] = useState<string>('')
  const [rvPhone, setRvPhone] = useState<string>('')
  const [rvSubmitting, setRvSubmitting] = useState<boolean>(false)

  useEffect(() => {
    let alive = true
    const s = slug ?? ''
    if (!s) return
    setLoading(true)
    getPublicTour(s)
      .then((payload) => {
        if (!alive) return
        setTour(payload.tour)
        setRelated(payload.related || [])
      })
      .catch((e) => {
        toast.error((e as any)?.message || 'Không tải được tour')
        setTour(null)
        setRelated([])
      })
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [slug, toast])

  useEffect(() => {
    if (!tour) return
    const title = tour.seo?.metaTitle || tour.title
    document.title = title
    if (tour.seo?.metaDescription) {
      let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', 'description')
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', tour.seo.metaDescription)
    }
    if (tour.seo?.canonicalUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.setAttribute('rel', 'canonical')
        document.head.appendChild(link)
      }
      link.setAttribute('href', tour.seo.canonicalUrl)
    }
  }, [tour])

  const gallery = useMemo(() => {
    if (!tour) return []
    const xs: string[] = []
    if (tour.coverImageUrl) xs.push(tour.coverImageUrl)
    for (const u of tour.galleryImageUrls || []) xs.push(u)
    return Array.from(new Set(xs))
  }, [tour])

  const videoEmbed = useMemo(() => parseYoutubeEmbed(tour?.videoUrl), [tour?.videoUrl])

  const quickMeta = useMemo(() => {
    if (!tour) return []
    const items: { label: string; value: string }[] = []
    items.push({ label: 'Thời gian', value: `${tour.durationDays} ngày ${tour.durationNights} đêm` })
    const depFormatted = formatDate(tour.nextDepartureDate)
    if (depFormatted !== '-') items.push({ label: 'Khởi hành', value: depFormatted })
    if (tour.transportText) items.push({ label: 'Phương tiện', value: tour.transportText })
    if (tour.hotelText) items.push({ label: 'Lưu trú', value: tour.hotelText })
    if (tour.departureFrom) items.push({ label: 'Điểm khởi hành', value: tour.departureFrom })
    if (tour.code) items.push({ label: 'Mã tour', value: tour.code })
    if (tour.region) items.push({ label: 'Vùng', value: tour.region })
    return items
  }, [tour])

  const priceRows = tour?.priceTable || []
  const surchargeRows = tour?.surcharges || []
  const departures = tour?.departures || []

  const originalFrom = tour?.originalPriceFrom ?? null
  const discountFrom = tour?.discountFrom ?? null

  const selectedBookingDep = useMemo(() => {
    const list = departures || []
    return list.find((d) => d.status === 'open') ?? list[0] ?? null
  }, [departures])

  const bookingBasePath = tour ? `/dat-tour/${tour.slug}` : null

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Trang chi tiết tour: lịch trình, lịch khởi hành, số chỗ còn, chính sách hủy."
        title={tour?.title || `Chi tiết tour: ${slug ?? ''}`}
        right={
          bookingBasePath && selectedBookingDep?.id ? (
            <Link
              className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-4 text-sm font-bold text-white shadow-sm shadow-orange-500/15 transition hover:bg-orange-600"
              to={`${bookingBasePath}?d=${selectedBookingDep.id}`}
            >
              Đặt / Giữ chỗ
            </Link>
          ) : null
        }
      />

      {tour?.themes?.length || tour?.categories?.length ? (
        <div className="flex flex-wrap gap-2">
          {tour.themes.map((t) => (
            <span key={t} className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200">
              {t}
            </span>
          ))}
          {tour.categories.map((c) => (
            <span key={c} className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 ring-1 ring-inset ring-blue-200">
              {c}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="aspect-[16/9] bg-slate-100">
              {gallery[0] ? <img alt={tour?.title || 'Tour'} className="h-full w-full object-cover" src={gallery[0]} /> : <div className="h-full w-full" />}
            </div>
            {gallery.length > 1 ? (
              <div className="grid gap-2 p-4 md:grid-cols-3">
                {gallery.slice(1, 4).map((u) => (
                  <div key={u} className="aspect-[16/10] overflow-hidden rounded-2xl bg-slate-100">
                    <img alt="Gallery" className="h-full w-full object-cover" src={u} />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {videoEmbed ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" id="video">
              <div className="flex items-center justify-between px-6 py-4">
                <div className="text-sm font-extrabold text-orange-700 uppercase tracking-wide">Video giới thiệu</div>
              </div>
              <div className="aspect-video w-full">
                <iframe
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                  src={videoEmbed}
                  title={tour?.title || 'Video'}
                />
              </div>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-wrap border-b border-slate-200">
              <TabLink active={tab === 'program'} href="#program" label="CHƯƠNG TRÌNH" onClick={() => setTab('program')} />
              <TabLink active={tab === 'price'} href="#price" label="BẢNG GIÁ" onClick={() => setTab('price')} />
              <TabLink active={tab === 'schedule'} href="#schedule" label="LỊCH KHỞI HÀNH" onClick={() => setTab('schedule')} />
              <TabLink active={tab === 'note'} href="#note" label="GHI CHÚ" onClick={() => setTab('note')} />
            </div>

            {tab === 'program' ? (
              <div className="p-6 md:p-8" id="program">
                <h3 className="mb-6 text-[17px] font-extrabold uppercase text-orange-600">Chương trình</h3>
                <div className="relative">
                  {(tour?.itinerary || []).map((d, idx) => {
                    const last = idx === (tour?.itinerary?.length ?? 0) - 1
                    return (
                      <div className="relative grid gap-4 pb-8 md:grid-cols-[72px_1fr]" key={idx}>
                        <div className="relative flex flex-col items-center md:items-start md:pl-4">
                          <div className="relative mt-2 flex items-center justify-center">
                            <span className="absolute h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-orange-100" />
                          </div>
                          <div className="mt-2 flex items-center gap-2 md:block">
                            <div className="text-sm font-extrabold text-orange-600 whitespace-nowrap">{d.label}</div>
                          </div>
                          {!last ? (
                            <div className="relative hidden h-full w-px md:block md:ml-[11px] md:mt-2">
                              <span className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-orange-200 via-slate-200 to-slate-100" />
                            </div>
                          ) : null}
                        </div>

                        <div className="relative rounded-3xl border border-slate-200 bg-white p-5 md:p-6 shadow-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-[17px] font-extrabold leading-snug text-slate-900 whitespace-pre-line">
                                {d.title}
                              </div>
                            </div>
                            {d.meals?.length ? (
                              <div className="flex flex-wrap gap-2">
                                {d.meals.map((m) => (
                                  <span key={m} className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                    {m}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {d.attractions?.length ? (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {d.attractions.map((a) => (
                                <span key={a} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-800 ring-1 ring-inset ring-blue-200">
                                  📍 {a}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          <div className="mt-4 text-[14.5px] leading-7 text-slate-700 whitespace-pre-line">
                            {d.content}
                          </div>

                          {d.accommodationText ? (
                            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-800 ring-1 ring-inset ring-indigo-200">
                              <span className="text-base">🛏️</span>
                              <span>Lưu trú đêm này: <span className="whitespace-pre-line">{d.accommodationText}</span></span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                  {!tour?.itinerary?.length ? <div className="text-sm text-slate-600">Chưa có chương trình.</div> : null}
                </div>
              </div>
            ) : null}

            {tab === 'price' ? (
              <div className="p-6 md:p-8" id="price">
                <h3 className="mb-6 text-[17px] font-extrabold uppercase text-orange-600">Bảng giá</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-[13px] font-bold uppercase text-slate-800">
                        <th className="border border-slate-400 px-4 py-3 w-40">Dịch vụ</th>
                        <th className="border border-slate-400 px-4 py-3">Loại dịch vụ</th>
                        <th className="border border-slate-400 px-4 py-3 text-right w-40">Giá từ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {priceRows.slice(0, 3).map((r, idx) => (
                        <tr className="bg-slate-50/60" key={r.label + idx}>
                          {idx === 0 ? (
                            <td className="border border-slate-300 px-4 py-4 font-bold text-slate-900 align-middle" rowSpan={Math.min(priceRows.length, 3)}>
                              Giá Tour
                            </td>
                          ) : null}
                          <td className="border border-slate-300 px-4 py-3 text-slate-800 whitespace-pre-line">{r.label}</td>
                          <td className="border border-slate-300 px-4 py-3 text-right font-bold text-orange-600">{formatMoney(r.amount)}</td>
                        </tr>
                      ))}
                      {surchargeRows.length ? (
                        <>
                          <tr>
                            <td className="border border-slate-300 bg-[#D9D9D9] px-4 py-3 text-[13px] font-bold uppercase text-slate-800 text-center" colSpan={3}>
                              Phụ thu
                            </td>
                          </tr>
                          {surchargeRows.map((r, idx) => (
                            <tr className="bg-white" key={r.label + idx}>
                              <td className="border border-slate-300 px-4 py-3 font-bold text-slate-900 align-middle" rowSpan={1}>
                                {r.label.split(':')[0].trim()}
                              </td>
                              <td className="border border-slate-300 px-4 py-3 text-slate-800 whitespace-pre-line">
                                {r.label.includes(':') ? r.label.split(':').slice(1).join(':').trim() : '-'}
                              </td>
                              <td className="border border-slate-300 px-4 py-3 text-right font-bold text-orange-600">{formatMoney(r.amount)}</td>
                            </tr>
                          ))}
                        </>
                      ) : null}
                      {!priceRows.length && !surchargeRows.length ? (
                        <tr>
                          <td className="border border-slate-300 px-4 py-8 text-sm text-slate-600 text-center" colSpan={3}>
                            Chưa có bảng giá.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tab === 'schedule' ? (
              <div className="p-6 md:p-8" id="schedule">
                <h3 className="mb-6 text-[17px] font-extrabold uppercase text-orange-600">Lịch khởi hành</h3>
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <table className="w-full border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="bg-[#D9D9D9] text-[13px] font-bold uppercase text-slate-800">
                        <th className="border border-slate-400 px-3 py-3 w-14 text-center">STT</th>
                        <th className="border border-slate-400 px-4 py-3">Ngày khởi hành</th>
                        <th className="border border-slate-400 px-4 py-3">Tiêu chuẩn</th>
                        <th className="border border-slate-400 px-4 py-3 text-right">Giá</th>
                        <th className="border border-slate-400 px-4 py-3 text-center w-28">Còn</th>
                        <th className="border border-slate-400 px-4 py-3 text-center w-36">Đặt tour</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departures.map((d, idx) => {
                        const st = statusBadge(d.status)
                        const depDisc = d.discountPercent ?? null
                        const depOrig = d.originalPriceAdult ?? null
                        const isSoldout = d.status === 'soldout' || d.status === 'cancelled' || d.status === 'closed' || d.seatsAvailable <= 0
                        return (
                          <tr className={cn(idx % 2 ? 'bg-slate-50/60' : 'bg-white')} key={idx}>
                            <td className="border border-slate-300 px-3 py-4 text-center font-semibold text-slate-900">{idx + 1}</td>
                            <td className="border border-slate-300 px-4 py-4">
                              <div className="flex flex-col gap-1">
                                <div className="font-bold text-slate-900">
                                  {formatDate(d.departureDate)}
                                </div>
                                {depOrig && depOrig > (d.priceAdult ?? 0) ? (
                                  <span className="inline-flex self-start rounded-md bg-orange-50 px-2 py-1 text-[11px] font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200">
                                    GIẢM SỐC {(depDisc ?? Math.round(((depOrig - d.priceAdult) / depOrig) * 100)).toLocaleString('vi-VN')}K
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="border border-slate-300 px-4 py-4 whitespace-pre-line">
                              {d.standardText ?? '-'}
                            </td>
                            <td className="border border-slate-300 px-4 py-4 text-right">
                              <div className="flex flex-col items-end gap-1">
                                <div className="text-[15px] font-extrabold text-orange-600">{formatMoney(d.priceAdult)}</div>
                                {depOrig && depOrig > d.priceAdult ? (
                                  <div className="text-xs line-through text-slate-400">{depOrig.toLocaleString('vi-VN')}đ</div>
                                ) : null}
                                {(d.priceChild ?? 0) > 0 || (d.priceInfant ?? 0) > 0 ? (
                                  <div className="mt-0.5 text-[11px] text-slate-500">
                                    {(d.priceChild ?? 0) > 0 ? `TE ${formatMoney(d.priceChild)}` : ''}
                                    {(d.priceChild ?? 0) > 0 && (d.priceInfant ?? 0) > 0 ? ' • ' : ''}
                                    {(d.priceInfant ?? 0) > 0 ? `EB ${formatMoney(d.priceInfant)}` : ''}
                                  </div>
                                ) : null}
                              </div>
                            </td>
                            <td className="border border-slate-300 px-4 py-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset', st.cls)}>
                                  {st.label}
                                </span>
                                <div className="text-xs text-slate-600">{d.seatsAvailable} / {d.seatsTotal} chỗ</div>
                              </div>
                            </td>
                            <td className="border border-slate-300 px-4 py-4 text-center">
                              {!isSoldout ? (
                                bookingBasePath && d.id ? (
                                  <Link
                                    className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-md bg-orange-500 px-3 text-xs font-bold uppercase text-white shadow-sm transition hover:bg-orange-600"
                                    to={`${bookingBasePath}?d=${d.id}`}
                                  >
                                    Đặt ngay
                                  </Link>
                                ) : (
                                  <button
                                    className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-md bg-orange-500 px-3 text-xs font-bold uppercase text-white shadow-sm transition hover:bg-orange-600"
                                    onClick={() => bookingBasePath && selectedBookingDep?.id && navigate(`${bookingBasePath}?d=${selectedBookingDep.id}`)}
                                    type="button"
                                  >
                                    Đặt ngay
                                  </button>
                                )
                              ) : (
                                <Link
                                  className="inline-flex h-9 min-w-[92px] items-center justify-center rounded-md bg-amber-400 px-3 text-xs font-bold uppercase text-slate-900 shadow-sm transition hover:bg-amber-500"
                                  to="/contact"
                                >
                                  Liên hệ
                                </Link>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {!departures.length ? (
                        <tr>
                          <td className="border border-slate-300 px-4 py-8 text-sm text-slate-600 text-center" colSpan={6}>
                            Chưa có lịch khởi hành.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tab === 'note' ? (
              <div className="p-6 md:p-8" id="note">
                <h3 className="mb-6 text-[17px] font-extrabold uppercase text-orange-600">Những quy định khách hàng cần lưu ý</h3>

                {departures.length ? (
                  <div className="mb-10 overflow-hidden rounded-2xl border border-slate-300 bg-white">
                    <div className="border-b border-slate-300 bg-white px-5 py-4 text-center">
                      <div className="text-[15px] font-extrabold uppercase text-slate-900">Giá tour trọn gói cho 1 khách (VND)</div>
                      <div className="mt-1 text-xs text-slate-600">(Giá áp dụng cho khách lẻ ghép đoàn)</div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-[13px]">
                        <thead>
                          <tr className="bg-[#E7E7E7] font-bold uppercase text-slate-800">
                            <th className="border border-slate-400 px-3 py-3">Lịch Khởi Hành</th>
                            <th className="border border-slate-400 px-3 py-3 text-right">Người Lớn<br /><span className="font-normal normal-case text-[11px] text-slate-600">Từ 10 tuổi trở lên</span></th>
                            <th className="border border-slate-400 px-3 py-3 text-right">Trẻ Em<br /><span className="font-normal normal-case text-[11px] text-slate-600">Từ 05 - &lt;10 tuổi</span></th>
                            <th className="border border-slate-400 px-3 py-3 text-right">Trẻ Em<br /><span className="font-normal normal-case text-[11px] text-slate-600">Từ 02 - &lt;05 tuổi</span></th>
                            <th className="border border-slate-400 px-3 py-3 text-right">Trẻ em<br /><span className="font-normal normal-case text-[11px] text-slate-600">dưới 2 tuổi</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {departures.map((d, idx) => {
                            const discPct =
                              typeof d.priceAdult === 'number' &&
                              d.priceAdult > 0 &&
                              typeof d.originalPriceAdult === 'number' &&
                              d.originalPriceAdult > d.priceAdult
                                ? Math.round(((d.originalPriceAdult - d.priceAdult) / d.originalPriceAdult) * 100)
                                : null
                            const discounted = d.originalPriceAdult && d.originalPriceAdult > d.priceAdult ? d.originalPriceAdult : null
                            return (
                              <tr className={cn(idx % 2 ? 'bg-slate-50/70' : 'bg-white')} key={idx}>
                                <td className="border border-slate-300 px-3 py-3">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="font-bold text-slate-900">{formatDate(d.departureDate)}</div>
                                    {discPct ? (
                                      <span className="inline-flex self-start rounded-md bg-orange-50 px-2 py-0.5 text-[11px] font-extrabold text-orange-700 ring-1 ring-inset ring-orange-200">
                                        GIẢM SỐC {discPct}%
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="border border-slate-300 px-3 py-3 text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    {discounted ? (
                                      <div className="text-[12.5px] line-through text-slate-400">{formatPlain(discounted)}</div>
                                    ) : null}
                                    <div className={cn('font-extrabold', discounted ? 'text-orange-600' : 'text-slate-900')}>
                                      {formatPlain(d.priceAdult)}
                                    </div>
                                  </div>
                                </td>
                                <td className="border border-slate-300 px-3 py-3 text-right">
                                  <div className="flex flex-col items-end gap-0.5">
                                    {d.originalPriceChild && d.priceChild && d.originalPriceChild > d.priceChild ? (
                                      <div className="text-[12.5px] line-through text-slate-400">{formatPlain(d.originalPriceChild)}</div>
                                    ) : null}
                                    <div className="font-extrabold text-slate-900">{formatPlain(d.priceChild ?? null)}</div>
                                  </div>
                                </td>
                                <td className="border border-slate-300 px-3 py-3 text-right">
                                  <div className="font-extrabold text-slate-900">{formatPlain(d.priceChild ? Math.round(d.priceChild * 0.8) : null)}</div>
                                </td>
                                <td className="border border-slate-300 px-3 py-3 text-right">
                                  <div className="font-extrabold text-slate-900">{formatPlain(d.priceInfant ?? null)}</div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-2 border-t border-slate-200 bg-slate-50 px-5 py-4 text-[13px] text-slate-800">
                      <div><b>KHÁCH NƯỚC NGOÀI:</b> Phụ thu 500.000 VND / khách</div>
                      <div><b>PHỤ THU PHÒNG ĐƠN</b> (trường hợp khách ở 1 người/phòng):</div>
                      <div className="pl-4 text-slate-700">- Ngày thường: 1.200.000 VND / người / tour</div>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="mb-2 text-[15px] font-extrabold text-slate-900">Dịch vụ bao gồm</div>
                    <div className="whitespace-pre-line text-[14px] leading-7 text-slate-700">{tour?.includedText ?? '-'}</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-5">
                    <div className="mb-2 text-[15px] font-extrabold text-slate-900">Dịch vụ chưa bao gồm</div>
                    <div className="whitespace-pre-line text-[14px] leading-7 text-slate-700">{tour?.excludedText ?? '-'}</div>
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 p-5">
                    <div className="mb-2 text-[15px] font-extrabold text-slate-900">Quy định trẻ em</div>
                    <div className="whitespace-pre-line text-[14px] leading-7 text-slate-700">{tour?.childPolicyText ?? '-'}</div>
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 p-5">
                    <div className="mb-2 text-[15px] font-extrabold text-slate-900">Điều kiện hủy tour</div>
                    <div className="whitespace-pre-line text-[14px] leading-7 text-slate-700">{tour?.cancelPolicyText ?? '-'}</div>
                  </div>
                  <div className="md:col-span-2 rounded-2xl border border-slate-200 p-5">
                    <div className="mb-2 text-[15px] font-extrabold text-slate-900">Ghi chú</div>
                    <div className="whitespace-pre-line text-[14px] leading-7 text-slate-700">{tour?.noteText ?? '-'}</div>
                  </div>
                </div>

                {(tour?.faq?.length ?? 0) > 0 ? (
                  <div className="mt-10 rounded-2xl border border-slate-200 p-5 md:p-6">
                    <div className="mb-4 text-[15px] font-extrabold text-slate-900">FAQ - Câu hỏi thường gặp</div>
                    <div className="space-y-2">
                      {tour?.faq.map((f, idx) => {
                        const isOpen = openFaq === idx
                        return (
                          <div key={idx} className={cn('rounded-2xl border transition', isOpen ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200')}>
                            <button
                              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                              onClick={() => setOpenFaq(isOpen ? -1 : idx)}
                              type="button"
                            >
                              <span className="text-sm font-bold text-slate-900 whitespace-pre-line">{f.question}</span>
                              <span className={cn('text-slate-500 transition-transform', isOpen && 'rotate-180')}>▾</span>
                            </button>
                            {isOpen ? (
                              <div className="px-4 pb-4 text-[14px] leading-7 text-slate-700 whitespace-pre-line">
                                {f.answer || <span className="text-slate-400 italic">Chưa có câu trả lời.</span>}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : null}

                {tour?.pickupPoints?.length ? (
                  <div className="mt-10 rounded-2xl border border-slate-200 p-5 md:p-6">
                    <div className="mb-4 text-[15px] font-extrabold text-slate-900">Điểm đón</div>
                    <div className="space-y-2">
                      {tour.pickupPoints.map((p, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-200 p-4 text-[14px] leading-7 text-slate-700">
                          <div className="font-bold text-slate-900 whitespace-pre-line">{p.address}</div>
                          {p.time ? <div className="mt-1">Thời gian: {p.time}</div> : null}
                          {p.note ? <div className="mt-1 whitespace-pre-line">{p.note}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {related.length ? (
            <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 rounded-t-3xl bg-emerald-600 px-5 py-3 text-white">
                <div className="text-sm font-extrabold uppercase tracking-wide">TOUR LIÊN QUAN</div>
                <button
                  className="text-xs font-bold text-white/95 hover:text-white"
                  onClick={() => navigate('/tours')}
                  type="button"
                >
                  Xem thêm »
                </button>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-3">
                {related.map((t) => {
                  const disc = t.discountFrom ?? null
                  const orig = t.originalPriceFrom ?? null
                  const r = t.avgRating ?? null
                  return (
                    <button
                      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      key={t.id}
                      onClick={() => {
                        navigate(`/tours/${t.slug}`)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      type="button"
                    >
                      <div className="aspect-[16/10] bg-slate-100">
                        {t.coverImageUrl ? (
                          <img alt={t.title} className="h-full w-full object-cover transition group-hover:scale-[1.02]" src={t.coverImageUrl} />
                        ) : (
                          <div className="h-full w-full" />
                        )}
                        {disc ? (
                          <span className="absolute left-3 top-3 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-extrabold text-white shadow-md shadow-orange-500/30">
                            -{disc}%
                          </span>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <div className="text-sm font-bold text-slate-900 line-clamp-2">{t.title}</div>
                        {r ? (
                          <div className="mt-2 flex items-center gap-1 text-xs">
                            <span className="text-amber-500">★</span>
                            <span className="font-bold text-slate-900">{r.toFixed(1)}</span>
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-slate-600">
                          {`${t.durationDays} ngày ${t.durationNights} đêm`}
                          {(() => {
                            const dep = formatDate(t.nextDepartureDate)
                            return dep !== '-' ? ` • Khởi hành ${dep}` : ''
                          })()}
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                          <div className="text-sm font-extrabold text-orange-600">{typeof t.priceFrom === 'number' ? `${t.priceFrom.toLocaleString('vi-VN')}đ` : '-'}</div>
                          {orig && orig > (t.priceFrom ?? 0) && disc &&
                          Math.abs(Math.round(((orig - (t.priceFrom ?? 0)) / orig) * 100) - disc) <= 2 ? (
                            <span className="text-xs line-through text-slate-400">{orig.toLocaleString('vi-VN')}đ</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-slate-50/60 p-5 md:p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-xl font-extrabold leading-tight text-slate-900">
                  {(tour?.reviewCount ?? 0)} Đánh giá {tour?.title || ''}
                </div>
                {(tour?.avgRating ?? null) ? (
                  <div className="mt-1 flex items-center gap-1.5 text-sm">
                    <span className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={i <= Math.round(tour!.avgRating!) ? '' : 'opacity-25'}>★</span>
                      ))}
                    </span>
                    <span className="font-bold text-slate-900">{tour!.avgRating!.toFixed(1)}</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mb-6 text-sm font-bold text-slate-800">
              Chọn đánh giá của bạn:
              <span
                className="ml-3 inline-flex cursor-pointer select-none items-center text-3xl text-slate-800"
                onMouseLeave={() => setRvHoverRating(0)}
              >
                {[1, 2, 3, 4, 5].map((i) => {
                  const active = (rvHoverRating || rvRating) >= i
                  return (
                    <span
                      key={i}
                      className={cn(
                        'mr-0.5 transition-colors',
                        active ? 'text-amber-500 drop-shadow-[0_0_2px_rgba(245,158,11,0.25)]' : 'text-slate-300',
                      )}
                      onClick={() => setRvRating(i)}
                      onMouseEnter={() => setRvHoverRating(i)}
                    >
                      ★
                    </span>
                  )
                })}
              </span>
            </div>

            <form
              className="grid gap-3 md:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!slug || !tour) return
                if (!rvName.trim()) {
                  toast.error('Vui lòng nhập Họ tên')
                  return
                }
                if (rvRating < 1 || rvRating > 5) {
                  toast.error('Vui lòng chọn số sao')
                  return
                }
                if (rvContent.length < 80) {
                  toast.error(`Nội dung đánh giá tối thiểu 80 ký tự (hiện ${rvContent.length}/80)`)
                  return
                }
                try {
                  setRvSubmitting(true)
                  const name = rvName.trim()
                  const email = rvEmail.trim()
                  const phone = rvPhone.trim()
                  const body = {
                    name,
                    rating: rvRating,
                    content: rvContent,
                    ...(email ? { email } : {}),
                    ...(phone ? { phone } : {}),
                  }
                  const res = await postPublicTourReview(slug, body)
                  toast.success(res.message || 'Gửi đánh giá thành công!')
                  setRvContent('')
                  setRvName('')
                  setRvEmail('')
                  setRvPhone('')
                  setRvRating(5)
                } catch (err: any) {
                  toast.error(err?.message || 'Gửi đánh giá không thành công')
                } finally {
                  setRvSubmitting(false)
                }
              }}
            >
              <div className="md:col-span-2">
                <textarea
                  className={cn(
                    'w-full resize-y rounded-2xl border bg-white px-4 py-3 text-sm outline-none transition focus:ring-4',
                    rvContent.length >= 80
                      ? 'border-emerald-200 ring-emerald-400/20 focus:ring-emerald-400/40'
                      : 'border-slate-200 ring-orange-400/20 focus:ring-orange-400/40',
                  )}
                  disabled={rvSubmitting}
                  minLength={80}
                  onChange={(e) => setRvContent(e.target.value)}
                  placeholder="Nhập đánh giá về tour (tối thiểu 80 ký tự)"
                  rows={6}
                  value={rvContent}
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-4 text-xs text-slate-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 font-semibold ring-1 ring-slate-200">
                      <span className="text-base">📷</span>
                      <span>Gửi ảnh</span>
                    </span>
                    <a className="font-semibold text-emerald-700 underline-offset-2 hover:underline" href="/quy-dinh-danh-gia" onClick={(e) => e.preventDefault()}>
                      Quy định đăng bình luận
                    </a>
                  </div>
                  <span className={cn(
                    'rounded-full px-2.5 py-1 text-[11px] font-bold',
                    rvContent.length >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800',
                  )}>
                    {rvContent.length}/80
                  </span>
                </div>
              </div>

              <div className="grid gap-3 content-start">
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/20 focus:ring-4 focus:ring-orange-400/40"
                  disabled={rvSubmitting}
                  onChange={(e) => setRvName(e.target.value)}
                  placeholder="Họ tên"
                  value={rvName}
                />
                <input
                  className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/20 focus:ring-4 focus:ring-orange-400/40"
                  disabled={rvSubmitting}
                  onChange={(e) => setRvEmail(e.target.value)}
                  placeholder="Email"
                  type="email"
                  value={rvEmail}
                />
                <div className="grid grid-cols-1 gap-3">
                  <input
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/20 focus:ring-4 focus:ring-orange-400/40"
                    disabled={rvSubmitting}
                    onChange={(e) => setRvPhone(e.target.value)}
                    placeholder="Số điện thoại"
                    type="tel"
                    value={rvPhone}
                  />
                  <button
                    className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-bold uppercase tracking-wide text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={rvSubmitting}
                    type="submit"
                  >
                    {rvSubmitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </div>
            </form>

            {(tour?.reviews?.length ?? 0) > 0 ? (
              <div className="mt-8 space-y-4 border-t border-slate-200 pt-6">
                <div className="text-sm font-extrabold uppercase text-slate-700">Những đánh giá đã duyệt</div>
                {tour!.reviews.map((r, idx) => (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm" key={idx}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">{r.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <span className="flex text-amber-500 text-sm">
                            {[1, 2, 3, 4, 5].map((i) => (
                              <span key={i} className={i <= (r.rating || 0) ? '' : 'opacity-20'}>★</span>
                            ))}
                          </span>
                          {r.createdAt ? (
                            <span className="text-[11px] text-slate-500">{formatDate(r.createdAt)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 text-[14px] leading-7 text-slate-700 whitespace-pre-line">{r.content}</div>
                    {r.imageUrls?.length ? (
                      <div className="mt-4 grid gap-2 md:grid-cols-4">
                        {r.imageUrls.slice(0, 4).map((u) => (
                          <div key={u} className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                            <img alt="Đánh giá" className="h-full w-full object-cover" src={u} />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-[15px] font-extrabold uppercase text-orange-700">Thông tin nhanh</div>
            <div className="mt-4 space-y-3">
              {quickMeta.map((m) => (
                <div className="flex items-start justify-between gap-4" key={m.label}>
                  <div className="text-sm text-slate-600">{m.label}</div>
                  <div className="text-right text-sm font-bold text-slate-900 whitespace-pre-line max-w-[55%]">{m.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">Giá từ</div>
                {discountFrom ? (
                  <span className="inline-flex rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white">
                    -{discountFrom}%
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-2">
                <div className="text-2xl font-extrabold text-orange-600">{formatMoney(tour?.priceFrom)}</div>
                {originalFrom && originalFrom > (tour?.priceFrom ?? 0) && discountFrom &&
                Math.abs(Math.round(((originalFrom - (tour?.priceFrom ?? 0)) / originalFrom) * 100) - discountFrom) <= 2 ? (
                  <span className="text-sm line-through text-slate-400">
                    {originalFrom.toLocaleString('vi-VN')}đ
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-xs text-slate-500">/ 1 người lớn</div>
              <div className="mt-2 text-sm font-semibold text-slate-700">
                {typeof tour?.seatsAvailable === 'number' ? `Còn ${tour.seatsAvailable} chỗ` : ''}
              </div>
              {bookingBasePath && selectedBookingDep?.id ? (
                <Link className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-bold text-white shadow-sm shadow-orange-500/20 transition hover:bg-orange-600" to={`${bookingBasePath}?d=${selectedBookingDep.id}`}>
                  Đặt tour ngay
                </Link>
              ) : null}
            </div>

            {(tour?.avgRating ?? null) ? (
              <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-extrabold text-amber-600">{tour!.avgRating!.toFixed(1)}</div>
                  <div>
                    <div className="flex items-center text-amber-500">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span key={i} className={i <= Math.round(tour!.avgRating!) ? '' : 'opacity-25'}>★</span>
                      ))}
                    </div>
                    <div className="text-xs text-slate-600">
                      {tour!.reviewCount} đánh giá • {tour!.totalBookings} lượt đặt
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tour?.highlights?.length ? (
              <>
                <div className="mt-6 text-[15px] font-extrabold uppercase text-orange-700">Điểm nhấn</div>
                <ul className="mt-3 space-y-2 text-[14px] leading-7 text-slate-700">
                  {tour.highlights.map((h) => (
                    <li className="flex gap-2" key={h}>
                      <span className="mt-3 h-1.5 w-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                      <span className="whitespace-pre-line">{h}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>

          {loading ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">Đang tải...</div>
          ) : null}

          {!loading && !tour ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
              Không tìm thấy tour.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
