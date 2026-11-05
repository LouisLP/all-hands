import { defineConfig, devices } from '@playwright/test'

// Overridable, so worktrees running side by side don't test each other's server.
const PORT = Number(process.env.E2E_PORT ?? 4173)
// Set it to run the suite against a deployed copy instead of a local build.
const DEPLOYED_URL = process.env.E2E_BASE_URL

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { baseURL: DEPLOYED_URL ?? `http://localhost:${PORT}/all-hands/` },
  webServer: DEPLOYED_URL
    ? undefined
    : {
        command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/all-hands/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
