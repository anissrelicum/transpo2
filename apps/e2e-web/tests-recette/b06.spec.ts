import { test, expect } from '@playwright/test';
import { loginTenant, logout, shotVp } from './helpers';

// TC-B06 — Déconnexion.
// PAS : connecté en admin → menu avatar → Se déconnecter.
// ATT : retour /login, et un accès direct à /orders renvoie au login (cookies purgés).
test('TC-B06 — déconnexion', async ({ page }) => {
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await shotVp(page, 'TC-B06', '01-connecte-dashboard');

  await logout(page, 'Nadia Alaoui');
  await shotVp(page, 'TC-B06', '02-retour-login');

  await page.goto('/orders');
  await page.waitForURL('**/login**', { timeout: 15_000 });
  await shotVp(page, 'TC-B06', '03-orders-renvoie-au-login');
  expect(page.url()).toContain('/login');
});
