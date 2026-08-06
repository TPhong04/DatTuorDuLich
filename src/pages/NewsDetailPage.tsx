import { useParams } from 'react-router-dom'

import PageHeader from '@/components/ui/PageHeader'

export default function NewsDetailPage() {
  const { slug } = useParams()

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Chi tiết bài viết (placeholder)." title={`Bài viết: ${slug ?? ''}`} />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Nội dung bài viết (placeholder).
      </div>
    </div>
  )
}

