import * as fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// Retest BUG-B4 (ex-TC-B15) — le COMPTABLE accède au journal des notifications en lecture :
// UI /notifications accessible (pas de redirection /login), aucune action d'écriture visible,
// GET /v1/notifications → 200, écritures (send/retry/consent) → 403.

function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

test('Retest BUG-B4 — journal notifications accessible en lecture au comptable', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwdOf('TC-B08'));
  expect(err).toBeNull();

  // UI : /notifications accessible, pas de redirection vers /login.
  await page.goto('/notifications');
  await page.waitForTimeout(1500);
  console.log(`UI /notifications comptable → ${page.url()}`);
  expect(page.url(), 'COMPTABLE : /notifications redirigé vers /login').toContain('/notifications');
  await expect(page.getByRole('heading', { name: 'Centre de notifications' })).toBeVisible();
  await shotVp(page, 'TC-B15', 'retest-comptable-notifications');

  // UI : aucune action d'écriture (Envoyer, Consentement, menus de ligne).
  expect(await page.getByRole('button', { name: 'Envoyer' }).count(), 'bouton Envoyer visible').toBe(0);
  expect(await page.getByRole('button', { name: 'Consentement' }).count(), 'bouton Consentement visible').toBe(0);
  expect(await page.locator('table button[aria-haspopup="menu"]').count(), 'menus de ligne visibles').toBe(0);

  // API (session courante via proxy) : lecture 200, écritures 403.
  const get = await page.request.fetch('/api/proxy/v1/notifications');
  console.log(`GET /v1/notifications comptable → ${get.status()}`);
  expect(get.status()).toBe(200);
  const send = await page.request.fetch('/api/proxy/v1/notifications/send', {
    method: 'POST', headers: { 'content-type': 'application/json' }, data: {},
  });
  console.log(`POST /v1/notifications/send comptable → ${send.status()}`);
  expect(send.status()).toBe(403);
  const consent = await page.request.fetch('/api/proxy/v1/notifications/consent', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    data: { subject: 'x', channel: 'SMS', optedIn: true },
  });
  console.log(`POST /v1/notifications/consent comptable → ${consent.status()}`);
  expect(consent.status()).toBe(403);

  await logout(page, 'Salma Bennis');
});
