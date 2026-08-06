import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AdminTour, adminCreateTour, adminGetTour, adminUpdateTour, adminUploadImage } from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { toInputDate } from '@/utils/date'

type Draft = Omit<AdminTour, 'id' | 'createdAt' | 'updatedAt'>

function emptyDraft(): Draft {
  return {
    title: '',
    slug: '',
    code: null,
    type: 'retail',
    departureFrom: null,
    durationDays: 1,
    durationNights: 0,
    transportText: null,
    hotelText: null,
    region: null,
    categories: [],
    themes: [],
    minGuests: null,
    maxGuests: null,
    videoUrl: null,
    coverImageUrl: null,
    galleryImageUrls: [],
    highlights: [],
    summary: null,
    totalBookings: 0,
    avgRating: null,
    reviewCount: 0,
    isPublished: false,
    tags: [],
    itinerary: [],
    priceTable: [],
    surcharges: [],
    departures: [],
    faq: [],
    seo: { metaTitle: null, metaDescription: null, canonicalUrl: null, ogImageUrl: null },
    includedText: null,
    excludedText: null,
    childPolicyText: null,
    cancelPolicyText: null,
    noteText: null,
    pickupPoints: [],
    reviews: [],
  }
}

function parseLines(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((x) => x.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .filter((x) => x.length > 0)
}

function parseTags(text: string) {
  return text
    .split(',')
    .map((s) => s.replace(/\s+/g, ' ').replace(/^[ \t]|[ \t]$/g, ''))
    .filter((s) => s.length > 0)
}

function normalizeMultiline(text: string | null | undefined): string | null {
  if (text == null) return null
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
  return cleaned
}

function preserveInline(text: string | null | undefined): string | null {
  if (text == null) return null
  const cleaned = text.replace(/\s+/g, ' ').replace(/^[ \t]|[ \t]$/g, '')
  return cleaned ? cleaned : null
}

function cleanArrayItem(s: string) {
  return s.replace(/\s+/g, ' ').replace(/^[ \t]|[ \t]$/g, '')
}

function applyDiscount(originalPrice: number | null, pct: number | null): number | null {
  if (originalPrice == null || !Number.isFinite(originalPrice) || originalPrice <= 0) return null
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return null
  const factor = 1 - Math.min(100, Math.max(0, pct)) / 100
  const raw = originalPrice * factor
  return Math.max(0, Math.round(raw / 1000) * 1000)
}

function computeDiscountPct(price: number | null, originalPrice: number | null): number | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (originalPrice == null || !Number.isFinite(originalPrice) || originalPrice <= price) return null
  const pct = Math.round(((originalPrice - price) / originalPrice) * 100)
  return pct > 0 ? pct : null
}

function formatMoney(n: number | null | undefined) {
  if (typeof n !== 'number') return ''
  return n.toLocaleString('vi-VN')
}

