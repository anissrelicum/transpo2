import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-K03 — Plafond de tentatives.
// ATT : au-delà de 3 tentatives, le bouton disparaît et le plafond est annoncé ; l'API
//       refuse aussi, pas seulement l'écran.
test('TC-K03 — plafond de trois tentatives', async ({ page }) => {
  test.setTimeout(180_000);

  const ref = sql(`SELECT ref FROM tenant_rabatexpress.returns ORDER BY created_at DESC LIMIT 1`).trim();
  expect(ref).toBeTruthy();
  // Décor : le retour en est à sa troisième tentative — le plafond est atteint.
  sql(`UPDATE tenant_rabatexpress.returns SET attempts = 3, status = 'A_TRAITER' WHERE ref = '${ref}'`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/returns');
  await page.getByText(ref).first().click();
  await page.waitForTimeout(1200);

  await expect(page.getByText('Plafond de tentatives atteint — reprogrammation impossible.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Reprogrammer une tentative/ })).toHaveCount(0);
  await shotVp(page, 'TC-K03', '01-plafond-atteint');

  // L'API tient la même ligne — l'écran n'est pas le seul garde-fou.
  const refus = await page.evaluate(async (r) => {
    const res = await fetch(`/api/proxy/v1/returns/${r}/reschedule`, { method: 'POST' });
    return { status: res.status, corps: await res.text() };
  }, ref);
  console.log(`  API reschedule au plafond → ${refus.status} ${refus.corps.slice(0, 80)}`);
  expect(refus.status).toBe(400);
  expect(sql(`SELECT attempts FROM tenant_rabatexpress.returns WHERE ref = '${ref}'`).trim()).toBe('3');
});
