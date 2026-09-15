import { defineConfig, devices } from '@playwright/test';

// Recette homelab K8s (console sur app.wedowonders.com) — contrairement à playwright.config.ts
// (Docker interne CI), cette config cible l'ingress du homelab et range les artefacts
// (captures, traces) dans qa/recette/<run>/.
//
// Lancement :
//   pnpm --filter @transpo/e2e-web exec playwright test --config playwright.homelab.config.ts
//
// RUN_ID horodaté par défaut ; surchargeable : RUN_ID=2026-09-07-a ...
const runId = process.env.RUN_ID || new Date().toISOString().slice(0, 10);

export default defineConfig({
  testDir: './tests-recette',
  outputDir: `../../qa/recette/${runId}/artefacts`,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.WEB_URL || 'http://app.wedowonders.com',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
