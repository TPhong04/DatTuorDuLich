import type { FullConfig } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApiClient, TestEnvCtx } from './lib/api-client'

export default async function globalTeardown(config: FullConfig) {
  const apiBase = String(process.env.E2E_API_URL ?? 'http://127.0.0.1:4000/api')
  const statePath = resolve(process.cwd(), 'e2e/.state/env.json')
  if (!existsSync(statePath)) return
  let state: TestEnvCtx['state'] | null = null
  try { state = JSON.parse(readFileSync(statePath, 'utf8')) as TestEnvCtx['state'] } catch { state = null }
  if (!state) return
  const api = new ApiClient(apiBase, state.staffUser?.accessToken ?? state.customerUser?.accessToken ?? null)
  const all: Array<Promise<any>> = []
  for (const id of state.createdBookingIds) {
    all.push(api.delete(`/bookings/${id}`).catch(() => null))
  }
  for (const id of state.createdUserIds) {
    all.push(api.delete(`/users/${id}`).catch(() => null))
  }
  for (const id of state.createdTourIds) {
    all.push(api.delete(`/tours/${id}`).catch(() => null))
  }
  try {
    await Promise.allSettled(all)
  } catch {}
  try { console.log('[e2e:globalTeardown] OK: cleaned ', state.createdBookingIds.length + ' bookings, ' + state.createdUserIds.length + ' users, ' + state.createdTourIds.length + ' tours') } catch {}
}
