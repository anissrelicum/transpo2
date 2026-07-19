import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin, compta;
before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  compta = await login('e2e', 'compta@e2e.ma');
});

test('tarification : grille standard + TVA', async () => {
  const r = await api('/v1/pricing/quote', { method: 'POST', token: admin, body: { distanceKm: 9 } });
  assert.equal(r.status, 200);
  assert.equal(r.json.applied, 'grille');
  assert.equal(r.json.base, 48);       // palier 7-15 km
  assert.equal(r.json.tva, 9.6);       // 48 * 0.20
  assert.equal(r.json.ttc, 57.6);
});

test('tarification : cascade — prix fixe marchand prioritaire', async () => {
  const r = await api('/v1/pricing/quote', { method: 'POST', token: admin, body: { distanceKm: 9, merchantFixedPrice: 40, discountRate: 0.1 } });
  assert.equal(r.json.applied, 'fixe_marchand');
  assert.equal(r.json.base, 40);
});

test('tarification : remise + majoration fragile', async () => {
  const r = await api('/v1/pricing/quote', { method: 'POST', token: admin, body: { distanceKm: 9, discountRate: 0.1, fragile: true } });
  assert.equal(r.json.applied, 'remise');
  assert.equal(r.json.base, 43.2);     // 48 * 0.9
  assert.equal(r.json.surcharges, 15); // fragile
});

test('COD : encaissement puis réconciliation + reversement marchand', async () => {
  // commande avec COD, assignée à un livreur, encaissée
  const created = (await api('/v1/orders', { method: 'POST', token: admin, body: { merchant: 'Boutique Test', fromCity: 'Casablanca', toCity: 'Rabat', cod: 1000 } })).json;
  await api(`/v1/orders/${created.ref}/assign`, { method: 'POST', token: admin, body: { driver: 'Youssef Benali' } });
  const collect = await api(`/v1/cash/collect/${created.ref}`, { method: 'POST', token: admin });
  assert.equal(collect.status, 200);
  assert.equal(collect.json.codPaid, true);

  // réconciliation : Youssef a au moins 1000 DH théoriques
  const recon = await api('/v1/cash/reconciliation', { token: compta });
  assert.equal(recon.status, 200);
  const yb = recon.json.find((x) => x.driver === 'Youssef Benali');
  assert.ok(yb && yb.theorique >= 1000);

  // reversement : Boutique Test → net = brut − 15 %
  const payouts = await api('/v1/cash/payouts', { token: compta });
  const m = payouts.json.find((x) => x.merchant === 'Boutique Test');
  assert.ok(m);
  assert.equal(m.net, Math.round(m.brut * 0.85 * 100) / 100);
});

test('COD : encaissement interdit au comptable → 403', async () => {
  const created = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', cod: 200 } })).json;
  const r = await api(`/v1/cash/collect/${created.ref}`, { method: 'POST', token: compta });
  assert.equal(r.status, 403);
});

test('factures marchand : dérivées des livraisons (commission + TVA)', async () => {
  const r = await api('/v1/invoices', { token: compta });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json));
});
