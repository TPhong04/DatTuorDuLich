import { ReactNode, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  Car,
  ClipboardList,
  FileText,
  FolderCog,
  Home,
  Key,
  LayoutDashboard,
  LogOut,
  MessageSquareHeart,
  ShieldCheck,
  Users,
} from 'lucide-react'

import logo from '@/assets/logo.png'
import NotificationBell from '@/components/notifications/NotificationBell'
import { getStoredUser, logout } from '@/features/auth/auth'
import { cn } from '@/lib/utils'

type NavGroup = {
  label: string
  items: { label: string; to: string; icon: ReactNode; end?: boolean }[]
}

const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-2.5 rounded-2xl px-2.5 py-2 text-[13px] font-semibold transition-all',
    isActive
      ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
      : 'text-blue-100 hover:bg-blue-700/50 hover:text-white',
  )

export default function AdminShell() {
  const [, setAuthVersion] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((v) => v + 1)
    window.addEventListener('auth-changed', onAuthChanged)
    return () => window.removeEventListener('auth-changed', onAuthChanged)
  }, [])

  const user = getStoredUser()

  useEffect(() => {
    if (!user) return
    if (user.role === 'staff') {
      navigate('/staff', { replace: true })
      return
    }
    if (user.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  const groups: NavGroup[] = [
    {
      label: 'Tổng quan',
      items: [
        { label: 'Dashboard', to: '/admin', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
        { label: 'Thông báo', to: '/admin/notifications', icon: <Bell className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Sản phẩm',
      items: [
        { label: 'Tours', to: '/admin/tours', icon: <BookOpen className="h-4 w-4" /> },
        { label: 'Lịch khởi hành', to: '/admin/departures', icon: <CalendarDays className="h-4 w-4" /> },
        { label: 'Danh mục', to: '/admin/catalog', icon: <FolderCog className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Vận hành',
      items: [
        { label: 'Bookings', to: '/admin/bookings', icon: <ClipboardList className="h-4 w-4" /> },
        { label: 'Quản lý xe', to: '/admin/vehicles', icon: <Car className="h-4 w-4" /> },
        { label: 'Cho thuê xe', to: '/admin/rentals', icon: <Key className="h-4 w-4" /> },
        { label: 'Tour đoàn', to: '/admin/group-tour-requests', icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Nội dung',
      items: [
        { label: 'Tin tức', to: '/admin/content/posts', icon: <FileText className="h-4 w-4" /> },
        { label: 'Đánh giá', to: '/admin/content/reviews', icon: <MessageSquareHeart className="h-4 w-4" /> },
        { label: 'Banners', to: '/admin/content/banners', icon: <FileText className="h-4 w-4" /> },
      ],
    },
    {
      label: 'Quản trị',
      items: [
        { label: 'Người dùng', to: '/admin/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Audit log', to: '/admin/audit-logs', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'Báo cáo', to: '/admin/reports', icon: <BarChart3 className="h-4 w-4" /> },
        { label: 'Cấu hình', to: '/admin/settings/company', icon: <FolderCog className="h-4 w-4" /> },
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-50 text-slate-900">
      <div className="mx-auto w-full grid grid-cols-1 gap-4 px-3 py-3 lg:grid-cols-[244px_minmax(0,1fr)] max-w-[1840px] 2xl:px-5 2xl:gap-5">
        <aside className="relative flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-3xl bg-gradient-to-b from-blue-900 via-blue-800 to-blue-900 p-4 shadow-2xl shadow-blue-900/20 sticky top-3">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-br from-orange-500/10 via-transparent to-transparent" />

          <Link
            className="relative flex items-center gap-2.5 rounded-2xl p-1.5 text-white transition hover:bg-blue-700/40"
            to="/admin"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-white/20">
              <img alt="Logo" className="h-7 w-7 rounded-full object-contain" src={logo} />
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-bold tracking-wide text-white">Quản trị</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-blue-200/80">Admin Panel</div>
            </div>
          </Link>

          <nav className="relative mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
            {groups.map((g) => (
              <div key={g.label}>
                <div className="px-2 text-[9px] font-bold uppercase tracking-[0.16em] text-blue-300/80">
                  {g.label}
                </div>
                <div className="mt-1.5 space-y-1">
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

          <div className="relative mt-4 space-y-2 border-t border-white/10 pt-3">
            <Link
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-white/10 text-center text-xs font-semibold text-white ring-1 ring-inset ring-white/20 transition hover:bg-white/20"
              to="/"
            >
              <Home className="h-3.5 w-3.5" />
              Về website
            </Link>
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-xs font-semibold text-white shadow-md shadow-orange-500/30 transition hover:bg-orange-600"
              onClick={async () => {
                await logout().catch(() => null)
                window.location.href = '/'
              }}
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Đăng xuất
              <span className="ml-1 text-[10px] text-white/80">({user?.name ?? 'Admin'})</span>
            </button>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="sticky top-3 z-40 mb-4 flex items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/80 px-4 py-3 shadow-sm backdrop-blur lg:px-6">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Hệ thống quản trị</div>
              <div className="truncate text-sm font-bold text-slate-800">Xin chào, {user?.name ?? 'Admin'} 👋</div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
            </div>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
