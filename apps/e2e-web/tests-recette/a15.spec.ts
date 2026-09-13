import { test, expect } from '@playwright/test';
import { loginSaas, openPlanMenu, shotVp } from './helpers';

// TC-A15 — Simulateur : l'écart VOLUME / GRADUÉ. Avec la grille de TC-A13, 600 commandes :
// 1 800 DH en rétroactif, rappel « (en par tranche : 2 700 DH) » ; basculer sur Par tranche
// inverse les deux montants. (Dialogue refermé sans publier.)
test('TC-A15 — Simulateur VOLUME / GRADUÉ', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Nouveau tarif/)).toBeVisible();

  // Lecture Rétroactif (défaut) : 600 commandes → 1 800 DH, rappel par tranche 2 700 DH.
  const volume = dialog.locator('input').last();
  await volume.fill('600');
  await expect(dialog.getByRole('heading', { name: /1\s?800 DH/ })).toBeVisible();
  await expect(dialog.getByText(/en par tranche : 2\s?700 DH/)).toBeVisible();
  await shotVp(page, 'TC-A15', '01-simulateur-retroactif-1800');

  // Basculer sur Par tranche : les deux montants s'inversent.
  await dialog.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: /Par tranche/ }).click();
  await expect(dialog.getByRole('heading', { name: /2\s?700 DH/ })).toBeVisible();
  await expect(dialog.getByText(/en rétroactif : 1\s?800 DH/)).toBeVisible();
  await shotVp(page, 'TC-A15', '02-simulateur-par-tranche-2700');

  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
});
