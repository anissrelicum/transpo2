import { test, expect } from '@playwright/test';
import { inviteUser, loginTenant, shotVp, saveCredential, sql } from './helpers';

// TC-B08 — Invitation d'un comptable.
// PAS : idem avec compta@rabatexpress.ma, rôle Comptable.
// ATT : compte créé, listé.
test('TC-B08 — invitation comptable', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');
  // Pré-requis (hors périmètre) : l'adresse doit être libre, sinon c'est le refus de doublon
  // (TC-B09) qui se déclenche et non l'invitation testée ici.
  sql(`DELETE FROM tenant_rabatexpress.users WHERE email = 'compta@rabatexpress.ma'`);
  await page.reload();

  const pwd = await inviteUser(page, 'Salma Bennis', 'compta@rabatexpress.ma', 'Comptable');
  expect(pwd.length).toBeGreaterThan(8);
  console.log(`TC-B08 mdp temporaire comptable = ${pwd}`);
  saveCredential(`TC-B08 rabatexpress COMPTABLE compta@rabatexpress.ma tempPassword=${pwd}`);
  await shotVp(page, 'TC-B08', '01-dialogue-mot-de-passe-temporaire');
  await page.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();

  const row = page.getByRole('row', { name: /compta@rabatexpress\.ma/ });
  await expect(row.getByText('Salma Bennis')).toBeVisible();
  await expect(row.getByText('Comptable')).toBeVisible();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible();
  await shotVp(page, 'TC-B08', '02-comptable-liste');
});
