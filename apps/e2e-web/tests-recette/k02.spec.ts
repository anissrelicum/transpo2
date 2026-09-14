import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-K02 — Reprogrammer une tentative.
// ATT : statut Reprogrammée, compteur incrémenté, et la commande REDEVIENT livrable côté
//       livreur — sinon la reprogrammation n'est qu'un changement d'étiquette.
test('TC-K02 — reprogrammer une tentative de livraison', async ({ page }) => {
  test.setTimeout(180_000);

  const ref = sql(`SELECT ref FROM tenant_rabatexpress.returns
                   WHERE status = 'A_TRAITER' ORDER BY created_at DESC LIMIT 1`).trim();
  expect(ref, 'un retour à traiter doit exister (TC-K01)').toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
  await page.goto('/returns');
  await page.getByText(ref).first().click();
  await page.waitForTimeout(1200);
  await shotVp(page, 'TC-K02', '01-avant-reprogrammation');

  await page.getByRole('button', { name: /Reprogrammer une tentative \(2\/3\)/ }).click();
  await expect.poll(
    () => sql(`SELECT status, attempts FROM tenant_rabatexpress.returns WHERE ref = '${ref}'`).trim(),
    { timeout: 20_000 },
  ).toBe('REPLANIFIE | 2');
  console.log('  retour → REPLANIFIE, 2 tentatives');
  await shotVp(page, 'TC-K02', '02-reprogramme');

  // Et surtout : la commande est de nouveau livrable par le livreur.
  const statutCommande = sql(`SELECT status, driver FROM tenant_rabatexpress.orders WHERE ref = '${ref}'`)
    .split('|').map((x) => x.trim());
  console.log(`  commande → ${statutCommande[0]}, livreur ${statutCommande[1]}`);
  expect(statutCommande[0]).toBe('LIVRAISON');
  expect(statutCommande[1]).toBeTruthy();
});
