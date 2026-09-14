import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-H03 — Flux de tri.
// ATT : Arrivés → Scannés — à trier → Sur quai, regroupé par ville de destination.
test('TC-H03 — un colis traverse les trois colonnes du tri', async ({ page }) => {
  test.setTimeout(180_000);

  // Décor : un colis entré au hub, à destination connue.
  sql(`UPDATE tenant_rabatexpress.orders SET hub_phase = NULL`);
  const ligne = sql(`
    UPDATE tenant_rabatexpress.orders SET status = 'RECUPEREE', hub_phase = 'arrive', to_city = 'Casablanca'
    WHERE ref = (SELECT ref FROM tenant_rabatexpress.orders
                 WHERE status NOT IN ('ANNULEE','RETOUR','LIVREE') ORDER BY created_at DESC LIMIT 1)
    RETURNING code`).trim();
  expect(ligne, 'un colis doit être entré au hub').toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
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
  await expect(quai.getByText('Casablanca')).toBeVisible();
  expect(sql(`SELECT hub_phase FROM tenant_rabatexpress.orders WHERE code = '${ligne}'`).trim()).toBe('quai');
  await shotVp(page, 'TC-H03', '03-colis-sur-quai');

  // L'indicateur « Sur quai » et la liste des destinations suivent.
  const corps = await page.locator('body').innerText();
  expect(corps).toMatch(/Sur quai[\s\S]{0,60}\b1\b/);
  expect(corps).toContain('Casablanca');
});
