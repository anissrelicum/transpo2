import * as fs from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { COMPTES, loginTenant, logout, shotVp } from './helpers';

// Retest BUG-B2 (ex-TC-B15) — /pricing en lecture seule pour DISPATCHER et COMPTABLE :
// bouton Enregistrer absent, « + Palier » absent, champs désactivés ; simulateur et
// export CSV (« Export grille ») restent fonctionnels. ADMIN : édition disponible.

function pwdOf(marker: string): string {
  const lines = fs.readFileSync(COMPTES, 'utf-8').split('\n').filter((l) => l.includes(marker));
  const m = /tempPassword=(\S+)/.exec(lines.at(-1) ?? '');
  if (!m) throw new Error(`mot de passe introuvable pour ${marker}`);
  return m[1];
}

async function checkPricingReadOnly(page: Page, tag: string) {
  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Tarification' })).toBeVisible();

  // Écriture absente : Enregistrer, + Palier, corbeilles de suppression.
  expect(await page.getByRole('button', { name: 'Enregistrer' }).count(), `${tag} : Enregistrer visible`).toBe(0);
  expect(await page.getByRole('button', { name: /Palier/ }).count(), `${tag} : « + Palier » visible`).toBe(0);
  // Champs de la grille + suppléments désactivés.
  const inputs = page.locator('main input[type="number"], [class*="rt-Card"] input[type="number"]');
  const n = await inputs.count();
  expect(n, `${tag} : aucun champ tarifaire trouvé`).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    expect(await inputs.nth(i).isDisabled(), `${tag} : champ #${i} modifiable`).toBe(true);
  }
  await shotVp(page, 'TC-B15', `retest-${tag}-pricing-lecture-seule`);

  // Simulateur fonctionnel : déplacer le curseur change la distance et le total.
  await expect(page.getByRole('heading', { name: 'Simulateur de devis' })).toBeVisible();
  const slider = page.getByRole('slider');
  await slider.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText(/Distance : 11 km/)).toBeVisible();
  await expect(page.getByText('Total TTC')).toBeVisible();
  await shotVp(page, 'TC-B15', `retest-${tag}-pricing-simulateur`);

  // Export CSV fonctionnel.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 10_000 }),
    page.getByRole('button', { name: 'Export grille' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('grille-tarifaire.csv');
  console.log(`${tag} : export CSV OK (${download.suggestedFilename()}), simulateur OK, édition absente`);
}

test('Retest BUG-B2 — /pricing RBAC : lecture seule dispatcher/comptable, édition admin', async ({ page }) => {
  test.setTimeout(180_000);

  // DISPATCHER
  let err = await loginTenant(page, 'rabatexpress', 'dispatch@rabatexpress.ma', pwdOf('TC-B11'));
  expect(err).toBeNull();
  await checkPricingReadOnly(page, 'dispatcher');
  await logout(page, 'Reda Ziani');

  // COMPTABLE
  err = await loginTenant(page, 'rabatexpress', 'compta@rabatexpress.ma', pwdOf('TC-B08'));
  expect(err).toBeNull();
  await checkPricingReadOnly(page, 'comptable');
  await logout(page, 'Salma Bennis');

  // ADMIN : édition disponible.
  err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', 'Test1234');
  expect(err).toBeNull();
  await page.goto('/pricing');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Palier/ })).toBeVisible();
  const firstInput = page.locator('table input[type="number"]').first();
  await expect(firstInput).toBeEnabled();
  await shotVp(page, 'TC-B15', 'retest-admin-pricing-edition');
  console.log('admin : Enregistrer + Palier présents, champs actifs');
  await logout(page, 'Nadia Alaoui');
});
