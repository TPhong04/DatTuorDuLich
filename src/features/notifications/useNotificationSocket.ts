import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { io } from 'socket.io-client'
import { getStoredAccessToken } from '@/features/auth/auth.storage'
import { AuthUser, getStoredUser } from '@/features/auth/auth'
import { fetchMyNotificationsBadge, fetchStaffNotificationsBadge, fetchAdminNotificationsBadge } from './notifications'

export type NotifSocketState = {
  connected: boolean
  connecting: boolean
  error: string | null
  serverTime: string | null
  unreadCount: number
}

export function useNotificationSocket() {
  const user = getStoredUser() as AuthUser | null
  const role = user?.role ?? null
  const socketRef = useRef<Socket | null>(null)
  const listenersRef = useRef<Record<string, Set<(data: any) => void>>>({})
  const [state, setState] = useState<NotifSocketState>({
    connected: false,
    connecting: true,
    error: null,
    serverTime: null,
    unreadCount: 0,
  })

  useEffect(() => {
    let cancelled = false
    async function refreshBadge() {
      try {
        let res: { unreadCount: number } | null = null
        if (role === 'admin') res = await fetchAdminNotificationsBadge()
        else if (role === 'staff') res = await fetchStaffNotificationsBadge()
        else if (role === 'customer') res = await fetchMyNotificationsBadge()
        if (!cancelled && res) setState((s) => ({ ...s, unreadCount: res.unreadCount }))
      } catch {}
    }
    refreshBadge()

    if (!role) return
    const token = getStoredAccessToken()
    if (!token) return
    const socket: Socket = io(`${window.location.origin}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      if (cancelled) return
      setState((s) => ({ ...s, connected: true, connecting: false, error: null }))
    })
    socket.on('disconnect', () => {
      if (cancelled) return
      setState((s) => ({ ...s, connected: false, connecting: false }))
    })
    socket.on('connect_error', (err: any) => {
      if (cancelled) return
      setState((s) => ({ ...s, connected: false, connecting: false, error: String(err?.message || err) }))
    })
    socket.on('connected', (data: any) => {
      if (cancelled) return
      setState((s) => ({ ...s, connected: true, connecting: false, error: null, serverTime: data.serverTime || null }))
    })
    socket.on('notification.new', (row: any) => {
      if (cancelled) return
      setState((s) => ({ ...s, unreadCount: Math.max(0, s.unreadCount) + 1 }))
      const ls = listenersRef.current['notification.new']
      if (ls) ls.forEach((fn) => fn(row))
    })
    socket.on('notification.badge', (p: any) => {
      if (cancelled) return
      setState((s) => ({ ...s, unreadCount: Number(p?.unreadCount || 0) }))
    })
    const onAuthChanged = () => {
      if (!cancelled) refreshBadge()
    }
    window.addEventListener('auth-changed', onAuthChanged)

    return () => {
      cancelled = true
      window.removeEventListener('auth-changed', onAuthChanged)
      socket.removeAllListeners()
      try { socket.disconnect() } catch {}
      socketRef.current = null
    }
  }, [role, user?.id])

  const emit = (ev: string, data?: unknown) => {
    socketRef.current?.emit(ev, data)
  }
  const on = (event: string, listener: (data: any) => void) => {
    const set = listenersRef.current[event] ?? new Set()
    set.add(listener)
    listenersRef.current[event] = set
    return () => {
      const s = listenersRef.current[event]
      s?.delete(listener)
      if (s && s.size === 0) delete listenersRef.current[event]
    }
  }
  const setUnread = (n: number) => setState((s) => ({ ...s, unreadCount: Math.max(0, n) }))

  return { state, emit, on, setUnread }
}
