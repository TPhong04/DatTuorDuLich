import { Link } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'

export default function GroupTourPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Tour đoàn v1.0 theo kiểu C: có tour đoàn mẫu + form yêu cầu báo giá."
        title="Tour đoàn"
        right={
          <Link
            className="inline-flex h-10 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-4 text-sm font-bold text-white shadow-sm shadow-orange-500/15 transition hover:bg-orange-600"
            to="/group-tour/request"
          >
            Yêu cầu báo giá
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          Danh sách tour đoàn mẫu (placeholder).
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          Lợi ích tour đoàn + quy trình tư vấn (placeholder).
        </div>
      </div>
    </div>
  )
}

