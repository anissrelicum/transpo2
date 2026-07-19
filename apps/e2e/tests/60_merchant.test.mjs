import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

const MERCHANT = 'Marchand E2E';
let admin, merchant;

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  merchant = await login('e2e', 'marchand@e2e.ma');
  // Deux commandes au marchand + une à un autre marchand (pour vérifier le scoping).
  await api('/v1/orders', { method: 'POST', token: admin, body: { merchant: MERCHANT, fromCity: 'Casablanca', toCity: 'Rabat', cod: 300 } });
  await api('/v1/orders', { method: 'POST', token: admin, body: { merchant: MERCHANT, fromCity: 'Casablanca', toCity: 'Salé', cod: 150 } });
  await api('/v1/orders', { method: 'POST', token: admin, body: { merchant: 'Autre Boutique', fromCity: 'Casablanca', toCity: 'Fès', cod: 999 } });
});

test('marchand : ne voit que ses propres commandes', async () => {
  const r = await api('/v1/merchant/orders', { token: merchant });
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2);
  assert.ok(r.json.every((o) => o.merchant === MERCHANT));
});

test('marchand : dashboard KPIs cohérents', async () => {
  const r = await api('/v1/merchant/dashboard', { token: merchant });
  assert.equal(r.status, 200);
  assert.ok(typeof r.json.total === 'number' && r.json.total >= 2);
  assert.ok('successRate' in r.json && 'inTransit' in r.json && 'codPending' in r.json);
  assert.ok(r.json.codPending >= 450); // 300 + 150 non encaissés
});

test('marchand : portefeuille net = COD − commission (15 %)', async () => {
  const r = await api('/v1/merchant/wallet', { token: merchant });
  assert.equal(r.status, 200);
  assert.equal(r.json.commissionRate, 0.15);
  assert.equal(r.json.net, Math.round((r.json.codCollected - r.json.commission) * 100) / 100);
});

test('marchand : facture dérivée (nom du marchand du JWT)', async () => {
  const r = await api('/v1/merchant/invoice', { token: merchant });
  assert.equal(r.status, 200);
  assert.equal(r.json.merchant, MERCHANT);
  assert.ok('deliveries' in r.json && 'ttc' in r.json);
});

test('RBAC : un admin ne peut pas accéder au portail marchand', async () => {
  const r = await api('/v1/merchant/orders', { token: admin });
  assert.equal(r.status, 403);
});
