import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, viderFlotte, motDePasse } from './helpers';

// TC-D01 — Ajouter un véhicule conforme.
// PAS : /vehicles → Ajouter un véhicule → 1111-A-11, Fourgon, Rabat, assurance 2029-01-01,
//       CT 2029-01-01 → Ajouter.
// ATT : ligne créée, état ACTIF, aucune alerte de conformité.
test('TC-D01 — ajout du véhicule conforme 1111-A-11', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/vehicles');
  // Pré-requis (hors périmètre) : le cas décrit l'ajout au PARC VIDE — il doit rester
  // rejouable après un run complet, pas seulement juste après la remise à zéro de la base.
  await viderFlotte(page);
  await expect(page.getByText('Aucun véhicule.')).toBeVisible();
  await shotVp(page, 'TC-D01', '01-liste-vide');

  await page.getByRole('button', { name: 'Ajouter un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('1234-A-56').fill('1111-A-11');
  // Sélecteurs du dialogue : Type (déjà Fourgon), Ville, État (déjà Actif).
  await dlg.getByRole('combobox').nth(1).click();
  await page.getByRole('option', { name: 'Rabat' }).click();
  await dlg.locator('input[type="date"]').nth(0).fill('2029-01-01');
  await dlg.locator('input[type="date"]').nth(1).fill('2029-01-01');
  await shotVp(page, 'TC-D01', '02-formulaire-vehicule');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const row = page.getByRole('row', { name: /1111-A-11/ });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText('Fourgon · Rabat')).toBeVisible();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  // Aucune alerte : sous-titre « 0 alerte(s) », pas de bandeau rouge.
  await expect(page.getByText('1 véhicules · 1 actifs · 0 alerte(s) d’échéance')).toBeVisible();
  await expect(page.getByText(/véhicule\(s\) avec assurance ou contrôle technique expiré/)).toHaveCount(0);
  await shotVp(page, 'TC-D01', '03-vehicule-cree-actif');
});
