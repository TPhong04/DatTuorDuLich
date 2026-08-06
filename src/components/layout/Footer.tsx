import { Link } from 'react-router-dom'

import logo from '@/assets/logo.png'
import { usePublicSettings } from '@/features/settings/SettingsProvider'

export default function Footer() {
  const { settings } = usePublicSettings()

  const companyName = typeof (settings?.company as any)?.name === 'string' ? ((settings?.company as any).name as string) : 'Đặt Tour Du Lịch'
  const slogan = typeof (settings?.company as any)?.slogan === 'string' ? ((settings?.company as any).slogan as string) : 'Hệ thống đặt tour cho công ty du lịch'
  const hotline = typeof (settings?.company as any)?.hotline === 'string' ? ((settings?.company as any).hotline as string) : '1800 6700'
  const email =
    typeof (settings?.company as any)?.email === 'string' ? ((settings?.company as any).email as string) : 'support@travel.vn'
  const address =
    typeof (settings?.company as any)?.address === 'string'
      ? ((settings?.company as any).address as string)
      : 'TP. Hồ Chí Minh, Việt Nam'
  const logoUrl =
    typeof (settings?.branding as any)?.logoFooterUrl === 'string' && (settings?.branding as any).logoFooterUrl
      ? ((settings?.branding as any).logoFooterUrl as string)
      : logo
  const telHref = `tel:${hotline.replace(/[^\d+]/g, '')}`

  return (
    <footer className="border-t border-slate-200 bg-slate-950 text-slate-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-12">
        <div className="space-y-4 md:col-span-5">
          <div className="flex items-center gap-3">
            <img alt="Logo" className="h-10 w-10 rounded-full bg-white object-contain p-1" src={logoUrl} />
            <div>
              <div className="text-base font-semibold text-white">{companyName}</div>
              <div className="text-sm text-slate-400">{slogan}</div>
            </div>
          </div>
          <div className="text-sm leading-7 text-slate-300">
            <a className="hover:text-white" href={telHref}>
              {`Hotline: ${hotline}`}
            </a>
            <br />
            <a className="hover:text-white" href={`mailto:${email}`}>
              {`Email: ${email}`}
            </a>
            <br />
            {`Địa chỉ: ${address}`}
          </div>
          <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs text-slate-200">
            Xanh dương chủ đạo • Cam nổi bật • Giao diện theo phong cách hiện đại
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm font-semibold text-white">Tour</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <Link className="block hover:text-white" to="/tours">
              Tour trong nước
            </Link>
            <Link className="block hover:text-white" to="/group-tour">
              Tour đoàn
            </Link>
            <Link className="block hover:text-white" to="/account/bookings">
              Booking của tôi
            </Link>
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="text-sm font-semibold text-white">Dịch vụ</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <Link className="block hover:text-white" to="/services/visa">
              Visa
            </Link>
            <Link className="block hover:text-white" to="/services/flight-ticket">
              Vé máy bay
            </Link>
            <Link className="block hover:text-white" to="/services/car-rental">
              Thuê xe
            </Link>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="text-sm font-semibold text-white">Hỗ trợ</div>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <Link className="block hover:text-white" to="/news">
              Tin tức
            </Link>
            <Link className="block hover:text-white" to="/contact">
              Liên hệ
            </Link>
            <Link className="block hover:text-white" to="/auth/login">
              Đăng nhập
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>{`© ${new Date().getFullYear()} ${companyName}. All rights reserved.`}</div>
          <div className="flex gap-4">
            <Link className="hover:text-slate-200" to="/terms">
              Điều khoản
            </Link>
            <Link className="hover:text-slate-200" to="/policy/cancel">
              Chính sách hủy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

