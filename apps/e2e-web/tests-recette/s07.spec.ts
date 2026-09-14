import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp } from './helpers';

// TC-S07 — Session expirée.
// ATT : sans cookie de session, une page d'exploitation renvoie au login — pas de contenu
//       servi à un visiteur sans session.
test('TC-S07 — la perte de session renvoie au login', async ({ page, context }) => {
  test.setTimeout(120_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/orders');
  await expect(page.getByRole('heading', { name: /Commandes/ }).first()).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-S07', '01-session-ouverte');

  await context.clearCookies();
  await page.goto('/orders');
  await page.waitForURL('**/login**', { timeout: 20_000 });
  console.log(`  après suppression du cookie → ${new URL(page.url()).pathname}`);
  await shotVp(page, 'TC-S07', '02-renvoye-au-login');

  // Et le contenu n'a pas fui au passage : la page d'arrivée est bien le formulaire.
  await expect(page.locator('input[name="email"]')).toBeVisible();
});
