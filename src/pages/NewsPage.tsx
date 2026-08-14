import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Eye, Search } from 'lucide-react'

import PageHeader from '@/components/ui/PageHeader'
import { cn } from '@/lib/utils'
import {
  fetchPublicPosts,
  POST_CATEGORY_META,
  PostCategory,
  PublicPost,
  PublicPostListResponse,
} from '@/features/posts/posts'

const CATEGORY_TABS: (PostCategory | 'all')[] = ['all', 'promotion', 'experience', 'tour_launch', 'company', 'culture', 'guide']

function _gradForCat(c: PostCategory, i = 0) {
  switch (c) {
    case 'promotion':  return i === 0 ? 'from-orange-500 via-rose-500 to-pink-500' : 'from-orange-100 via-rose-50 to-pink-50'
    case 'experience': return i === 0 ? 'from-emerald-500 via-teal-500 to-cyan-500' : 'from-emerald-100 via-teal-50 to-cyan-50'
    case 'tour_launch':return i === 0 ? 'from-blue-500 via-indigo-500 to-violet-500' : 'from-blue-100 via-indigo-50 to-violet-50'
    case 'company':    return i === 0 ? 'from-violet-500 via-purple-500 to-fuchsia-500' : 'from-violet-100 via-purple-50 to-fuchsia-50'
    case 'culture':    return i === 0 ? 'from-rose-500 via-red-500 to-orange-500' : 'from-rose-100 via-red-50 to-orange-50'
    case 'guide':      return i === 0 ? 'from-amber-500 via-orange-500 to-yellow-500' : 'from-amber-100 via-orange-50 to-yellow-50'
  }
}

