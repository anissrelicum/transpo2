import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-N01 — Tableau de bord marchand.
// ATT : les indicateurs ne portent QUE sur les commandes du marchand connecté.
test('TC-N01 — le portail marchand ne montre que ses commandes', async ({ page }) => {
  test.setTimeout(180_000);
  const email = 'marchand@rabatexpress.ma';
  const marchand = sql(`SELECT merchant FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  expect(marchand, 'un compte marchand doit exister (TC-F13)').toBeTruthy();

  const attendu = sql(`SELECT count(*), COALESCE(SUM(CASE WHEN status='LIVREE' THEN 1 ELSE 0 END),0),
                              COALESCE(SUM(CASE WHEN cod > 0 AND NOT cod_paid AND status <> 'ANNULEE' THEN cod ELSE 0 END),0)
                       FROM tenant_rabatexpress.orders WHERE merchant = '${marchand}'`)
    .split('|').map((x) => x.trim());
  console.log(`  ${marchand} → ${attendu[0]} commande(s), ${attendu[1]} livrée(s), ${attendu[2]} DH de COD à encaisser`);

  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();
  await page.waitForURL('**/portail**', { timeout: 20_000 });
  await page.waitForTimeout(1500);
  await shotVp(page, 'TC-N01', '01-tableau-de-bord-marchand');

  const corps = await page.locator('body').innerText();
  expect(corps).toContain(marchand);

  // Aucune commande d'un autre marchand ne doit transparaître.
  const autres = sql(`SELECT ref FROM tenant_rabatexpress.orders
                      WHERE merchant IS NOT NULL AND merchant <> '${marchand}' LIMIT 5`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  for (const ref of autres) expect(corps).not.toContain(ref);
  console.log(`  ${autres.length} commande(s) d’un autre marchand : absentes de l’écran`);

  // Et l'API marchande est bornée au même périmètre.
  const via = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/merchant/orders')).json()));
  for (const o of via) expect(o.merchant).toBe(marchand);
  console.log(`  /v1/merchant/orders → ${via.length} commande(s), toutes de ${marchand}`);
  await shotVp(page, 'TC-N01', '02-perimetre-marchand');
});
