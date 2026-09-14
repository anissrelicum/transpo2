import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D12 — Immatriculation en doublon.
// PAS : ajouter un véhicule dont la plaque est déjà au parc.
// ATT : refus 409 « Un véhicule porte déjà cette immatriculation. », rien créé.
test('TC-D12 — immatriculation en doublon refusée', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/vehicles');
  const avant = await page.getByRole('row').count();
  await expect(page.getByRole('row', { name: /1111-A-11/ })).toHaveCount(1);
  await shotVp(page, 'TC-D12', '01-parc-avant');

  await page.getByRole('button', { name: 'Ajouter un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('1234-A-56').fill('1111-A-11');
  await dlg.locator('input[type="date"]').nth(0).fill('2029-01-01');
  await dlg.locator('input[type="date"]').nth(1).fill('2029-01-01');
  const refus = page.waitForResponse(
    (r) => r.url().endsWith('/v1/vehicles') && r.request().method() === 'POST',
  );
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const res = await refus;
  console.log(`POST /v1/vehicles (plaque en doublon) → ${res.status()}`);
  expect(res.status()).toBe(409);
  await shotVp(page, 'TC-D12', '02-refus-doublon');

  // Rien créé : une seule ligne 1111-A-11, parc de taille inchangée.
  await page.reload();
  await expect(page.getByRole('row', { name: /1111-A-11/ })).toHaveCount(1);
  expect(await page.getByRole('row').count()).toBe(avant);
  await shotVp(page, 'TC-D12', '03-parc-inchange');
});
