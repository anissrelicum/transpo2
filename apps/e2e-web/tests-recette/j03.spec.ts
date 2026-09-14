import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-J03 — Alerte hors zone (géofence).
// ATT : bandeau rouge « … est sorti de zone » et « Localiser » ; l'alerte naît d'une
//       position réelle remontée par le terrain, pas d'un décor d'écran.
test('TC-J03 — sortie de géofence signalée au PC flotte', async ({ page }) => {
  test.setTimeout(180_000);

  // Décor : une géofence serrée autour de Rabat pour Hamid Ouali.
  sql(`DELETE FROM tenant_rabatexpress.geofences WHERE driver = 'Hamid Ouali'`);
  sql(`INSERT INTO tenant_rabatexpress.geofences (driver, name, center_lat, center_lng, radius_m)
       VALUES ('Hamid Ouali', 'Rabat Centre', 34.0209, -6.8416, 3000)`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Une position DANS la zone : aucune alerte.
  sql(`INSERT INTO tenant_rabatexpress.driver_positions (driver, lat, lng) VALUES ('Hamid Ouali', 34.0215, -6.8420)`);
  await page.goto('/fleet');
  await page.waitForTimeout(2500);
  await expect(page.getByText(/est sorti de zone/)).toHaveCount(0);
  await shotVp(page, 'TC-J03', '01-dans-la-zone');

  // Une position à 60 km : le livreur est manifestement hors zone.
  sql(`INSERT INTO tenant_rabatexpress.driver_positions (driver, lat, lng) VALUES ('Hamid Ouali', 33.5731, -7.5898)`);
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(page.getByText(/est sorti de zone/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Localiser' })).toBeVisible();
  await shotVp(page, 'TC-J03', '02-hors-zone');

  const alertes = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/tracking/alerts')).json()));
  console.log(`  alertes → ${JSON.stringify(alertes.map((a: any) => ({ d: a.driver, m: Math.round(a.distanceM), z: a.zone })))}`);
  expect(alertes.some((a: any) => a.driver === 'Hamid Ouali' && a.outOfZone)).toBe(true);

  // « Localiser » recentre sans quitter l'écran.
  await page.getByRole('button', { name: 'Localiser' }).click();
  await page.waitForTimeout(1200);
  expect(page.url()).toContain('/fleet');
  await shotVp(page, 'TC-J03', '03-localiser');
});
