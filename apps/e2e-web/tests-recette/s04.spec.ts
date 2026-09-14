import { test, expect } from '@playwright/test';
import { motDePasse, sql } from './helpers';

// TC-S04 — Isolation du scope marchand.
// ATT : `/v1/merchant/*` ne rend QUE les commandes du marchand du compte, quoi qu'on
//       demande — et le marchand n'atteint aucune route d'exploitation.
test('TC-S04 — le compte marchand est borné à son enseigne', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';
  const email = 'marchand@rabatexpress.ma';
  const marchand = sql(`SELECT merchant FROM tenant_rabatexpress.users WHERE email = '${email}'`).trim();
  expect(marchand, 'un compte marchand doit exister').toBeTruthy();

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email, password: motDePasse(email) },
  });
  expect(login.ok()).toBe(true);
  const token = (await login.json()).token;
  const entetes = { authorization: `Bearer ${token}`, 'x-tenant-slug': 'rabatexpress' };

  // Une commande d'un AUTRE marchand, pour avoir quelque chose à ne pas voir.
  const autre = `Concurrent ${Date.now().toString(36).toUpperCase()}`;
  const refVoisine = sql(`INSERT INTO tenant_rabatexpress.orders (ref, code, status, merchant, from_city, to_city, cod, size, proof_level)
    VALUES ('CMD-TEMOIN-${Date.now()}', 'TEMOIN01', 'NOUVELLE', '${autre}', 'Rabat', 'Fès', 100, 'Moyen', 'aucune')
    RETURNING ref`).trim();
  console.log(`  témoin → ${refVoisine} au nom de ${autre}`);

  const commandes = await (await request.get(`${API}/v1/merchant/orders`, { headers: entetes })).json();
  console.log(`  /v1/merchant/orders → ${commandes.length} commande(s)`);
  for (const o of commandes) expect(o.merchant, 'aucune commande d’un autre marchand').toBe(marchand);
  expect(commandes.some((o: any) => o.ref === refVoisine)).toBe(false);

  // Le tableau de bord et le portefeuille sont bornés de la même façon.
  for (const chemin of ['/v1/merchant/dashboard', '/v1/merchant/wallet', '/v1/merchant/invoice']) {
    const r = await request.get(`${API}${chemin}`, { headers: entetes });
    const corps = await r.text();
    console.log(`  ${chemin} → ${r.status()}`);
    expect(r.ok()).toBe(true);
    expect(corps, `${chemin} laisse fuir ${autre}`).not.toContain(autre);
  }

  // Et les routes d'exploitation restent fermées.
  for (const chemin of ['/v1/orders', '/v1/drivers', '/v1/cash/sessions', '/v1/users', '/v1/fraud/cases']) {
    const r = await request.get(`${API}${chemin}`, { headers: entetes });
    console.log(`  ${chemin} en marchand → ${r.status()}`);
    expect(r.status()).toBe(403);
  }

  sql(`DELETE FROM tenant_rabatexpress.orders WHERE ref = '${refVoisine}'`);
});
