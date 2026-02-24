import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:4200';

export default defineConfig({
  testDir: './e2e/ui',
  fullyParallel: true,
  retries: 0,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled'
    }
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm.cmd run start -- --host 127.0.0.1 --port 4200',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: true
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    }
  ]
});
