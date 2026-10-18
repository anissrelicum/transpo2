// Délais de livraison (ADR 0006) : défaut du marchand, choix par commande, supplément
// express, échéances calculées par le serveur, ponctualité à la livraison, urgence au dispatch.
//
// Tenant DÉDIÉ (l'affectation automatique y est activée pour le cas « urgent »).
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, superLogin, waitForApi } from '../helpers.mjs';

const SLUG = `delais${Date.now().toString(36)}`;
let admin;
let merchantId;
const minutes = (a, b) => Math.round((new Date(a).getTime() - new Date(b).getTime()) / 60000);
const as = (token, path, opts = {}) => api(path, { ...opts, token });

before(async () => {
  await waitForApi();
  const sa = await superLogin();
  const p = await api('/v1/saas/tenants', { method: 'POST', token: sa, body: { slug: SLUG, name: 'Délais Test', city: 'Casablanca', adminEmail: `admin@${SLUG}.ma`, adminName: 'Admin' } });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  const l = await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: p.json.admin.email, password: p.json.admin.tempPassword } });
  admin = l.json.token;
  const m = await as(admin, '/v1/merchants', { method: 'POST', body: {
    name: 'Resto Test', mode: 'forfait', flatPrice: 30,
    deliveryTerms: { delai: { mode: 'apres_commande', minutes: 60 }, supplements: { apres_commande: 15, apres_retrait: 10 }, penaliteRetard: 0.5 },
  } });
  assert.equal(m.status, 201, JSON.stringify(m.json));
  merchantId = m.json.id;
});

test('conditions de délai : validées et relues sur la fiche marchand', async () => {
  const r = await as(admin, `/v1/merchants/${merchantId}`);
  assert.deepEqual(r.json.deliveryTerms.delai.mode, 'apres_commande');
  assert.equal(r.json.deliveryTerms.supplements.apres_commande, 15);
  const ko = await as(admin, `/v1/merchants/${merchantId}`, { method: 'PATCH', body: { deliveryTerms: { delai: { mode: 'heure_limite', heure: '25:00' } } } });
  assert.equal(ko.status, 400);
  const neg = await as(admin, `/v1/merchants/${merchantId}`, { method: 'PATCH', body: { deliveryTerms: { penaliteRetard: 2 } } });
  assert.equal(neg.status, 400);
});

test('commande sans délai précisé : défaut du marchand, échéance = commande + 60 min, supplément express facturé', async () => {
  const r = await as(admin, '/v1/orders', { method: 'POST', body: { fromCity: 'Casablanca', toCity: 'Casablanca', merchant: 'Resto Test', cod: 0, proofLevel: 'aucune' } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.delayMode, 'apres_commande');
  assert.equal(minutes(r.json.dueAt, r.json.createdAt), 60);
  assert.equal(r.json.priceBase, 30);
  assert.equal(r.json.priceSurcharges, 15);
  assert.equal(r.json.priceHt, 45);
});

test('délai choisi pour la commande : il l’emporte sur le défaut (heure limite)', async () => {
  const r = await as(admin, '/v1/orders', { method: 'POST', body: {
    fromCity: 'Casablanca', toCity: 'Casablanca', merchant: 'Resto Test', proofLevel: 'aucune',
    delai: { mode: 'heure_limite', heure: '23:59' },
  } });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.delayMode, 'heure_limite');
  assert.equal(r.json.delayHeure, '23:59');
  assert.ok(new Date(r.json.dueAt) > new Date(r.json.createdAt));
  assert.equal(r.json.priceSurcharges, 0, 'pas de supplément « heure limite » négocié');
  const ko = await as(admin, '/v1/orders', { method: 'POST', body: { fromCity: 'Casablanca', toCity: 'Casablanca', delai: { mode: 'apres_retrait' } } });
  assert.equal(ko.status, 400);
});

test('délai après retrait : l’échéance naît au retrait, la ponctualité est figée à la livraison', async () => {
  const name = 'Livreur Délais';
  const d = await as(admin, '/v1/drivers', { method: 'POST', body: { name, city: 'Casablanca', vehicle: 'Moto', licenseDue: '2030-01-01', medicalDue: '2030-01-01', available: true } });
  assert.equal(d.status, 201);
  const u = await as(admin, '/v1/users', { method: 'POST', body: { email: `livreur@${SLUG}.ma`, name, role: 'DRIVER', driver: name } });
  const tok = (await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: `livreur@${SLUG}.ma`, password: u.json.tempPassword } })).json.token;
  const o = (await as(admin, '/v1/orders', { method: 'POST', body: {
    fromCity: 'Casablanca', toCity: 'Casablanca', merchant: 'Resto Test', proofLevel: 'aucune',
    delai: { mode: 'apres_retrait', minutes: 30, retraitMinutes: 20 },
  } })).json;
  assert.equal(o.dueAt, null, 'pas encore d’échéance de livraison');
  assert.equal(minutes(o.pickupDueAt, o.createdAt), 20);
  assert.equal(o.priceSurcharges, 10);
  await as(admin, `/v1/orders/${o.ref}/assign`, { method: 'POST', body: { driver: name } });
  for (const k of ['a', 'b']) await as(tok, `/v1/driver/orders/${o.ref}/advance`, { method: 'POST', body: {}, headers: { 'idempotency-key': `${o.ref}:${k}` } });
  const recup = (await as(admin, `/v1/orders/${o.ref}`)).json;
  assert.equal(recup.status, 'RECUPEREE');
  assert.equal(minutes(recup.dueAt, recup.pickedAt), 30);
  await as(tok, `/v1/driver/orders/${o.ref}/advance`, { method: 'POST', body: {}, headers: { 'idempotency-key': `${o.ref}:c` } });
  const livree = (await as(tok, `/v1/driver/orders/${o.ref}/proof`, { method: 'POST', body: {}, headers: { 'idempotency-key': `${o.ref}:p` } })).json;
  assert.equal(livree.status, 'LIVREE');
  assert.equal(livree.lateMinutes, 0);
  assert.equal(livree.latePenalty, null);
  assert.ok(livree.deliveredAt);
});

test('devis : le défaut du marchand et son supplément express accompagnent le prix', async () => {
  const q = await as(admin, '/v1/pricing/quote', { method: 'POST', body: { distanceKm: 3, merchant: 'Resto Test' } });
  assert.equal(q.json.deliveryTerms.delai.mode, 'apres_commande');
  assert.equal(q.json.surcharges, 15);
  const sans = await as(admin, '/v1/pricing/quote', { method: 'POST', body: { distanceKm: 3, merchant: 'Resto Test', delayMode: 'aucun' } });
  assert.equal(sans.json.surcharges, 0);
});