export default function AdminTourEditorPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const toast = useToast()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft())
  const [rawCategories, setRawCategories] = useState('')
  const [rawThemes, setRawThemes] = useState('')
  const [rawTags, setRawTags] = useState('')
  const [rawHighlights, setRawHighlights] = useState('')

  useEffect(() => {
    if (!editing || !id) return
    setLoading(true)
    adminGetTour(id)
      .then((t) => {
        const { createdAt: _c, updatedAt: _u, id: _id, ...rest } = t
        const restWithRaw: any = { ...rest }
        if (Array.isArray(restWithRaw.itinerary)) {
          restWithRaw.itinerary = restWithRaw.itinerary.map((day: any) => ({
            ...day,
            _rawMeals: Array.isArray(day.meals) ? day.meals.join(', ') : '',
            _rawAttractions: Array.isArray(day.attractions) ? day.attractions.join(', ') : '',
          }))
        }
        setDraft(restWithRaw as Draft)
        setRawCategories(Array.isArray(rest.categories) ? rest.categories.join(', ') : '')
        setRawThemes(Array.isArray(rest.themes) ? rest.themes.join(', ') : '')
        setRawTags(Array.isArray(rest.tags) ? rest.tags.join(', ') : '')
        setRawHighlights(Array.isArray(rest.highlights) ? rest.highlights.join('\n') : '')
      })
      .catch((e) => toast.error((e as any)?.message || 'Không tải được tour'))
      .finally(() => setLoading(false))
  }, [editing, id])

  useEffect(() => {
    if (editing) return
    if (loading) return
    setRawCategories(Array.isArray(draft.categories) ? draft.categories.join(', ') : '')
    setRawThemes(Array.isArray(draft.themes) ? draft.themes.join(', ') : '')
    setRawTags(Array.isArray(draft.tags) ? draft.tags.join(', ') : '')
    setRawHighlights(Array.isArray(draft.highlights) ? draft.highlights.join('\n') : '')
  }, [editing, loading])

  if (editing && !id) return <Navigate replace to="/admin/tours" />

  const uploadImage = async (file: File) => {
    const uploaded = await adminUploadImage({ file, category: 'tours' })
    return uploaded.url
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const titleClean = preserveInline(draft.title)
    const slugClean = preserveInline(draft.slug) ?? ''
    if (!titleClean || !slugClean) {
      toast.error('Vui lòng nhập Tên tour và Slug.')
      return
    }

    const cleanArray = (arr: string[] | null | undefined) =>
      Array.isArray(arr) ? arr.map(cleanArrayItem).filter((s) => s.length > 0) : []
    const draftDurationDays = typeof draft.durationDays === 'number' && Number.isFinite(draft.durationDays) ? Math.max(1, draft.durationDays) : 1
    const draftDurationNights = (() => {
      if (typeof draft.durationNights === 'number' && Number.isFinite(draft.durationNights) && draft.durationNights >= 0) return draft.durationNights
      if (draftDurationDays >= 2) return draftDurationDays - 1
      return 0
    })()
    const draftMinGuestsRaw = typeof draft.minGuests === 'number' && Number.isFinite(draft.minGuests) && draft.minGuests >= 0 ? draft.minGuests : null
    const draftMaxGuestsRaw = typeof draft.maxGuests === 'number' && Number.isFinite(draft.maxGuests) && draft.maxGuests >= 0 ? draft.maxGuests : null
    const finalMinGuests = draftMinGuestsRaw != null && draftMaxGuestsRaw != null && draftMinGuestsRaw > draftMaxGuestsRaw ? draftMaxGuestsRaw : draftMinGuestsRaw
    const canonicalDefault = slugClean ? `/tours/${encodeURIComponent(slugClean)}` : ''
    const departures = Array.isArray(draft.departures)
      ? draft.departures.map((d) => {
          const mealsRaw = parseTags(typeof (d as any)._rawMeals === 'string' ? (d as any)._rawMeals : Array.isArray(d.meals) ? d.meals.join(', ') : '')
          const attractionsRaw = parseTags(typeof (d as any)._rawAttractions === 'string' ? (d as any)._rawAttractions : Array.isArray(d.attractions) ? d.attractions.join(', ') : '')
          const { _rawMeals, _rawAttractions, ...rest } = d as any
          const seatsTotal = typeof rest.seatsTotal === 'number' ? Math.max(0, rest.seatsTotal) : 0
          const seatsAvailable = typeof rest.seatsAvailable === 'number' ? Math.max(0, rest.seatsAvailable) : 0
          return {
            ...rest,
            departureDate: rest.departureDate,
            standardText: preserveInline(rest.standardText),
            priceAdult: typeof rest.priceAdult === 'number' ? rest.priceAdult : 0,
            priceChild: typeof rest.priceChild === 'number' ? rest.priceChild : null,
            priceInfant: typeof rest.priceInfant === 'number' ? rest.priceInfant : null,
            originalPriceAdult: typeof rest.originalPriceAdult === 'number' ? rest.originalPriceAdult : null,
            originalPriceChild: typeof rest.originalPriceChild === 'number' ? rest.originalPriceChild : null,
            originalPriceInfant: typeof rest.originalPriceInfant === 'number' ? rest.originalPriceInfant : null,
            discountPercent: typeof rest.discountPercent === 'number' ? rest.discountPercent : null,
            seatsTotal,
            seatsAvailable: Math.min(seatsAvailable, seatsTotal),
            status: rest.status || 'open',
            meals: cleanArray(mealsRaw),
            attractions: cleanArray(attractionsRaw),
          }
        })
      : []
    const itinerary = Array.isArray(draft.itinerary)
      ? draft.itinerary.map((day) => {
          const d = day as any
          const mealsRaw = parseTags(typeof d._rawMeals === 'string' ? d._rawMeals : Array.isArray(day.meals) ? day.meals.join(', ') : '')
          const attractionsRaw = parseTags(typeof d._rawAttractions === 'string' ? d._rawAttractions : Array.isArray(day.attractions) ? day.attractions.join(', ') : '')
          const { _rawMeals, _rawAttractions, ...rest } = d
          return {
            ...rest,
            label: normalizeMultiline(day.label) ?? '',
            title: normalizeMultiline(day.title) ?? '',
            content: normalizeMultiline(day.content) ?? '',
            accommodationText: normalizeMultiline(day.accommodationText),
            attractions: cleanArray(attractionsRaw),
            meals: cleanArray(mealsRaw),
          }
        })
      : []

    const payload: Draft = {
      ...draft,
      title: normalizeMultiline(draft.title) ?? '',
      slug: slugClean,
      code: preserveInline(draft.code),
      departureFrom: normalizeMultiline(draft.departureFrom),
      durationDays: draftDurationDays,
      durationNights: draftDurationNights,
      transportText: normalizeMultiline(draft.transportText),
      hotelText: normalizeMultiline(draft.hotelText),
      region: normalizeMultiline(draft.region),
      categories: cleanArray(parseTags(rawCategories)),
      themes: cleanArray(parseTags(rawThemes)),
      tags: cleanArray(parseTags(rawTags)),
      highlights: cleanArray(parseLines(rawHighlights)),
      minGuests: finalMinGuests,
      maxGuests: draftMaxGuestsRaw,
      videoUrl: preserveInline(draft.videoUrl),
      summary: normalizeMultiline(draft.summary),
      galleryImageUrls: cleanArray(draft.galleryImageUrls),
      priceTable: Array.isArray(draft.priceTable)
        ? draft.priceTable.map((row) => ({
            label: preserveInline(row.label),
            value: preserveInline(row.value),
            amount: typeof row.amount === 'number' ? row.amount : null,
          }))
        : [],
      departures,
      itinerary,
      faq: Array.isArray(draft.faq)
        ? draft.faq.map((f) => ({
            question: normalizeMultiline(f.question) ?? '',
            answer: normalizeMultiline(f.answer) ?? '',
          }))
        : [],
      pickupPoints: Array.isArray(draft.pickupPoints) ? draft.pickupPoints : [],
      coverImageUrl: preserveInline(draft.coverImageUrl),
      seo: {
        metaTitle: preserveInline(draft.seo?.metaTitle),
        metaDescription: normalizeMultiline(draft.seo?.metaDescription),
        canonicalUrl: preserveInline(draft.seo?.canonicalUrl) || canonicalDefault,
        ogImageUrl: preserveInline(draft.seo?.ogImageUrl),
      },
      includedText: normalizeMultiline(draft.includedText),
      excludedText: normalizeMultiline(draft.excludedText),
      childPolicyText: normalizeMultiline(draft.childPolicyText),
      cancelPolicyText: normalizeMultiline(draft.cancelPolicyText),
      noteText: normalizeMultiline(draft.noteText),
    }

    setSaving(true)
    try {
      if (editing && id) {
        const saved = await adminUpdateTour(id, payload)
        const { createdAt: _c, updatedAt: _u, id: _id, ...rest } = saved
        const restWithRaw: any = { ...rest }
        if (Array.isArray(restWithRaw.itinerary)) {
          restWithRaw.itinerary = restWithRaw.itinerary.map((day: any) => ({
            ...day,
            _rawMeals: Array.isArray(day.meals) ? day.meals.join(', ') : '',
            _rawAttractions: Array.isArray(day.attractions) ? day.attractions.join(', ') : '',
          }))
        }
        setDraft(restWithRaw as Draft)
        setRawCategories(Array.isArray(rest.categories) ? rest.categories.join(', ') : '')
        setRawThemes(Array.isArray(rest.themes) ? rest.themes.join(', ') : '')
        setRawTags(Array.isArray(rest.tags) ? rest.tags.join(', ') : '')
        setRawHighlights(Array.isArray(rest.highlights) ? rest.highlights.join('\n') : '')
        toast.success('Đã cập nhật tour (đồng bộ dữ liệu hệ thống).')
      } else {
        const created = await adminCreateTour(payload)
        toast.success('Đã tạo tour.')
        navigate(`/admin/tours/${created.id}/edit`, { replace: true })
        return
      }
      navigate('/admin/tours')
    } catch (e) {
      toast.error((e as any)?.message || 'Lưu tour thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Tạo/Chỉnh sửa tour để hiển thị giống mẫu Datviettour."
        title={editing ? 'Sửa tour' : 'Tạo tour'}
        right={
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            to="/admin/tours"
          >
            Quay lại
          </Link>
        }
      />

      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Tên tour</div>
              <textarea
                className="mt-2 min-h-16 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                rows={2}
                value={draft.title}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Slug</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                placeholder="hcm-ninh-chu-nha-trang..."
                value={draft.slug}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Mã tour</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
                value={draft.code ?? ''}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Loại tour</div>
              <select
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as any }))}
                value={draft.type}
              >
                <option value="retail">Tour khách lẻ</option>
                <option value="group">Tour khách đoàn</option>
              </select>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Điểm khởi hành</div>
              <textarea
                className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, departureFrom: e.target.value }))}
                rows={2}
                value={draft.departureFrom ?? ''}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Vùng / Khu vực</div>
              <textarea
                className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))}
                placeholder="Miền Trung / Miền Bắc / Miền Nam..."
                rows={2}
                value={draft.region ?? ''}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Số ngày</div>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) => setDraft((d) => ({ ...d, durationDays: Number(e.target.value || 0) }))}
                  type="number"
                  value={draft.durationDays}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Số đêm</div>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) => setDraft((d) => ({ ...d, durationNights: Number(e.target.value || 0) }))}
                  type="number"
                  value={draft.durationNights}
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Khách tối thiểu</div>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, minGuests: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                  type="number"
                  value={draft.minGuests ?? ''}
                />
              </label>
              <label className="block">
                <div className="text-sm font-semibold text-slate-900">Khách tối đa</div>
                <input
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, maxGuests: e.target.value === '' ? null : Number(e.target.value) }))
                  }
                  type="number"
                  value={draft.maxGuests ?? ''}
                />
              </label>
            </div>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Phương tiện</div>
              <textarea
                className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, transportText: e.target.value }))}
                rows={2}
                value={draft.transportText ?? ''}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Lưu trú</div>
              <textarea
                className="mt-2 min-h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, hotelText: e.target.value }))}
                rows={2}
                value={draft.hotelText ?? ''}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Video giới thiệu (Youtube / embed URL)</div>
              <textarea
                className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, videoUrl: e.target.value }))}
                placeholder="https://www.youtube.com/watch?v=..."
                rows={1}
                value={draft.videoUrl ?? ''}
              />
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Danh mục tour (ngăn cách dấu phẩy)</div>
              <textarea
                className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setRawCategories(e.target.value)}
                placeholder="Du lịch biển, Tour miền Trung..."
                rows={1}
                value={rawCategories}
              />
              <div className="mt-1.5 text-[11px] text-slate-500">Ví dụ: "Du lịch biển, Miền Trung, Tour cao cấp"</div>
            </label>

            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Chủ đề / tags riêng (ngăn cách dấu phẩy)</div>
              <textarea
                className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setRawThemes(e.target.value)}
                placeholder="Giờ chót, Hè 2026, Gia đình..."
                rows={1}
                value={rawThemes}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Tags (ngăn cách bằng dấu phẩy)</div>
              <textarea
                className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setRawTags(e.target.value)}
                placeholder="tour 4 sao, tour cuối tuần, vé thuyền..."
                rows={1}
                value={rawTags}
              />
            </label>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Tóm tắt</div>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))}
                value={draft.summary ?? ''}
              />
            </label>

            <div className="grid gap-3 md:col-span-2 md:grid-cols-[max-content_1fr] items-start">
              <label className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 px-5 py-3">
                <input
                  checked={draft.isPublished}
                  className="h-5 w-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  disabled={loading || saving}
                  onChange={(e) => setDraft((d) => ({ ...d, isPublished: e.target.checked }))}
                  type="checkbox"
                />
                <span className="text-sm font-semibold text-blue-900">Xuất bản lên web</span>
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  <span>📘</span>
                  <span>Đã đặt (lượt):</span>
                  <span className="font-bold text-slate-900">{draft.totalBookings || 0}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  <span>⭐</span>
                  <span>Rating TB:</span>
                  <span className="font-bold text-slate-900">{typeof draft.avgRating === 'number' ? draft.avgRating.toFixed(1) : '0.0'}</span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                  <span>💬</span>
                  <span>Lượt review:</span>
                  <span className="font-bold text-slate-900">{draft.reviewCount || 0}</span>
                </span>
                <span className="ml-1 text-[11px] italic text-slate-500">
                  → Các chỉ số này <b>tự tính</b> theo booking + đánh giá khách hàng, không cần nhập.
                </span>
              </div>
            </div>

            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Highlights (mỗi dòng 1 ý)</div>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setRawHighlights(e.target.value)}
                value={rawHighlights}
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="text-sm font-semibold text-slate-900">Hình ảnh</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">Ảnh cover</div>
              <div className="mt-3 aspect-[16/5] overflow-hidden rounded-2xl bg-slate-100">
                {draft.coverImageUrl ? (
                  <img alt="Cover" className="h-full w-full object-cover" src={draft.coverImageUrl} />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600">
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={loading || saving}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        const url = await uploadImage(f)
                        setDraft((d) => ({ ...d, coverImageUrl: url }))
                        toast.success('Đã upload ảnh cover.')
                      } catch (err) {
                        toast.error((err as any)?.message || 'Upload thất bại')
                      } finally {
                        e.target.value = ''
                      }
                    }}
                    type="file"
                  />
                  Upload ảnh
                </label>
                {draft.coverImageUrl ? (
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                    disabled={loading || saving}
                    onClick={() => setDraft((d) => ({ ...d, coverImageUrl: null }))}
                    type="button"
                  >
                    Xóa
                  </button>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">Gallery</div>
                <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800">
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={loading || saving}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        const url = await uploadImage(f)
                        setDraft((d) => ({ ...d, galleryImageUrls: [...d.galleryImageUrls, url] }))
                        toast.success('Đã thêm ảnh gallery.')
                      } catch (err) {
                        toast.error((err as any)?.message || 'Upload thất bại')
                      } finally {
                        e.target.value = ''
                      }
                    }}
                    type="file"
                  />
                  Thêm ảnh
                </label>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {draft.galleryImageUrls.map((url) => (
                  <div key={url} className="relative overflow-hidden rounded-2xl border border-slate-200">
                    <div className="aspect-[16/9] bg-slate-100">
                      <img alt="Gallery" className="h-full w-full object-cover" src={url} />
                    </div>
                    <button
                      className="absolute right-2 top-2 inline-flex h-8 items-center justify-center rounded-full bg-white/90 px-3 text-xs font-semibold text-slate-900"
                      disabled={loading || saving}
                      onClick={() => setDraft((d) => ({ ...d, galleryImageUrls: d.galleryImageUrls.filter((x) => x !== url) }))}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                ))}
                {!draft.galleryImageUrls.length ? <div className="text-sm text-slate-600">Chưa có ảnh.</div> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Chương trình (itinerary)</div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  itinerary: [
                    ...d.itinerary,
                    {
                      label: `Ngày ${d.itinerary.length + 1}`,
                      title: '',
                      meals: [],
                      content: '',
                      attractions: [],
                      accommodationText: null,
                      _rawMeals: '',
                      _rawAttractions: '',
                    } as any,
                  ],
                }))
              }
              type="button"
            >
              Thêm ngày
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {draft.itinerary.map((day, idx) => (
              <div key={idx} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{day.label || `Ngày ${idx + 1}`}</div>
                  <button
                    className="inline-flex h-9 items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                    disabled={loading || saving}
                    onClick={() => setDraft((d) => ({ ...d, itinerary: d.itinerary.filter((_, i) => i !== idx) }))}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <div className="text-sm font-semibold text-slate-900">Nhãn</div>
                    <textarea
                      className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                        }))
                      }
                      rows={2}
                      value={day.label}
                    />
                  </label>
                  <label className="block">
                    <div className="text-sm font-semibold text-slate-900">Tiêu đề</div>
                    <textarea
                      className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)),
                        }))
                      }
                      rows={2}
                      value={day.title}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <div className="text-sm font-semibold text-slate-900">Bữa ăn (ngăn cách dấu phẩy)</div>
                    <textarea
                      className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) =>
                            i === idx ? { ...(x as any), _rawMeals: e.target.value } : x,
                          ),
                        }))
                      }
                      rows={1}
                      value={typeof (day as any)._rawMeals === 'string' ? (day as any)._rawMeals : (day.meals || []).join(', ')}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <div className="text-sm font-semibold text-slate-900">Điểm đến nổi bật / Địa danh (ngăn cách dấu phẩy)</div>
                    <textarea
                      className="mt-2 min-h-14 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) =>
                            i === idx ? { ...(x as any), _rawAttractions: e.target.value } : x,
                          ),
                        }))
                      }
                      placeholder="Vịnh Vĩnh Hy, Vinpearl Land, Cáp treo..."
                      rows={1}
                      value={typeof (day as any)._rawAttractions === 'string' ? (day as any)._rawAttractions : (day.attractions || []).join(', ')}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <div className="text-sm font-semibold text-slate-900">Lưu trú đêm này (nếu có)</div>
                    <textarea
                      className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) =>
                            i === idx ? { ...x, accommodationText: e.target.value } : x,
                          ),
                        }))
                      }
                      placeholder="KS 4 sao Vĩnh Hy (Villa Sea View) • 2 đêm"
                      rows={2}
                      value={day.accommodationText ?? ''}
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <div className="text-sm font-semibold text-slate-900">Nội dung</div>
                    <textarea
                      className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                      disabled={loading || saving}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          itinerary: d.itinerary.map((x, i) => (i === idx ? { ...x, content: e.target.value } : x)),
                        }))
                      }
                      value={day.content}
                    />
                  </label>
                </div>
              </div>
            ))}

            {!draft.itinerary.length ? <div className="text-sm text-slate-600">Chưa có chương trình.</div> : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="text-sm font-semibold text-slate-900">Bảng giá</div>
          <div className="mt-4 space-y-3">
            {(draft.priceTable || []).map((row, idx) => (
              <div key={idx} className="grid gap-3 md:grid-cols-3">
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      priceTable: d.priceTable.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  placeholder="Người lớn (>=10 tuổi)"
                  value={row.label}
                />
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      priceTable: d.priceTable.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value || 0) } : x)),
                    }))
                  }
                  placeholder="2386000"
                  type="number"
                  value={row.amount}
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  disabled={loading || saving}
                  onClick={() => setDraft((d) => ({ ...d, priceTable: d.priceTable.filter((_, i) => i !== idx) }))}
                  type="button"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() => setDraft((d) => ({ ...d, priceTable: [...d.priceTable, { label: '', value: '', amount: 0 }] }))}
              type="button"
            >
              Thêm dòng giá
            </button>
          </div>

          <div className="mt-8 text-sm font-semibold text-slate-900">Phụ thu</div>
          <div className="mt-4 space-y-3">
            {(draft.surcharges || []).map((row, idx) => (
              <div key={idx} className="grid gap-3 md:grid-cols-3">
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      surcharges: d.surcharges.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)),
                    }))
                  }
                  placeholder="Phụ thu phòng đơn"
                  value={row.label}
                />
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      surcharges: d.surcharges.map((x, i) => (i === idx ? { ...x, amount: Number(e.target.value || 0) } : x)),
                    }))
                  }
                  placeholder="700000"
                  type="number"
                  value={row.amount}
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  disabled={loading || saving}
                  onClick={() => setDraft((d) => ({ ...d, surcharges: d.surcharges.filter((_, i) => i !== idx) }))}
                  type="button"
                >
                  Xóa
                </button>
              </div>
            ))}
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() => setDraft((d) => ({ ...d, surcharges: [...d.surcharges, { label: '', value: '', amount: 0 }] }))}
              type="button"
            >
              Thêm phụ thu
            </button>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Lịch khởi hành</div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() =>
                setDraft((d) => ({
                  ...d,
                  departures: [
                    ...d.departures,
                    {
                      departureDate: toInputDate(new Date()),
                      standardText: d.hotelText ?? null,
                      priceAdult: 0,
                      priceChild: null,
                      priceInfant: null,
                      originalPriceAdult: null,
                      originalPriceChild: null,
                      originalPriceInfant: null,
                      discountPercent: null,
                      seatsTotal: 0,
                      seatsAvailable: 0,
                      status: 'open',
                      meals: [],
                      attractions: [],
                    },
                  ],
                }))
              }
              type="button"
            >
              Thêm ngày
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {(draft.departures || []).map((dep, idx) => {
              const autoDisc =
                typeof dep.priceAdult === 'number' &&
                dep.priceAdult > 0 &&
                typeof dep.originalPriceAdult === 'number' &&
                dep.originalPriceAdult > dep.priceAdult
                  ? Math.round(((dep.originalPriceAdult - dep.priceAdult) / dep.originalPriceAdult) * 100)
                  : null
              return (
                <div key={idx} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">Đợt {idx + 1}</div>
                      {typeof dep.discountPercent === 'number' ? (
                        <span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 ring-1 ring-inset ring-orange-200">
                          -{dep.discountPercent}%
                        </span>
                      ) : autoDisc ? (
                        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-inset ring-blue-200">
                          Tự động -{autoDisc}%
                        </span>
                      ) : null}
                    </div>
                    <button
                      className="inline-flex h-9 items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                      disabled={loading || saving}
                      onClick={() => setDraft((d) => ({ ...d, departures: d.departures.filter((_, i) => i !== idx) }))}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Ngày khởi hành</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) =>
                              i === idx ? { ...x, departureDate: e.target.value || toInputDate(new Date()) } : x,
                            ),
                          }))
                        }
                        type="date"
                        value={toInputDate(dep.departureDate)}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Tiêu chuẩn</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => (i === idx ? { ...x, standardText: e.target.value } : x)),
                          }))
                        }
                        value={dep.standardText ?? ''}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Trạng thái</div>
                      <select
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) =>
                              i === idx ? { ...x, status: e.target.value as any } : x,
                            ),
                          }))
                        }
                        value={dep.status}
                      >
                        <option value="open">Mở bán</option>
                        <option value="closed">Đóng bán</option>
                        <option value="cancelled">Đã huỷ</option>
                        <option value="soldout">Hết chỗ</option>
                      </select>
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giảm giá (%)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) => {
                          const pctRaw = e.target.value === '' ? null : Number(e.target.value)
                          const pct = pctRaw != null && Number.isFinite(pctRaw) && pctRaw >= 0 && pctRaw <= 100 ? pctRaw : null
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => {
                              if (i !== idx) return x
                              const y = { ...x, discountPercent: pct }
                              if (pct != null && pct > 0) {
                                const newPriceAdult = applyDiscount(y.originalPriceAdult ?? null, pct)
                                const newPriceChild = applyDiscount(y.originalPriceChild ?? null, pct)
                                const newPriceInfant = applyDiscount(y.originalPriceInfant ?? null, pct)
                                if (newPriceAdult != null) y.priceAdult = newPriceAdult
                                if (newPriceChild != null) y.priceChild = newPriceChild
                                if (newPriceInfant != null) y.priceInfant = newPriceInfant
                              }
                              return y
                            }),
                          }))
                        }}
                        placeholder="VD: 5"
                        type="number"
                        value={dep.discountPercent ?? ''}
                      />
                      <div className="mt-1.5 text-[11px] leading-snug text-slate-500">
                        Điền % = hệ thống TỰ tính Giá bán (NL/TE/EB) = Giá gốc × (1 − %). Để trống = tự tính % ngược theo Giá gốc − Giá bán.
                      </div>
                    </label>

                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá NL (giá bán)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => {
                              if (i !== idx) return x
                              const y = { ...x, priceAdult: Number(e.target.value || 0) }
                              if (y.discountPercent == null) {
                                const autoPct = computeDiscountPct(y.priceAdult, y.originalPriceAdult ?? null)
                                if (autoPct != null) y.discountPercent = autoPct
                              }
                              return y
                            }),
                          }))
                        }
                        type="number"
                        value={dep.priceAdult}
                      />
                      <div className="mt-1.5 text-[11px] text-slate-500">Có thể chỉnh tay sau khi tự tính % giảm.</div>
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá NL gốc (giá cũ)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => {
                              if (i !== idx) return x
                              const orig = e.target.value === '' ? null : Number(e.target.value)
                              const y = { ...x, originalPriceAdult: orig != null && orig > 0 ? orig : null }
                              if (y.discountPercent != null && y.discountPercent > 0) {
                                const newPrice = applyDiscount(y.originalPriceAdult ?? null, y.discountPercent)
                                if (newPrice != null) y.priceAdult = newPrice
                              }
                              return y
                            }),
                          }))
                        }
                        type="number"
                        value={dep.originalPriceAdult ?? ''}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá TE (giá bán)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => (i === idx ? { ...x, priceChild: e.target.value ? Number(e.target.value) : null } : x)),
                          }))
                        }
                        type="number"
                        value={dep.priceChild ?? ''}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá TE gốc (giá cũ)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => {
                              if (i !== idx) return x
                              const orig = e.target.value === '' ? null : Number(e.target.value)
                              const y = { ...x, originalPriceChild: orig != null && orig > 0 ? orig : null }
                              if (y.discountPercent != null && y.discountPercent > 0) {
                                const newPrice = applyDiscount(y.originalPriceChild ?? null, y.discountPercent)
                                if (newPrice != null) y.priceChild = newPrice
                              }
                              return y
                            }),
                          }))
                        }
                        type="number"
                        value={dep.originalPriceChild ?? ''}
                      />
                    </label>

                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá EB (giá bán)</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => (i === idx ? { ...x, priceInfant: e.target.value ? Number(e.target.value) : null } : x)),
                          }))
                        }
                        type="number"
                        value={dep.priceInfant ?? ''}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Giá EB gốc</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => {
                              if (i !== idx) return x
                              const orig = e.target.value === '' ? null : Number(e.target.value)
                              const y = { ...x, originalPriceInfant: orig != null && orig > 0 ? orig : null }
                              if (y.discountPercent != null && y.discountPercent > 0) {
                                const newPrice = applyDiscount(y.originalPriceInfant ?? null, y.discountPercent)
                                if (newPrice != null) y.priceInfant = newPrice
                              }
                              return y
                            }),
                          }))
                        }
                        type="number"
                        value={dep.originalPriceInfant ?? ''}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Số chỗ</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => (i === idx ? { ...x, seatsTotal: Number(e.target.value || 0) } : x)),
                          }))
                        }
                        type="number"
                        value={dep.seatsTotal}
                      />
                    </label>
                    <label className="block">
                      <div className="text-sm font-semibold text-slate-900">Còn</div>
                      <input
                        className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                        disabled={loading || saving}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            departures: d.departures.map((x, i) => (i === idx ? { ...x, seatsAvailable: Number(e.target.value || 0) } : x)),
                          }))
                        }
                        type="number"
                        value={dep.seatsAvailable}
                      />
                    </label>
                  </div>

                  <div className="mt-3 text-sm text-slate-600">
                    {dep.priceAdult ? `Giá bán hiển thị: ${formatMoney(dep.priceAdult)}đ` : ''}
                    {typeof dep.originalPriceAdult === 'number' ? ` • Giá cũ: ${formatMoney(dep.originalPriceAdult)}đ` : ''}
                  </div>
                </div>
              )
            })}
            {!draft.departures.length ? <div className="text-sm text-slate-600">Chưa có lịch khởi hành.</div> : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="text-sm font-semibold text-slate-900">Chính sách & ghi chú</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Dịch vụ bao gồm</div>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, includedText: e.target.value }))}
                value={draft.includedText ?? ''}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Dịch vụ chưa bao gồm</div>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, excludedText: e.target.value }))}
                value={draft.excludedText ?? ''}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Quy định trẻ em</div>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, childPolicyText: e.target.value }))}
                value={draft.childPolicyText ?? ''}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Điều kiện hủy tour</div>
              <textarea
                className="mt-2 min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, cancelPolicyText: e.target.value }))}
                value={draft.cancelPolicyText ?? ''}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Ghi chú</div>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, noteText: e.target.value }))}
                value={draft.noteText ?? ''}
              />
            </label>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">FAQ - Câu hỏi thường gặp</div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() => setDraft((d) => ({ ...d, faq: [...d.faq, { question: '', answer: '' }] }))}
              type="button"
            >
              Thêm câu hỏi
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {(draft.faq || []).map((f, idx) => (
              <div key={idx} className="grid gap-3 md:grid-cols-[1fr_2fr_auto] rounded-2xl border border-slate-200 p-4">
                <label className="block">
                  <div className="text-sm font-semibold text-slate-900">Câu hỏi</div>
                  <textarea
                    className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                    disabled={loading || saving}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        faq: d.faq.map((x, i) => (i === idx ? { ...x, question: e.target.value } : x)),
                      }))
                    }
                    placeholder="Trẻ em giá như thế nào?"
                    rows={2}
                    value={f.question}
                  />
                </label>
                <label className="block">
                  <div className="text-sm font-semibold text-slate-900">Câu trả lời</div>
                  <textarea
                    className="mt-2 min-h-20 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none ring-orange-400/40 focus:ring-4"
                    disabled={loading || saving}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        faq: d.faq.map((x, i) => (i === idx ? { ...x, answer: e.target.value } : x)),
                      }))
                    }
                    placeholder="Trẻ dưới 5 tuổi miễn phí..."
                    rows={3}
                    value={f.answer}
                  />
                </label>
                <div className="flex items-end">
                  <button
                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                    disabled={loading || saving}
                    onClick={() => setDraft((d) => ({ ...d, faq: d.faq.filter((_, i) => i !== idx) }))}
                    type="button"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
            {!draft.faq.length ? <div className="text-sm text-slate-600">Chưa có FAQ.</div> : null}
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="text-sm font-semibold text-slate-900">SEO (lên top Google)</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Meta Title (tiêu đề kết quả tìm kiếm)</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, seo: { ...d.seo, metaTitle: e.target.value } }))}
                placeholder="Tour HCM - Ninh Chữ - Nha Trang 4N3Đ - Giá Tốt 2026"
                value={draft.seo?.metaTitle ?? ''}
              />
            </label>
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Meta Description (mô tả ngắn kết quả Google)</div>
              <textarea
                className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, seo: { ...d.seo, metaDescription: e.target.value } }))}
                placeholder="Tour 4 ngày 3 đêm đầy đủ: Vịnh Ninh Chữ, Vinpearl, Vĩnh Hy, Nha Phu. Xe Limousine, KS 4 sao, bảo hiểm. Mua sớm ưu đãi 15%."
                value={draft.seo?.metaDescription ?? ''}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Canonical URL</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                disabled={loading || saving}
                onChange={(e) => setDraft((d) => ({ ...d, seo: { ...d.seo, canonicalUrl: e.target.value } }))}
                placeholder="https://yourdomain.com/tour/hcm-ninh-chu-nha-trang..."
                value={draft.seo?.canonicalUrl ?? ''}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">OG Image (ảnh share Facebook)</div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) => setDraft((d) => ({ ...d, seo: { ...d.seo, ogImageUrl: e.target.value } }))}
                  placeholder="/uploads/og-tour-ninhchu.jpg"
                  value={draft.seo?.ogImageUrl ?? ''}
                />
                <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-600">
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={loading || saving}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      try {
                        const url = await uploadImage(f)
                        setDraft((d) => ({ ...d, seo: { ...d.seo, ogImageUrl: url } }))
                        toast.success('Đã upload ảnh SEO.')
                      } catch (err) {
                        toast.error((err as any)?.message || 'Upload thất bại')
                      } finally {
                        e.target.value = ''
                      }
                    }}
                    type="file"
                  />
                  Upload
                </label>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Điểm đón khách</div>
            <button
              className="inline-flex h-9 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
              disabled={loading || saving}
              onClick={() => setDraft((d) => ({ ...d, pickupPoints: [...d.pickupPoints, { address: '', time: null, note: null }] }))}
              type="button"
            >
              Thêm điểm đón
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {draft.pickupPoints.map((p, idx) => (
              <div key={idx} className="grid gap-3 md:grid-cols-4">
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4 md:col-span-2"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      pickupPoints: d.pickupPoints.map((x, i) => (i === idx ? { ...x, address: e.target.value } : x)),
                    }))
                  }
                  placeholder="Địa chỉ"
                  value={p.address}
                />
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      pickupPoints: d.pickupPoints.map((x, i) => (i === idx ? { ...x, time: e.target.value } : x)),
                    }))
                  }
                  placeholder="Thời gian"
                  value={p.time ?? ''}
                />
                <button
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  disabled={loading || saving}
                  onClick={() => setDraft((d) => ({ ...d, pickupPoints: d.pickupPoints.filter((_, i) => i !== idx) }))}
                  type="button"
                >
                  Xóa
                </button>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4 md:col-span-3"
                  disabled={loading || saving}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      pickupPoints: d.pickupPoints.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)),
                    }))
                  }
                  placeholder="Ghi chú"
                  value={p.note ?? ''}
                />
              </div>
            ))}
            {!draft.pickupPoints.length ? <div className="text-sm text-slate-600">Chưa có điểm đón.</div> : null}
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row">
          <button
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600',
              (loading || saving) && 'pointer-events-none opacity-60',
            )}
            type="submit"
          >
            {saving ? 'Đang lưu...' : 'Lưu tour'}
          </button>
          <Link
            className={cn(
              'inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50',
              (loading || saving) && 'pointer-events-none opacity-60',
            )}
            to="/admin/tours"
          >
            Hủy
          </Link>
        </div>
      </form>
    </div>
  )
}

