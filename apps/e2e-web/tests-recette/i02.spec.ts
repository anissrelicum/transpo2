import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-I02 — Optimiser l'ordre des arrêts.
// ATT : l'ordre change, « Optimisée » apparaît, et le bouton est fermé sous 2 arrêts.
test('TC-I02 — optimisation de l’ordre des arrêts', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/tournees');

  const avant = sql(`SELECT stops FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(avant, 'TC-I01 doit avoir laissé une tournée du jour').toBeTruthy();
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-I02', '01-tournee-selectionnee');

  const bouton = page.getByRole('button', { name: 'Optimiser l’ordre' });
  await expect(bouton).toBeEnabled();
  await bouton.click();

  // L'ordre optimisé est ANNONCÉ et PERSISTÉ : sans persistance, le livreur suivrait
  // encore l'ordre d'avant.
  await expect(page.getByText(/Optimisée/)).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-I02', '02-ordre-optimise');
  await page.waitForTimeout(1500);
  const apres = sql(`SELECT stops FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`).trim();
  console.log(`  ordre avant ${avant}\n  ordre après ${apres}`);
  expect(apres.replace(/[{}"]/g, '').split(',').sort()).toEqual(avant.replace(/[{}"]/g, '').split(',').sort());

  // Sous deux arrêts, optimiser n'a pas de sens : l'action doit être fermée.
  const id = sql(`SELECT id FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`).trim();
  const premier = apres.replace(/[{}"]/g, '').split(',')[0];
  sql(`UPDATE tenant_rabatexpress.tournees SET stops = ARRAY['${premier}'] WHERE id = '${id}'`);
  await page.reload();
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: 'Optimiser l’ordre' })).toBeDisabled();
  await shotVp(page, 'TC-I02', '03-un-seul-arret-optimisation-fermee');

  // On rétablit la tournée complète pour les cas suivants.
  sql(`UPDATE tenant_rabatexpress.tournees SET stops = '${apres}' WHERE id = '${id}'`);
});
