import { randomUUID } from 'node:crypto'

export type TestEnvCtx = {
  apiBase: string
  adminApi: ApiClient
  customerApi: ApiClient
  state: {
    customerUser: { id: string; email: string; password: string; accessToken: string } | null
    staffUser: { id: string; email: string; password: string; accessToken: string } | null
    seededTour: { id: string; slug: string; departureId: string; capacity: number; priceAdult: number } | null
    createdBookingIds: string[]
    createdTourIds: string[]
    createdUserIds: string[]
  }
}

export class ApiClient {
  constructor(
    public base: string,
    public accessToken: string | null = null,
  ) {}

  private async fetchJSON(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<{ ok: boolean; status: number; data: any; headers: Headers }> {
    const url = this.base + path
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-E2E': 'playwright',
      ...headers,
    }
    if (this.accessToken) reqHeaders['Authorization'] = `Bearer ${this.accessToken}`
    let csrf: string | null = null
    try {
      if (method !== 'GET') {
        const csrfRes = await fetch(this.base + '/auth/csrf-token', {
          method: 'GET',
          credentials: 'include',
          headers: reqHeaders,
        })
        const jar = (csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [])
        for (const c of jar) {
          const m = c.match(/XSRF_TOKEN=([^;]+)/)
          if (m) { csrf = decodeURIComponent(m[1]); break }
        }
      }
    } catch {
      /* ignore csrf setup fail */
    }
    if (csrf) reqHeaders['X-XSRF-TOKEN'] = csrf
    const res = await fetch(url, {
      method,
      headers: reqHeaders,
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data: any = null
    try { data = text.length ? JSON.parse(text) : null } catch { data = { _raw: text } }
    return { ok: res.ok, status: res.status, data, headers: res.headers }
  }

  get(path: string, headers?: Record<string, string>) {
    return this.fetchJSON('GET', path, undefined, headers)
  }
  post(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetchJSON('POST', path, body, headers)
  }
  patch(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetchJSON('PATCH', path, body, headers)
  }
  put(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetchJSON('PUT', path, body, headers)
  }
  delete(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.fetchJSON('DELETE', path, body, headers)
  }

  async registerLogin(role: 'customer' | 'staff' | 'admin'): Promise<{ id: string; email: string; password: string; accessToken: string }> {
    const uniq = randomUUID().replace(/-/g, '').slice(0, 12).toLowerCase()
    const email = `e2e-${role}-${uniq}@vnexplorer-test.invalid`
    const password = `Test1ng!Strong-${uniq.slice(0, 4)}`
    const name = role === 'customer' ? 'Khách Test E2E' : role === 'staff' ? 'Nhân viên Test' : 'Admin Test'
    const phone = '0909' + String(10000000 + Math.floor(Math.random() * 89999999))
    const reg = await this.post('/auth/register', { email, password, name, phone, role, acceptTos: true })
    if (!reg.ok && reg.status !== 409) {
      throw new Error(`[e2e] register ${role} ${email} failed: ${reg.status} ${JSON.stringify(reg.data)}`)
    }
    const login = await this.post('/auth/login', { email, password })
    if (!login.ok || !login.data || !login.data.accessToken) {
      throw new Error(`[e2e] login ${role} ${email} failed: status=${login.status} ${JSON.stringify(login.data)}`)
    }
    const accessToken = String(login.data.accessToken)
    this.accessToken = accessToken
    return { id: String(login.data.user?.id ?? login.data.user?.sub ?? reg.data?.id ?? 'unknown'), email, password, accessToken }
  }
}

export const DEFAULT_TEST_DATA = {
  tour: {
    title: 'E2E Test Tour - Hà Nội 1N2D',
    slug: null as string | null,
    code: 'E2E-HN-001',
    durationDays: 2,
    durationNights: 1,
    region: 'Miền Bắc',
    type: 'domestic',
    isPublished: true,
    priceAdult: 1890000,
    priceChild: 1490000,
    priceInfant: 490000,
    coverImageUrl: null,
    description: 'Tour dùng test E2E Happy path đặt tour + 5 negative',
    highlights: ['Check-in Hà Nội', 'Test itinerary'],
    itinerary: [{ day: 1, title: 'Ngày 1', activities: 'Đón khách Nội Bài → Old Quarter' }],
    inclusions: ['Vé máy bay', 'KS 3 sao'],
    exclusions: ['Chi phí cá nhân'],
  },
  departureCapacity: 12,
  departureStartDaysFromNow: 30,
} as const
