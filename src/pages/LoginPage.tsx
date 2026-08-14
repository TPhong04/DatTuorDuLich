import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import { login } from '@/features/auth/auth'

function defaultAfterLogin(role: 'customer' | 'staff' | 'admin') {
  if (role === 'admin') return '/admin'
  if (role === 'staff') return '/staff'
  return '/'
}

function normalizeRedirect(raw: string | null) {
  if (!raw) return null
  if (!raw.startsWith('/')) return null
  if (raw.startsWith('//')) return null
  if (raw.startsWith('/\\')) return null
  if (raw.startsWith('/auth')) return null
  return raw
}

function canAccessPath(role: 'customer' | 'staff' | 'admin', to: string) {
  const pathname = to.split('?')[0] ?? to
  if (pathname.startsWith('/admin')) return role === 'admin'
  if (pathname.startsWith('/staff')) return role === 'admin' || role === 'staff'
  return true
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams])
  const [email, setEmail] = useState(initialEmail)
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [next, setNext] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const redirect = useMemo(() => searchParams.get('redirect'), [searchParams])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }
    setError(null)
    try {
      const res = await login({ email, password })
      const role = res.user.role
      const normalized = normalizeRedirect(redirect)
      const target = normalized && canAccessPath(role, normalized) ? normalized : defaultAfterLogin(role)
      toast.success('Đăng nhập thành công.')
      setNext(target)
      setDone(true)
    } catch (e) {
      const msg =
        typeof (e as any)?.message === 'string' && (e as any).message
          ? String((e as any).message)
          : 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
      setError(msg)
    }
  }

  if (done && next) return <Navigate replace to={next} />

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-900 px-4 py-10"
      style={{
        backgroundImage: "url('/picture/bia_dulich.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Lớp phủ tối để chữ dễ đọc trên ảnh nền */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <Link className="inline-flex flex-col items-center gap-3" to="/">
            <img
              alt="VietNam Explore"
              className="h-28 w-28 rounded-full border-4 border-white/90 object-cover shadow-xl shadow-black/30"
              src="/picture/logo4.png"
            />
            <span className="text-2xl font-extrabold tracking-tight">
              <span className="text-blue-900">VietNam</span> <span className="text-sky-400">Explore</span>
            </span>
            <span className="text-xs font-medium italic text-blue-900/90">Mỗi hành trình là một trải nghiệm</span>
          </Link>
          <p className="mt-4 text-sm text-white/80">Đăng nhập để đặt tour và quản lý booking.</p>
        </div>

        <form
          className="space-y-4 rounded-3xl border border-white/20 bg-white/95 p-6 shadow-2xl shadow-black/40 backdrop-blur-sm"
          onSubmit={onSubmit}
        >
          <div>
            <h1 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
              <span className="h-6 w-1.5 rounded-full bg-gradient-to-b from-orange-500 to-blue-800" />
              Đăng nhập
            </h1>
          </div>

          {error ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {error}
            </div>
          ) : null}

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
          <button
            className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600"
            type="submit"
          >
            Đăng nhập
          </button>
          <div className="text-center text-sm">
            <Link className="font-semibold text-blue-800 hover:underline" to={`/auth/forgot-password?email=${encodeURIComponent(email)}`}>
              Quên mật khẩu?
            </Link>
          </div>
          <div className="text-center text-sm text-slate-600">
            Chưa có tài khoản?{' '}
            <Link className="font-semibold text-blue-800 hover:underline" to="/auth/register">
              Đăng ký
            </Link>
          </div>
        </form>

        <div className="mt-6 text-center">
          <Link className="text-sm font-medium text-white/80 hover:text-white hover:underline" to="/">
            ← Về trang chủ
          </Link>
        </div>
      </div>
    </div>
  )
}
