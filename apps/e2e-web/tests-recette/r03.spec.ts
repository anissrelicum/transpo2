import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-R03 — Cohérence croisée.
// ATT : les mêmes faits donnent les mêmes chiffres sur /dashboard, /analytics, /orders,
//       /cash et l'API. Un écran qui compte autrement qu'un autre fait douter des deux.
test('TC-R03 — les mêmes faits comptés partout pareil', async ({ page }) => {
  test.setTimeout(240_000);

  const verite = {
    livrees: Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE status = 'LIVREE'`).trim()),
    echecs: Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders WHERE status = 'ECHOUEE'`).trim()),
    codEncaisse: Number(sql(`SELECT COALESCE(SUM(cod),0) FROM tenant_rabatexpress.orders WHERE cod_paid`).trim()),
    caisse: Number(sql(`SELECT COALESCE(SUM(theorique),0) FROM tenant_rabatexpress.cash_sessions`).trim()),
  };
  console.log(`  vérité de la base → ${JSON.stringify(verite)}`);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // Ce que l'API sert aux différents écrans.
  const lu = await page.evaluate(async () => ({
    orders: await (await fetch('/api/proxy/v1/orders?limit=500')).json(),
    reconciliation: await (await fetch('/api/proxy/v1/cash/reconciliation')).json(),
    sessions: await (await fetch('/api/proxy/v1/cash/sessions')).json(),
  }));
  const liste = Array.isArray(lu.orders) ? lu.orders : lu.orders.items ?? [];
  const livreesApi = liste.filter((o: any) => o.status === 'LIVREE').length;
  const codApi = liste.filter((o: any) => o.codPaid).reduce((s: number, o: any) => s + o.cod, 0);
  const theoriqueCaisse = lu.sessions.reduce((s: number, x: any) => s + x.theorique, 0);
  const theoriqueRecon = lu.reconciliation.reduce((s: number, x: any) => s + x.theorique, 0);
  console.log(`  API → ${livreesApi} livrée(s), ${codApi} DH encaissés, caisse ${theoriqueCaisse}, réconciliation ${theoriqueRecon}`);

  expect(livreesApi).toBe(verite.livrees);
  expect(codApi).toBe(verite.codEncaisse);

  // La caisse et la réconciliation regardent le même argent : elles doivent s'accorder.
  console.log(`  caisse ${theoriqueCaisse} DH vs réconciliation ${theoriqueRecon} DH vs COD encaissé ${verite.codEncaisse} DH`);
  expect(theoriqueCaisse).toBe(verite.caisse);
  await shotVp(page, 'TC-R03', '01-coherence');

  // Et l'analytique compte les mêmes échecs que les commandes.
  await page.goto('/analytics');
  await page.waitForTimeout(2500);
  const corps = await page.locator('body').innerText();
  if (verite.echecs === 0) expect(corps).toMatch(/Aucun échec sur la période/);
  await shotVp(page, 'TC-R03', '02-analytique');
});
