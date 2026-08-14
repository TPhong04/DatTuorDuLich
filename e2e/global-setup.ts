import { chromium, type FullConfig } from '@playwright/test'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApiClient, DEFAULT_TEST_DATA, TestEnvCtx } from './lib/api-client'

async function ensureCsrfCookie(api: ApiClient, domain: string): Promise<{ name: string; value: string; domain: string; path: string; httpOnly: boolean } | null> {
  const res = await api.get('/auth/csrf-token')
  const jar = (res.headers.getSetCookie ? res.headers.getSetCookie() : [])
  for (const c of jar) {
    const m = c.match(/XSRF_TOKEN=([^;]+)/)
    if (m) {
      const value = decodeURIComponent(m[1])
      return { name: 'XSRF_TOKEN', value, domain, path: '/api', httpOnly: false }
    }
  }
  return null
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = String(config.projects[0]?.use?.baseURL ?? process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173')
  const apiBase = String(process.env.E2E_API_URL ?? 'http://127.0.0.1:4000/api')
  const stateDir = resolve(process.cwd(), 'e2e/.auth')
  const dataDir = resolve(process.cwd(), 'e2e/.state')
  for (const d of [stateDir, dataDir]) if (!existsSync(d)) mkdirSync(d, { recursive: true })
  const ctx: TestEnvCtx = {
    apiBase,
    adminApi: new ApiClient(apiBase),
    customerApi: new ApiClient(apiBase),
    state: {
      customerUser: null,
      staffUser: null,
      seededTour: null,
      createdBookingIds: [],
      createdTourIds: [],
      createdUserIds: [],
    },
  }
  const customerUser = await ctx.customerApi.registerLogin('customer')
  ctx.state.customerUser = customerUser
  ctx.state.createdUserIds.push(customerUser.id)
  const staffUser = await ctx.adminApi.registerLogin('staff')
  ctx.state.staffUser = staffUser
  ctx.state.createdUserIds.push(staffUser.id)
  let seededTour: TestEnvCtx['state']['seededTour'] = null
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() + DEFAULT_TEST_DATA.departureStartDaysFromNow)
    const departure = {
      startDate: startDate.toISOString(),
      capacity: DEFAULT_TEST_DATA.departureCapacity,
      priceAdult: DEFAULT_TEST_DATA.tour.priceAdult,
      priceChild: DEFAULT_TEST_DATA.tour.priceChild,
      priceInfant: DEFAULT_TEST_DATA.tour.priceInfant,
      groupSeatsReserved: 0,
      note: 'E2E nightly departure',
    }
    const createRes = await ctx.adminApi.post('/tours', { ...DEFAULT_TEST_DATA.tour, departures: [departure] })
    if (createRes.ok && createRes.data) {
      const t = createRes.data.tour ?? createRes.data
      seededTour = {
        id: String(t._id ?? t.id),
        slug: String(t.slug),
        departureId: Array.isArray(t.departures) && t.departures[0] ? String(t.departures[0]._id ?? t.departures[0].id) : 'unknown',
        capacity: DEFAULT_TEST_DATA.departureCapacity,
        priceAdult: DEFAULT_TEST_DATA.tour.priceAdult,
      }
      ctx.state.createdTourIds.push(seededTour.id)
    } else {
      try { console.error('[e2e:globalSetup] seed tour failed:', createRes.status, JSON.stringify(createRes.data).slice(0, 400)) } catch {}
    }
  } catch (e: any) {
    try { console.error('[e2e:globalSetup] seed tour exception:', String(e?.message || e)) } catch {}
  }
  ctx.state.seededTour = seededTour

  const ctxDir = resolve(process.cwd(), 'e2e/.state')
  if (!existsSync(ctxDir)) mkdirSync(ctxDir, { recursive: true })
  writeFileSync(resolve(ctxDir, 'env.json'), JSON.stringify(ctx.state, null, 2))

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({ baseURL })
    const csrf = await ensureCsrfCookie(ctx.customerApi, '127.0.0.1')
    const cookies: any[] = csrf ? [csrf] : []
    cookies.push({
      name: 'e2e_api_token',
      value: customerUser.accessToken,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: false,
    })
    const context = await browser.newContext({ baseURL, storageState: undefined })
    await context.addCookies(cookies)
    await context.addInitScript(({ token }: { token: string }) => {
      try {
        ;(window as any).__E2E_TOKEN__ = token
        if (token) {
          localStorage.setItem('vnexplorer.auth', JSON.stringify({ accessToken: token, user: { role: 'customer' } }))
        }
      } catch {}
    }, { token: customerUser.accessToken })
    await context.storageState({ path: resolve(stateDir, 'customer.json') })
    await context.close()
    await page.close()
  } finally {
    await browser.close()
  }
  try {
    console.log(`[e2e:globalSetup] OK: user=${customerUser.email}${seededTour ? ` | tour ${seededTour.slug} id=${seededTour.id} dep=${seededTour.departureId}` : ' (NO TOUR - API tours failed)'}`)
  } catch {}
}
