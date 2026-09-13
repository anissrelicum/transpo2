import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D04 — Renouveler un document.
// PAS : menu du véhicule 2 → renouveler l'assurance avec une date future → Enregistrer.
// ATT : l'alerte disparaît de la liste et du tableau de bord.
test('TC-D04 — renouvellement assurance 2222-B-22, alertes résorbées', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/vehicles');

  const row = page.getByRole('row', { name: /2222-B-22/ });
  await expect(row.getByText(/Expirée \(\d+ j\)/)).toBeVisible();
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Renouveler l’assurance' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('2222-B-22 — nouvelle date d’échéance.')).toBeVisible();
  await dlg.locator('input[type="date"]').fill('2029-06-01');
  await shotVp(page, 'TC-D04', '01-dialogue-renouvellement');
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();

  // Alerte disparue de la liste.
  await expect(row.getByText(/Expirée/)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText(/0 alerte\(s\) d’échéance/)).toBeVisible();
  await expect(page.getByText(/véhicule\(s\) avec assurance ou contrôle technique expiré/)).toHaveCount(0);
  await shotVp(page, 'TC-D04', '02-alerte-disparue-liste');

  // Alerte disparue du tableau de bord.
  await page.goto('/dashboard');
  await expect(page.getByText(/2222-B-22/)).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByText('Aucune échéance en alerte.')).toBeVisible();
  await shotVp(page, 'TC-D04', '03-dashboard-sans-alerte');
});
