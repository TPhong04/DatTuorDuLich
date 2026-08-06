import { Link } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'

const cards = [
  {
    title: 'Visa',
    desc: 'Tư vấn hồ sơ và thời gian xử lý theo nhu cầu.',
    to: '/services/visa',
  },
  {
    title: 'Vé máy bay',
    desc: 'Gửi yêu cầu báo giá theo chặng bay và thời gian.',
    to: '/services/flight-ticket',
  },
  {
    title: 'Thuê xe',
    desc: 'Thuê xe theo giờ/ngày, nội thành và liên tỉnh.',
    to: '/services/car-rental',
  },
]

export default function ServicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="v1.0 triển khai dạng trang giới thiệu + form yêu cầu (sẽ nâng cấp đặt dịch vụ online ở v1.1)."
        title="Dịch vụ"
      />
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <div key={c.to} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">{c.title}</div>
            <div className="mt-2 text-sm text-slate-600">{c.desc}</div>
            <Link className="mt-4 inline-flex text-sm font-semibold text-blue-800 hover:underline" to={c.to}>
              Xem chi tiết
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

