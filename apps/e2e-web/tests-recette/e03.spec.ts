import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-E03 — Affecter un livreur à la zone.
// PAS : dans l'éditeur → Ajouter → Hamid Ouali → Enregistrer.
// ATT : l'initiale/le nom du chauffeur apparaît sur la zone ; quand tous sont affectés,
//       « Tous les livreurs sont affectés. » s'affiche.
test('TC-E03 — affectation des livreurs à la zone', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/zones');
  await expect(page.getByText('Rabat Centre').first()).toBeVisible();
  await expect(page.getByText('Livreurs affectés · 0')).toBeVisible();
  await shotVp(page, 'TC-E03', '01-aucun-livreur');

  async function affecter(nom: string) {
    await page.getByRole('button', { name: 'Ajouter' }).click();
    await page.getByText('Choisir un livreur pour cette zone').waitFor();
    await page.getByText(nom, { exact: true }).last().click();
    await page.waitForTimeout(800);
  }

  await affecter('Hamid Ouali');
  await expect(page.getByText('Livreurs affectés · 1')).toBeVisible();
  await shotVp(page, 'TC-E03', '02-hamid-affecte');

  // L'affectation est immédiate (PATCH sans « Enregistrer ») et persiste.
  await page.reload();
  await expect(page.getByText('Livreurs affectés · 1')).toBeVisible();
  const enBase = sql(`SELECT drivers FROM tenant_rabatexpress.zones WHERE name_fr='Rabat Centre'`);
  console.log(`livreurs en base → ${enBase}`);
  expect(enBase).toContain('Hamid Ouali');
  await shotVp(page, 'TC-E03', '03-affectation-persistee');

  // Quand tout l'effectif est affecté, le produit le dit.
  await affecter('Sara Bennis');
  await expect(page.getByText('Livreurs affectés · 2')).toBeVisible();
  await page.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText('Tous les livreurs sont affectés.')).toBeVisible();
  await shotVp(page, 'TC-E03', '04-tous-affectes');
  await page.keyboard.press('Escape');
});
