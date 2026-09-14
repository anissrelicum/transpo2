import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, motDePasse } from './helpers';

// TC-D02 — Ajouter un véhicule non conforme.
// PAS : ajouter 2222-B-22, Moto, Rabat, assurance à une date passée.
// ATT : véhicule créé avec un signal d'alerte assurance ; remonte dans les alertes
//       du /dashboard (bloc Assurance).
test('TC-D02 — véhicule 2222-B-22 à assurance expirée + alerte dashboard', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/vehicles');
  // Pré-requis (hors périmètre) : la plaque doit être libre, l'unicité étant désormais
  // imposée par le produit (AN-16).
  await page.evaluate(async () => {
    const d = await (await fetch('/api/proxy/v1/vehicles')).json();
    const v = (Array.isArray(d) ? d : d.items ?? []).find((x: any) => x.plate === '2222-B-22');
    if (v) await fetch(`/api/proxy/v1/vehicles/${v.id}`, { method: 'DELETE' });
  });
  await page.reload();

  await page.getByRole('button', { name: 'Ajouter un véhicule' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('1234-A-56').fill('2222-B-22');
  await dlg.getByRole('combobox').nth(0).click(); // Type
  await page.getByRole('option', { name: 'Moto', exact: true }).click();
  await dlg.getByRole('combobox').nth(1).click(); // Ville
  await page.getByRole('option', { name: 'Rabat' }).click();
  await dlg.locator('input[type="date"]').nth(0).fill('2026-01-01'); // assurance échue
  await dlg.locator('input[type="date"]').nth(1).fill('2029-01-01'); // CT valide
  await shotVp(page, 'TC-D02', '01-formulaire-assurance-echue');
  await dlg.getByRole('button', { name: 'Ajouter', exact: true }).click();

  const row = page.getByRole('row', { name: /2222-B-22/ });
  await expect(row).toBeVisible({ timeout: 15_000 });
  await expect(row.getByText(/Expirée \(\d+ j\)/)).toBeVisible();
  // Bandeau d'alerte flotte.
  await expect(page.getByText(/1 véhicule\(s\) avec assurance ou contrôle technique expiré/)).toBeVisible();
  await expect(page.getByText(/2 véhicules · \d actifs · 1 alerte\(s\)/)).toBeVisible();
  await shotVp(page, 'TC-D02', '02-vehicule-non-conforme-liste');

  // Alerte remontée au tableau de bord (bloc Conformité).
  await page.goto('/dashboard');
  await expect(page.getByText(/Moto 2222-B-22.*assurance expirée depuis \d+ j/)).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-D02', '03-alerte-dashboard');
});
