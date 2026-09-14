import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-I03 — Réordonner manuellement un arrêt.
// ATT : le nouvel ordre survit au rechargement — sinon le livreur suit l'ordre d'avant.
test('TC-I03 — réordonnancement manuel persistant', async ({ page }) => {
  test.setTimeout(180_000);
  const jour = new Date().toISOString().slice(0, 10);

  // Décor : une tournée du jour encore ouverte, à trois arrêts.
  const id = sql(`SELECT id FROM tenant_rabatexpress.tournees WHERE day = '${jour}' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(id, 'une tournée du jour doit exister (TC-I01)').toBeTruthy();
  sql(`UPDATE tenant_rabatexpress.tournees SET status = 'PLANIFIEE' WHERE id = '${id}'`);
  const ordre = () => sql(`SELECT stops FROM tenant_rabatexpress.tournees WHERE id = '${id}'`)
    .replace(/[{}"]/g, '').trim().split(',');
  const avant = ordre();
  expect(avant.length).toBeGreaterThanOrEqual(2);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/tournees');
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-I03', '01-ordre-initial');

  // Descendre le premier arrêt : l'ordre doit s'inverser sur les deux premiers.
  // Le « descendre » du PREMIER arrêt : on part de sa référence, affichée sur sa carte,
  // et on prend le dernier bouton de cette carte (monter, puis descendre).
  const carte = page.locator('.rt-Card').filter({ hasText: avant[0] }).last();
  const boutons = carte.getByRole('button');
  console.log(`  carte du premier arrêt → ${await boutons.count()} bouton(s)`);
  await boutons.last().click();
  await page.waitForTimeout(2500);

  const apres = ordre();
  console.log(`  avant ${avant.join(' → ')}\n  après ${apres.join(' → ')}`);
  expect(apres).not.toEqual(avant);
  expect([...apres].sort()).toEqual([...avant].sort());
  await shotVp(page, 'TC-I03', '02-ordre-modifie');

  // Et après rechargement, c'est bien le nouvel ordre qui est servi.
  await page.reload();
  await page.locator('tr, [role="row"]').filter({ hasText: 'Hamid Ouali' }).first().click().catch(() => {});
  await page.waitForTimeout(1500);
  expect(ordre()).toEqual(apres);
  const corps = await page.locator('body').innerText();
  const positions = apres.map((ref) => corps.indexOf(ref));
  expect(positions.every((p, i) => i === 0 || p > positions[i - 1]),
    'les arrêts doivent s’afficher dans le nouvel ordre').toBe(true);
  await shotVp(page, 'TC-I03', '03-ordre-persistant');
});
