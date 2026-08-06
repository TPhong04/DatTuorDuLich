import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Menu, Search, X } from 'lucide-react'

import logo from '@/assets/logo.png'
import { getStoredUser } from '@/features/auth/auth'
import { getStoredAccessToken } from '@/features/auth/auth.storage'
import { usePublicSettings } from '@/features/settings/SettingsProvider'
import { cn } from '@/lib/utils'

type NavItem =
  | { label: string; to: string }
  | { label: string; items: { label: string; to: string }[] }

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-full px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-orange-500 text-white'
      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
  )

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [q, setQ] = useState('')
  const [, setAuthVersion] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const { settings } = usePublicSettings()

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((v) => v + 1)
    window.addEventListener('auth-changed', onAuthChanged)
    return () => window.removeEventListener('auth-changed', onAuthChanged)
  }, [])

  const authed = Boolean(getStoredAccessToken())
  const user = getStoredUser()
  const initials = (user?.name?.trim()?.[0] ?? 'U').toUpperCase()

  const companyName = typeof (settings?.company as any)?.name === 'string' ? ((settings?.company as any).name as string) : 'Đặt Tour Du Lịch'
  const slogan = typeof (settings?.company as any)?.slogan === 'string' ? ((settings?.company as any).slogan as string) : 'Travel Booking System'
  const logoUrl =
    typeof (settings?.branding as any)?.logoHeaderUrl === 'string' && (settings?.branding as any).logoHeaderUrl
      ? ((settings?.branding as any).logoHeaderUrl as string)
      : logo

  const navItems = useMemo<NavItem[]>(
    () => [
      { label: 'Trang chủ', to: '/' },
      {
        label: 'Dịch vụ',
        items: [
          { label: 'Visa', to: '/services/visa' },
          { label: 'Vé máy bay', to: '/services/flight-ticket' },
          { label: 'Thuê xe', to: '/services/car-rental' },
        ],
      },
      { label: 'Tin tức', to: '/news' },
      { label: 'Liên hệ', to: '/contact' },
    ],
    [],
  )

  const categoryItems = useMemo(
    () => [
      { label: 'Tour mùa', to: '/tours?tag=season' },
      { label: 'Tour xe', to: '/tours?transport=bus' },
      { label: 'Tour bay', to: '/tours?transport=flight' },
      { label: 'Tour mới', to: '/tours?tag=new' },
      { label: 'Tour trong nước', to: '/tours' },
      { label: 'Tour đoàn', to: '/group-tour' },
      { label: 'Visa', to: '/services/visa' },
      { label: 'Vé máy bay', to: '/services/flight-ticket' },
      { label: 'Thuê xe', to: '/services/car-rental' },
      { label: 'Lịch KH', to: '/tours?view=departures' },
    ],
    [],
  )

  const activeCategoryTo = useMemo(() => {
    const currentPathname = location.pathname
    const currentParams = new URLSearchParams(location.search)

    let bestTo: string | null = null
    let bestScore = -1

    for (const item of categoryItems) {
      const [path, search = ''] = item.to.split('?')
      if (path !== currentPathname) continue

      const itemParams = new URLSearchParams(search)

      let ok = true
      let score = 0
      for (const [k, v] of itemParams.entries()) {
        if (currentParams.get(k) !== v) {
          ok = false
          break
        }
        score += 1
      }

      if (!ok) continue
      if (score > bestScore) {
        bestScore = score
        bestTo = item.to
      }
    }

    return bestTo
  }, [categoryItems, location.pathname, location.search])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const next = q.trim()
    if (!next) return
    navigate(`/tours?q=${encodeURIComponent(next)}`)
    setMobileOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link className="flex items-center gap-2" to="/">
            <img alt="Logo" className="h-9 w-9 rounded-full object-contain" src={logoUrl} />
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">{companyName}</div>
              <div className="text-xs text-slate-500">{slogan}</div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              if ('to' in item) {
                return (
                  <NavLink key={item.to} className={navLinkClassName} to={item.to}>
                    {item.label}
                  </NavLink>
                )
              }

              return (
                <div key={item.label} className="group relative">
                  <button
                    className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    type="button"
                  >
                    <span>{item.label}</span>
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                  </button>
                  <div className="invisible absolute left-0 top-full mt-2 min-w-52 rounded-2xl border border-slate-200 bg-white p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    {item.items.map((sub) => (
                      <NavLink
                        key={sub.to}
                        className={({ isActive }) =>
                          cn(
                            'block rounded-xl px-3 py-2 text-sm transition-colors',
                            isActive
                              ? 'bg-orange-50 text-orange-800'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                          )
                        }
                        to={sub.to}
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            })}
          </nav>

          <form className="hidden flex-1 items-center justify-center px-2 lg:flex" onSubmit={onSearch}>
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="h-11 w-full rounded-full border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-orange-400/40 transition focus:ring-4"
                onChange={(e) => setQ(e.target.value)}
                placeholder="Bạn muốn tìm tour..."
                value={q}
              />
            </div>
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            {authed ? (
              <Link className="inline-flex items-center" to="/account">
                <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-orange-500">
                  {user?.avatarUrl ? (
                    <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={user.avatarUrl} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 text-sm font-bold text-white">
                      {initials}
                    </div>
                  )}
                </div>
              </Link>
            ) : (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    isActive ? 'bg-orange-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600',
                  )
                }
                to="/auth/login"
              >
                Tài khoản
              </NavLink>
            )}
          </div>

          <button
            aria-label={mobileOpen ? 'Đóng menu' : 'Mở menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50 lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            type="button"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-blue-900">
          <div className="mx-auto max-w-6xl px-2">
            <div className="flex items-center gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryItems.map((item) => {
                const active = item.to === activeCategoryTo
                return (
                  <Link
                    key={item.to}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-white/90 transition',
                      'hover:bg-white/10 hover:text-white',
                      active && 'bg-orange-500 text-white hover:bg-orange-500',
                    )}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>

        <div className={cn('border-t border-slate-200 bg-white lg:hidden', !mobileOpen && 'hidden')}>
          <div className="mx-auto max-w-6xl space-y-2 px-4 py-4">
            <form className="flex items-center gap-2 rounded-2xl bg-slate-50 p-2" onSubmit={onSearch}>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-orange-400/40 focus:ring-4"
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Tìm tour..."
                  value={q}
                />
              </div>
              <button
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white"
                type="submit"
              >
                Tìm
              </button>
            </form>

            {navItems.map((item) => {
              if ('to' in item) {
                return (
                  <NavLink
                    key={item.to}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                        isActive ? 'bg-orange-500 text-white' : 'bg-slate-50 text-slate-900',
                      )
                    }
                    onClick={() => setMobileOpen(false)}
                    to={item.to}
                  >
                    {item.label}
                  </NavLink>
                )
              }

              return (
                <div key={item.label} className="rounded-2xl bg-slate-50 p-2">
                  <div className="px-3 py-2 text-sm font-semibold text-slate-900">{item.label}</div>
                  <div className="space-y-1">
                    {item.items.map((sub) => (
                      <NavLink
                        key={sub.to}
                        className={({ isActive }) =>
                          cn(
                            'block rounded-xl px-3 py-2 text-sm transition-colors',
                            isActive ? 'bg-orange-100 text-orange-900' : 'text-slate-700',
                          )
                        }
                        onClick={() => setMobileOpen(false)}
                        to={sub.to}
                      >
                        {sub.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              )
            })}

            {authed ? (
              <Link
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                onClick={() => setMobileOpen(false)}
                to="/account"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-full ring-2 ring-orange-500">
                    {user?.avatarUrl ? (
                      <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={user.avatarUrl} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-700 to-blue-900 text-sm font-bold text-white">
                        {initials}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">{user?.name ?? 'Tài khoản'}</div>
                    <div className="truncate text-xs text-slate-600">{user?.email ?? ''}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-blue-800">Hồ sơ</div>
              </Link>
            ) : (
              <div className="pt-2">
                <NavLink
                  className="block rounded-2xl bg-orange-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-orange-600"
                  onClick={() => setMobileOpen(false)}
                  to="/auth/login"
                >
                  Tài khoản
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
