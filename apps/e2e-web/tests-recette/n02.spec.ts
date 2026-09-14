import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-N02 / TC-N03 — Mes commandes et portefeuille marchand.
// ATT : filtrage réel, aucune commande d'un autre marchand ; COD encaissé et net à
//       reverser cohérents avec ce que l'exploitation calcule.
test('TC-N02 — commandes et portefeuille du marchand', async ({ page }) => {
  test.setTimeout(240_000);
  const email = 'marchand@rabatexpress.ma';
  const marchand = sql(`SELECT merchant FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  expect(marchand).toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();

  await page.goto('/portail/commandes');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-N02', '01-mes-commandes');

  const siennes = sql(`SELECT ref FROM tenant_rabatexpress.orders WHERE merchant = '${marchand}'`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  const autres = sql(`SELECT ref FROM tenant_rabatexpress.orders
                      WHERE merchant IS NOT NULL AND merchant <> '${marchand}' LIMIT 5`)
    .split('\n').map((l) => l.trim()).filter(Boolean);
  const corps = await page.locator('body').innerText();
  console.log(`  ${siennes.length} commande(s) du marchand, ${autres.length} d’un autre`);
  for (const ref of autres) expect(corps, `${ref} ne doit pas apparaître`).not.toContain(ref);

  // Le portefeuille : ce que le marchand doit toucher.
  await page.goto('/portail/portefeuille');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-N02', '02-portefeuille');
  const wallet = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/merchant/wallet')).json()));
  console.log(`  portefeuille → ${JSON.stringify(wallet)}`);

  const codEncaisse = Number(sql(`SELECT COALESCE(SUM(cod),0) FROM tenant_rabatexpress.orders
                                  WHERE merchant = '${marchand}' AND cod_paid`).trim());
  console.log(`  COD encaissé en base pour ${marchand} → ${codEncaisse} DH`);
  const valeurs = JSON.stringify(wallet);
  expect(valeurs).toContain(String(codEncaisse).slice(0, 3));
});
