import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin, driver;
let incidentId;

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  driver = await login('e2e', 'livreur@e2e.ma');
});

test('incident : signalement par le livreur (OUVERT)', async () => {
  const r = await api('/v1/driver/incidents', { method: 'POST', token: driver, body: { type: 'CLIENT_INJOIGNABLE', note: 'Ne répond pas' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'OUVERT');
  incidentId = r.json.id;
  const mine = await api('/v1/driver/incidents', { token: driver });
  assert.ok(mine.json.some((i) => i.id === incidentId));
});

test('incident : type invalide → 400', async () => {
  const r = await api('/v1/driver/incidents', { method: 'POST', token: driver, body: { type: 'ZZZ' } });
  assert.equal(r.status, 400);
});

test('incident : l’exploitation le voit et le traite', async () => {
  const list = await api('/v1/field/incidents?status=OUVERT', { token: admin });
  assert.ok(list.json.some((i) => i.id === incidentId));
  const res = await api(`/v1/field/incidents/${incidentId}/resolve`, { method: 'POST', token: admin });
  assert.equal(res.json.status, 'TRAITE');
});

test('support : fil livreur ↔ ops, ordonné', async () => {
  await api('/v1/driver/support', { method: 'POST', token: driver, body: { body: 'Bonjour, souci sur une adresse.' } });
  await api(`/v1/field/support/${encodeURIComponent('Youssef Benali')}/reply`, { method: 'POST', token: admin, body: { body: 'Bien reçu, on regarde.' } });
  const thread = await api('/v1/driver/support', { token: driver });
  assert.equal(thread.status, 200);
  assert.ok(thread.json.length >= 2);
  assert.equal(thread.json[0].sender, 'driver');
  assert.equal(thread.json[thread.json.length - 1].sender, 'ops');
});

test('historique & gains : livraisons du livreur', async () => {
  const r = await api('/v1/driver/history', { token: driver });
  assert.equal(r.status, 200);
  assert.ok(r.json.deliveries >= 1);
  assert.equal(r.json.gains, r.json.deliveries * r.json.feePerDelivery);
});

test('RBAC : ops interdit au livreur, annexes livreur interdites à l’admin', async () => {
  const a = await api('/v1/field/incidents', { token: driver });
  assert.equal(a.status, 403);
  const b = await api('/v1/driver/history', { token: admin });
  assert.equal(b.status, 403);
});
