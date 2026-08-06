import PageHeader from '@/components/ui/PageHeader'

export default function GroupTourRequestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Trang này yêu cầu đăng nhập để gửi yêu cầu và lưu lịch sử theo tài khoản."
        title="Yêu cầu báo giá tour đoàn"
      />
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        Form yêu cầu báo giá (placeholder).
      </div>
    </div>
  )
}

