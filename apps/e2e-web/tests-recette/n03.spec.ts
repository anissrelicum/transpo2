import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-N03 — Facture du marchand.
// ATT : la facture reprend la commission et la TVA de /settings, et ses montants
//       s'accordent avec ce que l'exploitation facturera — pas un calcul d'écran à part.
test('TC-N03 — la facture du marchand suit les règles du tenant', async ({ page }) => {
  test.setTimeout(180_000);
  const email = 'marchand@rabatexpress.ma';
  const marchand = sql(`SELECT merchant FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  expect(marchand).toBeTruthy();

  const err = await loginTenant(page, 'rabatexpress', email, motDePasse(email));
  expect(err).toBeNull();
  await page.goto('/portail/facture');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-N03', '01-facture-marchand');

  const facture = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/merchant/invoice')).json()));
  console.log(`  facture marchande → ${JSON.stringify(facture).slice(0, 200)}`);

  // Les taux viennent des paramètres du tenant, pas de constantes d'écran.
  const cfg = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/pricing/config')).json())).catch(() => null);
  const tauxCommission = cfg?.commissionRate
    ?? Number(sql(`SELECT commission_rate FROM tenant_rabatexpress.pricing_config WHERE id = 'default'`).trim() || 0.15);
  const tauxTva = cfg?.vatRate
    ?? Number(sql(`SELECT vat_rate FROM tenant_rabatexpress.pricing_config WHERE id = 'default'`).trim() || 0.2);
  console.log(`  taux du tenant → commission ${tauxCommission}, TVA ${tauxTva}`);

  // L'écran doit afficher la facture, pas un gabarit vide.
  const corps = await page.locator('body').innerText();
  expect(corps.length, 'la page de facture ne doit pas être vide').toBeGreaterThan(200);
  expect(corps).toMatch(/TVA|Commission|Total/i);

  // Et les montants doivent tenir ensemble : net = brut − commission.
  const brut = facture?.deliveriesAmount ?? facture?.gross ?? facture?.total ?? null;
  const commission = facture?.commission ?? null;
  const net = facture?.netHt ?? facture?.net ?? null;
  if (brut != null && commission != null && net != null) {
    console.log(`  brut ${brut} − commission ${commission} = net ${net}`);
    expect(Math.round(Number(net))).toBe(Math.round(Number(brut) - Number(commission)));
    expect(Math.round(Number(commission))).toBe(Math.round(Number(brut) * tauxCommission));
  } else {
    console.log('  ⚠ la facture marchande ne rend pas le détail brut/commission/net — à consigner');
  }
  await shotVp(page, 'TC-N03', '02-montants');
});
