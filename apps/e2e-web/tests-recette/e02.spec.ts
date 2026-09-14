import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-E02 — Effacer le tracé en cours.
// PAS : rouvrir la zone → Dessiner un polygone → 2 clics → Effacer.
// ATT : les sommets disparaissent sans supprimer la zone tant qu'on n'enregistre pas.
test('TC-E02 — « Effacer » ne retire que le tracé en cours', async ({ page }) => {
  test.setTimeout(150_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  const avant = sql(`SELECT json_array_length(polygon::json) FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`sommets enregistrés avant → ${avant}`);
  await shotVp(page, 'TC-E02', '01-zone-existante');

  await page.getByRole('button', { name: 'Dessiner un polygone' }).click();
  const carte = page.locator('.leaflet-container');
  const b = (await carte.boundingBox())!;
  await page.mouse.click(b.x + b.width * 0.4, b.y + b.height * 0.4);
  await page.waitForTimeout(250);
  await page.mouse.click(b.x + b.width * 0.6, b.y + b.height * 0.4);
  await page.waitForTimeout(250);
  await expect(page.getByRole('button', { name: 'Effacer' })).toBeVisible();
  await shotVp(page, 'TC-E02', '02-deux-sommets-cliques');

  await page.getByRole('button', { name: 'Effacer' }).click();
  // Le bouton disparaît avec le dernier sommet : plus rien n'est en cours de tracé.
  await expect(page.getByRole('button', { name: 'Effacer' })).toHaveCount(0);
  await shotVp(page, 'TC-E02', '03-trace-efface');

  // La zone, elle, est intacte : ni supprimée, ni modifiée en base (rien n'a été enregistré).
  await expect(page.getByText('Zones définies · 1')).toBeVisible();
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  const apres = sql(`SELECT json_array_length(polygon::json) FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`sommets enregistrés après → ${apres}`);
  expect(apres).toBe(avant);
  await shotVp(page, 'TC-E02', '04-zone-intacte');

  // Et un rechargement ramène bien le tracé enregistré.
  await page.reload();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await shotVp(page, 'TC-E02', '05-trace-enregistre-retrouve');
});
