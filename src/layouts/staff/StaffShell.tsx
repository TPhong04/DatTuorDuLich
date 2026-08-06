import { ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, ClipboardList, FileText, LayoutDashboard, LogOut } from 'lucide-react'

import logo from '@/assets/logo.png'
import { getStoredUser, logout } from '@/features/auth/auth'
import { cn } from '@/lib/utils'

type NavGroup = {
  label: string
  items: { label: string; to: string; icon: ReactNode; end?: boolean }[]
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-semibold transition-all',
    isActive
      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
      : 'text-blue-100 hover:bg-blue-700/50 hover:text-white',
  )

export default function StaffShell() {
  const location = useLocation()
  const [, setAuthVersion] = useState(0)

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((v) => v + 1)
    window.addEventListener('auth-changed', onAuthChanged)
    return () => window.removeEventListener('auth-changed', onAuthChanged)
  }, [])

  const user = getStoredUser()
  const initials = (user?.name?.trim()?.[0] ?? 'S').toUpperCase()

  const groups: NavGroup[] = [
    {
      label: 'Tổng quan',
      items: [{ label: 'Dashboard', to: '/staff', icon: <LayoutDashboard className="h-4 w-4" />, end: true }],
    },
    {
      label: 'Vận hành',
      items: [
        { label: 'Bookings', to: '/staff/bookings', icon: <ClipboardList className="h-4 w-4" /> },
        { label: 'Tours', to: '/staff/tours', icon: <BookOpen className="h-4 w-4" /> },
        { label: 'Lịch khởi hành', to: '/staff/departures', icon: <CalendarDays className="h-4 w-4" /> },
        { label: 'Tour đoàn', to: '/staff/group-tour-requests', icon: <FileText className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 text-slate-900">
      <div className="mx-auto w-full grid grid-cols-1 gap-6 px-4 py-4 lg:grid-cols-[296px_minmax(0,1fr)] 2xl:px-8 2xl:gap-8">
        <aside className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 p-5 shadow-2xl shadow-blue-900/20">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent" />

          <Link
            className="relative flex items-center gap-3 rounded-2xl p-2 text-white transition hover:bg-blue-700/40"
            to="/staff"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-white/20">
              <img alt="Logo" className="h-8 w-8 rounded-full object-contain" src={logo} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide text-white">Vận hành</div>
              <div className="text-[11px] font-medium uppercase tracking-widest text-blue-200/80">
                Staff Panel
              </div>
            </div>
          </Link>

          <div className="relative mt-5 rounded-2xl bg-blue-700/40 p-4 ring-1 ring-inset ring-white/10 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="relative h-11 w-11 overflow-hidden rounded-full ring-2 ring-orange-400 shadow-lg shadow-orange-500/20">
                {user?.avatarUrl ? (
                  <img alt="Ảnh đại diện" className="h-full w-full object-cover" src={user.avatarUrl} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-bold text-white">
                    {initials}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{user?.name ?? 'Staff'}</div>
                <div className="truncate text-xs text-blue-200/90">{user?.email ?? ''}</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                className="inline-flex h-9 items-center justify-center rounded-2xl bg-white/10 text-center text-xs font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
                to="/"
              >
                Về website
              </Link>
              <button
                className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl bg-orange-500 text-xs font-semibold text-white shadow-md shadow-orange-500/30 transition hover:bg-orange-600"
                onClick={async () => {
                  await logout().catch(() => null)
                  window.location.href = '/'
                }}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </button>
            </div>
          </div>

          <nav className="relative mt-5 space-y-5">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                  {g.label}
                </div>
                <div className="mt-2 space-y-1">
                  {g.items.map((it) => (
                    <NavLink key={it.to} className={navLinkClassName} end={it.end} to={it.to}>
                      {it.icon}
                      <span className="truncate">{it.label}</span>
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="relative mt-6 rounded-2xl bg-blue-700/30 p-3 text-xs text-blue-100 ring-1 ring-inset ring-white/10">
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300/80">Đang xem</div>
            <div className="mt-1 truncate font-mono text-[11px] text-white/90">
              {location.pathname + location.search}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

