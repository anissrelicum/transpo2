import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql, creerCommandes } from './helpers';

// TC-H03 — Flux de tri.
// ATT : Arrivés → Scannés — à trier → Sur quai, regroupé par ville de destination.
test('TC-H03 — un colis traverse les trois colonnes du tri', async ({ page }) => {
  test.setTimeout(180_000);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Décor : un colis entré au hub, à destination connue.
  sql(`UPDATE tenant_rabatexpress.orders SET hub_phase = NULL`);
  const [ref] = await creerCommandes(page, [{ cod: 90, toCity: 'Casablanca' }]);
  sql(`UPDATE tenant_rabatexpress.orders SET status = 'RECUPEREE', hub_phase = 'arrive' WHERE ref = '${ref}'`);
  const ligne = sql(`SELECT code FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`).trim();

  await page.goto('/hub');

  const colonne = (titre: string) => page.locator('div').filter({ hasText: new RegExp(`^${titre}`) }).first();
  await expect(colonne('Arrivés — à scanner').getByText(ligne)).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-H03', '01-colis-arrive');

  // Premier geste : le scan de tri.
  await page.getByRole('button', { name: 'Marquer scanné' }).first().click();
  await expect(colonne('Scannés — à trier').getByText(ligne)).toBeVisible({ timeout: 20_000 });
  expect(sql(`SELECT hub_phase FROM tenant_rabatexpress.orders WHERE code = '${ligne}'`).trim()).toBe('trier');
  await shotVp(page, 'TC-H03', '02-colis-scanne');

  // Second geste : la mise à quai, regroupée par destination.
  await page.getByRole('button', { name: 'Placer sur quai' }).first().click();
  const quai = colonne('Sur quai — par destination');
  await expect(quai.getByText(ligne)).toBeVisible({ timeout: 20_000 });
  await expect(quai.getByText('Casablanca').first()).toBeVisible();
  expect(sql(`SELECT hub_phase FROM tenant_rabatexpress.orders WHERE code = '${ligne}'`).trim()).toBe('quai');
  await shotVp(page, 'TC-H03', '03-colis-sur-quai');

  // L'indicateur « Sur quai » et la liste des destinations suivent.
  const corps = await page.locator('body').innerText();
  expect(corps).toMatch(/Sur quai[\s\S]{0,60}\b1\b/);
  expect(corps).toContain('Casablanca');
});
