import { test, expect } from '@playwright/test';
import { isoPlus, loginSaas, openPlanMenu, shotVp } from './helpers';

// TC-A17 — Date d'effet antérieure refusée : créer une version avec une date d'effet ≤ celle
// de la version courante → champ en rouge « Doit être postérieure au AAAA-MM-JJ », publication
// impossible. (pay-as-you-go : v1 effective le jour du run.)
test('TC-A17 — Date d’effet antérieure refusée', async ({ page }) => {
  test.setTimeout(120_000);
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Nouveau tarif/)).toBeVisible();

  // Date = celle de la v1 (défaut : aujourd'hui) → refus explicite, publication bloquée.
  const publier = dialog.getByRole('button', { name: 'Publier le tarif' });
  await expect(dialog.getByText(new RegExp(`Doit être postérieure au ${isoPlus(0)}`))).toBeVisible();
  await expect(publier).toBeDisabled();
  await shotVp(page, 'TC-A17', '01-date-non-posterieure-refusee');

  // Date encore antérieure → même refus.
  await dialog.locator('input[type="date"]').fill(isoPlus(-11));
  await expect(dialog.getByText(new RegExp(`Doit être postérieure au ${isoPlus(0)}`))).toBeVisible();
  await expect(publier).toBeDisabled();

  // Date postérieure → le contrôle se lève (on n'en publie rien ici).
  await dialog.locator('input[type="date"]').fill(isoPlus(1));
  await expect(dialog.getByText(/Doit être postérieure/)).toHaveCount(0);
  await expect(publier).toBeEnabled();
  await shotVp(page, 'TC-A17', '02-date-posterieure-acceptee');

  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(dialog).toBeHidden();
});
