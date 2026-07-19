import { defineConfig, devices } from '@playwright/test';

// baseURL = console-web dans le réseau Docker. Timeouts larges (Next dev démarre à froid).
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 1,
  use: {
    baseURL: process.env.WEB_URL || 'http://console-web:3001',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
