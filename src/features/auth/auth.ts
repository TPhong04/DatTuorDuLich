import { apiFetch } from '@/lib/api'
import { clearStoredAuthRaw, getStoredAccessToken, getStoredUserRaw, setStoredAccessToken, setStoredUserRaw } from './auth.storage'

export type AuthUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  gender?: 'male' | 'female' | 'other' | null
  avatarUrl?: string | null
  dateOfBirth?: string | null
  address?: {
    province?: string | null
    district?: string | null
    ward?: string | null
    line1?: string | null
  } | null
  emergencyContact?: {
    name?: string | null
    phone?: string | null
    relation?: string | null
  } | null
  citizenId?: string | null
  passportNumber?: string | null
  dietary?: string | null
  medicalNotes?: string | null
  role: 'customer' | 'staff' | 'admin'
}

function emitAuthChanged() {
  window.dispatchEvent(new Event('auth-changed'))
}

export function getStoredUser(): AuthUser | null {
  const raw = getStoredUserRaw()
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setStoredAuth(input: { accessToken: string; user: AuthUser }) {
  setStoredAccessToken(input.accessToken)
  setStoredUserRaw(JSON.stringify(input.user))
  emitAuthChanged()
}

export function clearStoredAuth() {
  clearStoredAuthRaw()
  emitAuthChanged()
}

export function setStoredUser(user: AuthUser) {
  setStoredUserRaw(JSON.stringify(user))
  emitAuthChanged()
}

export function isAuthed() {
  return Boolean(getStoredAccessToken())
}

export async function login(input: { email: string; password: string }) {
  const res = await apiFetch<{ accessToken: string; user: AuthUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  setStoredAuth(res)
  return res
}

export async function register(input: { name: string; phone?: string; email: string; password: string }) {
  const res = await apiFetch<{ ok: true }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return res
}

export async function forgotPasswordCheck(input: { email: string }) {
  return apiFetch<{ ok: true }>('/auth/forgot-password/check', { method: 'POST', body: JSON.stringify(input) })
}

export async function forgotPasswordReset(input: { email: string; password: string }) {
  return apiFetch<{ ok: true }>('/auth/forgot-password/reset', { method: 'POST', body: JSON.stringify(input) })
}

export async function logout() {
  await apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' })
  clearStoredAuth()
}

export async function me() {
  return apiFetch<AuthUser | null>('/auth/me', { method: 'GET' })
}

export async function fetchProfile() {
  const res = await apiFetch<AuthUser>('/users/me', { method: 'GET' })
  setStoredUser(res)
  return res
}

export async function updateProfile(input: {
  name?: string
  phone?: string | null
  gender?: 'male' | 'female' | 'other' | null
  avatarUrl?: string | null
  dateOfBirth?: string | null
  address?: {
    province?: string | null
    district?: string | null
    ward?: string | null
    line1?: string | null
  } | null
  emergencyContact?: {
    name?: string | null
    phone?: string | null
    relation?: string | null
  } | null
  citizenId?: string | null
  passportNumber?: string | null
  dietary?: string | null
  medicalNotes?: string | null
}) {
  const res = await apiFetch<AuthUser>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  setStoredUser(res)
  return res
}

async function refreshAccessToken() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json()) as { accessToken: string; user: unknown }
  setStoredAccessToken(data.accessToken)
  setStoredUserRaw(JSON.stringify(data.user))
  return data.accessToken
}

export async function uploadAvatar(file: File) {
  const form = new FormData()
  form.set('file', file)

  const doFetch = async (canRetry: boolean) => {
    const accessToken = getStoredAccessToken()
    const res = await fetch('/api/uploads/avatar', {
      method: 'POST',
      body: form,
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    })

    if (res.status === 401 && canRetry && accessToken) {
      const next = await refreshAccessToken()
      if (!next) {
        clearStoredAuthRaw()
        throw { status: 401, message: 'Unauthorized' }
      }
      return doFetch(false)
    }

    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? ''
      if (contentType.includes('application/json')) {
        const payload = (await res.json().catch(() => null)) as any
        const msg = typeof payload?.message === 'string' ? payload.message : res.statusText
        throw { status: res.status, message: msg, details: payload }
      }
      const text = await res.text().catch(() => '')
      throw { status: res.status, message: text || res.statusText }
    }

    return (await res.json()) as { url: string; user: AuthUser }
  }

  const result = await doFetch(true)
  setStoredUser(result.user)
  return result
}
