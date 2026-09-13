import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D14 — Chauffeur homonyme.
// PAS : créer un second « Hamid Ouali ».
// ATT : refus 409 « Un chauffeur porte déjà ce nom. » — les commandes référencent le
//       chauffeur par son nom, l'unicité est une règle métier.
test('TC-D14 — chauffeur homonyme refusé', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/drivers');
  await expect(page.getByRole('row', { name: /Hamid Ouali/ })).toHaveCount(1);
  const avant = await page.getByRole('row').count();

  await page.getByRole('button', { name: 'Ajouter un chauffeur' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Youssef Benali').fill('Hamid Ouali');
  await dlg.getByPlaceholder('+212600000000').fill('+212644444444');
  await shotVp(page, 'TC-D14', '01-homonyme-saisi');
  const refus = page.waitForResponse(
    (r) => r.url().endsWith('/v1/drivers') && r.request().method() === 'POST',
  );
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();
  const res = await refus;
  console.log(`POST /v1/drivers (homonyme) → ${res.status()}`);
  expect(res.status()).toBe(409);
  await shotVp(page, 'TC-D14', '02-refus-homonyme');

  await page.reload();
  await expect(page.getByRole('row', { name: /Hamid Ouali/ })).toHaveCount(1);
  expect(await page.getByRole('row').count()).toBe(avant);
});
