import { execSync } from 'node:child_process';
import { test, expect } from '@playwright/test';
import { loginTenant, shotVp } from './helpers';

// TC-B02 — Amorçage de l'admin (contournement documenté, §0.3).
// PAS : exécuter la commande `account` pour admin@rabatexpress.ma.
// ATT : la connexion /login?org=rabatexpress avec Test1234 aboutit sur /dashboard.
test('TC-B02 — amorçage admin en CLI puis connexion', async ({ page }) => {
  const out = execSync(
    `kubectl exec -n transpo deploy/transpo-api -- sh -c 'cd /repo && pnpm --filter @transpo/db account rabatexpress admin@rabatexpress.ma "Nadia Alaoui" ADMIN Test1234'`,
    { encoding: 'utf-8' },
  ).trim();
  console.log(`TC-B02 account CLI → ${out}`);
  expect(out).toContain('Compte OK');

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  const topbar = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Nadia Alaoui' });
  await expect(topbar).toBeVisible();
  await expect(topbar.getByText('Administrateur')).toBeVisible();
  await shotVp(page, 'TC-B02', '01-dashboard-apres-amorcage');
});
