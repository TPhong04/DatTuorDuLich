import PageHeader from '@/components/ui/PageHeader'

export default function NewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader subtitle="Tin tức, bài viết, kinh nghiệm du lịch (v1.0)." title="Tin tức" />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Danh sách bài viết (placeholder).
      </div>
    </div>
  )
}

