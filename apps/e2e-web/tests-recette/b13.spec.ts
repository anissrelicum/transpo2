import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// TC-B13 — Désactivation / réactivation.
// PAS : Désactiver le dispatcher (confirmation) → tenter sa connexion → puis Réactiver.
// ATT : connexion refusée quand inactif, rétablie après réactivation.
function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

// NB : lignes ciblees par locator DOM et non par role — apres la fermeture d'un dialogue
// declenchee par une mutation, le conteneur racine garde aria-hidden (defaut AN-12) et
// l'arbre d'accessibilite se vide : getByRole('row') ne trouve plus rien.
test('TC-B13 — désactivation puis réactivation du dispatcher', async ({ page }) => {
  test.setTimeout(150_000);
  const pwd = pwdOf('TC-B11');
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');

  // 1. Désactiver (avec confirmation).
  const row = page.locator('tr', { hasText: 'dispatch@rabatexpress.ma' }).first();
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Désactiver' }).click();
  const confirm = page.getByRole('alertdialog');
  await expect(confirm.getByText('Désactiver Reda Ziani ?')).toBeVisible();
  await shotVp(page, 'TC-B13', '01-confirmation-desactivation');
  await confirm.getByRole('button', { name: 'Désactiver' }).click();
  await expect(row.getByText('Désactivé', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-B13', '02-dispatcher-desactive');
  await logout(page, 'Nadia Alaoui');

  // 2. Connexion refusée quand inactif.
  const errOff = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwd);
  console.log(`connexion compte désactivé → ${errOff}`);
  expect(errOff).not.toBeNull();
  await shotVp(page, 'TC-B13', '03-connexion-refusee-inactif');

  // 3. Réactiver → connexion rétablie.
  const err2 = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err2).toBeNull();
  await page.goto('/users');
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Réactiver' }).click();
  await expect(row.getByText('Actif', { exact: true })).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-B13', '04-dispatcher-reactive');
  await logout(page, 'Nadia Alaoui');

  const errOn = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwd);
  expect(errOn).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  await shotVp(page, 'TC-B13', '05-connexion-retablie');
});
