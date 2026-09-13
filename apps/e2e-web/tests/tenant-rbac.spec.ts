import { test, expect, type Page } from '@playwright/test';
import {
  loginTenant, logout, provisionTenant, saasToken, uniq, waitReady,
} from './helpers';

// Régression B15 (clés de la matrice) + retests BUG-B2/B3/B4 — RBAC console.
// Amorce : un tenant dédié + un DISPATCHER et un COMPTABLE invités via l'API de session.
test.describe.configure({ mode: 'serial' });

const slug = uniq('regrbac');
const adminEmail = `admin@${slug}.ma`;
const dispEmail = `dispatch@${slug}.ma`;
const comptaEmail = `compta@${slug}.ma`;
let adminPassword = '';
let dispPassword = '';
let comptaPassword = '';

/** Invite via /api/proxy (session admin courante) — retourne le mot de passe temporaire. */
async function inviteViaApi(page: Page, email: string, name: string, role: string): Promise<string> {
  const res = await page.request.post('/api/proxy/v1/users', { data: { email, name, role } });
  const body = await res.json().catch(() => null);
  expect(res.ok(), `invite ${email} → ${res.status()} ${JSON.stringify(body)}`).toBe(true);
  expect(body.tempPassword?.length ?? 0).toBeGreaterThan(8);
  return body.tempPassword;
}

test.beforeAll(async ({ request, browser }) => {
  await waitReady(request);
  const token = await saasToken(request);
  const t = await provisionTenant(request, token, {
    slug, name: 'Regression RBAC', planCode: 'transporteur',
    adminEmail, adminName: 'Admin Rbac',
  });
  adminPassword = t.adminPassword ?? '';
  expect(adminPassword.length).toBeGreaterThan(8);

  const page = await browser.newPage();
  try {
    const err = await loginTenant(page, slug, adminEmail, adminPassword);
    expect(err).toBeNull();
    dispPassword = await inviteViaApi(page, dispEmail, 'Disp Rbac', 'DISPATCHER');
    comptaPassword = await inviteViaApi(page, comptaEmail, 'Compta Rbac', 'COMPTABLE');
  } finally {
    await page.close();
  }
});

/** /pricing en lecture seule : aucune écriture, champs désactivés (BUG-B2). */
async function expectPricingReadOnly(page: Page, tag: string) {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Tarification' })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Enregistrer' }).count(), `${tag} : Enregistrer visible`).toBe(0);
  expect(await page.getByRole('button', { name: /Palier/ }).count(), `${tag} : « + Palier » visible`).toBe(0);
  // Pas de <main> dans AppShell (le contenu est dans une Box) : on cible les champs
  // numériques de la page, comme le retest recette BUG-B2.
  const inputs = page.locator('input[type="number"]');
  const n = await inputs.count();
  expect(n, `${tag} : aucun champ tarifaire trouvé`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    expect(await inputs.nth(i).isDisabled(), `${tag} : champ #${i} modifiable`).toBe(true);
  }
}

test('DISPATCHER : /pricing en lecture seule ; POST /orders {} → 400 validé', async ({ page }) => {
  const err = await loginTenant(page, slug, dispEmail, dispPassword);
  expect(err).toBeNull();

  await expectPricingReadOnly(page, 'DISPATCHER');

  // Corps invalide : 400 « Champs requis manquants », pas un 500 SQL (BUG-B3).
  const res = await page.request.fetch('/api/proxy/v1/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' }, data: {},
  });
  const body = await res.json().catch(() => null);
  expect(res.status()).toBe(400);
  expect(JSON.stringify(body)).toContain('Champs requis manquants');
});

test('COMPTABLE : /pricing lecture seule ; notifications GET 200 / POST send 403', async ({ page }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, slug, comptaEmail, comptaPassword);
  expect(err).toBeNull();

  await expectPricingReadOnly(page, 'COMPTABLE');

  // Journal des notifications accessible en lecture (BUG-B4), aucune écriture.
  await page.goto('/notifications');
  await expect(page).toHaveURL(/\/notifications/);
  await expect(page.getByRole('heading', { name: 'Centre de notifications' })).toBeVisible();
  expect(await page.getByRole('button', { name: 'Envoyer' }).count(), 'bouton Envoyer visible').toBe(0);

  const get = await page.request.fetch('/api/proxy/v1/notifications');
  expect(get.status(), 'GET /v1/notifications comptable').toBe(200);
  const send = await page.request.fetch('/api/proxy/v1/notifications/send', {
    method: 'POST', headers: { 'content-type': 'application/json' }, data: {},
  });
  expect(send.status(), 'POST /v1/notifications/send comptable').toBe(403);
});

test('contrôle ADMIN : /pricing éditable (Enregistrer + paliers actifs)', async ({ page }) => {
  const err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await page.goto('/pricing');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Palier/ })).toBeVisible();
  await expect(page.locator('table input[type="number"]').first()).toBeEnabled();
  await logout(page, 'Admin Rbac');
});
