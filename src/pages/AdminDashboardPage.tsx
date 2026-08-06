import PageHeader from '@/components/ui/PageHeader'

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Khu vực Admin: tài khoản, phân quyền, danh mục, quản trị nội dung."
        title="Admin Dashboard"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Dashboard Admin (placeholder).
      </div>
    </div>
  )
}

