import { useEffect, useState } from 'react'

import { AuthUser, getStoredUser, isAuthed } from './auth'

type AuthState = {
  isLoggedIn: boolean
  user: AuthUser | null
  refresh: () => void
}

export function useAuth(): AuthState {
  const read = (): AuthState => ({ isLoggedIn: isAuthed(), user: getStoredUser(), refresh })
  const [state, setState] = useState<AuthState>(read)
  function refresh() { setState(read()) }
  useEffect(() => {
    const h = () => refresh()
    window.addEventListener('auth-changed', h)
    return () => window.removeEventListener('auth-changed', h)
  }, [])
  return state
}
