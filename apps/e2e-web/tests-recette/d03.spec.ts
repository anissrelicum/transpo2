import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D03 — Changer d'état.
// PAS : menu du véhicule 1 → MAINTENANCE, vérifier ; → HORS SERVICE, vérifier ; → ACTIF.
// ATT : l'état change à chaque fois et est reflété dans la liste.
test('TC-D03 — cycle Actif → Maintenance → Hors service → Actif', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/vehicles');
  const row = page.getByRole('row', { name: /1111-A-11/ });
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();

  async function setState(item: string) {
    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: item }).click();
  }

  await setState('Mettre en maintenance');
  await expect(row.getByText('Maintenance', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D03', '01-maintenance');

  await setState('Hors service');
  await expect(row.getByText('Hors service', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D03', '02-hors-service');

  await setState('Réactiver');
  await expect(row.getByText('Actif', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D03', '03-actif-retabli');

  // Persistance après rechargement.
  await page.reload();
  await expect(page.getByRole('row', { name: /1111-A-11/ }).getByText('Actif', { exact: true })).toBeVisible();
});
