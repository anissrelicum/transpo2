import * as fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// TC-B15 — RBAC console (matrice ADMIN / DISPATCHER / COMPTABLE).
// ATT : toute action interdite doit être absente ou désactivée dans l'UI ET refusée par
// l'API (403) si l'URL est appelée directement.
// Vérifications représentatives par ligne de la matrice : présence/absence des boutons
// d'écriture dans l'UI + statut des appels API directs (via /api/proxy, session courante).

function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

async function api(page: Page, method: string, path: string, body?: unknown): Promise<number> {
  const res = await page.request.fetch(`/api/proxy/v1/${path}`, {
    method, data: body, headers: body ? { 'content-type': 'application/json' } : undefined,
  });
  return res.status();
}

async function checkApi(page: Page, label: string, method: string, path: string, expected: number | number[], body?: unknown) {
  const status = await api(page, method, path, body);
  const ok = Array.isArray(expected) ? expected.includes(status) : status === expected;
  console.log(`  API ${method} ${path} → ${status} (attendu ${Array.isArray(expected) ? expected.join('|') : expected}) ${ok ? 'OK' : 'ÉCART'}`);
  expect.soft(status, `${label} : ${method} ${path} → ${status}`).toBe(Array.isArray(expected) ? expected[0] : expected);
  return status;
}

