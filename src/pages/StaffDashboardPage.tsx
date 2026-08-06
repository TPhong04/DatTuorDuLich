import PageHeader from '@/components/ui/PageHeader'

export default function StaffDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Khu vực Staff: quản lý tour, lịch khởi hành, booking, xác nhận, hóa đơn."
        title="Staff Dashboard"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Dashboard Staff (placeholder).
      </div>
    </div>
  )
}

