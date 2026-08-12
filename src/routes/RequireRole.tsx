import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { getStoredUser } from '@/features/auth/auth'

export default function RequireRole({ role }: { role: 'staff' | 'admin' }) {
  const location = useLocation()
  const user = getStoredUser()

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate replace to={`/auth/login?redirect=${redirect}`} />
  }

  if (role === 'admin') {
    if (user.role !== 'admin') {
      if (user.role === 'staff') return <Navigate replace to="/staff" />
      return <Navigate replace to="/" />
    }
  }

  if (role === 'staff') {
    if (user.role !== 'staff') {
      if (user.role === 'admin') return <Navigate replace to="/admin" />
      return <Navigate replace to="/" />
    }
  }

  return <Outlet />
}

