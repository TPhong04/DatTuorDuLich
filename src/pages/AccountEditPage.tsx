import { FormEvent, useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { fetchProfile, getStoredUser, isAuthed, updateProfile, uploadAvatar } from '@/features/auth/auth'
import { cn } from '@/lib/utils'

export default function AccountEditPage() {
  const authed = isAuthed()
  const [profile, setProfile] = useState(getStoredUser())
  const toast = useToast()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)

  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>((profile?.gender as any) ?? '')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [dateOfBirth, setDateOfBirth] = useState((profile as any)?.dateOfBirth ?? '')
  const [citizenId, setCitizenId] = useState((profile as any)?.citizenId ?? '')
  const [passportNumber, setPassportNumber] = useState((profile as any)?.passportNumber ?? '')

  const [addressProvince, setAddressProvince] = useState(((profile as any)?.address?.province as any) ?? '')
  const [addressDistrict, setAddressDistrict] = useState(((profile as any)?.address?.district as any) ?? '')
  const [addressWard, setAddressWard] = useState(((profile as any)?.address?.ward as any) ?? '')
  const [addressLine1, setAddressLine1] = useState(((profile as any)?.address?.line1 as any) ?? '')

  const [emergencyName, setEmergencyName] = useState(((profile as any)?.emergencyContact?.name as any) ?? '')
  const [emergencyPhone, setEmergencyPhone] = useState(((profile as any)?.emergencyContact?.phone as any) ?? '')
  const [emergencyRelation, setEmergencyRelation] = useState(((profile as any)?.emergencyContact?.relation as any) ?? '')

  const [dietary, setDietary] = useState((profile as any)?.dietary ?? '')
  const [medicalNotes, setMedicalNotes] = useState((profile as any)?.medicalNotes ?? '')

  if (!authed) return <Navigate replace to="/auth/login" />

  const initials = (profile?.name?.trim()?.[0] ?? 'U').toUpperCase()

  useEffect(() => {
    if (!avatarFile) return
    const url = URL.createObjectURL(avatarFile)
    setAvatarPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [avatarFile])

  useEffect(() => {
    let alive = true
    fetchProfile()
      .then((u) => {
        if (!alive || !u) return
        setProfile(u)
        setName(u.name ?? '')
        setPhone((u.phone ?? '') as any)
        setGender(((u.gender ?? '') as any) ?? '')
        setAvatarFile(null)
        setAvatarPreviewUrl(null)
        setDateOfBirth(((u as any)?.dateOfBirth ?? '') as any)
        setCitizenId(((u as any)?.citizenId ?? '') as any)
        setPassportNumber(((u as any)?.passportNumber ?? '') as any)
        setAddressProvince((((u as any)?.address?.province ?? '') as any) ?? '')
        setAddressDistrict((((u as any)?.address?.district ?? '') as any) ?? '')
        setAddressWard((((u as any)?.address?.ward ?? '') as any) ?? '')
        setAddressLine1((((u as any)?.address?.line1 ?? '') as any) ?? '')
        setEmergencyName((((u as any)?.emergencyContact?.name ?? '') as any) ?? '')
        setEmergencyPhone((((u as any)?.emergencyContact?.phone ?? '') as any) ?? '')
        setEmergencyRelation((((u as any)?.emergencyContact?.relation ?? '') as any) ?? '')
        setDietary(((u as any)?.dietary ?? '') as any)
        setMedicalNotes(((u as any)?.medicalNotes ?? '') as any)
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

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    try {
      if (avatarFile) {
        setAvatarBusy(true)
        const uploaded = await uploadAvatar(avatarFile)
        setProfile(uploaded.user)
        setAvatarFile(null)
        setAvatarPreviewUrl(null)
        toast.success('Đã cập nhật ảnh đại diện.')
      }

      const updated = await updateProfile({
        name: name.trim() || undefined,
        phone: phone.trim() ? phone.trim() : null,
        gender: gender ? gender : null,
        dateOfBirth: dateOfBirth.trim() ? dateOfBirth.trim() : null,
        address: {
          province: addressProvince.trim() ? addressProvince.trim() : null,
          district: addressDistrict.trim() ? addressDistrict.trim() : null,
          ward: addressWard.trim() ? addressWard.trim() : null,
          line1: addressLine1.trim() ? addressLine1.trim() : null,
        },
        emergencyContact: {
          name: emergencyName.trim() ? emergencyName.trim() : null,
          phone: emergencyPhone.trim() ? emergencyPhone.trim() : null,
          relation: emergencyRelation.trim() ? emergencyRelation.trim() : null,
        },
        citizenId: citizenId.trim() ? citizenId.trim() : null,
        passportNumber: passportNumber.trim() ? passportNumber.trim() : null,
        dietary: dietary.trim() ? dietary.trim() : null,
        medicalNotes: medicalNotes.trim() ? medicalNotes.trim() : null,
      })

      setProfile(updated)
      toast.success('Cập nhật hồ sơ thành công.')
      navigate('/account', { replace: true })
    } catch {
      toast.error('Cập nhật hồ sơ thất bại. Vui lòng thử lại.')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        subtitle="Cập nhật thông tin cá nhân để đặt tour nhanh hơn."
        title="Chỉnh sửa tài khoản"
        right={
          <button
            className="inline-flex rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
            onClick={() => navigate('/account', { replace: true })}
            type="button"
          >
            Quay lại
          </button>
        }
      />

      <form className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSave}>
        <div className="flex items-start justify-between gap-4">
          <div className="text-sm font-semibold text-slate-900">Hồ sơ cá nhân</div>
          <div className="text-xs font-semibold text-slate-500">{loading ? 'Đang tải...' : ''}</div>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-orange-500">
            {avatarPreviewUrl ? (
              <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={avatarPreviewUrl} />
            ) : profile?.avatarUrl ? (
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
            <div className="mt-2">
              <label
                className={cn(
                  'inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50',
                  (loading || avatarBusy) && 'pointer-events-none opacity-60',
                )}
              >
                <input
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={loading || avatarBusy}
                  onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                  type="file"
                />
                {avatarBusy ? 'Đang xử lý...' : profile?.avatarUrl ? 'Thay ảnh' : 'Chọn ảnh'}
              </label>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
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
              placeholder="09xxxxxxxx"
              value={phone}
            />
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Giới tính</div>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setGender(e.target.value as any)}
              value={gender}
            >
              <option value="">Chưa chọn</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
              <option value="other">Khác</option>
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Ngày sinh</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setDateOfBirth(e.target.value)}
                type="date"
                value={dateOfBirth}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">CCCD/CMND</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setCitizenId(e.target.value)}
                placeholder="Số giấy tờ"
                value={citizenId}
              />
            </label>
          </div>

          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Passport (nếu có)</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setPassportNumber(e.target.value)}
              placeholder="Passport number"
              value={passportNumber}
            />
          </label>

          <div className="pt-2 text-sm font-semibold text-slate-900">Địa chỉ</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Tỉnh/Thành</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setAddressProvince(e.target.value)}
                placeholder="VD: TP. Hồ Chí Minh"
                value={addressProvince}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Quận/Huyện</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setAddressDistrict(e.target.value)}
                placeholder="VD: Quận 1"
                value={addressDistrict}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Phường/Xã</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setAddressWard(e.target.value)}
                placeholder="VD: Phường Bến Nghé"
                value={addressWard}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Địa chỉ chi tiết</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Số nhà, đường..."
                value={addressLine1}
              />
            </label>
          </div>

          <div className="pt-2 text-sm font-semibold text-slate-900">Liên hệ khẩn cấp</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Họ tên</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Người thân / bạn bè"
                value={emergencyName}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Số điện thoại</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="09xxxxxxxx"
                value={emergencyPhone}
              />
            </label>
            <label className="block">
              <div className="text-sm font-semibold text-slate-900">Mối quan hệ</div>
              <input
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                onChange={(e) => setEmergencyRelation(e.target.value)}
                placeholder="VD: Anh/Chị/Em, Bạn..."
                value={emergencyRelation}
              />
            </label>
          </div>

          <div className="pt-2 text-sm font-semibold text-slate-900">Ghi chú nghiệp vụ</div>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Ăn kiêng / dị ứng</div>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setDietary(e.target.value)}
              placeholder="VD: Ăn chay, dị ứng hải sản..."
              value={dietary}
            />
          </label>
          <label className="block">
            <div className="text-sm font-semibold text-slate-900">Sức khỏe / yêu cầu đặc biệt</div>
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-orange-400/40 focus:ring-4"
              onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder="VD: bệnh lý, hạn chế vận động, yêu cầu phòng..."
              value={medicalNotes}
            />
          </label>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              className={cn(
                'inline-flex h-11 w-full items-center justify-center rounded-2xl bg-orange-500 text-sm font-semibold text-white transition hover:bg-orange-600',
                (loading || avatarBusy) && 'pointer-events-none opacity-60',
              )}
              type="submit"
            >
              Lưu thay đổi
            </button>
            <button
              className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              onClick={() => navigate('/account', { replace: true })}
              type="button"
            >
              Hủy
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

