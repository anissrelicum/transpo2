import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-J04 — Raccourci vers les zones.
// ATT : « Gérer les zones » mène à /zones ; « Plein écran » et sa sortie fonctionnent.
test('TC-J04 — raccourcis du PC flotte', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/fleet');
  await page.waitForTimeout(2000);

  // Plein écran : la carte prend l'écran, et on en ressort.
  await page.getByRole('button', { name: 'Plein écran' }).click();
  await expect(page.getByRole('button', { name: 'Quitter le plein écran' })).toBeVisible();
  await shotVp(page, 'TC-J04', '01-plein-ecran');
  await page.getByRole('button', { name: 'Quitter le plein écran' }).click();
  await expect(page.getByRole('button', { name: 'Plein écran' })).toBeVisible();
  await shotVp(page, 'TC-J04', '02-retour');

  await page.getByRole('link', { name: 'Gérer les zones' }).click();
  await page.waitForURL('**/zones**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: /Zones/ }).first()).toBeVisible();
  await shotVp(page, 'TC-J04', '03-zones');
});
