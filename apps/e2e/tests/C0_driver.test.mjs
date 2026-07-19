import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

const DRIVER = 'Youssef Benali';
let admin, driver, ref;
const idem = (k) => ({ headers: { 'idempotency-key': k } });

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  driver = await login('e2e', 'livreur@e2e.ma');
  const o = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', cod: 400 } })).json;
  ref = o.ref;
  await api(`/v1/orders/${ref}/assign`, { method: 'POST', token: admin, body: { driver: DRIVER } });
});

test('livreur : ses missions listent la commande assignée', async () => {
  const r = await api('/v1/driver/missions', { token: driver });
  assert.equal(r.status, 200);
  assert.ok(r.json.some((o) => o.ref === ref && o.status === 'ASSIGNEE'));
});

test('livreur : avancement idempotent (rejeu même clé = pas de double effet)', async () => {
  const r1 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV1') });
  assert.equal(r1.json.status, 'RETRAIT');
  const replay = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV1') });
  assert.equal(replay.json.status, 'RETRAIT'); // rejeu : toujours RETRAIT, pas RECUPEREE
  const r2 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV2') });
  assert.equal(r2.json.status, 'RECUPEREE');
  const r3 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver, ...idem('ADV3') });
  assert.equal(r3.json.status, 'LIVRAISON');
  const r4 = await api(`/v1/driver/orders/${ref}/advance`, { method: 'POST', token: driver });
  assert.equal(r4.status, 400); // livraison via preuve
});

test('livreur : preuve + encaissement COD → LIVREE, idempotent', async () => {
  const p1 = await api(`/v1/driver/orders/${ref}/proof`, { method: 'POST', token: driver, body: { codCollected: 400 }, ...idem('PRF1') });
  assert.equal(p1.json.status, 'LIVREE');
  assert.equal(p1.json.codPaid, true);
  const p2 = await api(`/v1/driver/orders/${ref}/proof`, { method: 'POST', token: driver, body: { codCollected: 400 }, ...idem('PRF1') });
  assert.deepEqual(p2.json, p1.json); // rejeu : réponse mémorisée identique
});

test('RBAC : un admin n’accède pas à l’app livreur', async () => {
  const r = await api('/v1/driver/missions', { token: admin });
  assert.equal(r.status, 403);
});

test('sécurité : un livreur ne peut pas agir sur la commande d’un autre', async () => {
  const other = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Fès', cod: 100 } })).json;
  await api(`/v1/orders/${other.ref}/assign`, { method: 'POST', token: admin, body: { driver: 'Salma Idrissi' } });
  const r = await api(`/v1/driver/orders/${other.ref}/advance`, { method: 'POST', token: driver });
  assert.equal(r.status, 403);
});
