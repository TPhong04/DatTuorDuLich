import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Eye, FileText, Share2, Tag } from 'lucide-react'

import PageHeader from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import {
  fetchPublicPostBySlug,
  POST_CATEGORY_META,
  PostCategory,
  PublicPost,
  PublicPostDetail,
} from '@/features/posts/posts'

function fmtDate(d: string | null) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`
  } catch { return '' }
}
function fmtDateTime(d: string | null) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    return `${fmtDate(d)} · ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

function _gradForCat(c: PostCategory) {
  switch (c) {
    case 'promotion':  return 'from-orange-500 via-rose-500 to-pink-500'
    case 'experience': return 'from-emerald-500 via-teal-500 to-cyan-500'
    case 'tour_launch':return 'from-blue-500 via-indigo-500 to-violet-500'
    case 'company':    return 'from-violet-500 via-purple-500 to-fuchsia-500'
    case 'culture':    return 'from-rose-500 via-red-500 to-orange-500'
    case 'guide':      return 'from-amber-500 via-orange-500 to-yellow-500'
  }
}

function buildDemoDetail(slugRequest: string): PublicPostDetail {
  const base: PublicPost = {
    id: '00001',
    title: '🔥 FLASH SALE cuối tuần: Giảm 25% toàn bộ tour Miền Nam 3 ngày 2 đêm',
    category: 'promotion',
    slug: slugRequest && slugRequest.length > 0 ? slugRequest : 'flash-sale-cuoi-tuan-giam-25-toan-bo-tour-mien-nam-3-ngay-2-dem-00001',
    tags: ['promotion', 'flash-sale'],
    relatedTourIds: [],
    excerpt: 'Áp dụng cho khách booking trước 31/08, thanh toán VNPAY/QR, combo 2 khách + 1 trẻ em miễn phí vé tham quan.',
    content: `<h2>🔥 Chương trình khuyến mãi cuối tuần tháng 8</h2><p>Áp dụng cho <strong>tất cả các tour Miền Nam 3 ngày 2 đêm</strong>, booking online trên hệ thống VietNamExplorer từ 15/8 - 31/8 năm 2025.</p><blockquote><h3>🎁 Ưu đãi đi kèm (thanh toán VNPAY)</h3><ul><li>Giảm 25% giá tour người lớn (tối đa 1.000.000đ/khách)</li><li>Trẻ em dưới 1.2m FREE vé tham quan toàn bộ chương trình</li><li>Tặng 1 bộ quà lưu niệm thêu tên mỗi khách hàng VIP</li></ul></blockquote><h3>📅 Lịch trình gợi ý</h3><p>Ngày 1: Sài Gòn → Cần Thơ (chợ nổi, Nhà thờ, chợ Ninh Kiều, nhà cổ). Ngày 2: Cần Thơ → Phú Quốc (bãi Sao, cáp treo Hòn Thơm). Ngày 3: Phú Quốc → Sài Gòn.</p><p>Đặt ngay bấm nút bên dưới 👇</p>`,
    coverImageUrl: null,
    publishedAt: new Date(2025, 7, 12).toISOString(),
    viewCount: 4820,
    isPinned: true,
    sourceUrl: null,
    sourceName: null,
    createdAt: new Date(2025, 7, 12).toISOString(),
  }
  const related: PublicPost[] = [
    { id: 'r1', title: '🎉 Mừng National Day: Tặng 2 đêm KS 4 sao khi book tour Thái Lan 5N4Đ', category: 'promotion', slug: 'national-day-tang-2-dem-ks-4-sao-thai-lan-r1', tags: ['promotion', 'thai-lan'], relatedTourIds: [], excerpt: 'Khuyến mãi giới hạn 200 voucher, xuất phát Tết Dương lịch 2026.', content: null, coverImageUrl: null, publishedAt: new Date(2025, 7, 1).toISOString(), viewCount: 2110, isPinned: false, sourceUrl: null, sourceName: null, createdAt: new Date(2025, 7, 1).toISOString() },
    { id: 'r2', title: '💳 VPBank hoàn đến 1.5 triệu khi thanh toán tour Quốc tế', category: 'promotion', slug: 'uu-dai-vpbank-hoan-1-5-trieu-quoc-te-r2', tags: ['promotion', 'the-tin-dung'], relatedTourIds: [], excerpt: 'Visa Platinum, kỳ 15/8 - 30/9.', content: null, coverImageUrl: null, publishedAt: new Date(2025, 6, 28).toISOString(), viewCount: 890, isPinned: false, sourceUrl: null, sourceName: null, createdAt: new Date(2025, 6, 28).toISOString() },
    { id: 'r3', title: '🗺️ Kinh nghiệm đi Sapa 3N2Đ tiết kiệm 1.500.000đ', category: 'experience', slug: 'kinh-nghiem-sapa-3n2d-tiet-kiem-r3', tags: ['sapa', 'kinh-nghiem'], relatedTourIds: [], excerpt: 'Khách sạn, xe limousine Hà Nội SaPa, 3 bữa ăn đặc sản.', content: null, coverImageUrl: null, publishedAt: new Date(2025, 6, 20).toISOString(), viewCount: 1280, isPinned: false, sourceUrl: null, sourceName: null, createdAt: new Date(2025, 6, 20).toISOString() },
    { id: 'r4', title: '✨ Mới: Tour săn mây Cao Bằng Bản Giốc 4N3Đ cuối tuần', category: 'tour_launch', slug: 'tour-san-may-cao-bang-ban-gioc-4n3d-r4', tags: ['cao-bang', 'tour-moi'], relatedTourIds: [], excerpt: 'Limit 16 khách đoàn, eco-lodge rừng nguyên sinh.', content: null, coverImageUrl: null, publishedAt: new Date(2025, 6, 10).toISOString(), viewCount: 650, isPinned: false, sourceUrl: null, sourceName: null, createdAt: new Date(2025, 6, 10).toISOString() },
  ]
  return { ...base, related }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-slate-200/60', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
    </div>
  )
}

