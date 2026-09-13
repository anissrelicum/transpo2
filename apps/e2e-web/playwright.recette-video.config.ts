import { defineConfig, devices } from '@playwright/test';

// Recette vidéo — homelab K8s (transpo.wedowonders.com).
// Contrairement à playwright.homelab.config.ts (captures PNG), cette config
// enregistre une VIDÉO par cas et range les artefacts dans qa/recette/<run>/.
//
// Lancement :
//   pnpm --filter @transpo/e2e-web exec playwright test --config playwright.recette-video.config.ts a01
//   node scripts/sort-videos.mjs        # range les .webm dans qa/recette/<run>/TC-XXX/
const runId = process.env.RUN_ID || '2026-09-12-homelab';

export default defineConfig({
  testDir: './tests-recette',
  outputDir: `../../qa/recette/${runId}/videos`,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  retries: 0,
  workers: 1,          // les cas se chaînent : jamais en parallèle
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: `../../qa/recette/${runId}/resultats.json` }]],
  use: {
    baseURL: process.env.WEB_URL || 'http://transpo.wedowonders.com',
    video: { mode: 'on', size: { width: 1280, height: 800 } },
    screenshot: 'off',            // la vidéo remplace les captures
    trace: 'retain-on-failure',
    locale: 'fr-FR',
    viewport: { width: 1440, height: 900 },
    actionTimeout: 20_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
