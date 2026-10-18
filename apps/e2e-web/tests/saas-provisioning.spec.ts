import { test, expect } from '@playwright/test';
import {
  loginSaas, loginTenant, provisionTenant, saasApi, saasToken, uniq, waitReady,
} from './helpers';

// Régression A03 / A04 / A05 / B02 — cycle de vie du provisioning d'un tenant.
// Série : les tests partagent le tenant provisionné dans le premier.
test.describe.configure({ mode: 'serial' });

let token: string;
const slug = uniq('regprov');
const adminEmail = `admin@${slug}.ma`;
let adminPassword = '';

test.beforeAll(async ({ request }) => {
  await waitReady(request);
  token = await saasToken(request);
});

test('provisioning UI : ligne Essai 30 j, mot de passe admin affiché une seule fois', async ({ page }) => {
  await loginSaas(page);

  await page.getByRole('button', { name: 'Provisionner' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Provisionner une organisation')).toBeVisible();

  await dialog.getByPlaceholder('rabatexpress', { exact: true }).fill(slug);
  await dialog.getByPlaceholder('Rabat Express').fill('Regression Prov');
  // Ville : 3e champ du formulaire (défaut « Casablanca », sans placeholder).
  await dialog.locator('input').nth(2).fill('Rabat');
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Transporteur' }).click();
  await dialog.getByPlaceholder('Youssef Tazi').fill('Admin Reg');
  await dialog.getByPlaceholder('admin@rabatexpress.ma').fill(adminEmail);

  await dialog.getByRole('button', { name: 'Provisionner' }).click();

  // Mot de passe temporaire du 1er admin, affiché une seule fois.
  const reveal = page.getByRole('dialog').filter({ hasText: 'ne sera plus affiché' });
  await expect(reveal.getByText('Compte administrateur créé')).toBeVisible({ timeout: 20_000 });
  await expect(reveal.getByText(`Admin Reg (${adminEmail})`)).toBeVisible();
  adminPassword = ((await reveal.locator('[style*="code-font"]').first().textContent()) ?? '').trim();
  expect(adminPassword.length).toBeGreaterThan(8);
  await reveal.getByRole('button', { name: 'Fermer' }).click();
  // Fermé, le mot de passe n'est plus affiché nulle part.
  await expect(page.getByText(adminPassword)).toHaveCount(0);

  // La ligne apparaît : abonnement Essai (30 j), plan visé Transporteur.
  const row = page.getByRole('row', { name: new RegExp(slug) });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Regression Prov');
  await expect(row).toContainText('Transporteur');
  await expect(row.getByText('Essai')).toBeVisible();
  await expect(row).toContainText(/\d+ j restants/);
});

test('slug réservé refusé (API) : api/www/admin → 400, rien de créé', async ({ request }) => {
  for (const reserved of ['api', 'www', 'admin']) {
    const { status, body } = await saasApi(request, token, 'POST', 'tenants', { slug: reserved, name: 'Test' });
    expect(status, `slug ${reserved}`).toBe(400);
    expect(JSON.stringify(body)).toContain('réservé');
  }
});

test('slug en doublon refusé (API) : 409, aucune duplication', async ({ request, page }) => {
  const { status, body } = await saasApi(request, token, 'POST', 'tenants', { slug, name: 'Doublon' });
  expect(status).toBe(409);
  expect(JSON.stringify(body)).toContain('Tenant déjà existant');

  // Une seule ligne pour ce slug dans la console.
  await loginSaas(page);
  await expect(page.getByRole('row', { name: new RegExp(slug) })).toHaveCount(1);
  await expect(page.getByRole('row', { name: /Doublon/ })).toHaveCount(0);
});

test('le nouvel admin se connecte sur son tenant (?org=slug)', async ({ page }) => {
  const err = await loginTenant(page, slug, adminEmail, adminPassword);
  expect(err).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Admin Reg')).toBeVisible();
  await expect(page.getByText('Administrateur')).toBeVisible();
});

// Le provisioning API (utilisé en amorce par les autres specs) rend le mdp admin et refuse les doublons.
test('provisioning via API : mdp admin retourné, doublon refusé (409)', async ({ request }) => {
  const again = await provisionTenant(request, token, {
    slug: uniq('regapi'), name: 'Regression API', city: 'Fès', planCode: 'tpe-coursier',
    adminEmail: `admin-${uniq('')}@regapi.ma`, adminName: 'Admin Api',
  });
  expect(again.adminPassword?.length ?? 0).toBeGreaterThan(8);
  const dup = await saasApi(request, token, 'POST', 'tenants', { slug: again.slug, name: 'Bis' });
  expect(dup.status).toBe(409);
});
