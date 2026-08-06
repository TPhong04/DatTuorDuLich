import { useMemo } from 'react'
import { useParams } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'

const copyByService: Record<string, { title: string; subtitle: string }> = {
  visa: {
    title: 'Dịch vụ Visa',
    subtitle: 'Trang giới thiệu + form yêu cầu (v1.0).',
  },
  'flight-ticket': {
    title: 'Dịch vụ Vé máy bay',
    subtitle: 'Trang giới thiệu + form yêu cầu (v1.0).',
  },
  'car-rental': {
    title: 'Dịch vụ Thuê xe',
    subtitle: 'Trang giới thiệu + form yêu cầu (v1.0).',
  },
}

export default function ServiceDetailPage() {
  const { serviceSlug } = useParams()

  const content = useMemo(() => {
    if (!serviceSlug) return null
    return copyByService[serviceSlug] ?? null
  }, [serviceSlug])

  return (
    <div className="space-y-6">
      <PageHeader subtitle={content?.subtitle} title={content?.title ?? 'Dịch vụ'} />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Nội dung giới thiệu dịch vụ + form yêu cầu (placeholder).
      </div>
    </div>
  )
}

