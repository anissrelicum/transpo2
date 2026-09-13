import { test, expect } from '@playwright/test';
import { loginSaas, waitReady } from './helpers';

// Régression A01 / A12 / B06 (realm plateforme) — session super-admin.
test.beforeAll(async ({ request }) => waitReady(request));

test('connexion super-admin : badge Plateforme → /saas', async ({ page }) => {
  await page.goto('/login?realm=saas');
  await expect(page.getByTestId('detected-org')).toHaveText(/plateforme/i);

  await page.locator('input[name="email"]').fill('ops@transpo.ma');
  await page.locator('input[name="password"]').fill('transpo');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await page.waitForURL('**/saas**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
  await expect(page.getByText('Console SaaS')).toBeVisible();
});

test('cloisonnement realm : /dashboard et /orders redirigent vers /login', async ({ page }) => {
  await loginSaas(page);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/login/, { timeout: 20_000 });

  await page.goto('/orders');
  await expect(page).toHaveURL(/login/, { timeout: 20_000 });

  // La session super-admin reste valide sur /saas.
  await page.goto('/saas');
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
});

test('déconnexion super-admin : retour /login, /saas à nouveau protégé', async ({ page }) => {
  await loginSaas(page);
  await page.getByRole('button', { name: 'Quitter' }).click();
  await page.waitForURL('**/login**', { timeout: 15_000 });

  // Cookies purgés : /saas renvoie vers le login.
  await page.goto('/saas');
  await expect(page).toHaveURL(/login/, { timeout: 20_000 });
});
