import * as fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// TC-B12 — Changement de rôle.
// PAS : /users → menu du comptable → Changer de rôle → Dispatcher → Enregistrer.
// ATT : rôle mis à jour ; reconnexion → l'accès correspond au nouveau rôle. Remettre Comptable.
function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

async function changeRole(page: Page, emailRe: RegExp, roleLabel: string) {
  const row = page.locator('tr').filter({ hasText: emailRe }).first();
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Changer de rôle' }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByText('Changer de rôle')).toBeVisible();
  await dlg.getByRole('combobox').click();
  await page.getByRole('option', { name: roleLabel }).click();
  await dlg.getByRole('button', { name: 'Enregistrer' }).click();
}

// NB : lignes ciblees par locator DOM et non par role — apres la fermeture d'un dialogue
// declenchee par une mutation, le conteneur racine garde aria-hidden (defaut AN-12) et
// l'arbre d'accessibilite se vide : getByRole('row') ne trouve plus rien.
test('TC-B12 — changement de rôle comptable → dispatcher → comptable', async ({ page }) => {
  test.setTimeout(150_000);
  const pwd = pwdOf('TC-B08');
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/users');

  // 1. Comptable → Dispatcher.
  await changeRole(page, /compta@rabatexpress\.ma/, 'Dispatcher');
  const row = page.locator('tr', { hasText: 'compta@rabatexpress.ma' }).first();
  await expect(row.getByText('Dispatcher')).toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-B12', '01-role-dispatcher-dans-la-liste');
  await logout(page, 'Nadia Alaoui');

  // 2. Reconnexion → l'accès correspond au nouveau rôle (badge DISPATCHER, peut créer une commande).
  const err2 = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwd);
  expect(err2).toBeNull();
  const topbar = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Salma Bennis' });
  await expect(topbar.getByText('Dispatcher')).toBeVisible();
  await page.goto('/orders');
  await expect(page.getByRole('link', { name: 'Nouvelle commande' })).toBeVisible();
  await shotVp(page, 'TC-B12', '02-acces-dispatcher-apres-reconnexion');
  await logout(page, 'Salma Bennis');

  // 3. Remettre Comptable.
  const err3 = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err3).toBeNull();
  await page.goto('/users');
  await changeRole(page, /compta@rabatexpress\.ma/, 'Comptable');
  await expect(page.locator('tr', { hasText: 'compta@rabatexpress.ma' }).first().getByText('Comptable'))
    .toBeVisible({ timeout: 15_000 });
  await shotVp(page, 'TC-B12', '03-role-comptable-retabli');
});
