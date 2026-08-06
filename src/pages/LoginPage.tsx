import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
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
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader subtitle="Đăng nhập để đặt tour và quản lý booking." title="Đăng nhập" />
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
    </div>
  )
}
