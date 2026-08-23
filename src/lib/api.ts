import {
  clearStoredAuthRaw,
  getStoredAccessToken,
  setStoredAccessToken,
  setStoredUserRaw,
} from '@/features/auth/auth.storage'

type ApiError = {
  status: number
  message: string
  details?: unknown
}

const env = ((import.meta as any).env || {}) as Record<
  string,
  string | undefined
>

const API_TARGET = String(
  env.VITE_API_TARGET || 'https://dattuordulich-be.onrender.com'
).replace(/\/+$/, '')

function apiUrl(path: string): string {
  return `${API_TARGET}${path.startsWith('/') ? path : `/${path}`}`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null

  const prefix = `${encodeURIComponent(name)}=`
  const parts = document.cookie.split(';')

  for (const p of parts) {
    const s = p.trim()

    if (s.startsWith(prefix)) {
      try {
        return decodeURIComponent(s.slice(prefix.length))
      } catch {
        return s.slice(prefix.length)
      }
    }
  }

  return null
}

export async function ensureCsrfTokenForStateChanging(
  method: string | undefined
): Promise<string | null> {
  if (!method) return null

  const m = method.toUpperCase()

  if (
    m !== 'POST' &&
    m !== 'PATCH' &&
    m !== 'PUT' &&
    m !== 'DELETE'
  ) {
    return null
  }

  const existing = getCookie('XSRF_TOKEN')

  if (existing && existing.length >= 16) {
    return existing
  }

  try {
    const r = await fetch(apiUrl('/api/auth/csrf-token'), {
      credentials: 'include',
    })

    if (!r.ok) return null

    const data = (await r.json().catch(() => null)) as any

    return data?.xsrfToken ?? getCookie('XSRF_TOKEN')
  } catch {
    return null
  }
}

let _isRefreshingToken = false
let _refreshPromise: Promise<string | null> | null = null

export async function refreshAccessToken(): Promise<string | null> {
  if (_isRefreshingToken && _refreshPromise) {
    return _refreshPromise
  }

  _isRefreshingToken = true

  _refreshPromise = (async () => {
    try {
      const csrf = await ensureCsrfTokenForStateChanging('POST')

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      const currentToken = getStoredAccessToken()

      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`
      }

      if (csrf) {
        headers['X-XSRF-TOKEN'] = csrf
      }

      const res = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers,
      })

      if (!res.ok) {
        return null
      }

      const data = (await res.json()) as {
        accessToken: string
        user: unknown
      }

      setStoredAccessToken(data.accessToken)
      setStoredUserRaw(JSON.stringify(data.user))

      return data.accessToken
    } finally {
      _isRefreshingToken = false
      _refreshPromise = null
    }
  })()

  return _refreshPromise
}

export async function apiFetch<T>(
  input: string,
  init?: RequestInit,
  opts?: { signal?: AbortSignal }
): Promise<T> {
  return apiFetchWithRetry<T>(
    input,
    init,
    true,
    opts?.signal,
    0
  )
}

function delay(
  ms: number,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timer = setTimeout(resolve, ms)

    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true }
    )
  })
}

async function apiFetchWithRetry<T>(
  input: string,
  init: RequestInit | undefined,
  canRetry: boolean,
  signal?: AbortSignal,
  attempt: number = 0
): Promise<T> {
  const accessToken = getStoredAccessToken()

  const body: unknown = init?.body

  const headers = new Headers(
    init?.headers ?? {}
  )

  if (
    !headers.has('Content-Type') &&
    !(body instanceof FormData)
  ) {
    headers.set(
      'Content-Type',
      'application/json'
    )
  }

  if (
    accessToken &&
    !headers.has('Authorization')
  ) {
    headers.set(
      'Authorization',
      `Bearer ${accessToken}`
    )
  }

  const csrf =
    await ensureCsrfTokenForStateChanging(
      init?.method
    )

  if (
    csrf &&
    !headers.has('X-XSRF-TOKEN')
  ) {
    headers.set(
      'X-XSRF-TOKEN',
      csrf
    )
  }

  const res = await fetch(
    apiUrl(`/api${input}`),
    {
      ...init,
      headers,
      credentials: 'include',
      signal,
    }
  )

  /*
   * Access token hết hạn
   */
  if (
    res.status === 401 &&
    canRetry &&
    accessToken
  ) {
    const next =
      await refreshAccessToken()

    if (!next) {
      clearStoredAuthRaw()

      throw {
        status: 401,
        message: 'Unauthorized',
      } satisfies ApiError
    }

    return apiFetchWithRetry<T>(
      input,
      init,
      false,
      signal,
      attempt + 1
    )
  }

  /*
   * Rate limit
   */
  if (
    res.status === 429 &&
    attempt < 4
  ) {
    const retryAfterHeader =
      res.headers.get('retry-after')

    const retryAfter =
      retryAfterHeader
        ? Number(retryAfterHeader) * 1000
        : null

    const base =
      retryAfter &&
      Number.isFinite(retryAfter) &&
      retryAfter > 0
        ? retryAfter
        : 500

    const jitter =
      200 +
      Math.floor(Math.random() * 400)

    const waitMs = Math.min(
      base * (attempt + 1) + jitter,
      3500
    )

    await delay(waitMs, signal)

    return apiFetchWithRetry<T>(
      input,
      init,
      canRetry,
      signal,
      attempt + 1
    )
  }

  /*
   * Các lỗi khác
   */
  if (!res.ok) {
    if (res.status === 429) {
      throw {
        status: 429,
        message: '',
        details: {
          _silent: true,
          _throttle: true,
        },
      } satisfies ApiError & {
        details: {
          _silent: boolean
          _throttle: boolean
        }
      }
    }

    const contentType =
      res.headers.get('content-type') ?? ''

    if (
      contentType.includes(
        'application/json'
      )
    ) {
      const payload =
        (await res
          .json()
          .catch(() => null)) as any

      const rawMessage =
        payload?.message

      if (
        typeof rawMessage === 'string'
      ) {
        throw {
          status: res.status,
          message: rawMessage,
          details: payload,
        } satisfies ApiError
      }

      if (Array.isArray(rawMessage)) {
        throw {
          status: res.status,
          message:
            rawMessage
              .filter(
                (x) =>
                  typeof x === 'string'
              )
              .join('\n') ||
            res.statusText,
          details: payload,
        } satisfies ApiError
      }

      if (
        rawMessage &&
        typeof rawMessage === 'object'
      ) {
        const msg =
          typeof rawMessage.message ===
          'string'
            ? String(
                rawMessage.message
              )
            : res.statusText

        throw {
          status: res.status,
          message: msg,
          details: rawMessage,
        } satisfies ApiError
      }

      throw {
        status: res.status,
        message: res.statusText,
        details: payload,
      } satisfies ApiError
    }

    const text =
      await res.text().catch(
        () => ''
      )

    throw {
      status: res.status,
      message:
        text || res.statusText,
    } satisfies ApiError
  }

  return (await res.json()) as T
}

/**
 * Resolve relative file URL:
 * - Absolute http/https → giữ nguyên
 * - /pdfs/... → BE
 * - /uploads/... → BE
 */
export function resolveFileUrl(
  url: string | null | undefined
): string | undefined {
  if (!url) return undefined

  const trimmed =
    String(url).trim()

  if (!trimmed) return undefined

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  if (
    trimmed.startsWith('/pdfs/') ||
    trimmed.startsWith('/uploads/')
  ) {
    return apiUrl(trimmed)
  }

  return trimmed
}
