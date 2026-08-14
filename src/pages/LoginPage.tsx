import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { login, totpLoginStep2 } from '@/features/auth/auth'
import type { LoginStep1TfaPending } from '@/features/auth/auth'

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

  const [tfaPending, setTfaPending] = useState<LoginStep1TfaPending | null>(null)
  const [tfaCode, setTfaCode] = useState('')
  const [tfaError, setTfaError] = useState<string | null>(null)
  const [tfaSubmitting, setTfaSubmitting] = useState(false)

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
      if (res && (res as LoginStep1TfaPending).totpRequired) {
        setTfaPending(res as LoginStep1TfaPending)
        setTfaCode('')
        setTfaError(null)
        return
      }
      const success = res as { user: { role: 'customer' | 'staff' | 'admin' } }
      const role = success.user.role
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

  const onStep2Submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!tfaPending) return
    const clean = tfaCode.replace(/\s+/g, '').toUpperCase()
    if (clean.length < 6) {
      setTfaError('Vui lòng nhập mã 6 chữ số trên Google Authenticator hoặc mã dự phòng 13 ký tự (XXXXXX-XXXXXX).')
      return
    }
    setTfaSubmitting(true)
    setTfaError(null)
    try {
      const res = await totpLoginStep2({ stepToken: tfaPending.stepToken, code: clean })
      const role = res.user.role
      const normalized = normalizeRedirect(redirect)
      const target = normalized && canAccessPath(role, normalized) ? normalized : defaultAfterLogin(role)
      toast.success('Xác thực 2 yếu tố thành công.')
      setNext(target)
      setDone(true)
    } catch (e) {
      const msg =
        typeof (e as any)?.message === 'string' && (e as any).message
          ? String((e as any).message)
          : 'Mã 2FA không hợp lệ, vui lòng kiểm tra lại Google Authenticator hoặc dùng mã dự phòng.'
      setTfaError(msg)
    } finally {
      setTfaSubmitting(false)
    }
  }

  if (done && next) return <Navigate replace to={next} />

  if (tfaPending) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="Xác thực 2 yếu tố" subtitle={`Nhập mã OTP Google Authenticator cho tài khoản ${tfaPending.user.email}`} />
        <form
          className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={onStep2Submit}
        >
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Tài khoản của bạn được bảo vệ bằng 2 yếu tố (TOTP Google Authenticator). Vui lòng nhập 6 chữ số hiện tại trên App, hoặc nhập 1 trong 6 mã dự phòng bạn đã lưu khi bật 2FA.
          </div>
          {tfaError ? (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              {tfaError}
            </div>
          ) : null}
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Mã OTP / Mã dự phòng</div>
            <input
              autoComplete="one-time-code"
              className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-center font-mono text-2xl font-semibold tracking-[0.5em] outline-none ring-orange-400/40 focus:ring-4"
              inputMode="text"
              onChange={(e) => setTfaCode(e.target.value)}
              placeholder="000 000"
              value={tfaCode}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={tfaSubmitting}
              onClick={() => {
                setTfaPending(null)
                setTfaCode('')
                setTfaError(null)
              }}
              type="button"
            >
              ← Quay lại đăng nhập
            </button>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70"
              disabled={tfaSubmitting}
              type="submit"
            >
              {tfaSubmitting ? 'Đang xác thực…' : 'Xác thực →'}
            </button>
          </div>
          <div className="text-center text-xs text-slate-500">
            Mất điện thoại? Dùng <span className="font-semibold text-slate-700">mã dự phòng</span> 13 ký tự (ABC123-DEF456) đã sao lưu lúc bật 2FA.
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Đăng nhập" />
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
