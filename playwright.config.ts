import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

/**
 * Browser end-to-end suite.
 *
 * Runs against a dev server on port 3111 so it never collides with a `pnpm dev`
 * you already have open on 3000. The server is started with VAPID and Gmail
 * credentials blanked: both are supported "not configured" states, and it keeps
 * a test run from pushing notifications or mailing anyone for real.
 *
 * Uses the Chrome already installed on the machine (`channel: 'chrome'`) rather
 * than downloading a Playwright build.
 */
const PORT = Number(process.env.E2E_PORT || 3111);
export const BASE_URL = `http://localhost:${PORT}`;
export const STORAGE_STATE_DIR = path.join(__dirname, 'e2e', '.auth');

export default defineConfig({
  testDir: './e2e/specs',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // The suite shares one staging database and one wizard draft per account, so
  // parallel workers would edit each other's rows.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  outputDir: './e2e/.artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      GMAIL_USER: '',
      GMAIL_APP_PASSWORD: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: '',
    },
  },
});
