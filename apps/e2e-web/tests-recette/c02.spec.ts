import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-C02 — Commission & TVA.
// PAS : régler la commission plateforme (ex. 15 %) et la TVA (20 %) → Enregistrer.
// ATT : persistance ; ces taux se retrouvent dans la facture marchand (TC-N03).
// Pour prouver l'écriture réelle, on passe la commission à 18 % puis on la restaure à 15 %.
test('TC-C02 — commission & TVA : enregistrement, persistance, restauration', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/settings');

  const commission = page.locator('input[type="number"]').first();
  const tva = page.locator('input[type="number"]').nth(1);
  const saveRates = page.getByRole('button', { name: 'Enregistrer' }).last();

  await expect(commission).toHaveValue('15');
  await expect(tva).toHaveValue('20');

  // 1. Modifier la commission à 18 % (TVA inchangée à 20 %) → Enregistrer.
  await commission.fill('18');
  await saveRates.click();
  await expect(page.getByRole('button', { name: 'Enregistré ✓' }).last()).toBeVisible();
  await shotVp(page, 'TC-C02', '01-commission-18-enregistre');

  // 2. Persistance après rechargement.
  await page.reload();
  await expect(commission).toHaveValue('18');
  await expect(tva).toHaveValue('20');
  await shotVp(page, 'TC-C02', '02-apres-rechargement');
  const db = sql(`SELECT commission_rate, vat_rate FROM tenant_rabatexpress.pricing_config WHERE id='default'`);
  console.log(`base → ${db}`);
  expect(db).toContain('0.18');

  // 3. Restauration à 15 % / 20 % (valeurs de référence de la recette).
  await commission.fill('15');
  await saveRates.click();
  await expect(page.getByRole('button', { name: 'Enregistré ✓' }).last()).toBeVisible();
  await page.reload();
  await expect(commission).toHaveValue('15');
  await expect(tva).toHaveValue('20');
  await shotVp(page, 'TC-C02', '03-restaure-15-20');
  const db2 = sql(`SELECT commission_rate, vat_rate FROM tenant_rabatexpress.pricing_config WHERE id='default'`);
  console.log(`base après restauration → ${db2}`);
  expect(db2).toContain('0.15');
});
