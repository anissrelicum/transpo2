import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-E05 — Zones visibles au dispatch et au PC flotte.
// PAS : ouvrir /dispatch puis /fleet.
// ATT : la zone « Rabat Centre » est affichée sur les deux cartes.
test('TC-E05 — la zone est tracée sur les cartes dispatch et PC flotte', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();

  for (const [url, nom] of [['/dispatch', 'dispatch'], ['/fleet', 'PC flotte']] as const) {
    await page.goto(url);
    await expect(page.locator('.leaflet-container')).toBeVisible({ timeout: 20_000 });
    // Le tracé de la zone est un `path` de la couche d'overlay Leaflet.
    await expect(page.locator('.leaflet-overlay-pane path')).not.toHaveCount(0, { timeout: 20_000 });
    const formes = await page.locator('.leaflet-overlay-pane path').count();
    console.log(`${nom} → ${formes} forme(s) tracée(s)`);
    await shotVp(page, 'TC-E05', url === '/dispatch' ? '01-zone-sur-dispatch' : '02-zone-sur-pc-flotte');
  }
});
