import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { AdminTour, adminDeleteTour, adminListTours } from '@/features/admin/admin'
import { cn } from '@/lib/utils'
import { formatDate } from '@/utils/date'

export default function AdminToursPage() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<AdminTour[]>([])

  const reload = () => {
    setLoading(true)
    adminListTours()
      .then((r) => setItems(Array.isArray(r.items) ? r.items : []))
      .catch((e) => toast.error((e as any)?.message || 'Không tải được danh sách tour'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  const rows = useMemo(() => {
    return items.map((t) => {
      const nextDepartureDate =
        t.departures
          .map((d) => d.departureDate)
          .filter(Boolean)
          .map((x) => new Date(String(x)).getTime())
          .filter((x) => Number.isFinite(x))
          .sort((a, b) => a - b)[0] ?? null
      return { t, nextDepartureDate }
    })
  }, [items])

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Tạo tour đầy đủ thông tin, xuất bản để hiển thị lên trang Home."
        title="Tours"
        right={
          <Link
            className="inline-flex h-11 items-center justify-center rounded-full bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
            to="/admin/tours/new"
          >
            Tạo tour
          </Link>
        }
      />

      <div className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-blue-900/5 ring-1 ring-blue-100">
        <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-blue-50/50 p-5">
          <div className="text-sm font-bold tracking-wide text-slate-900">Danh sách tour</div>
          <button
            className={cn(
              'inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50',
              loading && 'pointer-events-none opacity-60',
            )}
            onClick={reload}
            type="button"
          >
            {loading ? 'Đang tải...' : 'Tải lại'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gradient-to-r from-blue-50 to-blue-100/40 text-[11px] font-bold uppercase tracking-wider text-blue-900/70">
              <tr>
                <th className="px-5 py-3">Tour</th>
                <th className="px-5 py-3">Trạng thái</th>
                <th className="px-5 py-3">Khởi hành</th>
                <th className="px-5 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ t, nextDepartureDate }) => (
                <tr key={t.id} className="border-t border-blue-100/60 transition hover:bg-blue-50/30">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-900">{t.title}</div>
                    <div className="text-xs text-slate-500">/{t.slug}</div>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-3 py-1 text-xs font-semibold',
                        t.isPublished
                          ? 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200'
                          : 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
                      )}
                    >
                      {t.isPublished ? 'Đang hiển thị' : 'Nháp'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {formatDate(nextDepartureDate)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50"
                        to={`/admin/tours/${t.id}/edit`}
                      >
                        Sửa
                      </Link>
                      <Link
                        className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 ring-1 ring-blue-200 transition hover:bg-blue-50"
                        target="_blank"
                        to={`/tours/${t.slug}`}
                      >
                        Xem
                      </Link>
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full bg-orange-50 px-4 text-sm font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 transition hover:bg-orange-100"
                        onClick={async () => {
                          const ok = window.confirm('Xóa tour này?')
                          if (!ok) return
                          try {
                            await adminDeleteTour(t.id)
                            toast.success('Đã xóa tour.')
                            reload()
                          } catch (e) {
                            toast.error((e as any)?.message || 'Xóa tour thất bại')
                          }
                        }}
                        type="button"
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!rows.length && !loading ? (
                <tr>
                  <td className="px-5 py-8 text-sm text-slate-600" colSpan={4}>
                    Chưa có tour nào.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
