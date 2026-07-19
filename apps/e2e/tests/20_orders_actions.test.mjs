import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin, compta;
before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  compta = await login('e2e', 'compta@e2e.ma');
});

test('création de commande → apparaît dans la liste', async () => {
  const before = (await api('/v1/orders', { token: admin })).json.length;
  const r = await api('/v1/orders', {
    method: 'POST', token: admin,
    body: { merchant: 'Boutique Zellige', fromCity: 'Casablanca', toCity: 'Rabat', cod: 300, size: 'Petit' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.status, 'NOUVELLE');
  assert.match(r.json.code, /^[A-Z0-9]{8}$/);
  const after = (await api('/v1/orders', { token: admin })).json.length;
  assert.equal(after, before + 1);
});

test('cycle de vie : advance NOUVELLE → ASSIGNEE → RETRAIT', async () => {
  const created = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Salé' } })).json;
  const a1 = await api(`/v1/orders/${created.ref}/advance`, { method: 'POST', token: admin });
  assert.equal(a1.status, 200);
  assert.equal(a1.json.status, 'ASSIGNEE');
  const a2 = await api(`/v1/orders/${created.ref}/advance`, { method: 'POST', token: admin });
  assert.equal(a2.json.status, 'RETRAIT');
});

test('assignation d’un livreur', async () => {
  const created = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat' } })).json;
  const r = await api(`/v1/orders/${created.ref}/assign`, { method: 'POST', token: admin, body: { driver: 'Youssef Benali' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.driver, 'Youssef Benali');
  assert.equal(r.json.status, 'ASSIGNEE');
});

test('annulation d’une commande', async () => {
  const created = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat' } })).json;
  const r = await api(`/v1/orders/${created.ref}/cancel`, { method: 'POST', token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ANNULEE');
});

test('filtre par statut', async () => {
  const r = await api('/v1/orders?status=ANNULEE', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.every((o) => o.status === 'ANNULEE'));
});

test('RBAC : comptable ne peut pas créer de commande → 403', async () => {
  const r = await api('/v1/orders', { method: 'POST', token: compta, body: { fromCity: 'Casablanca', toCity: 'Rabat' } });
  assert.equal(r.status, 403);
});

test('GET /v1/drivers → liste des livreurs du tenant', async () => {
  const r = await api('/v1/drivers', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2);
  assert.ok(r.json.some((d) => d.name === 'Youssef Benali'));
});
