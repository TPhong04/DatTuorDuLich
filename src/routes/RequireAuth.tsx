import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { isAuthed } from '@/features/auth/auth'

export default function RequireAuth() {
  const location = useLocation()

  if (!isAuthed()) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate replace to={`/auth/login?redirect=${redirect}`} />
  }

  return <Outlet />
}
