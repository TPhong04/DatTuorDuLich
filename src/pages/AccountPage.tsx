import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { fetchProfile, getStoredUser, isAuthed, logout } from '@/features/auth/auth'

export default function AccountPage() {
  const authed = isAuthed()
  const [profile, setProfile] = useState(getStoredUser())
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  if (!authed) return <Navigate replace to="/auth/login" />

  const initials = (profile?.name?.trim()?.[0] ?? 'U').toUpperCase()

  useEffect(() => {
    let alive = true
    fetchProfile()
      .then((u) => {
        if (!alive || !u) return
        setProfile(u)
      })
      .catch(() => null)
      .finally(() => {
        if (!alive) return
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  const onLogout = async () => {
    await logout().catch(() => null)
    toast.success('Đã đăng xuất.')
    setTimeout(() => navigate('/', { replace: true }), 300)
  }

  return (
    <div className="space-y-6">
      <PageHeader subtitle="Quản lý thông tin cá nhân, booking và hóa đơn." title="Tài khoản" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm font-semibold text-slate-900">Hồ sơ cá nhân</div>
            <div className="text-xs font-semibold text-slate-500">{loading ? 'Đang tải...' : ''}</div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-orange-500">
              {profile?.avatarUrl ? (
                <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={profile.avatarUrl} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 text-xl font-extrabold text-white">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{profile?.name ?? 'Tài khoản'}</div>
              <div className="truncate text-sm text-slate-600">{profile?.email ?? ''}</div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Họ tên</div>
              <div className="mt-1 text-sm text-slate-700">{profile?.name ?? '-'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Số điện thoại</div>
              <div className="mt-1 text-sm text-slate-700">{profile?.phone ?? '-'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Giới tính</div>
              <div className="mt-1 text-sm text-slate-700">
                {profile?.gender === 'male' ? 'Nam' : profile?.gender === 'female' ? 'Nữ' : profile?.gender === 'other' ? 'Khác' : '-'}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">Ngày sinh</div>
                <div className="mt-1 text-sm text-slate-700">{(profile as any)?.dateOfBirth ?? '-'}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-semibold text-slate-900">CCCD/CMND</div>
                <div className="mt-1 text-sm text-slate-700">{(profile as any)?.citizenId ?? '-'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Passport (nếu có)</div>
              <div className="mt-1 text-sm text-slate-700">{(profile as any)?.passportNumber ?? '-'}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Địa chỉ</div>
              <div className="mt-1 text-sm text-slate-700">
                {[
                  (profile as any)?.address?.line1 ?? '',
                  (profile as any)?.address?.ward ?? '',
                  (profile as any)?.address?.district ?? '',
                  (profile as any)?.address?.province ?? '',
                ]
                  .filter(Boolean)
                  .join(', ') || '-'}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Liên hệ khẩn cấp</div>
              <div className="mt-1 space-y-1 text-sm text-slate-700">
                <div>{(profile as any)?.emergencyContact?.name ?? '-'}</div>
                <div>{(profile as any)?.emergencyContact?.phone ?? '-'}</div>
                <div>{(profile as any)?.emergencyContact?.relation ?? '-'}</div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Ăn kiêng / dị ứng</div>
              <div className="mt-1 text-sm text-slate-700">{(profile as any)?.dietary ?? '-'}</div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-sm font-semibold text-slate-900">Sức khỏe / yêu cầu đặc biệt</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{(profile as any)?.medicalNotes ?? '-'}</div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600"
                onClick={() => navigate('/account/edit')}
                type="button"
              >
                Chỉnh sửa
              </button>
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                onClick={onLogout}
                type="button"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Booking</div>
          <div className="mt-2 text-sm text-slate-600">
            Xem lịch sử booking, trạng thái xác nhận, thanh toán mô phỏng.
          </div>
          <Link className="mt-4 inline-flex text-sm font-semibold text-blue-800 hover:underline" to="/account/bookings">
            Đi tới booking của tôi
          </Link>
        </div>
      </div>
    </div>
  )
}
