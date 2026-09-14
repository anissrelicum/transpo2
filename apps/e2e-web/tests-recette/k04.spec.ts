import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-K04 — Retour au marchand.
// ATT : statut Rendu au marchand, ligne basculée dans « Clôturés », et plus AUCUNE action
//       possible — y compris en contournant l'écran.
test('TC-K04 — restitution au marchand et clôture du retour', async ({ page }) => {
  test.setTimeout(180_000);

  const ref = sql(`SELECT ref FROM tenant_rabatexpress.returns ORDER BY created_at DESC LIMIT 1`).trim();
  expect(ref).toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/returns');
  await page.getByText(ref).first().click();
  await page.waitForTimeout(1200);
  await shotVp(page, 'TC-K04', '01-avant-restitution');

  await page.getByRole('button', { name: 'Lancer le retour au marchand' }).click();
  await expect.poll(
    () => sql(`SELECT status FROM tenant_rabatexpress.returns WHERE ref = '${ref}'`).trim(),
    { timeout: 20_000 },
  ).toBe('RENDU');
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`).trim()).toBe('RETOUR');
  console.log('  retour RENDU, commande RETOUR');
  await shotVp(page, 'TC-K04', '02-rendu-au-marchand');

  // La ligne quitte les retours actifs pour les clôturés.
  await page.reload();
  await page.waitForTimeout(1500);
  const actifs = await page.locator('body').innerText();
  expect(actifs).not.toContain(ref);
  await page.getByRole('tab', { name: 'Clôturés' }).click();
  await page.waitForTimeout(1200);
  await expect(page.getByText(ref).first()).toBeVisible();
  await shotVp(page, 'TC-K04', '03-onglet-clotures');

  // Et rien ne peut plus lui arriver : un colis rendu au marchand n'est plus chez nous.
  const refus = await page.evaluate(async (r) => {
    const a = await fetch(`/api/proxy/v1/returns/${r}/reschedule`, { method: 'POST' });
    const b = await fetch(`/api/proxy/v1/returns/${r}/return-to-merchant`, { method: 'POST' });
    return { reschedule: a.status, rendu: b.status };
  }, ref);
  console.log(`  API sur retour clos → reschedule ${refus.reschedule}, retour ${refus.rendu}`);
  expect(refus.reschedule).toBe(400);
  expect(refus.rendu).toBe(400);
  expect(sql(`SELECT status FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`).trim()).toBe('RETOUR');
});
