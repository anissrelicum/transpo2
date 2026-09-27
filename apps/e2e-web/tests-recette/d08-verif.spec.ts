import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-D08 (vérification) — Rattacher un véhicule.
// Le rattachement 1111-A-11 → Hamid Ouali a été effectué via l'UI lors d'une exécution
// précédente de d08.spec.ts (PATCH /v1/drivers/:id/vehicle abouti, visible en base) mais
// la capture de confirmation manquait. Cette spec vérifie l'ATT : la plaque apparaît sur
// la fiche chauffeur, type synchronisé (Fourgon), persistance après rechargement, et le
// véhicule est présélectionné dans le dialogue de rattachement.
test('TC-D08 — vérification du rattachement 1111-A-11 à Hamid Ouali', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/drivers');

  const row = page.getByRole('row', { name: /Hamid Ouali/ });
  await expect(row.getByText('1111-A-11')).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText('Fourgon', { exact: true })).toBeVisible();
  await expect(row.getByText('(non rattaché)')).toHaveCount(0);
  await shotVp(page, 'TC-D08', '03-plaque-sur-fiche');

  // Le dialogue de rattachement présélectionne le véhicule actuel.
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Rattacher un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('combobox')).toContainText('1111-A-11');
  await shotVp(page, 'TC-D08', '04-dialogue-preselectionne');
  await dlg.getByRole('button', { name: 'Annuler' }).click();
  await page.keyboard.press('Escape');

  // Persistance après rechargement.
  await page.reload();
  const row2 = page.getByRole('row', { name: /Hamid Ouali/ });
  await expect(row2.getByText('1111-A-11')).toBeVisible({ timeout: 15_000 });
  await expect(row2.getByText('Fourgon', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-D08', '05-persiste-apres-rechargement');
});
