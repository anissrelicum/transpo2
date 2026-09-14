import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-M01 — Grille tarifaire.
// ATT : « Enregistré ✓ » et valeurs persistantes après rechargement — une grille qui ne
//       survit pas au rechargement ne facture rien.
test('TC-M01 — modifier et enregistrer la grille tarifaire', async ({ page }) => {
  test.setTimeout(180_000);
  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  await page.goto('/pricing');
  await expect(page.getByRole('heading', { name: 'Simulateur de devis' })).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-M01', '01-grille-initiale');

  const avant = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/pricing/config')).json()));
  console.log(`  grille avant → ${avant.tiers.length} palier(s), fragile ${avant.fragileSurcharge}, remise ${avant.discountRate}`);

  // Un supplément fragile modifié : la valeur doit survivre au rechargement.
  const nouveauFragile = (Number(avant.fragileSurcharge) || 0) + 7;
  // Le champ est repéré par sa VALEUR courante dans le bloc des suppléments : viser
  // « le premier champ numérique de la page » tombait sur un palier de distance, et le
  // cas concluait à tort que l'enregistrement ne persistait pas.
  const fragile = page.locator(`input[type="number"][value="${avant.fragileSurcharge}"]`).first();
  const cible = (await fragile.count())
    ? fragile
    : page.locator('input[type="number"]').nth(await page.locator('input[type="number"]').count() - 3);
  await cible.fill(String(nouveauFragile));
  await shotVp(page, 'TC-M01', '02-supplement-modifie');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Enregistré ✓' })).toBeVisible({ timeout: 20_000 });
  await shotVp(page, 'TC-M01', '03-enregistre');

  await page.reload();
  await page.waitForTimeout(2000);
  const apres = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/pricing/config')).json()));
  console.log(`  grille après rechargement → fragile ${apres.fragileSurcharge}`);
  expect(Number(apres.fragileSurcharge)).toBe(nouveauFragile);
  await shotVp(page, 'TC-M01', '04-persistance');

  // Remis comme avant, pour ne pas fausser les cas de facturation suivants.
  await page.evaluate(async (cfg) => {
    await fetch('/api/proxy/v1/pricing/config', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cfg),
    });
  }, avant);
});
