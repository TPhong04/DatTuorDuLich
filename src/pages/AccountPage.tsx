import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useToast } from '@/components/notifications/ToastProvider'
import PageHeader from '@/components/ui/PageHeader'
import { fetchProfile, getStoredUser, isAuthed, logout } from '@/features/auth/auth'
import {
  ctrStatusInfo, customerMyContracts, customerMyInquiries, inqStatusInfo,
  labelVehicleClass, labelVehicleType,
  type VehicleInquiry, type VehicleRentalContract,
} from '@/features/rentals/rentals'
import { fetchMyPendingReviewBookings } from '@/features/reviews/reviews'
import { resolveFileUrl } from '@/lib/api'

export default function AccountPage() {
  const authed = isAuthed()
  const [profile, setProfile] = useState(getStoredUser())
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const [pendingCount, setPendingCount] = useState(0)
  const [firstPendingSlug, setFirstPendingSlug] = useState<string | null>(null)

  const [rentalsTab, setRentalsTab] = useState<'inq' | 'ctr'>('inq')
  const [inquiries, setInquiries] = useState<VehicleInquiry[]>([])
  const [contracts, setContracts] = useState<VehicleRentalContract[]>([])
  const [loadingRentals, setLoadingRentals] = useState(false)

  if (!authed) return <Navigate replace to="/auth/login" />

  const initials = (profile?.name?.trim()?.[0] ?? 'U').toUpperCase()

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchProfile()
        .then((u) => {
          if (!alive || !u) return
          setProfile(u)
        })
        .catch(() => null),
      fetchMyPendingReviewBookings({ page: 1, pageSize: 50 })
        .then((r) => {
          if (!alive) return
          setPendingCount(r.pendingCount || 0)
          setFirstPendingSlug(r.rows[0]?.tourSlug || null)
        })
        .catch(() => null),
    ]).finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!authed) return
    let alive = true
    setLoadingRentals(true)
    Promise.allSettled([customerMyInquiries(), customerMyContracts()]).then(([ri, rc]) => {
      if (!alive) return
      if (ri.status === 'fulfilled') setInquiries(ri.value.items || [])
      if (rc.status === 'fulfilled') setContracts(rc.value.items || [])
      setLoadingRentals(false)
    })
    return () => { alive = false }
  }, [authed])

  const onLogout = async () => {
    await logout().catch(() => null)
    toast.success('Đã đăng xuất.')
    setTimeout(() => navigate('/', { replace: true }), 300)
  }

  return (
    <div className="space-y-6">
      {pendingCount > 0 ? (
        <div className="rounded-3xl border border-orange-100 bg-gradient-to-r from-blue-50 via-white to-orange-50 p-4 md:p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 text-lg text-white shadow-sm">⭐</div>
              <div>
                <div className="text-sm font-extrabold text-slate-900">
                  Bạn có <span className="bg-gradient-to-r from-blue-700 to-orange-500 bg-clip-text text-transparent">{pendingCount}</span> tour đã đi xong đang chờ đánh giá!
                </div>
                <div className="mt-1 text-xs text-slate-600">Viết đánh giá giúp cộng đồng lựa chọn tour tốt hơn. Mỗi bài đánh giá được bảo mật nghiêm ngặt và chỉ sửa được trong 7 ngày đầu.</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to="/account/bookings" className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[10px] font-extrabold uppercase text-slate-700 hover:bg-slate-50">
                Xem danh sách
              </Link>
              {firstPendingSlug ? (
                <Link to={`/tours/${encodeURIComponent(firstPendingSlug)}#tour-reviews`} className="inline-flex h-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500 px-5 text-[10px] font-extrabold uppercase text-white shadow-sm hover:brightness-110">
                  ⭐ Đánh giá ngay
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <PageHeader title="Tài khoản" />
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
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl bg-orange-500 text-xs font-semibold text-white transition hover:bg-orange-600"
                onClick={() => navigate('/account/edit')}
                type="button"
              >
                Chỉnh sửa
              </button>
              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-2xl border border-slate-200 bg-white text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                onClick={onLogout}
                type="button"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-slate-900">Thông báo của tôi</div>
          <div className="mt-2 text-sm text-slate-600">
            Xem lịch sử cập nhật booking, báo giá, chốt đơn, nhắc lịch khởi hành.
          </div>
          <Link className="mt-4 inline-flex text-sm font-semibold text-blue-800 hover:underline" to="/account/notifications">
            Đi tới thông báo của tôi →
          </Link>
        </div>
      </div>

      {/* ============ THUÊ XE CỦA TÔI ============ */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">🚗 Thuê xe của tôi</div>
            <div className="mt-1 text-xs text-slate-500">Lịch sử Yêu cầu thuê xe và Hợp đồng thuê xe (cả 2 luồng A thuê xe độc lập & Luồng B thuê kèm booking tour).</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/cho-thue-xe" className="inline-flex h-10 items-center justify-center rounded-2xl bg-indigo-600 px-4 text-[11px] font-extrabold uppercase text-white hover:bg-indigo-700">+ Tạo yêu cầu mới</Link>
            <Link to="/account/bookings" className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-extrabold uppercase text-slate-700 hover:bg-slate-50">📋 Booking của tôi</Link>
          </div>
        </div>

        <div className="mt-4 inline-flex rounded-2xl bg-slate-100 p-1 text-xs font-bold uppercase tracking-wide">
          <button type="button" onClick={() => setRentalsTab('inq')} className={"rounded-xl px-4 py-2 transition " + (rentalsTab === 'inq' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Yêu cầu thuê xe ({inquiries.length})</button>
          <button type="button" onClick={() => setRentalsTab('ctr')} className={"rounded-xl px-4 py-2 transition " + (rentalsTab === 'ctr' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700')}>Hợp đồng thuê xe ({contracts.length})</button>
        </div>

        <div className="mt-4">
          {loadingRentals ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-400">Đang tải danh sách...</div>
          ) : rentalsTab === 'inq' ? (
            inquiries.length === 0 ? (
              <EmptyRentals title="Chưa có yêu cầu thuê xe nào" desc="Bạn chưa từng gửi yêu cầu thuê xe. Nhấn nút phía trên để tạo yêu cầu đầu tiên!" />
            ) : (
              <div className="space-y-4">
                {inquiries.slice(0, 50).map((i_raw) => {
                  const i = i_raw as any
                  const status = inqStatusInfo(String(i.status || ''))
                  const pdfUrl: string | undefined = i.quotationPdfUrlPath ?? (i as any).quotationPdfDownloadUrl
                  const pdfName = pdfUrl ? `Bao-gia-${String(i.code || i.id)}.pdf` : undefined
                  const isConfirmed = String(i.status || '') === 'confirmed'
                  const isQuoted = String(i.status || '') === 'quoted'
                  const isConverted = String(i.status || '') === 'converted'
                  const inqTimeline = [
                    { key: 'pending', label: 'Chờ xử lý', done: true },
                    { key: 'confirmed', label: 'Đã xác nhận', done: isConfirmed || isQuoted || isConverted, active: isConfirmed },
                    { key: 'quoted', label: 'Đã báo giá', done: isQuoted || isConverted, active: isQuoted },
                    { key: 'converted', label: 'Đã thành HĐ', done: isConverted, active: isConverted },
                  ]
                  return (
                    <div key={i.id} className="overflow-hidden rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-shadow">
                      {isConfirmed && (
                        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-4 py-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-sm">✅</div>
                              <div className="flex-1">
                                <div className="text-sm font-extrabold text-emerald-800">Yêu cầu đã được xác nhận & tạo báo giá</div>
                                <div className="mt-1 text-[11px] text-slate-600">
                                  {i.confirmedAt && (<span>Ngày xác nhận: <b>{new Date(i.confirmedAt).toLocaleString('vi-VN')}</b> · </span>)}
                                  {i.confirmedByStaff?.fullName && (<span>Nhân viên duyệt: <b>{i.confirmedByStaff.fullName}</b></span>)}
                                </div>
                              </div>
                            </div>
                            {pdfUrl && (
                              <a href={resolveFileUrl(pdfUrl) || pdfUrl} target="_blank" rel="noopener noreferrer"
                                download={pdfName || true}
                                className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-4 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 transition">
                                📥 Tải PDF báo giá
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                        <div className="flex flex-wrap items-center gap-1 text-[10px]">
                          {inqTimeline.map((step, idx) => (
                            <div key={step.key} className="flex items-center gap-1">
                              <div className={
                                'inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 text-[9px] font-bold ' +
                                (step.done
                                  ? step.active
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white ring-emerald-300 pulseGlow'
                                    : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                                  : 'bg-white text-slate-400 ring-slate-200')
                              }>
                                {step.done ? '✓' : (idx + 1)}
                              </div>
                              <span className={
                                'font-semibold ' + (step.done ? (step.active ? 'text-emerald-700' : 'text-emerald-700') : 'text-slate-400')
                              }>{step.label}</span>
                              {idx < inqTimeline.length - 1 && (
                                <div className={'mx-1 h-px w-5 ' + (step.done ? 'bg-emerald-300' : 'bg-slate-200')}></div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-slate-600">
                            <tr>
                              <th className="px-4 py-3 font-medium">Mã</th>
                              <th className="px-4 py-3 font-medium">Xe yêu cầu</th>
                              <th className="px-4 py-3 font-medium">Nhận / Trả</th>
                              <th className="px-4 py-3 font-medium">Nơi nhận</th>
                              <th className="px-4 py-3 font-medium">Nơi trả</th>
                              <th className="px-4 py-3 font-medium">Ngày tạo</th>
                              <th className="px-4 py-3 font-medium">Trạng thái</th>
                              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-semibold text-slate-900">{i.code || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">
                                <div>{i.preferredVehicleTypeLabel || labelVehicleType(i.preferredVehicleType as any) || i.vehicleType ? labelVehicleType(i.vehicleType as any) : 'Không yêu cầu cụ thể'}</div>
                                {(i.preferredVehicleClassLabel || labelVehicleClass(i.preferredVehicleClass as any) || i.vehicleClass) ? <div className="text-[11px] text-slate-500">{i.preferredVehicleClassLabel || labelVehicleClass(i.preferredVehicleClass as any) || labelVehicleClass(i.vehicleClass as any)}</div> : null}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <div>{i.pickupDateTime ? new Date(i.pickupDateTime).toLocaleString('vi-VN') : '—'}</div>
                                <div className="text-[11px] text-slate-500">→ {i.returnDateTime ? new Date(i.returnDateTime).toLocaleString('vi-VN') : '—'}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700">{i.pickupLocation || '—'}</td>
                              <td className="px-4 py-3 text-slate-700">{i.returnLocation || '—'}</td>
                              <td className="px-4 py-3 text-slate-500 text-xs">{i.createdAt ? new Date(i.createdAt).toLocaleString('vi-VN') : '—'}</td>
                              <td className="px-4 py-3">
                                <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ' + (status.tone || 'bg-slate-100 text-slate-700 ring-slate-200')}>
                                  {status.label || String(i.status || 'unknown')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex flex-wrap justify-end gap-1.5">
                                  {pdfUrl && (
                                    <a href={resolveFileUrl(pdfUrl) || pdfUrl} target="_blank" rel="noopener noreferrer"
                                      download={pdfName || true}
                                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100">
                                      📥 Tải PDF báo giá
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : contracts.length === 0 ? (
            <EmptyRentals title="Chưa có hợp đồng thuê xe nào" desc="Khi Admin/Vận hành đã duyệt báo giá & tạo hợp đồng, bạn sẽ thấy ở đây. Gồm thông tin giá trị, lịch trình, xe gán, biên bản giao/thu & thanh toán cuối." />
          ) : (
            <div className="space-y-4">
              {contracts.slice(0, 50).map((c_raw) => {
                const c = c_raw as any
                const status = ctrStatusInfo(String(c.status || ''))
                const total = Number(c.totalGrandVnd || 0)
                const deposit = Number(c.depositPaidVnd || 0)
                const paid = Number((c as any).totalPaidVnd ?? c.paidVnd ?? 0)
                const owed = Math.max(0, total - paid)
                const s = String(c.status || '')
                const ctrTimeline = [
                  { key: 'draft', label: 'Soạn HĐ', done: s !== 'canceled' && s !== 'terminated' },
                  { key: 'pending_signature', label: 'Chờ ký', done: ['pending_signature', 'signed', 'deposit_paid', 'in_progress', 'completed'].includes(s) },
                  { key: 'signed', label: 'Đã ký', done: ['signed', 'deposit_paid', 'in_progress', 'completed'].includes(s) },
                  { key: 'deposit_paid', label: 'Đã cọc', done: ['deposit_paid', 'in_progress', 'completed'].includes(s) },
                  { key: 'in_progress', label: 'Đang thuê', done: ['in_progress', 'completed'].includes(s) },
                  { key: 'completed', label: 'Hoàn tất', done: s === 'completed' },
                ]
                return (
                  <div key={c.id} className="overflow-hidden rounded-2xl border border-slate-200 hover:border-indigo-200 hover:shadow-sm transition-shadow">
                    {/* Timeline */}
                    <div className="px-4 py-3 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex flex-wrap items-center gap-1 text-[10px] overflow-x-auto whitespace-nowrap">
                        {ctrTimeline.map((step, idx) => (
                          <div key={step.key} className="flex items-center gap-1 shrink-0">
                            <div className={
                              'inline-flex h-5 w-5 items-center justify-center rounded-full ring-1 text-[9px] font-bold ' +
                              (step.done
                                ? s === step.key
                                  ? 'bg-gradient-to-r from-indigo-600 to-blue-500 text-white ring-indigo-300 pulseGlow'
                                  : 'bg-indigo-100 text-indigo-700 ring-indigo-200'
                                : 'bg-white text-slate-400 ring-slate-200')
                            }>
                              {step.done ? '✓' : (idx + 1)}
                            </div>
                            <span className={
                              'font-semibold ' + (step.done ? (s === step.key ? 'text-indigo-700' : 'text-indigo-700') : 'text-slate-400')
                            }>{step.label}</span>
                            {idx < ctrTimeline.length - 1 && (
                              <div className={'mx-1 h-px w-4 ' + (step.done ? 'bg-indigo-300' : 'bg-slate-200')}></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-slate-600">
                          <tr>
                            <th className="px-4 py-3 font-medium">Mã HĐ</th>
                            <th className="px-4 py-3 font-medium">Khách</th>
                            <th className="px-4 py-3 font-medium">Nhận / Trả</th>
                            <th className="px-4 py-3 font-medium">Tổng giá trị</th>
                            <th className="px-4 py-3 font-medium">Đã cọc</th>
                            <th className="px-4 py-3 font-medium">Công nợ</th>
                            <th className="px-4 py-3 font-medium">Trạng thái</th>
                            <th className="px-4 py-3 font-medium">Xe gán</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="hover:bg-slate-50/60">
                            <td className="px-4 py-3 font-semibold text-slate-900">{c.code || '—'}</td>
                            <td className="px-4 py-3 text-slate-700">
                              <div className="font-medium">{c.customerName || '—'}</div>
                              <div className="text-[11px] text-slate-500">{c.customerPhone || ''}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <div>{c.pickupDateTime ? new Date(c.pickupDateTime).toLocaleString('vi-VN') : '—'}</div>
                              <div className="text-[11px] text-slate-500">→ {c.returnDateTime ? new Date(c.returnDateTime).toLocaleString('vi-VN') : '—'}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-900 text-right">{(total).toLocaleString('vi-VN')}đ</td>
                            <td className="px-4 py-3 text-slate-700 text-right">{(deposit).toLocaleString('vi-VN')}đ</td>
                            <td className={'px-4 py-3 font-semibold text-right ' + (owed > 0 ? 'text-rose-600' : 'text-emerald-700')}>
                              {owed > 0 ? owed.toLocaleString('vi-VN') + 'đ' : 'Đã đủ'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ' + (status.tone || 'bg-slate-100 text-slate-700 ring-slate-200')}>
                                {status.label || String(c.status || '')}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {(c.assignedVehicles || []).length === 0 ? <span className="text-[11px] text-slate-400 italic">Chưa gán xe</span> : null}
                                {(c.assignedVehicles || []).map((v: any) => (
                                  <span key={v?.licensePlate || v?.id || Math.random().toString(36).slice(2)} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                    {v?.licensePlate || v?.plateNumber || v?.id || '—'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyRentals({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center">
      <div className="text-sm font-semibold text-slate-700">{title}</div>
      <p className="mt-1 text-xs text-slate-500 max-w-lg mx-auto">{desc}</p>
    </div>
  )
}

