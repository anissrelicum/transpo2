// Helpers des specs de NON-RÉGRESSION (CI docker, homelab possible via WEB_URL/API_URL).
// Différences avec tests-recette/helpers.ts : pas de captures, pas de SQL/kubectl,
// provisioning via l'API super-admin — chaque spec crée ses propres données.
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const BASE = process.env.WEB_URL || 'http://console-web:3001';
// Réseau compose : l'API est joignable directement. Homelab : API_URL=http://transpo-api.wedowonders.com.
export const API = process.env.API_URL || 'http://api:3000';

export const SAAS_EMAIL = 'ops@transpo.ma';
export const SAAS_PASSWORD = 'transpo';

let seq = 0;
/** Suffixe unique et URL-safe ([a-z0-9]) pour slugs, emails, codes de plan. */
export function uniq(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;
}

/** Attend que la console réponde (stack docker qui démarre). */
export async function waitReady(request: APIRequestContext) {
  for (let i = 0; i < 40; i++) {
    try { const r = await request.get(`${BASE}/login`); if (r.ok()) return; } catch { /* pas prêt */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('console-web indisponible');
}

/** JWT super-admin plateforme, via l'API directe. */
export async function saasToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/v1/auth/super/login`, {
    data: { email: SAAS_EMAIL, password: SAAS_PASSWORD },
  });
  expect(res.status(), `login super-admin API → ${res.status()}`).toBe(200);
  return (await res.json()).token;
}

export type Provisioned = { slug: string; adminEmail?: string; adminPassword?: string };

/** Provisionne un tenant via l'API super-admin (essai 30 j sur le plan choisi). */
export async function provisionTenant(
  request: APIRequestContext,
  token: string,
  input: { slug: string; name: string; city?: string; planCode?: string; adminEmail?: string; adminName?: string },
): Promise<Provisioned> {
  const res = await request.post(`${API}/v1/saas/tenants`, {
    headers: { authorization: `Bearer ${token}` },
    data: input,
  });
  const body = await res.json().catch(() => null);
  expect(res.ok(), `provision ${input.slug} → ${res.status()} ${JSON.stringify(body)}`).toBe(true);
  return {
    slug: body.slug,
    adminEmail: body.admin?.email,
    adminPassword: body.admin?.tempPassword,
  };
}

/** Appel API plateforme authentifié (réponses négatives incluses). */
export async function saasApi(
  request: APIRequestContext, token: string, method: 'GET' | 'POST' | 'PATCH',
  path: string, body?: unknown,
) {
  const res = await request.fetch(`${API}/v1/saas/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    data: body,
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

/** Connexion super-admin via l'UI → /saas. */
export async function loginSaas(page: Page) {
  await page.goto('/login?realm=saas');
  await page.locator('input[name="email"]').fill(SAAS_EMAIL);
  await page.locator('input[name="password"]').fill(SAAS_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.waitForURL('**/saas**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
}

/** Connexion tenant via ?org=<slug>. Retourne le message d'erreur affiché, null si succès. */
export async function loginTenant(page: Page, slug: string, email: string, password: string): Promise<string | null> {
  await page.goto(`/login?org=${slug}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const ok = await page.waitForURL('**/dashboard**', { timeout: 12_000 }).then(() => true).catch(() => false);
  if (ok) return null;
  const alertBox = page.locator('[role="alert"]');
  return (await alertBox.count()) ? (await alertBox.first().textContent()) : 'pas de message affiché';
}

/** Déconnexion console tenant via le menu avatar → retour /login. */
export async function logout(page: Page, name?: string) {
  // Plusieurs éléments ont aria-haspopup="menu" (LangSwitch avant l'avatar dans la
  // topbar, menus « … » des lignes) : le nom de l'utilisateur identifie le bon menu.
  const trigger = name
    ? page.locator('div[aria-haspopup="menu"]').filter({ hasText: name })
    : page.locator('[aria-haspopup="menu"]').first();
  await trigger.click();
  await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
  await page.waitForURL('**/login**', { timeout: 15_000 });
}

/**
 * Invite un utilisateur depuis /users (dialogue déjà fermé non compris).
 * Retourne le mot de passe temporaire ; le dialogue de révélation reste OUVERT.
 */
export async function inviteUser(page: Page, name: string, email: string, roleLabel?: string): Promise<string> {
  await page.getByRole('button', { name: 'Inviter' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('Nom complet').fill(name);
  await dlg.getByPlaceholder('prenom.nom@tenant.ma').fill(email);
  if (roleLabel) {
    await dlg.getByRole('combobox').click();
    await page.getByRole('option', { name: roleLabel }).click();
  }
  await dlg.getByRole('button', { name: 'Inviter' }).click();
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await expect(reveal.getByText('Mot de passe temporaire')).toBeVisible({ timeout: 15_000 });
  await expect(reveal.getByText(`${name} (${email})`)).toBeVisible();
  return ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
}

/** Ouvre le menu « … » de la ligne d'un plan sur /saas/plans. */
export async function openPlanMenu(page: Page, code: string) {
  const row = page.getByRole('row', { name: new RegExp(code) });
  await row.getByRole('button').last().click();
}

/** Écoute le prochain window.alert et renvoie son message. */
export function nextAlert(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.once('dialog', async (d) => { const m = d.message(); await d.accept(); resolve(m); });
  });
}

/**
 * Ferme menu / alertdialog / dialog restés ouverts après une action refusée :
 * tant qu'une surcouche Radix est ouverte, elle masque le tableau en aria-hidden
 * et les lignes sortent de l'arbre d'accessibilité.
 */
export async function closeOverlays(page: Page) {
  const overlays = page.locator('[role="menu"], [role="alertdialog"], [role="dialog"]');
  for (let i = 0; i < 6 && (await overlays.count()) > 0; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
  await expect(overlays).toHaveCount(0);
}