test('TC-B15 — matrice RBAC console', async ({ page }) => {
  test.setTimeout(300_000);
  const pwdDisp = pwdOf('TC-B11');
  const pwdCompta = pwdOf('TC-B08');

  // ---------- ADMIN ----------
  let err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  console.log('== ADMIN ==');
  await page.goto('/orders');
  await expect(page.getByRole('link', { name: 'Nouvelle commande' })).toBeVisible();
  await page.goto('/users');
  await expect(page.getByRole('button', { name: 'Inviter' })).toBeVisible();
  await page.goto('/drivers');
  await expect(page.getByRole('button', { name: 'Ajouter un chauffeur' })).toBeVisible();
  await page.goto('/pricing');
  await expect(page.getByRole('button', { name: 'Enregistrer' }).first()).toBeVisible();
  await shotVp(page, 'TC-B15', '01-admin-pricing-enregistrer-present');
  await checkApi(page, 'ADMIN', 'GET', 'users', 200);
  await checkApi(page, 'ADMIN', 'GET', 'cash/sessions', 200);
  await checkApi(page, 'ADMIN', 'GET', 'fraud/cases', 200);
  await checkApi(page, 'ADMIN', 'GET', 'notifications', 200);
  await logout(page, 'Nadia Alaoui');

  // ---------- DISPATCHER ----------
  err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwdDisp);
  expect(err).toBeNull();
  console.log('== DISPATCHER ==');
  // UI : commandes en écriture OK
  await page.goto('/orders');
  await expect(page.getByRole('link', { name: 'Nouvelle commande' })).toBeVisible();
  await shotVp(page, 'TC-B15', '02-dispatcher-orders-nouvelle-commande');
  // UI : utilisateurs sans Inviter ni menus de ligne
  await page.goto('/users');
  await expect(page.getByRole('heading', { name: 'Utilisateurs & rôles' })).toBeVisible();
  expect.soft(await page.getByRole('button', { name: 'Inviter' }).count(), 'DISPATCHER : bouton Inviter visible').toBe(0);
  expect.soft(await page.locator('table button[aria-haspopup="menu"]').count(), 'DISPATCHER : menus de ligne /users visibles').toBe(0);
  await shotVp(page, 'TC-B15', '03-dispatcher-users-sans-inviter');
  // UI : chauffeurs — pas d'ajout, dispo seule
  await page.goto('/drivers');
  expect.soft(await page.getByRole('button', { name: 'Ajouter un chauffeur' }).count(), 'DISPATCHER : Ajouter un chauffeur visible').toBe(0);
  await shotVp(page, 'TC-B15', '04-dispatcher-drivers-sans-ajout');
  // UI : tarification — Enregistrer doit être absent ou désactivé
  await page.goto('/pricing');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const savePricing = page.getByRole('button', { name: 'Enregistrer' }).first();
  const pricingSaveCount = await savePricing.count();
  const pricingSaveEnabled = pricingSaveCount > 0 && (await savePricing.isEnabled());
  console.log(`  UI pricing Enregistrer : présent=${pricingSaveCount > 0} actif=${pricingSaveEnabled}`);
  expect.soft(pricingSaveEnabled, 'DISPATCHER : bouton Enregistrer (tarification) actif dans l’UI').toBe(false);
  await shotVp(page, 'TC-B15', '05-dispatcher-pricing');
  // UI : paramètres en lecture seule
  await page.goto('/settings');
  const legalName = page.getByPlaceholder('Casa Express SARL');
  expect.soft(await legalName.isDisabled(), 'DISPATCHER : champ identité modifiable').toBe(true);
  await shotVp(page, 'TC-B15', '06-dispatcher-settings-lecture-seule');
  // UI : fraude — arbitrage interdit (page réservée admin)
  await page.goto('/fraud');
  await page.waitForTimeout(1500);
  console.log(`  UI /fraud dispatcher → ${page.url()}`);
  await shotVp(page, 'TC-B15', '07-dispatcher-fraud');
  // API directe
  await checkApi(page, 'DISPATCHER', 'POST', 'users', 403, { email: 'x@x.ma', name: 'X', role: 'COMPTABLE' });
  await checkApi(page, 'DISPATCHER', 'POST', 'drivers', 403, { name: 'X' });
  await checkApi(page, 'DISPATCHER', 'POST', 'vehicles', 403, { plate: 'X' });
  await checkApi(page, 'DISPATCHER', 'POST', 'settings/company', 403, {});
  await checkApi(page, 'DISPATCHER', 'POST', 'pricing/config', 403, {});
  await checkApi(page, 'DISPATCHER', 'POST', 'fraud/cases/00000000-0000-0000-0000-000000000000/confirm', 403);
  await checkApi(page, 'DISPATCHER', 'GET', 'cash/sessions', 403);
  await checkApi(page, 'DISPATCHER', 'GET', 'tournees', 200);
  await checkApi(page, 'DISPATCHER', 'POST', 'orders', [400, 422], {});
  await checkApi(page, 'DISPATCHER', 'GET', 'analytics/summary', 200);
  await checkApi(page, 'DISPATCHER', 'GET', 'reviews', 200);
  await logout(page, 'Reda Ziani');

  // ---------- COMPTABLE ----------
  err = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwdCompta);
  expect(err).toBeNull();
  console.log('== COMPTABLE ==');
  // UI : commandes en lecture seule
  await page.goto('/orders');
  expect.soft(await page.getByRole('link', { name: 'Nouvelle commande' }).count(), 'COMPTABLE : Nouvelle commande visible').toBe(0);
  await shotVp(page, 'TC-B15', '08-comptable-orders-lecture-seule');
  await page.goto('/orders/new');
  await page.waitForURL('**/orders', { timeout: 15_000 });
  console.log(`  UI /orders/new comptable → ${page.url()}`);
  expect.soft(page.url().endsWith('/orders'), 'COMPTABLE : /orders/new non redirigé').toBe(true);
  await shotVp(page, 'TC-B15', '09-comptable-orders-new-redirige');
  // UI : utilisateurs sans Inviter
  await page.goto('/users');
  expect.soft(await page.getByRole('button', { name: 'Inviter' }).count(), 'COMPTABLE : bouton Inviter visible').toBe(0);
  // UI : chauffeurs sans ajout
  await page.goto('/drivers');
  expect.soft(await page.getByRole('button', { name: 'Ajouter un chauffeur' }).count(), 'COMPTABLE : Ajouter un chauffeur visible').toBe(0);
  // UI : tarification — Enregistrer doit être absent ou désactivé
  await page.goto('/pricing');
  const savePricingC = page.getByRole('button', { name: 'Enregistrer' }).first();
  const pricingEnabledC = (await savePricingC.count()) > 0 && (await savePricingC.isEnabled());
  console.log(`  UI pricing Enregistrer (comptable) : actif=${pricingEnabledC}`);
  expect.soft(pricingEnabledC, 'COMPTABLE : bouton Enregistrer (tarification) actif dans l’UI').toBe(false);
  await shotVp(page, 'TC-B15', '10-comptable-pricing');
  // UI : paramètres en lecture seule
  await page.goto('/settings');
  expect.soft(await page.getByPlaceholder('Casa Express SARL').isDisabled(), 'COMPTABLE : champ identité modifiable').toBe(true);
  // UI : caisse / reversements / factures accessibles en écriture
  await page.goto('/cash');
  await page.waitForTimeout(1500);
  console.log(`  UI /cash comptable → ${page.url()}`);
  expect.soft(page.url()).toContain('/cash');
  await shotVp(page, 'TC-B15', '11-comptable-caisse');
  await page.goto('/invoices');
  await page.waitForTimeout(1500);
  console.log(`  UI /invoices comptable → ${page.url()}`);
  expect.soft(page.url()).toContain('/invoices');
  // UI : notifications — la matrice donne le journal en lecture au comptable
  await page.goto('/notifications');
  await page.waitForTimeout(1500);
  console.log(`  UI /notifications comptable → ${page.url()}`);
  expect.soft(page.url(), 'COMPTABLE : /notifications (journal) inaccessible').toContain('/notifications');
  await shotVp(page, 'TC-B15', '12-comptable-notifications');
  // API directe
  await checkApi(page, 'COMPTABLE', 'POST', 'orders', 403, {});
  await checkApi(page, 'COMPTABLE', 'POST', 'users', 403, { email: 'y@y.ma', name: 'Y', role: 'DISPATCHER' });
  await checkApi(page, 'COMPTABLE', 'POST', 'drivers', 403, { name: 'Y' });
  await checkApi(page, 'COMPTABLE', 'POST', 'settings/company', 403, {});
  await checkApi(page, 'COMPTABLE', 'POST', 'pricing/config', 403, {});
  await checkApi(page, 'COMPTABLE', 'POST', 'fraud/cases/00000000-0000-0000-0000-000000000000/clear', 403);
  await checkApi(page, 'COMPTABLE', 'POST', 'notifications/send', 403, {});
  await checkApi(page, 'COMPTABLE', 'GET', 'notifications', 200); // journal seul (matrice)
  await checkApi(page, 'COMPTABLE', 'GET', 'cash/sessions', 200);
  await checkApi(page, 'COMPTABLE', 'GET', 'invoices', 200);
  await checkApi(page, 'COMPTABLE', 'GET', 'analytics/summary', 200);
  await checkApi(page, 'COMPTABLE', 'GET', 'reviews', 200);
  await logout(page, 'Salma Bennis');
});