function fmtDate(d: string | null) {
  if (!d) return ''
  try {
    const dt = new Date(d)
    const dd = String(dt.getDate()).padStart(2, '0')
    const mm = String(dt.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${dt.getFullYear()}`
  } catch { return '' }
}

function buildDemoPublicPosts(page: number, pageSize: number, cat: PostCategory | 'all'): PublicPostListResponse {
  const TITLES: { cat: PostCategory; title: string; excerpt: string }[] = [
    { cat: 'promotion',  title: '🔥 FLASH SALE cuối tuần: Giảm 25% toàn bộ tour Miền Nam 3 ngày 2 đêm',     excerpt: 'Áp dụng cho khách booking trước 31/08, thanh toán VNPAY/QR, combo 2 khách + 1 trẻ em miễn phí vé tham quan.' },
    { cat: 'promotion',  title: '🎉 Mừng National Day: Tặng 2 đêm KS 4 sao khi book tour Thái Lan 5N4Đ',        excerpt: 'Khuyến mãi giới hạn 200 voucher, xuất phát Tết Dương lịch 2026, vé máy bay Vietnam Airlines round-trip.' },
    { cat: 'promotion',  title: '💳 Ưu đãi thẻ VPBank: Hoàn đến 1.500.000đ khi thanh toán tour Quốc tế',      excerpt: 'Đối tác thẻ tín dụng Visa Platinum, không giới hạn số lần thanh toán trong kỳ khuyến mãi 15/8 - 30/9.' },
    { cat: 'experience', title: '🗺️ Kinh nghiệm đi Sapa 3 ngày 2 đêm tiết kiệm: Làm sao đi 1 triệu 5?',        excerpt: 'Khách sạn dân cư 250k/đêm, xe limousine Hà Nội→SaPa 280k, 3 bữa ăn đặc sản Bắc 500k tổng cộng, vé Fansipan giảm 30% card ATM.' },
    { cat: 'experience', title: '🍜 Đà Lạt ẩm thực đêm: 10 quán ăn chỉ dân địa phương biết',                   excerpt: 'Bánh tráng trộn chợ Đà Lạt, Mì sủi cảo Hồ Xuân Hương, Mỳ vằn đêm chợ Tân Thịnh, Cà phê sữa đá Hồng Vương 3 tầng.' },
    { cat: 'experience', title: '🏝️ Phú Quốc 5 ngày tự túc: Điểm nào nên đi, đâu nên tránh?',                 excerpt: 'Đảo Phú Quốc bãi Sao không phải đẹp nhất, Bãi Dài phía Nam ít người hơn, nghỉ tại resort Bãi Kem giá mềm dịp giữa tuần.' },
    { cat: 'tour_launch',title: '✨ MỚI: Tour săn mây Cao Bằng - Bản Giốc 4 ngày 3 đêm khởi hành cuối tuần',   excerpt: 'Lịch trình mới, limit 16 khách/đoàn, hướng dẫn viên bản địa, nghỉ tại Eco Lodge giữa rừng, check-in thác Bản Giốc 7 giờ sáng chưa có khách.' },
    { cat: 'tour_launch',title: '🛳️ Ra mắt Tour du thuyền Hạ Long 5 sao Heritage Binh Chuan 2N1Đ',              excerpt: 'Thuyền 24 cabin sang trọng, phòng riêng có ban công biển, buffet hải sản tối, chèo thuyền kayak Hang Sửng Sốt miễn phí.' },
    { cat: 'tour_launch',title: '🏔️ Trekking Fansipan 3 ngày 2 đêm: Hành trình trên nóc nhà Đông Dương',       excerpt: 'Đội hình dẫn đường chuyên nghiệp, thiết bị crampon/ice axe cho tour mùa đông, tấm biệt danh "Chinh phục Fansipan 3143m".' },
    { cat: 'company',    title: '🏢 VietNamExplorer ký hợp tác chiến lược Bamboo Airways mở 20 route nội địa mới', excerpt: 'Từ tháng 9/2025, khách book tour VietNamExplorer được ưu tiên chọn ghế hàng ghế Comfort+ miễn phí trên chuyến bay Bamboo.' },
    { cat: 'company',    title: '🏆 Công ty nhận giải thưởng "Đơn vị lữ hành Uy tín TP. Hồ Chí Minh" năm 2025', excerpt: 'Giải thưởng do Sở Du lịch trao tặng, dựa trên tỷ lệ hài lòng KH 4.8/5 sao + 0 đơn khiếu nại về dịch vụ trong năm 2024.' },
    { cat: 'company',    title: '👥 Giới thiệu Chi nhánh Đà Nẵng: Phục vụ khách miền Trung 24/7',                excerpt: 'Địa chỉ: 138 Bắc Sơn, Quận Hải Châu, hotline riêng miền Trung: 0236.655.6789, hỗ trợ xe đưa đón sân bay Đà Nẵng - Hội An - Huế.' },
    { cat: 'culture',    title: '🎎 Áo dài Cần Thơ: Tư cách trang phục truyền thống của người phụ nữ Nam Bộ',  excerpt: 'Bộ sưu tập áo dài Tết 2026 với họa tiết hoa sen, kiểu dáng tà xẻ chữ A, kết hợp khăn rằn cách điệu cách tân thêu tay thủ công.' },
    { cat: 'culture',    title: '⛩️ Nhà thờ Đà Lạt: Kiến trúc Gothic gỗ đặc trưng vùng Cao nguyên',             excerpt: 'Khảo cổ kiến trúc 1912 của Pháp, cửa vòm gỗ tự nhiên cao 10m, kính hoa văn nghệ thuật gắn thủ công, tháp chuông cao 47m.' },
    { cat: 'culture',    title: '🪔 Lễ hội Chùa Hương 2026: Thời gian, lưu ý ăn mặc và di chuyển',             excerpt: 'Lễ khai mạc 15/01 âm lịch, đường đua thuyền sông Đáy, cách trang phục lịch sự khi vào điện thờ, xe buýt liên tỉnh Hà Nội ↔ Hương Sơn 50k.' },
    { cat: 'guide',      title: '📖 Hướng dẫn thanh toán MoMo/VietQR lần đầu book tour online',                  excerpt: 'Quét mã QR → chọn ngân hàng → nhập mã xác thực OTP 6 số → booking trạng thái "Đã thanh toán" trong 30 giây, email hóa đơn tự gửi.' },
    { cat: 'guide',      title: '📅 Làm sao đổi tên hành khách trước 48h khởi hành?',                            excerpt: 'Vào menu [Tài khoản của tôi → Đơn hàng], nút "Sửa hành khách", giới hạn 2 lần/đơn, thu phí admin 50k/lần (miễn phí hạng thành viên Bạc+).' },
    { cat: 'guide',      title: '🧾 Yêu cầu xuất hóa đơn GTGT 0% cho tour doanh nghiệp: Cần chuẩn bị gì?',        excerpt: 'Tên công ty, MST, Địa chỉ ĐKKD, thông tin người nhận hóa đơn (email công ty), gửi yêu cầu trước 7 ngày từ ngày khởi hành tour.' },
  ]
  const rows: PublicPost[] = TITLES.map((t, idx) => {
    const id = String(idx + 1).padStart(5, '0')
    const cat = t.cat
    const slugify = (s: string) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ|Đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 120)
    const slug = slugify(t.title) + '-' + id
    const base = new Date(2025, 7, 1)
    base.setDate(base.getDate() - idx * 2)
    return {
      id,
      title: t.title,
      slug,
      category: cat,
      tags: [cat, slugify(t.title.split(' ').slice(0, 2).join(' '))],
      relatedTourIds: [],
      excerpt: t.excerpt,
      content: `<p>${t.excerpt}</p><h2>Nội dung chi tiết</h2><p>Đây là nội dung minh họa bài viết mẫu <strong>${t.title}</strong>, khi hoàn thiện CMS nội dung do nhân viên content viết. Hệ thống hỗ trợ rich-text, insert ảnh, embed video YouTube, bảng giá, block quote...</p><ul><li>Điểm nhấn 1</li><li>Điểm nhấn 2</li><li>Thông tin booking link bên cuối bài.</li></ul>`,
      coverImageUrl: null,
      publishedAt: base.toISOString(),
      viewCount: 100 + idx * 37 + (cat === 'promotion' ? 500 : 0),
      isPinned: idx % 8 === 0,
      sourceUrl: null,
      sourceName: null,
      createdAt: base.toISOString(),
    }
  })
  const filtered = cat === 'all' ? rows : rows.filter((x) => x.category === cat)
  const pinned = filtered.filter((x) => x.isPinned).slice(0, 3)
  const totalRows = filtered.length
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const curPage = Math.max(1, Math.min(page, totalPages))
  const start = (curPage - 1) * pageSize
  return { rows: filtered.slice(start, start + pageSize), pinned, page: curPage, pageSize, totalPages, totalRows }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-slate-200/60', className)}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
    </div>
  )
}

function PaginatorPages({ page, totalPages, onPick }: { page: number; totalPages: number; onPick: (n: number) => void }) {
  const pages: (number | '…')[] = []
  const push = (v: number | '…') => pages.push(v)
  const W = 2
  push(1)
  for (let i = page - W; i <= page + W; i++) {
    if (i > 1 && i < totalPages) {
      if (pages[pages.length - 1] !== '…' && i - 1 > (pages[pages.length - 1] as number) + 1) push('…')
      push(i)
    }
  }
  if (pages[pages.length - 1] !== '…' && totalPages - 1 > (pages[pages.length - 1] as number) + 1) push('…')
  if (totalPages > 1) push(totalPages)
  return (
    <div className="inline-flex items-center gap-1">
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onPick(page - 1)}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="inline-flex h-9 w-9 items-center justify-center text-slate-400">…</span>
        ) : (
          <button
            key={p}
            className={cn(
              'inline-flex h-9 min-w-[36px] items-center justify-center rounded-xl px-3 text-sm font-semibold transition',
              p === page
                ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white shadow-lg shadow-blue-500/20'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
            onClick={() => onPick(p)}
            type="button"
          >
            {p}
          </button>
        ),
      )}
      <button
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 disabled:opacity-40"
        disabled={page >= totalPages}
        onClick={() => onPick(page + 1)}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function NewsPage() {
  const nonceRef = useRef(0)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stale, setStale] = useState(false)
  const [, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicPostListResponse | null>(null)
  const [cat, setCat] = useState<PostCategory | 'all'>('all')
  const [kw, setKw] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 12

  function load() {
    const nonce = ++nonceRef.current
    if (!data) setInitialLoading(true)
    setStale(true)
    void (async () => {
      try {
        const res = await fetchPublicPosts({ category: cat, search: kw || null, page, pageSize })
        if (nonceRef.current !== nonce) return
        if ((res?.rows?.length ?? 0) === 0 && (res?.totalRows ?? 0) === 0) {
          setData(buildDemoPublicPosts(page, pageSize, cat))
        } else {
          setData(res)
        }
        setError(null)
      } catch (e) {
        if (nonceRef.current !== nonce) return
        setError(e && (e as any).message ? String((e as any).message) : 'Lỗi tải tin tức')
        setData(buildDemoPublicPosts(page, pageSize, cat))
      } finally {
        if (nonceRef.current === nonce) {
          setStale(false)
          setInitialLoading(false)
        }
      }
    })()
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [cat, page])

  const used = useMemo<PublicPostListResponse>(() => data ?? buildDemoPublicPosts(page, pageSize, cat), [data, page, pageSize, cat])
  const activeFilterCount = (cat !== 'all' ? 1 : 0) + (kw.trim() ? 1 : 0)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50/60 text-slate-900">
      <div className="mx-auto w-full max-w-[1640px] px-4 py-8 2xl:px-6">
        <PageHeader
          title="📰 Tin tức & Kinh nghiệm du lịch"
        />

        <div className="mt-4 flex flex-col gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-blue-100 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex flex-wrap items-center gap-1.5">
            {CATEGORY_TABS.map((c) => {
              const meta = c === 'all' ? null : POST_CATEGORY_META[c as PostCategory]
              const label = c === 'all' ? 'Tất cả' : `${meta?.icon} ${meta?.label}`
              const active = c === cat
              return (
                <button
                  key={c}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold ring-1 transition-all',
                    active
                      ? 'bg-gradient-to-r from-blue-700 to-orange-500 text-white ring-transparent shadow-md shadow-blue-500/20'
                      : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50',
                  )}
                  onClick={() => { setCat(c); setPage(1) }}
                  type="button"
                >
                  {label}
                  <span className={cn(
                    'ml-0.5 inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px]',
                    active ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500',
                  )}>
                    {used.totalRows && (c as any) === 'all' ? used.totalRows : buildDemoPublicPosts(1, 9999, c).totalRows}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <label className="relative inline-flex items-center flex-1 md:w-[380px]">
              <Search className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
              <input
                className="h-10 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                defaultValue={kw}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = (e.target as HTMLInputElement).value
                    setKw(v)
                    setPage(1)
                    setTimeout(load, 10)
                  }
                }}
                placeholder="Tìm tiêu đề, thẻ tag, nội dung..."
                type="text"
              />
            </label>
            {activeFilterCount > 0 && (
              <button
                className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-gradient-to-r from-orange-50 to-blue-50 px-3 text-xs font-bold text-blue-700 ring-1 ring-blue-200"
                onClick={() => { setCat('all'); setKw(''); setPage(1); setTimeout(load, 10) }}
                type="button"
              >
                Xóa lọc ({activeFilterCount})
              </button>
            )}
          </div>
        </div>

        <div className={cn('mt-6 transition-[opacity,transform] duration-300', stale ? 'opacity-80 blur-[0.4px]' : 'opacity-100')}>
          {/* PINNED 3 bài */}
          {initialLoading ? (
            <div className="grid gap-4 md:grid-cols-3" style={{ minHeight: 360 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
                  <Shimmer className="h-44 w-full rounded-2xl" />
                  <div className="mt-4 space-y-2">
                    <Shimmer className="h-4 w-24" />
                    <Shimmer className="h-5 w-full" />
                    <Shimmer className="h-5 w-4/5" />
                    <Shimmer className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : used.pinned.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3" style={{ minHeight: 360 }}>
              {used.pinned.map((p, i) => <PinnedCard key={p.id} post={p} index={i} />)}
            </div>
          ) : null}

          {/* GRID 12 bài */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ minHeight: 1500 }}>
            {initialLoading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100">
                    <Shimmer className="h-40 w-full rounded-2xl" />
                    <div className="mt-3 space-y-2 p-1">
                      <Shimmer className="h-3 w-20" />
                      <Shimmer className="h-5 w-full" />
                      <Shimmer className="h-3 w-5/6" />
                    </div>
                  </div>
                ))
              : used.rows.map((p, i) => <PostCard key={p.id} post={p} index={i} />)}
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 md:flex-row">
            <div className="text-sm text-slate-500">
              Trang <span className="font-bold text-slate-800">{used.page}</span>/<span className="font-bold">{used.totalPages}</span> · Tổng <b>{used.totalRows.toLocaleString('vi-VN')}</b> bài
            </div>
            <PaginatorPages page={used.page} totalPages={used.totalPages} onPick={(n) => setPage(n)} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PinnedCard({ post, index }: { post: PublicPost; index: number }) {
  const meta = POST_CATEGORY_META[post.category]
  return (
    <Link
      to={`/news/${post.slug}`}
      className={cn(
        'group relative overflow-hidden rounded-3xl bg-white p-4 shadow-lg ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl',
        'ring-' + (meta.color === 'orange' ? 'orange' : 'blue') + '-200/60',
      )}
      style={{ minHeight: 360 }}
    >
      <div className={cn('absolute -top-10 -right-10 h-40 w-40 rounded-full blur-3xl opacity-30 bg-gradient-to-br', _gradForCat(post.category, 1))} />
      <div className={cn('relative h-44 w-full overflow-hidden rounded-2xl bg-gradient-to-br ring-1 ring-white/40', _gradForCat(post.category, 0))}>
        {post.coverImageUrl ? (
          <img alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" src={post.coverImageUrl} />
        ) : (
          <div className="flex h-full w-full items-end justify-between p-4">
            <div className="text-6xl drop-shadow">{meta.icon}</div>
            <div className="rounded-full bg-white/25 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white backdrop-blur">PIN #{index + 1}</div>
          </div>
        )}
      </div>
      <div className="relative mt-4">
        <div className="flex items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1', meta.chip)}>
            <span>{meta.icon}</span>
            {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-500 ring-1 ring-slate-200">
            📅 {fmtDate(post.publishedAt)}
          </span>
        </div>
        <div className="mt-2 line-clamp-2 text-lg font-extrabold leading-snug text-slate-900 group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-700 group-hover:via-sky-600 group-hover:to-orange-600">
          {post.title}
        </div>
        <div className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{post.excerpt ?? ''}</div>
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Eye className="h-3.5 w-3.5 text-blue-500" /> {post.viewCount.toLocaleString('vi-VN')} lượt xem
          </div>
          <div className="text-xs font-extrabold text-blue-700 group-hover:text-orange-600 transition">Đọc tiếp →</div>
        </div>
      </div>
    </Link>
  )
}

function PostCard({ post, index: _ }: { post: PublicPost; index: number }) {
  const meta = POST_CATEGORY_META[post.category]
  return (
    <Link
      to={`/news/${post.slug}`}
      className="group relative overflow-hidden rounded-3xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-blue-100"
    >
      <div className={cn('h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br', _gradForCat(post.category, 0))}>
        {post.coverImageUrl ? (
          <img alt={post.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" src={post.coverImageUrl} />
        ) : (
          <div className="flex h-full w-full items-end justify-between p-3">
            <div className="text-5xl drop-shadow-sm">{meta.icon}</div>
            <div className={cn('rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white/95 backdrop-blur bg-white/20', _gradForCat(post.category, 1))}>{meta.label}</div>
          </div>
        )}
      </div>
      <div className="mt-3 space-y-2 px-1 pb-1">
        <div className="flex items-center gap-1.5">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', meta.chip)}>{meta.icon} {meta.label}</span>
          <span className="text-[10px] text-slate-400">📅 {fmtDate(post.publishedAt)}</span>
        </div>
        <div className="line-clamp-2 text-sm font-bold leading-snug text-slate-900 group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-700 group-hover:to-orange-600">
          {post.title}
        </div>
        <div className="line-clamp-2 text-xs leading-5 text-slate-500">{post.excerpt ?? ''}</div>
        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
            <Eye className="h-3 w-3 text-blue-500" /> {post.viewCount.toLocaleString('vi-VN')}
          </span>
          <span className="text-[11px] font-bold text-blue-700 group-hover:text-orange-600">Xem →</span>
        </div>
      </div>
    </Link>
  )
}
