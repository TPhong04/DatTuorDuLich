import { defineConfig, devices } from '@playwright/test'

const ci = String(process.env.CI ?? '').length > 0
const baseURL = String(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173')
const apiBaseURL = String(process.env.E2E_API_URL ?? 'http://127.0.0.1:4000/api')

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.(ts|tsx)$/,
  outputDir: './e2e/.test-artifacts',
  fullyParallel: false,
  forbidOnly: ci,
  retries: ci ? 2 : 1,
  workers: 1,
  tsconfig: './e2e/tsconfig.json',
  reporter: [
    ['list', { printSteps: true }],
    ['html', { open: ci ? 'never' : 'on-failure', outputFolder: './e2e/.report-html' }],
    ['junit', { outputFile: './e2e/.test-artifacts/junit-e2e.xml' }],
    ['json', { outputFile: './e2e/.test-artifacts/results.json' }],
  ],
  timeout: 45_000,
  expect: {
    timeout: 8_000,
  },
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: ci ? 'retain-on-failure' : 'retain-on-failure',
    screenshot: ci ? 'only-on-failure' : 'only-on-failure',
    video: ci ? 'retain-on-failure' : 'off',
    ignoreHTTPSErrors: !ci,
    extraHTTPHeaders: {
      'X-Accept-Language': 'vi-VN',
      'X-E2E': 'playwright',
    },
  },
  projects: [
    {
      name: 'setup',
      testMatch: /global-setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /global-teardown\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        storageState: './e2e/.auth/customer.json',
        launchOptions: { args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] },
      },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: './e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: './e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: './e2e/.auth/customer.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: ci
    ? [
        {
          command: String(process.env.E2E_SERVER_CMD ?? 'cd server && npm.cmd run dev'),
          url: apiBaseURL + '/health/live',
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: process.cwd(),
        },
        {
          command: String(process.env.E2E_VITE_CMD ?? 'npm.cmd run dev'),
          url: baseURL,
          reuseExistingServer: false,
          timeout: 120_000,
          cwd: process.cwd(),
        },
      ]
    : undefined,
})
