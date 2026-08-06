import { FormEvent, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { forgotPasswordCheck, forgotPasswordReset } from '@/features/auth/auth'

export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const toast = useToast()

  const initialEmail = useMemo(() => searchParams.get('email') ?? '', [searchParams])

  const [email, setEmail] = useState(initialEmail)
  const [step, setStep] = useState<'check' | 'reset'>('check')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onCheck = async (e: FormEvent) => {
    e.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) return
    setError(null)
    setBusy(true)
    try {
      await forgotPasswordCheck({ email: nextEmail })
      setStep('reset')
      setSent(true)
      toast.success('Email hợp lệ. Bạn có thể đặt lại mật khẩu.')
    } catch (e) {
      const msg = typeof (e as any)?.message === 'string' && (e as any).message ? String((e as any).message) : 'Sai email.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  const onReset = async (e: FormEvent) => {
    e.preventDefault()
    const nextEmail = email.trim()
    if (!nextEmail) return
    if (!password || password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirm) {
      setError('Xác nhận mật khẩu không khớp.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      await forgotPasswordReset({ email: nextEmail, password })
      toast.success('Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.')
      setDone(true)
    } catch (e) {
      const msg =
        typeof (e as any)?.message === 'string' && (e as any).message ? String((e as any).message) : 'Đặt lại mật khẩu thất bại.'
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <Navigate replace to={`/auth/login?email=${encodeURIComponent(email.trim())}`} />

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader subtitle="Nhập email để đặt lại mật khẩu." title="Quên mật khẩu" />

      <form
        className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={step === 'check' ? onCheck : onReset}
      >
        {error ? (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">{error}</div>
        ) : null}
        {sent && step === 'reset' ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Email hợp lệ. Vui lòng nhập mật khẩu mới.
          </div>
        ) : null}

        <label className="block">
          <div className="text-sm font-semibold text-slate-900">Email</div>
          <input
            className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
            disabled={step === 'reset'}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </label>

        {step === 'reset' ? (
          <>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Mật khẩu mới</div>
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
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                type="password"
                value={confirm}
              />
            </label>
          </>
        ) : null}

        <button
          className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-blue-700 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
          disabled={busy}
          type="submit"
        >
          {step === 'check' ? 'Tiếp tục' : 'Đổi mật khẩu'}
        </button>

        <div className="text-center text-sm text-slate-600">
          <Link className="font-semibold text-blue-800 hover:underline" to="/auth/login">
            Quay lại đăng nhập
          </Link>
        </div>
      </form>
    </div>
  )
}
