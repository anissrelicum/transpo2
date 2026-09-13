import { test, expect } from '@playwright/test';
import { loginSaas, shotVp } from './helpers';

// TC-A12 — Cloisonnement du realm plateforme : connecté en super-admin,
// tenter /dashboard puis /orders → accès refusé / redirection vers le login.
test('TC-A12 — Cloisonnement du realm plateforme', async ({ page }) => {
  await loginSaas(page);
  await shotVp(page, 'TC-A12', '01-session-super-admin-sur-saas');

  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/login/, { timeout: 20_000 });
  await shotVp(page, 'TC-A12', '02-dashboard-redirige-vers-login');

  await page.goto('/orders');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveURL(/login/, { timeout: 20_000 });
  await shotVp(page, 'TC-A12', '03-orders-redirige-vers-login');

  // La session super-admin reste valide sur /saas.
  await page.goto('/saas');
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
});
