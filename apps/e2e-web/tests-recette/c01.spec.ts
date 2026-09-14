import { test, expect } from '@playwright/test';
import { loginTenant, shotVp, sql, motDePasse } from './helpers';

// TC-C01 — Renseigner l'identité légale.
// PAS : /settings → Raison sociale, ICE/RC, adresse complète → Enregistrer.
// ATT : bouton passe à « Enregistré ✓ » ; après rechargement, les valeurs persistent.
test('TC-C01 — identité légale : enregistrement et persistance', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Identité légale' })).toBeVisible();

  await page.getByPlaceholder('Casa Express SARL').fill('Rabat Express SARL');
  await page.getByPlaceholder('001234567000012').fill('002345678000012');
  await page.getByPlaceholder('123456', { exact: true }).fill('RC456789');
  await page.getByPlaceholder('123 Bd Zerktouni, Casablanca').fill('45 Av. Mohammed V, 10000 Rabat');
  await shotVp(page, 'TC-C01', '01-formulaire-rempli');

  // Le bouton « Enregistrer » de la carte Identité légale est le premier de la page.
  await page.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(page.getByRole('button', { name: 'Enregistré ✓' }).first()).toBeVisible();
  await shotVp(page, 'TC-C01', '02-enregistre');

  // Persistance après rechargement complet.
  await page.reload();
  await expect(page.getByPlaceholder('Casa Express SARL')).toHaveValue('Rabat Express SARL');
  await expect(page.getByPlaceholder('001234567000012')).toHaveValue('002345678000012');
  await expect(page.getByPlaceholder('123456', { exact: true })).toHaveValue('RC456789');
  await expect(page.getByPlaceholder('123 Bd Zerktouni, Casablanca')).toHaveValue('45 Av. Mohammed V, 10000 Rabat');
  await shotVp(page, 'TC-C01', '03-apres-rechargement');

  const db = sql(`SELECT legal_name, ice, rc, address FROM tenant_rabatexpress.company_settings WHERE id='default'`);
  console.log(`base → ${db}`);
  expect(db).toContain('Rabat Express SARL');
  expect(db).toContain('002345678000012');
  expect(db).toContain('RC456789');
});
