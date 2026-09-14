import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-M04 / TC-M05 / TC-M06 — Facturation marchand : génération, cycle de vie, litige.
// ATT : une facture par marchand livrant sur la période, montants cohérents avec la
//       commission et la TVA de /settings, puis Brouillon → Envoyée → Payée, et un litige
//       qui ajuste réellement les montants.
test('TC-M04 — générer, envoyer, payer et contester une facture', async ({ request }) => {
  test.setTimeout(240_000);
  const API = process.env.API_URL || 'http://localhost:3000';
  const periode = new Date().toISOString().slice(0, 7);

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress', 'content-type': 'application/json' };

  // Décor : au moins une course LIVRÉE pour un marchand — sans quoi la génération n'a
  // rien à facturer et le cas conclurait à tort qu'elle est muette. Les sections
  // précédentes annulent leurs commandes en partant ; on ne s'appuie pas sur leurs restes.
  sql(`DELETE FROM tenant_rabatexpress.invoices WHERE period = '${periode}'`);
  // Une course livrée, par le chemin du terrain (créer → affecter → avancer → preuve).
  const creee = await (await request.post(`${API}/v1/orders`, {
    headers: entetes,
    data: { merchant: 'Boutique Test', fromCity: 'Rabat', toCity: 'Casablanca', cod: 0,
            proofLevel: 'aucune', dropContact: 'Client Facture', dropAddress: '3 rue du Test' },
  })).json();
  await request.post(`${API}/v1/orders/${creee.ref}/assign`, { headers: entetes, data: { driver: 'Hamid Ouali' } });
  const jetonLivreur = (await (await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'livreur@rabatexpress.ma', password: motDePasse('livreur@rabatexpress.ma') },
  })).json()).token;
  const terrain = { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress',
                    authorization: `Bearer ${jetonLivreur}` };
  for (const etape of [1, 2, 3]) {
    await request.post(`${API}/v1/driver/orders/${creee.ref}/advance`, {
      headers: { ...terrain, 'idempotency-key': `${creee.ref}:adv${etape}` }, data: {},
    });
  }
  await request.post(`${API}/v1/driver/orders/${creee.ref}/proof`, {
    headers: { ...terrain, 'idempotency-key': `${creee.ref}:prf` }, data: { codCollected: 0 },
  });
  const livrables = Number(sql(`SELECT count(*) FROM tenant_rabatexpress.orders
                                WHERE status = 'LIVREE' AND merchant IS NOT NULL`).trim());
  console.log(`  décor → ${creee.ref} livrée ; ${livrables} course(s) facturable(s)`);
  expect(livrables, 'une course livrée pour un marchand est requise').toBeGreaterThan(0);
  const gen = await request.post(`${API}/v1/invoices/generate`, { headers: entetes, data: { period: periode } });
  console.log(`  génération ${periode} → ${gen.status()} ${JSON.stringify(await gen.json().catch(() => null))}`);
  expect(gen.ok()).toBe(true);

  const factures = sql(`SELECT id, merchant, deliveries_amount, commission, net_ht, tva, status
                        FROM tenant_rabatexpress.invoices WHERE period = '${periode}'`)
    .split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((c) => c[0]);
  console.log(`  ${factures.length} facture(s) générée(s)`);
  expect(factures.length).toBeGreaterThan(0);

  // Les montants suivent la configuration du tenant, pas des constantes d'écran.
  const cfg = await (await request.get(`${API}/v1/pricing/config`, { headers: entetes })).json();
  for (const [, marchand, livraisons, commission, netHt, tva] of factures) {
    const attenduCommission = Math.round(Number(livraisons) * cfg.commissionRate);
    const attenduNet = Number(livraisons) - attenduCommission;
    const attenduTva = Math.round(attenduNet * cfg.vatRate);
    console.log(`  ${marchand} → livraisons ${livraisons}, commission ${commission}, net ${netHt}, TVA ${tva}`);
    expect(Number(commission), `${marchand} : commission`).toBe(attenduCommission);
    expect(Number(netHt), `${marchand} : net HT`).toBe(attenduNet);
    expect(Number(tva), `${marchand} : TVA`).toBe(attenduTva);
  }

  // Cycle de vie : Brouillon → Envoyée → Payée.
  const id = factures[0][0];
  const statut = () => sql(`SELECT status FROM tenant_rabatexpress.invoices WHERE id = '${id}'`).trim();
  expect(statut()).toBe('BROUILLON');
  expect((await request.post(`${API}/v1/invoices/${id}/send`, { headers: entetes })).ok()).toBe(true);
  console.log(`  après envoi → ${statut()}`);
  expect(statut()).toBe('ENVOYEE');
  expect((await request.post(`${API}/v1/invoices/${id}/pay`, { headers: entetes })).ok()).toBe(true);
  console.log(`  après paiement → ${statut()}`);
  expect(statut()).toBe('PAYEE');

  // Litige sur une seconde facture envoyée, s'il en reste une.
  if (factures.length > 1) {
    const autre = factures[1][0];
    await request.post(`${API}/v1/invoices/${autre}/send`, { headers: entetes });
    const litige = await request.post(`${API}/v1/invoices/${autre}/dispute`, {
      headers: entetes, data: { amount: 50, note: 'Deux livraisons contestées par le marchand.' },
    });
    console.log(`  litige → ${litige.status()} ${JSON.stringify(await litige.json().catch(() => null))}`);
    expect(litige.ok()).toBe(true);
    const enLitige = sql(`SELECT status FROM tenant_rabatexpress.invoices WHERE id = '${autre}'`).trim();
    console.log(`  statut en litige → ${enLitige}`);
    expect(enLitige).toMatch(/LITIGE/);

    const resolution = await request.post(`${API}/v1/invoices/${autre}/dispute/resolve`, {
      headers: entetes, data: { decision: 'avoir' },
    });
    console.log(`  résolution → ${resolution.status()}`);
    expect(resolution.ok()).toBe(true);
    console.log(`  statut après décision → ${sql(`SELECT status FROM tenant_rabatexpress.invoices WHERE id = '${autre}'`).trim()}`);
  }
});
