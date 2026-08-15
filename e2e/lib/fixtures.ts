import { test as baseTest, expect } from '@playwright/test'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ApiClient, TestEnvCtx } from './api-client'

export type TestFixtures = {
  testCtx: TestEnvCtx['state'] & {
    apiBase: string
    customerApi: ApiClient
    bookingsCreated: (id: string) => void
  }
}

export const test = baseTest.extend<TestFixtures>({
  testCtx: [
    async ({}, use) => {
      const apiBase = String(process.env.E2E_API_URL ?? 'http://127.0.0.1:4000/api')
      const statePath = resolve(process.cwd(), 'e2e/.state/env.json')
      let state: TestEnvCtx['state'] = {
        customerUser: null,
        staffUser: null,
        seededTour: null,
        createdBookingIds: [],
        createdTourIds: [],
        createdUserIds: [],
      }
      try {
        if (existsSync(statePath)) state = JSON.parse(readFileSync(statePath, 'utf8')) as TestEnvCtx['state']
      } catch { /* ignore */ }
      const customerApi = new ApiClient(apiBase, state.customerUser?.accessToken ?? null)
      const ctx: TestFixtures['testCtx'] = {
        ...state,
        apiBase,
        customerApi,
        bookingsCreated(id: string) {
          state.createdBookingIds.push(id)
        },
      }
      await use(ctx)
    },
    { scope: 'worker', auto: false },
  ],
})

export { expect }
