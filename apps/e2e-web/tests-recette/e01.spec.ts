import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-E01 — Créer une zone.
// PAS : /zones → Nouvelle zone → nom FR « Rabat Centre », nom AR, couleur indigo →
//       Dessiner un polygone → 4 sommets sur la carte → Enregistrer.
// ATT : zone visible dans la liste et tracée sur la carte.
test('TC-E01 — création de la zone Rabat Centre avec polygone', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/zones');

  // Pré-requis (hors périmètre) : repartir d'un découpage vierge pour être rejouable.
  await page.evaluate(async () => {
    const zs = await (await fetch('/api/proxy/v1/dispatch/zones')).json();
    for (const z of (Array.isArray(zs) ? zs : zs.items ?? [])) {
      await fetch(`/api/proxy/v1/dispatch/zones/${z.id}`, { method: 'DELETE' });
    }
  });
  await page.reload();
  await expect(page.getByText('Aucune zone. Créez-en une.')).toBeVisible();
  await shotVp(page, 'TC-E01', '01-aucune-zone');

  await page.getByRole('button', { name: 'Nouvelle zone' }).click();
  await expect(page.getByRole('heading', { name: 'Éditeur de zone' })).toBeVisible();
  await shotVp(page, 'TC-E01', '02-zone-creee-par-defaut');

  // Identité de la zone, ciblée par LIBELLÉ : les champs de l'éditeur sont désormais
  // reliés au leur, ce qu'un lecteur d'écran exige autant qu'une recette.
  await page.getByLabel('Nom (français)').fill('Rabat Centre');
  await page.getByLabel('Nom (arabe)').fill('الرباط الوسط');
  await shotVp(page, 'TC-E01', '03-noms-saisis');

  // Tracé : 4 sommets cliqués sur la carte.
  await page.getByRole('button', { name: 'Dessiner un polygone' }).click();
  await expect(page.getByText('Cliquez sur la carte pour ajouter des sommets.')).toBeVisible();
  // Le tracé repart de zéro : plus aucune forme affichée tant qu'on n'a pas 3 sommets.
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(0);
  const carte = page.locator('.leaflet-container');
  const boite = (await carte.boundingBox())!;
  const sommets: [number, number][] = [[0.30, 0.30], [0.70, 0.30], [0.70, 0.70], [0.30, 0.70]];
  for (const [fx, fy] of sommets) {
    await page.mouse.click(boite.x + boite.width * fx, boite.y + boite.height * fy);
    await page.waitForTimeout(250);
  }
  await shotVp(page, 'TC-E01', '04-quatre-sommets-cliques');

  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.waitForTimeout(1500);
  await page.reload();

  // La zone est dans la liste, et son tracé est bien celui des 4 clics.
  await expect(page.getByText('Zones définies · 1')).toBeVisible();
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
  await shotVp(page, 'TC-E01', '05-zone-listee-et-tracee');

  const enBase = sql(`SELECT name_fr, name_ar, color, json_array_length(polygon::json) FROM tenant_rabatexpress.zones`);
  console.log(`base → ${enBase}`);
  expect(enBase).toContain('Rabat Centre');
  expect(enBase).toContain('الرباط الوسط');
  expect(enBase.trim().endsWith('| 4')).toBe(true);
});
