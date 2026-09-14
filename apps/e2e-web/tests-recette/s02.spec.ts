import { test, expect } from '@playwright/test';
import { motDePasse, shotVp, sql } from './helpers';

// TC-S02 — Isolation par l'API.
// ATT : un jeton de `rabatexpress` qui force l'en-tête d'un autre tenant ne voit JAMAIS
//       les données de ce tenant — c'est le jeton qui décide, pas l'en-tête.
test('TC-S02 — l’en-tête de tenant ne contourne pas le jeton', async ({ request }) => {
  test.setTimeout(120_000);
  const API = process.env.API_URL || 'http://localhost:3000';

  // Un second tenant, avec une commande bien à lui.
  const existe = sql(`SELECT count(*) FROM platform.tenants WHERE slug = 'tangerlog'`).trim();
  expect(existe, 'le tenant tangerlog doit exister pour ce cas').not.toBe('0');
  const refAutre = sql(`SELECT ref FROM tenant_tangerlog.orders ORDER BY created_at DESC LIMIT 1`).trim();

  const login = await request.post(`${API}/v1/auth/login`, {
    headers: { 'content-type': 'application/json', 'x-tenant-slug': 'rabatexpress' },
    data: { email: 'admin@rabatexpress.ma', password: motDePasse('admin@rabatexpress.ma') },
  });
  expect(login.ok()).toBe(true);
  const token = (await login.json()).token;

  // Même jeton, en-tête d'un autre tenant.
  const force = await request.get(`${API}/v1/orders`, {
    headers: { authorization: `Bearer ${token}`, 'x-tenant-slug': 'tangerlog' },
  });
  console.log(`  GET /v1/orders avec x-tenant-slug: tangerlog → ${force.status()}`);
  const corps = force.ok() ? await force.text() : '';
  if (force.ok()) {
    // Si l'appel passe, il ne doit rendre QUE les données du tenant du jeton.
    if (refAutre) expect(corps).not.toContain(refAutre);
    const refSien = sql(`SELECT ref FROM tenant_rabatexpress.orders ORDER BY created_at DESC LIMIT 1`).trim();
    console.log(`  données rendues → celles de rabatexpress (${refSien}) : ${corps.includes(refSien)}`);
    expect(corps).toContain(refSien);
  } else {
    expect([401, 403]).toContain(force.status());
  }

  // Et l'inverse : une écriture dirigée vers l'autre tenant ne doit rien y créer.
  const avant = sql(`SELECT count(*) FROM tenant_tangerlog.orders`).trim();
  await request.post(`${API}/v1/orders`, {
    headers: { authorization: `Bearer ${token}`, 'x-tenant-slug': 'tangerlog', 'content-type': 'application/json' },
    data: { merchant: 'Intrusion', fromCity: 'Rabat', toCity: 'Tanger', cod: 10, proofLevel: 'aucune' },
  }).catch(() => null);
  const apres = sql(`SELECT count(*) FROM tenant_tangerlog.orders`).trim();
  console.log(`  commandes de tangerlog : ${avant} avant, ${apres} après tentative d’écriture`);
  expect(apres).toBe(avant);
});
