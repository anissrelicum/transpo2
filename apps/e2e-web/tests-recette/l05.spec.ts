import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-L05 / TC-L06 — Reversements marchands.
// ATT : une ligne par marchand avec COD encaissé − commission = net à reverser ; le
//       paiement conserve méthode et référence, et ne se rejoue pas.
test('TC-L05 — générer puis payer un reversement marchand', async ({ page }) => {
  test.setTimeout(240_000);
  const periode = new Date().toISOString().slice(0, 7);
  const periodeCourante = periode;

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();

  // La génération saute les marchands DÉJÀ reversés sur la période : sans remise à plat,
  // le cas ne crée rien au second passage et conclut à tort que la génération est muette.
  sql(`DELETE FROM tenant_rabatexpress.payouts WHERE period = '${periode}'`);

  await page.goto('/payout');
  await page.waitForTimeout(2000);
  await shotVp(page, 'TC-L05', '01-avant-generation');

  // La génération porte sur la période du test, pas sur une période figée dans l'écran.
  const genere = await page.evaluate(async (p) => {
    const r = await fetch('/api/proxy/v1/cash/reversements/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ period: p }),
    });
    return { status: r.status, corps: await r.json().catch(() => null) };
  }, periode);
  console.log(`  génération ${periode} → ${JSON.stringify(genere.corps)}`);
  expect(genere.status).toBe(200);

  // La commission et le net ne sont pas stockés : ils se calculent à la lecture. On lit
  // donc ce que l'API sert à l'écran, et on vérifie l'égalité brut − commission = net.
  const lignes = sql(`SELECT merchant, cod_amount, orders_count FROM tenant_rabatexpress.payouts
                      WHERE period = '${periode}'`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  console.log(`  ${lignes.length} reversement(s) en base : ${lignes.map((l) => `${l[0]} ${l[1]} DH`).join(' · ')}`);
  expect(lignes.length).toBeGreaterThan(0);

  const servis = await page.evaluate(async () => (await (await fetch('/api/proxy/v1/cash/reversements')).json()));
  // (la période est comparée côté Node, le tableau étant rendu tel quel par l'API)
  const duJour = servis.filter((r: any) => r.period === periode);
  for (const r of duJour) {
    console.log(`  ${r.merchant} → brut ${r.codAmount ?? r.cod} − commission ${r.commission} = net ${r.net}`);
    expect(Math.round((r.codAmount ?? r.cod) - r.commission), `${r.merchant} : net`).toBe(Math.round(r.net));
  }
  expect(duJour.length).toBeGreaterThan(0);

  await page.reload();
  await page.waitForTimeout(2000);
  const corps = await page.locator('body').innerText();
  for (const [marchand] of lignes) expect(corps).toContain(marchand);
  await shotVp(page, 'TC-L05', '02-reversements-generes');

  // Paiement d'un reversement : méthode et référence conservées.
  const id = sql(`SELECT id FROM tenant_rabatexpress.payouts
                  WHERE period = '${periode}' AND status <> 'VERSE' LIMIT 1`).trim();
  expect(id).toBeTruthy();
  const paiement = await page.evaluate(async (pid) => {
    const r = await fetch(`/api/proxy/v1/cash/reversements/${pid}/pay`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'virement', reference: 'VIR-RECETTE-001' }),
    });
    return { status: r.status, corps: await r.json().catch(() => null) };
  }, id);
  console.log(`  paiement → ${JSON.stringify(paiement.corps)}`);
  expect(paiement.status).toBe(200);
  const apres = sql(`SELECT status, method, reference FROM tenant_rabatexpress.payouts WHERE id = '${id}'`)
    .split('|').map((x) => x.trim());
  expect(apres[0]).toBe('VERSE');
  expect(apres[1]).toBe('virement');
  expect(apres[2]).toBe('VIR-RECETTE-001');
  await shotVp(page, 'TC-L05', '03-reversement-paye');

  // Un second paiement du même reversement doit être refusé : l'argent ne part qu'une fois.
  const rejeu = await page.evaluate(async (pid) => (await fetch(`/api/proxy/v1/cash/reversements/${pid}/pay`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ method: 'virement' }),
  })).status, id);
  console.log(`  second paiement → ${rejeu}`);
  expect(rejeu).toBe(400);
});
