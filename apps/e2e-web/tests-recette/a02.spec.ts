import { test, expect } from '@playwright/test';
import { shot } from './helpers';

// TC-A02 — Bascule de realm sur la page de login :
// Plateforme ↔ organisation détectée, email pré-rempli qui change, et retour à la
// plateforme. Depuis le 15/09 la console est sur `app.wedowonders.com` : `app` figure dans
// les libellés que la détection par sous-domaine ignore, l'organisation affichée est donc
// celle par défaut. Le cas juge la BASCULE, pas le nom détecté — il tient dans les deux cas.
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
