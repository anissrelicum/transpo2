import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin;
const DRIVER = 'Youssef Benali';
let refs = [];

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  const a = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', cod: 100 } })).json;
  const b = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Salé', cod: 200 } })).json;
  refs = [a.ref, b.ref];
});

test('tournée : création regroupe les commandes et assigne le livreur', async () => {
  const r = await api('/v1/tournees', { method: 'POST', token: admin, body: { driver: DRIVER, zone: 'Casa Centre', day: '2026-07-20', stops: refs } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'PLANIFIEE');
  assert.deepEqual(r.json.stops, refs);
  // Les commandes sont désormais assignées au livreur.
  const o = (await api(`/v1/orders/${refs[0]}`, { token: admin })).json;
  assert.equal(o.driver, DRIVER);
  assert.equal(o.status, 'ASSIGNEE');
});

test('tournée : commande inexistante → 400', async () => {
  const r = await api('/v1/tournees', { method: 'POST', token: admin, body: { driver: DRIVER, day: '2026-07-20', stops: ['CMD-NOPE'] } });
  assert.equal(r.status, 400);
});

test('tournée : réordonnancement (même ensemble) puis ensemble divergent refusé', async () => {
  const t = (await api('/v1/tournees', { method: 'POST', token: admin, body: { driver: DRIVER, day: '2026-07-20', stops: refs } })).json;
  const rev = [...refs].reverse();
  const ok = await api(`/v1/tournees/${t.id}/reorder`, { method: 'POST', token: admin, body: { stops: rev } });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.json.stops, rev);
  const bad = await api(`/v1/tournees/${t.id}/reorder`, { method: 'POST', token: admin, body: { stops: [refs[0]] } });
  assert.equal(bad.status, 400);
});

test('tournée : cycle de vie PLANIFIEE → EN_COURS → CLOTUREE', async () => {
  const t = (await api('/v1/tournees', { method: 'POST', token: admin, body: { driver: DRIVER, day: '2026-07-20', stops: refs } })).json;
  const s1 = await api(`/v1/tournees/${t.id}/advance`, { method: 'POST', token: admin });
  assert.equal(s1.json.status, 'EN_COURS');
  const s2 = await api(`/v1/tournees/${t.id}/advance`, { method: 'POST', token: admin });
  assert.equal(s2.json.status, 'CLOTUREE');
  const s3 = await api(`/v1/tournees/${t.id}/advance`, { method: 'POST', token: admin });
  assert.equal(s3.status, 400); // déjà clôturée
});

test('tournée : détail résout les commandes dans l’ordre', async () => {
  const t = (await api('/v1/tournees', { method: 'POST', token: admin, body: { driver: DRIVER, day: '2026-07-20', stops: refs } })).json;
  const r = await api(`/v1/tournees/${t.id}`, { token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.orders.length, refs.length);
  assert.equal(r.json.orders[0].ref, refs[0]);
});
