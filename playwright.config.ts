import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests run against the Vite dev server in mock API mode, so they need no backend or
 * third-party credentials. See docs/testing.md.
 *
 * Environment overrides:
 *  - E2E_PORT                        port for the dev server Playwright starts (default 5173)
 *  - E2E_BASE_URL                    test an already-running server instead of starting one
 *  - PLAYWRIGHT_CHROMIUM_EXECUTABLE  use a specific Chromium/Chrome binary
 */
const port = Number(process.env.E2E_PORT ?? 5173)
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    launchOptions: { executablePath },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        env: { VITE_API_MODE: 'mock' },
        timeout: 120_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Phone-sized smoke coverage for tests tagged @mobile.
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
})
