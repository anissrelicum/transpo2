import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// TC-B10 — Connexion des comptes invités.
// PAS : se déconnecter, se connecter avec le dispatcher puis avec le comptable
// (mots de passe temporaires).
// ATT : les deux atterrissent sur /dashboard, le nom et le rôle s'affichent dans la barre supérieure.
function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker} dans COMPTES.md`);
  return m[1];
}

test('TC-B10 — connexion dispatcher puis comptable', async ({ page }) => {
  const pwdDisp = pwdOf('TC-B07');
  const err1 = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwdDisp);
  expect(err1).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  const topbar1 = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Reda Ziani' });
  await expect(topbar1).toBeVisible();
  await expect(topbar1.getByText('Dispatcher')).toBeVisible();
  await shotVp(page, 'TC-B10', '01-dashboard-dispatcher');
  await logout(page, 'Reda Ziani');

  const pwdCompta = pwdOf('TC-B08');
  const err2 = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwdCompta);
  expect(err2).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  const topbar2 = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Salma Bennis' });
  await expect(topbar2).toBeVisible();
  await expect(topbar2.getByText('Comptable')).toBeVisible();
  await shotVp(page, 'TC-B10', '02-dashboard-comptable');
  await logout(page, 'Salma Bennis');
});
