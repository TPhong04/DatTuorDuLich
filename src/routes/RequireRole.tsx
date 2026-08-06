import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { getStoredUser } from '@/features/auth/auth'

export default function RequireRole({ role }: { role: 'staff' | 'admin' }) {
  const location = useLocation()
  const user = getStoredUser()

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate replace to={`/auth/login?redirect=${redirect}`} />
  }

  if (role === 'admin' && user.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  if (role === 'staff' && user.role !== 'staff' && user.role !== 'admin') {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}

