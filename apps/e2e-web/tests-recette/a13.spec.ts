import { test, expect } from '@playwright/test';
import { loginSaas, openPlanMenu, shotVp, sql } from './helpers';

// TC-A13 — Créer un plan à l'usage avec paliers :
// Nouveau plan « Pay as you go » (code auto pay-as-you-go) → Nouvelle version de tarif
// À l'usage, 3 paliers (1–100 à 6, 101–500 à 4,50, 501+ à 3) → Publier.
// ATT : bandeau ambre « plan sans tarif » disparait ; carte « À l'usage — dès 3 DH/cmd »
// et « 3 paliers · rétroactif ».
test('TC-A13 — Plan à l’usage avec paliers', async ({ page }) => {
  test.setTimeout(180_000);
  // Pré-requis (hors périmètre) : le plan ne doit pas déjà exister — sans quoi c'est le
  // refus de doublon (TC-A19) qui se déclenche, pas le cas testé ici.
  const id = sql("select id from platform.plans where code = 'pay-as-you-go'");
  if (id) {
    sql(`delete from platform.plan_versions where plan_id = '${id}'`);
    sql(`delete from platform.plans where id = '${id}'`);
  }
  await loginSaas(page);
  await page.goto('/saas/plans');
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();

  // Création du plan (code auto-rempli depuis le libellé FR).
  await page.getByRole('button', { name: 'Nouveau plan' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Pay as you go').fill('Pay as you go');
  await expect(dialog.getByPlaceholder('pay-as-you-go')).toHaveValue('pay-as-you-go');
  await dialog.getByPlaceholder('الدفع حسب الاستعمال').fill('الدفع حسب الاستعمال');
  await shotVp(page, 'TC-A13', '01-nouveau-plan-code-auto');
  await dialog.getByRole('button', { name: 'Créer le plan' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();

  // Bandeau ambre « plan sans tarif » visible avant publication.
  await expect(page.getByText(/plan\(s\) sans tarif/)).toBeVisible({ timeout: 30_000 });
  await shotVp(page, 'TC-A13', '02-bandeau-plan-sans-tarif');

  // Nouvelle version de tarif, mode À l'usage.
  await openPlanMenu(page, 'pay-as-you-go');
  await page.getByRole('menuitem', { name: /Nouvelle version de tarif/ }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Premier tarif de ce plan/)).toBeVisible();
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /À l’usage/ }).click();

  // 3 paliers : 1–100 à 6 · 101–500 à 4,50 · 501+ à 3.
  const tierRows = dialog.locator('table tbody tr');
  await expect(tierRows).toHaveCount(1);
  await tierRows.nth(0).locator('input').last().fill('6');
  await dialog.getByRole('button', { name: 'Ajouter un palier' }).click();
  await expect(tierRows).toHaveCount(2);
  await dialog.getByRole('button', { name: 'Ajouter un palier' }).click();
  await expect(tierRows).toHaveCount(3);
  // Borne haute du palier 2 à 500 (recale automatiquement le palier 3 à 501).
  await tierRows.nth(1).locator('input').first().fill('500');
  await tierRows.nth(1).locator('input').last().fill('4.50');
  await tierRows.nth(2).locator('input').last().fill('3');
  await expect(tierRows.nth(0)).toContainText('1');
  await expect(tierRows.nth(2)).toContainText('501');
  await expect(tierRows.nth(2)).toContainText('et au-delà');
  await shotVp(page, 'TC-A13', '03-editeur-3-paliers');

  await dialog.getByRole('button', { name: 'Publier le tarif' }).click();
  await expect(dialog).toBeHidden();
  await page.reload();

  // Bandeau disparu, carte et ligne à jour.
  await expect(page.getByText(/plan\(s\) sans tarif/)).toHaveCount(0);
  const card = page.locator('table tbody tr', { hasText: 'pay-as-you-go' });
  await expect(card).toContainText('À l’usage — dès 3 DH/cmd', { timeout: 30_000 });
  await expect(card).toContainText('3 paliers · rétroactif');
  await shotVp(page, 'TC-A13', '04-plan-paye-as-you-go-publie');
});