export default function NewsDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const nav = useNavigate()
  const nonceRef = useRef(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicPostDetail | null>(null)

  useEffect(() => {
    const nonce = ++nonceRef.current
    if (!data) setInitialLoading(true)
    setStale(true)
    void (async () => {
      try {
        const res = await fetchPublicPostBySlug(slug ?? '')
        if (nonceRef.current !== nonce) return
        setData(res)
        setError(null)
      } catch (e) {
        if (nonceRef.current !== nonce) return
        setError(e && (e as any).message ? String((e as any).message) : 'Lỗi tải bài viết')
        setData(buildDemoDetail(slug ?? ''))
      } finally {
        if (nonceRef.current === nonce) {
          setStale(false)
          setInitialLoading(false)
        }
      }
    })()
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug])

  const used = useMemo<PublicPostDetail>(() => data ?? buildDemoDetail(slug ?? ''), [data, slug])
  const meta = POST_CATEGORY_META[used.category]

  return (
    <div className={cn('min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50/50 text-slate-900 transition-[opacity] duration-300', stale ? 'opacity-80' : 'opacity-100')}>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 2xl:px-8">
        <div className="mb-5 inline-flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            onClick={() => nav(-1)}
            type="button"
          >
            <ChevronLeft className="h-4 w-4 text-blue-600" />
            <span>Quay lại tin tức</span>
          </button>
          <Link
            className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
            to="/news"
          >
            <FileText className="h-4 w-4 text-orange-500" />
            <span>Tất cả bài viết</span>
          </Link>
        </div>

        {initialLoading ? (
          <div className="space-y-6" style={{ minHeight: 960 }}>
            <Shimmer className="h-10 w-5/6" />
            <div className="grid grid-cols-3 gap-3">
              <Shimmer className="h-8 w-32" />
              <Shimmer className="h-8 w-32" />
              <Shimmer className="h-8 w-32" />
            </div>
            <Shimmer className="h-80 w-full rounded-3xl" />
            <div className="space-y-3">
              <Shimmer className="h-5 w-full" />
              <Shimmer className="h-5 w-5/6" />
              <Shimmer className="h-5 w-4/5" />
              <Shimmer className="h-24 w-full" />
              <Shimmer className="h-5 w-5/6" />
            </div>
          </div>
        ) : (
          <>
            <article className="overflow-hidden rounded-3xl bg-white pb-10 ring-1 ring-blue-100 shadow-sm" style={{ minHeight: 960 }}>
              <div className={cn('relative h-72 w-full overflow-hidden bg-gradient-to-br', _gradForCat(used.category))}>
                {used.coverImageUrl ? (
                  <img alt={used.title} className="h-full w-full object-cover" src={used.coverImageUrl} />
                ) : (
                  <div className="relative flex h-full w-full items-end justify-between p-6 md:p-10">
                    <div>
                      <div className="drop-shadow-lg text-7xl md:text-9xl">{meta.icon}</div>
                      <div className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-white backdrop-blur">
                        BÀI VIẾT CHI TIẾT
                      </div>
                    </div>
                    <div className="hidden space-y-2 text-right md:block">
                      <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/30 backdrop-blur">
                        <span>{meta.icon}</span>
                        {meta.label}
                      </div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur">
                        <Eye className="h-3.5 w-3.5" />
                        {used.viewCount.toLocaleString('vi-VN')} lượt xem
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 pt-8 md:px-10">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ring-1', meta.chip)}>
                    <span>{meta.icon}</span>
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
                    📅 Xuất bản: {fmtDateTime(used.publishedAt)}
                  </span>
                  {used.sourceName && (
                    <a className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200" href={used.sourceUrl ?? undefined} target="_blank" rel="noreferrer noopener">
                      🔗 Nguồn: {used.sourceName}
                    </a>
                  )}
                </div>

                <h1 className="mt-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-800 via-slate-900 to-orange-700 text-2xl font-black leading-[1.2] tracking-tight md:text-4xl">
                  {used.title}
                </h1>

                {used.excerpt && (
                  <div className="mt-4 rounded-2xl bg-gradient-to-r from-blue-50 via-white to-orange-50 p-5 text-base italic leading-7 text-slate-700 ring-1 ring-blue-100">
                    💡 {used.excerpt}
                  </div>
                )}

                <div
                  className="prose prose-slate mt-6 max-w-none text-[15px] leading-[1.9] text-slate-700 prose-headings:text-slate-900 prose-h2:mt-8 prose-h2:border-b prose-h2:border-slate-200 prose-h2:pb-2 prose-h3:mt-6 prose-a:text-blue-700 prose-blockquote:rounded-r-lg prose-blockquote:border-l-orange-500 prose-blockquote:bg-orange-50 prose-blockquote:py-2 prose-blockquote:not-italic prose-img:rounded-2xl prose-strong:text-slate-900 prose-ul:my-3"
                  dangerouslySetInnerHTML={{ __html: used.content ?? '<p>Nội dung bài viết đang được cập nhật...</p>' }}
                />

                {used.tags.length > 0 && (
                  <div className="mt-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-100">
                    <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">
                      <Tag className="h-3.5 w-3.5 text-blue-600" /> Tags liên quan
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {used.tags.map((t) => (
                        <span key={t} className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 hover:ring-blue-300">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                  <div className="text-xs text-slate-500">
                    Tạo lúc: {fmtDateTime(used.createdAt)} · Cập nhật gần nhất: {fmtDateTime(used.publishedAt)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex h-9 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                      onClick={() => {
                        if (navigator.share) {
                          void navigator.share({
                            title: used.title,
                            text: used.excerpt ?? undefined,
                            url: window.location.href,
                          }).catch(() => null)
                        }
                      }}
                      type="button"
                    >
                      <Share2 className="h-4 w-4 text-orange-500" />
                      Chia sẻ
                    </button>
                    <Link
                      className="inline-flex h-9 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-blue-700 to-orange-500 px-4 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition hover:brightness-105 active:scale-[0.98]"
                      to="/tours"
                    >
                      🎯 Xem tour liên quan
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {used.related.length > 0 && (
              <section className="mt-10">
                <PageHeader title="📚 Bạn có thể thích" />
                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {used.related.map((r) => {
                    const rm = POST_CATEGORY_META[r.category]
                    return (
                      <Link
                        key={r.id}
                        className="group rounded-3xl bg-white p-3 ring-1 ring-slate-100 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                        style={{ minHeight: 280 }}
                        to={`/news/${r.slug}`}
                      >
                        <div className={cn('h-36 w-full overflow-hidden rounded-2xl bg-gradient-to-br', _gradForCat(r.category))}>
                          <div className="flex h-full w-full items-end justify-between p-3">
                            <div className="drop-shadow-sm text-4xl">{rm.icon}</div>
                            <div className="rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur">
                              {rm.label}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 space-y-1.5 px-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', rm.chip)}>
                              {rm.icon} {rm.label}
                            </span>
                            <span className="text-[10px] text-slate-400">{fmtDate(r.publishedAt)}</span>
                          </div>
                          <div className="line-clamp-3 text-sm font-bold leading-snug text-slate-900 group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-700 group-hover:to-orange-600">
                            {r.title}
                          </div>
                          <div className="flex items-center gap-1 pt-1 text-[11px] font-semibold text-slate-400">
                            <Eye className="h-3 w-3 text-blue-500" /> {r.viewCount.toLocaleString('vi-VN')}
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
