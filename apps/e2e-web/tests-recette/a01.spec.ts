import { test, expect } from '@playwright/test';
import { shot, nbTenants } from './helpers';

// TC-A01 — Connexion super-admin : /login?realm=saas → badge Plateforme → /saas.
// Le cas d'origine exigeait une liste VIDE, ce qui ne valait qu'au tout premier passage sur
// une base neuve. Ce qu'il prouve réellement — le realm est détecté, la connexion aboutit,
// la console plateforme s'ouvre sur le parc — vaut à tout moment.
test('TC-A01 — Connexion super-admin', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/login?realm=saas');
  await expect(page.getByTestId('detected-org')).toHaveText(/plateforme/i);
  await shot(page, 'TC-A01', '01-login-realm-saas-badge-plateforme');

  await page.locator('input[name="email"]').fill('ops@transpo.ma');
  await page.locator('input[name="password"]').fill('transpo');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await page.waitForURL('**/saas**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Organisations' })).toBeVisible();
  const parc = nbTenants();
  console.log(`organisations au parc → ${parc}`);
  if (parc === 0) {
    await expect(page.getByText('Aucune organisation.', { exact: true })).toBeVisible();
  } else {
    await expect(page.locator('table tbody tr')).toHaveCount(parc);
  }
  await shot(page, 'TC-A01', '02-console-plateforme-ouverte');
});
