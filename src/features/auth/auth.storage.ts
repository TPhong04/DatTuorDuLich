export type StoredAuthUser = {
  id: string
  name: string
  email: string
  phone?: string | null
  gender?: 'male' | 'female' | 'other' | null
  avatarUrl?: string | null
  role: 'customer' | 'staff' | 'admin'
}

const ACCESS_TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

function migrateKey(key: string) {
  const v = localStorage.getItem(key)
  if (!v) return
  sessionStorage.setItem(key, v)
  localStorage.removeItem(key)
}

export function getStoredAccessToken() {
  if (!sessionStorage.getItem(ACCESS_TOKEN_KEY) && localStorage.getItem(ACCESS_TOKEN_KEY)) {
    migrateKey(ACCESS_TOKEN_KEY)
  }
  return sessionStorage.getItem(ACCESS_TOKEN_KEY)
}

export function setStoredAccessToken(token: string) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export function getStoredUserRaw() {
  if (!sessionStorage.getItem(USER_KEY) && localStorage.getItem(USER_KEY)) {
    migrateKey(USER_KEY)
  }
  return sessionStorage.getItem(USER_KEY)
}

export function setStoredUserRaw(userJson: string) {
  sessionStorage.setItem(USER_KEY, userJson)
  localStorage.removeItem(USER_KEY)
}

export function clearStoredAuthRaw() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

