import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { register } from '@/features/auth/auth'
import { cn } from '@/lib/utils'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const toast = useToast()

  const passwordMismatch = Boolean(confirmPassword) && confirmPassword !== password

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name || !email || !password || !confirmPassword) return
    if (passwordMismatch) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    setError(null)
    try {
      await register({ name, phone: phone.trim() || undefined, email, password })
      toast.success('Đăng ký thành công. Vui lòng đăng nhập để tiếp tục.')
      navigate('/auth/login', { replace: true })
    } catch (e) {
      setError('Đăng ký thất bại. Email có thể đã tồn tại.')
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader subtitle="Tạo tài khoản để đặt tour và theo dõi hóa đơn." title="Đăng ký" />
      <form
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={onSubmit}
      >
        {error ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            {error}
          </div>
        ) : null}
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Họ tên</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setName(e.target.value)}
            placeholder="Nguyễn Văn A"
            value={name}
          />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Số điện thoại</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0xxxxxxxxx"
            type="tel"
            value={phone}
          />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Email</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Mật khẩu</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            value={password}
          />
        </label>
        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Xác nhận mật khẩu</div>
          <input
            className={cn(
              'mt-2 h-11 w-full rounded-2xl border bg-white px-4 text-sm outline-none transition',
              passwordMismatch
                ? 'border-red-300 ring-red-400/40 focus:ring-4'
                : 'border-slate-200 ring-orange-400/40 focus:ring-4',
            )}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            value={confirmPassword}
          />
          {passwordMismatch ? <div className="mt-2 text-sm text-red-600">Mật khẩu xác nhận không khớp.</div> : null}
        </label>
        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600"
          type="submit"
        >
          Tạo tài khoản
        </button>
        <div className="text-center text-sm text-slate-600">
          Đã có tài khoản?{' '}
          <Link className="font-semibold text-blue-800 hover:underline" to="/auth/login">
            Đăng nhập
          </Link>
        </div>
      </form>
    </div>
  )
}
