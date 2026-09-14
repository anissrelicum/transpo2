import { test, expect } from '@playwright/test';
import { loginTenant, motDePasse, shotVp, sql } from './helpers';

// TC-L05 / TC-L06 — Reversements marchands.
// ATT : une ligne par marchand avec COD encaissé − commission = net à reverser ; le
//       paiement conserve méthode et référence, et ne se rejoue pas.
test('TC-L05 — générer puis payer un reversement marchand', async ({ page }) => {
  test.setTimeout(240_000);
  const periode = new Date().toISOString().slice(0, 7);

  const err = await loginTenant(page, 'rabatexpress', 'admin@rabatexpress.ma', motDePasse('admin@rabatexpress.ma'));
  expect(err).toBeNull();
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

  const lignes = sql(`SELECT merchant, cod_amount, commission, net FROM tenant_rabatexpress.payouts
                      WHERE period = '${periode}'`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  console.log(`  ${lignes.length} reversement(s) : ${lignes.map((l) => `${l[0]} ${l[1]}−${l[2]}=${l[3]}`).join(' · ')}`);
  expect(lignes.length).toBeGreaterThan(0);

  // Le net est bien le brut moins la commission — c'est l'argent du marchand.
  for (const [marchand, brut, commission, net] of lignes) {
    expect(Number(net), `${marchand} : net`).toBe(Number(brut) - Number(commission));
  }

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
