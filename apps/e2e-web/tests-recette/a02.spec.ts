import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// TC-A02 — Bascule de realm sur la page de login :
// Plateforme ↔ organisation détectée (host transpo.wedowonders.com → « transpo »),
// email pré-rempli change, re-cliquer revient à la plateforme.
test('TC-A02 — Bascule de realm', async ({ page }) => {
  await page.goto('/login?realm=saas');
  const badge = page.getByTestId('detected-org');
  const email = page.locator('input[name="email"]');
  await expect(badge).toHaveText(/plateforme/i);
  await shot(page, 'TC-A02', '01-realm-plateforme-avant-bascule');

  await page.getByRole('button', { name: /connexion à une organisation/i }).click();
  await expect(badge).not.toHaveText(/plateforme/i);
  await expect(email).toHaveValue('admin@casaexpress.ma');
  await shot(page, 'TC-A02', '02-realm-organisation-apres-bascule');

  await page.getByRole('button', { name: /connexion console saas/i }).click();
  await expect(badge).toHaveText(/plateforme/i);
  await expect(email).toHaveValue('ops@transpo.ma');
  await shot(page, 'TC-A02', '03-retour-realm-plateforme');
});
