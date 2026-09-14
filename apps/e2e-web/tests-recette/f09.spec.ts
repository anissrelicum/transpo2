import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-F09 — Recherche globale (barre supérieure).
// PAS : taper une référence dans la barre du haut → Entrée.
// ATT : atterrissage sur /orders?q=<référence> avec la liste filtrée.
test('TC-F09 — recherche globale depuis la barre supérieure', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/dashboard');

  const ref = sql(`SELECT ref FROM tenant_rabatexpress.orders ORDER BY created_at DESC LIMIT 1`);
  console.log(`référence cherchée → ${ref}`);
  const barre = page.getByPlaceholder(/Rechercher/).first();
  await expect(barre).toBeVisible();
  await barre.fill(ref);
  await shotVp(page, 'TC-F09', '01-reference-saisie');
  await barre.press('Enter');

  await page.waitForURL(/\/orders\?q=/, { timeout: 15_000 });
  console.log(`URL d'arrivée → ${new URL(page.url()).pathname}${new URL(page.url()).search}`);
  await expect(page.getByTestId('orders-count')).toHaveText('1 résultat(s)');
  await expect(page.getByRole('row', { name: new RegExp(ref) })).toBeVisible();
  await shotVp(page, 'TC-F09', '02-liste-filtree');
});
