import { Link } from 'react-router-dom'

import logo from '@/assets/logo.png'
import { usePublicSettings } from '@/features/settings/SettingsProvider'

const _gradText = 'bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-sky-400 to-orange-400'
const _gradRing = 'bg-gradient-to-r from-blue-700 via-blue-600 to-orange-500'
const _linkBase =
  'relative inline-flex w-full items-center gap-2 rounded-md px-1 py-1 -mx-1 text-slate-300 transition-all duration-200 ease-out will-change-transform hover:text-white active:scale-[0.97] active:ring-2 active:ring-orange-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50'
const _linkAfter =
  'after:absolute after:inset-x-1 after:-bottom-0.5 after:h-[2px] after:rounded-full after:bg-gradient-to-r after:from-blue-500 after:via-sky-400 after:to-orange-500 after:origin-left after:scale-x-0 after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100'

export default function Footer() {
  const { settings } = usePublicSettings()

  const companyName = typeof (settings?.company as any)?.name === 'string' ? ((settings?.company as any).name as string) : 'Đặt Tour Du Lịch'
  const slogan = typeof (settings?.company as any)?.slogan === 'string' ? ((settings?.company as any).slogan as string) : 'Mỗi hành trình là một trải nghiệm'
  const hotline = typeof (settings?.company as any)?.hotline === 'string' ? ((settings?.company as any).hotline as string) : '1800 6700'
  const email =
    typeof (settings?.company as any)?.email === 'string' ? ((settings?.company as any).email as string) : 'vietnamexplorer@gmail.com'
  const address =
    typeof (settings?.company as any)?.address === 'string'
      ? ((settings?.company as any).address as string)
      : 'Trường Cao Đẳng Viễn Đông, Lô 2, Công viên phần mềm Quang Trung, Phường Trung Mỹ Tây, TP.HCM, Việt Nam'
  const logoUrl =
    typeof (settings?.branding as any)?.logoFooterUrl === 'string' && (settings?.branding as any).logoFooterUrl
      ? ((settings?.branding as any).logoFooterUrl as string)
      : logo
  const telHref = `tel:${hotline.replace(/[^\d+]/g, '')}`

  return (
    <footer className="relative bg-slate-950 text-slate-200 overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 ${_gradRing} shadow-[0_0_20px_rgba(249,115,22,0.25)]`} />
      <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-16 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

      <div className="relative mx-auto grid w-full max-w-[1680px] gap-10 px-4 py-12 2xl:px-6 md:grid-cols-12">
        <div className="space-y-4 md:col-span-5">
          <div className="flex items-center gap-3">
            <div className={`relative rounded-full p-[2px] ${_gradRing} shadow-lg shadow-blue-900/40`}>
              <img alt="Logo" className="h-10 w-10 rounded-full bg-white object-contain p-1" src={logoUrl} />
            </div>
            <div>
              <div className={`text-base font-bold tracking-tight ${_gradText}`}>{companyName}</div>
              <div className="text-sm text-slate-400">{slogan}</div>
            </div>
          </div>
          <div className="text-sm leading-7 space-y-1">
            <a
              className={`group inline-flex items-center gap-2 rounded-md px-1 py-1 -mx-1 text-slate-300 transition-all duration-200 hover:translate-x-[2px] active:scale-[0.97] active:ring-2 active:ring-orange-400/40`}
              href={telHref}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-600/30 to-orange-500/30 ring-1 ring-white/10 text-xs">
                ☎
              </span>
              <span className="group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:via-sky-400 group-hover:to-orange-400">
                {`Hotline: ${hotline}`}
              </span>
            </a>
            <a
              className={`group inline-flex items-center gap-2 rounded-md px-1 py-1 -mx-1 text-slate-300 transition-all duration-200 hover:translate-x-[2px] active:scale-[0.97] active:ring-2 active:ring-orange-400/40`}
              href={`mailto:${email}`}
            >
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-600/30 to-orange-500/30 ring-1 ring-white/10 text-xs">
                ✉
              </span>
              <span className="group-hover:bg-clip-text group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-blue-400 group-hover:via-sky-400 group-hover:to-orange-400">
                {`Email: ${email}`}
              </span>
            </a>
            <div className={`group inline-flex items-center gap-2 px-1 -mx-1 text-slate-300`}>
              <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-600/30 to-orange-500/30 ring-1 ring-white/10 text-xs">
                📍
              </span>
              <span>{`Địa chỉ: ${address}`}</span>
            </div>
          </div>
          
        </div>

        <div className="md:col-span-2">
          <div className="relative pb-2 text-sm font-bold uppercase tracking-wider">
            <span className={_gradText}>Tour</span>
            <span className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full ${_gradRing}`} />
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/tours">
              <span className="text-slate-500 opacity-0 -ml-3 transition-all duration-200 group-hover:opacity-100">›</span>
              Tour trong nước
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/group-tour">
              Tour đoàn
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/account/bookings">
              Booking của tôi
            </Link>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="relative pb-2 text-sm font-bold uppercase tracking-wider">
            <span className={_gradText}>Dịch vụ</span>
            <span className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full ${_gradRing}`} />
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/services/visa">
              Visa
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/services/flight-ticket">
              Vé máy bay
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/services/car-rental">
              Thuê xe
            </Link>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="relative pb-2 text-sm font-bold uppercase tracking-wider">
            <span className={_gradText}>Hỗ trợ</span>
            <span className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full ${_gradRing}`} />
          </div>
          <div className="mt-4 space-y-1.5 text-sm">
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/news">
              Tin tức
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/contact">
              Liên hệ
            </Link>
            <Link className={`${_linkBase} ${_linkAfter} hover:translate-x-[2px]`} to="/auth/login">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/10 backdrop-blur-sm bg-slate-950/60">
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-2 px-4 py-5 text-xs text-slate-400 2xl:px-6 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex items-center gap-2">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${_gradRing}`} />
            {`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}
          </div>
          <div className="flex gap-5">
            <Link
              className={`group inline-flex items-center gap-1.5 rounded-md px-1 py-1 -mx-1 transition-all duration-200 hover:translate-y-[-1px] active:scale-[0.97] hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-blue-400 hover:via-sky-400 hover:to-orange-400`}
              to="/terms"
            >
              Điều khoản
              <span className="inline-block h-[1px] w-full bg-gradient-to-r from-blue-500 via-sky-400 to-orange-500 absolute inset-x-1 -bottom-0.5 origin-left scale-x-0 transition-transform duration-200 group-hover:scale-x-100" />
            </Link>
            <Link
              className={`group inline-flex items-center gap-1.5 rounded-md px-1 py-1 -mx-1 transition-all duration-200 hover:translate-y-[-1px] active:scale-[0.97] hover:bg-clip-text hover:text-transparent hover:bg-gradient-to-r hover:from-blue-400 hover:via-sky-400 hover:to-orange-400`}
              to="/policy/cancel"
            >
              Chính sách hủy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

