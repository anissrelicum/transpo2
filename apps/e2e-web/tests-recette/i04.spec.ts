import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-I04 — Cycle de vie d'une tournée.
// ATT : Planifiée → En cours → Clôturée, et plus AUCUNE écriture sur une tournée close —
//       y compris en contournant l'écran.
test('TC-I04 — cycle de vie et fermeture d’une tournée', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/tournees');
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);

  const id = sql(`SELECT id FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`).trim();
  const statut = () => sql(`SELECT status FROM tenant_rabatexpress.tournees WHERE id = '${id}'`).trim();
  expect(statut()).toBe('PLANIFIEE');
  await shotVp(page, 'TC-I04', '01-planifiee');

  await page.getByRole('button', { name: 'Valider la tournée' }).click();
  await expect.poll(() => statut(), { timeout: 20_000 }).toBe('EN_COURS');
  console.log('  Planifiée → En cours');
  await shotVp(page, 'TC-I04', '02-en-cours');

  await page.getByRole('button', { name: 'Clôturer' }).click();
  await expect.poll(() => statut(), { timeout: 20_000 }).toBe('CLOTUREE');
  console.log('  En cours → Clôturée');
  await shotVp(page, 'TC-I04', '03-cloturee');

  // Plus aucune action d'écriture à l'écran.
  await page.reload();
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.getByRole('button', { name: 'Valider la tournée' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Clôturer' })).toHaveCount(0);
  await shotVp(page, 'TC-I04', '04-aucune-action');

  // Et l'API tient la même ligne : une tournée close ne se réordonne ni ne se relance.
  const stops = sql(`SELECT stops FROM tenant_rabatexpress.tournees WHERE id = '${id}'`)
    .replace(/[{}"]/g, '').trim().split(',');
  const refus = await page.evaluate(async ([tid, s]) => {
    const r1 = await fetch(`/api/proxy/v1/tournees/${tid}/reorder`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stops: [...s].reverse() }),
    });
    const r2 = await fetch(`/api/proxy/v1/tournees/${tid}/advance`, { method: 'POST' });
    return { reorder: r1.status, advance: r2.status };
  }, [id, stops] as const);
  console.log(`  API sur tournée close → reorder ${refus.reorder}, advance ${refus.advance}`);
  expect(refus.reorder).toBe(400);
  expect(refus.advance).toBe(400);
  expect(sql(`SELECT stops FROM tenant_rabatexpress.tournees WHERE id = '${id}'`).replace(/[{}"]/g, '').trim().split(','))
    .toEqual(stops);
});
