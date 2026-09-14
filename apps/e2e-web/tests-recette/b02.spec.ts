import { test, expect } from '@playwright/test';
import { compteCli, loginTenant, saveCredential, shotVp } from './helpers';

// TC-B02 — Amorçage de l'admin (contournement documenté, §0.3).
// PAS : exécuter la commande `account` pour admin@rabatexpress.ma.
// ATT : la connexion /login?org=rabatexpress avec Test1234 aboutit sur /dashboard.
test('TC-B02 — amorçage admin en CLI puis connexion', async ({ page }) => {
  // La commande était codée pour le homelab (`kubectl exec` dans le pod API) : le cas
  // était injouable en local. Elle passe désormais par ACCOUNT_EXEC, comme le reste.
  const out = compteCli('rabatexpress', 'admin@rabatexpress.ma', 'Nadia Alaoui', 'ADMIN', 'Test1234');
  console.log(`TC-B02 account CLI → ${out}`);
  expect(out).toContain('Compte OK');
  // Les sections C à T relisent ce mot de passe dans COMPTES.md : sans cette ligne, un run
  // sur base neuve amorçait bien l'admin mais aucun cas suivant ne savait s'y connecter.
  saveCredential(`TC-B02 rabatexpress ADMIN admin@rabatexpress.ma tempPassword=Test1234`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await expect(page).toHaveURL(/\/dashboard/);
  const topbar = page.locator('div[aria-haspopup="menu"]').filter({ hasText: 'Nadia Alaoui' });
  await expect(topbar).toBeVisible();
  await expect(topbar.getByText('Administrateur')).toBeVisible();
  await shotVp(page, 'TC-B02', '01-dashboard-apres-amorcage');
});
