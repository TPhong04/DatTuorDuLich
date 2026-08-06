import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="text-2xl font-semibold text-slate-900">Không tìm thấy trang</div>
      <div className="text-sm text-slate-600">Đường dẫn không tồn tại hoặc đã bị thay đổi.</div>
      <Link className="inline-flex rounded-full bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white" to="/">
        Về trang chủ
      </Link>
    </div>
  )
}

