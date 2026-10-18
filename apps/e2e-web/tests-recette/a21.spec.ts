import { test, expect } from '@playwright/test';
import { loginSaas, shotVp, saveCredential, supprimerTenant, lireMotDePasseRevele } from './helpers';

// TC-A21 — Tout tenant naît en essai daté : provisionner une organisation en choisissant
// le plan Transporteur → abonnement « Essai — 30 j restants » (le plan choisi est la cible
// de la conversion, pas le statut). Organisation dédiée aux cas A-ter (atlasfret).
test('TC-A21 — Tout tenant naît en essai daté', async ({ page }) => {
  test.setTimeout(180_000);
  // Pré-requis (hors périmètre) : l'organisation dédiée aux cas de cycle (A21 → A28) est
  // reconstruite à neuf, sinon c'est le refus de doublon qui se déclenche.
  supprimerTenant('atlasfret');
  test.setTimeout(120_000);
  await loginSaas(page);

  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill('atlasfret');
  await dialog.getByPlaceholder('Rabat Express').fill('Atlas Fret');
  await dialog.locator('input').nth(2).fill('Casablanca');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Transporteur' }).click();
  await dialog.getByPlaceholder('Youssef Tazi').fill('Salma Idrissi');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill('admin@atlasfret.ma');
  await shotVp(page, 'TC-A21', '01-provisioning-atlasfret-transporteur');
  await dialog.getByRole('button', { name: 'Provisionner' }).click();

  const reveal = page.getByRole('dialog');
  await expect(reveal.getByText('Compte administrateur créé')).toBeVisible({ timeout: 20_000 });
  const pwd = await lireMotDePasseRevele(reveal);
  saveCredential(`TC-A21 atlasfret ADMIN admin@atlasfret.ma tempPassword=${pwd}`);
  await shotVp(page, 'TC-A21', '02-admin-atlasfret-cree');
  await reveal.getByRole('button', { name: 'Fermer' }).click();

  // Essai daté, pas « Actif » ; le plan visé est bien Transporteur.
  const row = page.getByRole('row', { name: /atlasfret/ });
  await expect(row).toBeVisible();
  await expect(row.getByText('Essai')).toBeVisible();
  await expect(row).toContainText('30 j restants');
  await expect(row).not.toContainText('Actif');
  await expect(row).toContainText('Transporteur');
  await shotVp(page, 'TC-A21', '03-atlasfret-essai-14j-transporteur');
});
