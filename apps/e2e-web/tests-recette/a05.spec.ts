import { test, expect } from '@playwright/test';
import { loginSaas, nextAlert, shot, sql, nbTenants } from './helpers';

// TC-A05 — Slug en doublon refusé.
// ATT : erreur « Tenant déjà existant », aucune duplication dans la liste.
// Joué sur le slug jetable provisionné par TC-A03 (cf. la note de ce cas).
const SLUG = 'recetteprov';

test('TC-A05 — Slug en doublon refusé', async ({ page }) => {
  test.setTimeout(150_000);
  const avant = nbTenants();
  expect(sql(`select count(*) from platform.tenants where slug='${SLUG}'`)).toBe('1');
  await loginSaas(page);

  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(SLUG);
  await dialog.getByPlaceholder('Rabat Express').fill('Recette Provisioning Bis');
  await dialog.getByPlaceholder('Youssef Tazi').fill('Admin Bis');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(`admin2@${SLUG}.ma`);
  await shot(page, 'TC-A05', '01-dialogue-doublon-rempli');

  const alertMsg = nextAlert(page);
  await dialog.getByRole('button', { name: 'Provisionner' }).click();
  const msg = await alertMsg;
  expect(msg).toContain('Tenant déjà existant');
  console.log(`doublon ${SLUG} → ${msg}`);
  await shot(page, 'TC-A05', '02-doublon-refuse-dialogue-ouvert');
  await dialog.getByRole('button', { name: 'Annuler' }).click();

  // Aucune duplication : une seule ligne, et le parc d'organisations n'a pas bougé.
  await expect(page.getByRole('row', { name: new RegExp(SLUG) })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /Recette Provisioning Bis/ })).toHaveCount(0);
  await shot(page, 'TC-A05', '03-liste-sans-duplication');
  expect(sql(`select count(*) from platform.tenants where slug='${SLUG}'`)).toBe('1');
  expect(nbTenants()).toBe(avant);
});
