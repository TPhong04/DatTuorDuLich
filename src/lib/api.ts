import { clearStoredAuthRaw, getStoredAccessToken, setStoredAccessToken, setStoredUserRaw } from '@/features/auth/auth.storage'

type ApiError = {
  status: number
  message: string
  details?: unknown
}

async function refreshAccessToken() {
  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) return null
  const data = (await res.json()) as { accessToken: string; user: unknown }
  setStoredAccessToken(data.accessToken)
  setStoredUserRaw(JSON.stringify(data.user))
  return data.accessToken
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  return apiFetchWithRetry<T>(input, init, true)
}

async function apiFetchWithRetry<T>(input: string, init: RequestInit | undefined, canRetry: boolean): Promise<T> {
  const accessToken = getStoredAccessToken()

  const headers = new Headers(init?.headers ?? {})
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const res = await fetch(`/api${input}`, {
    ...init,
    headers,
    credentials: 'include',
  })

  if (res.status === 401 && canRetry && accessToken) {
    const next = await refreshAccessToken()
    if (!next) {
      clearStoredAuthRaw()
      throw { status: 401, message: 'Unauthorized' } satisfies ApiError
    }
    return apiFetchWithRetry<T>(input, init, false)
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const payload = (await res.json().catch(() => null)) as any
      const rawMessage = payload?.message
      if (typeof rawMessage === 'string') {
        throw { status: res.status, message: rawMessage, details: payload } satisfies ApiError
      }
      if (Array.isArray(rawMessage)) {
        throw { status: res.status, message: rawMessage.filter((x) => typeof x === 'string').join('\n') || res.statusText, details: payload } satisfies ApiError
      }
      if (rawMessage && typeof rawMessage === 'object') {
        const msg = typeof (rawMessage as any).message === 'string' ? String((rawMessage as any).message) : res.statusText
        throw { status: res.status, message: msg, details: rawMessage } satisfies ApiError
      }
      throw { status: res.status, message: res.statusText, details: payload } satisfies ApiError
    }

    const text = await res.text().catch(() => '')
    throw { status: res.status, message: text || res.statusText } satisfies ApiError
  }

  return (await res.json()) as T
}
