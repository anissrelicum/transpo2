import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin, adminCasa;
before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  adminCasa = await login('casaexpress', 'admin@casaexpress.ma');
});

test('retour : échec de livraison crée un retour A_TRAITER', async () => {
  const o = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', cod: 200 } })).json;
  const r = await api(`/v1/returns/fail/${o.ref}`, { method: 'POST', token: admin, body: { reason: 'Client absent' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'A_TRAITER');
  assert.equal(r.json.attempts, 1);
});

test('retour : reprogrammation incrémente les tentatives, plafond à 3', async () => {
  const o = (await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Salé', cod: 100 } })).json;
  await api(`/v1/returns/fail/${o.ref}`, { method: 'POST', token: admin, body: { reason: 'Client absent' } }); // attempts=1
  const r1 = await api(`/v1/returns/${o.ref}/reschedule`, { method: 'POST', token: admin }); // →2
  assert.equal(r1.json.attempts, 2);
  const r2 = await api(`/v1/returns/${o.ref}/reschedule`, { method: 'POST', token: admin }); // →3
  assert.equal(r2.json.attempts, 3);
  const r3 = await api(`/v1/returns/${o.ref}/reschedule`, { method: 'POST', token: admin }); // plafond
  assert.equal(r3.status, 400);
});

test('retour : renvoi au marchand → RENDU', async () => {
  const o = (await api('/v1/orders', { method: 'POST', token: admin, body: { merchant: 'X', fromCity: 'Casablanca', toCity: 'Rabat' } })).json;
  await api(`/v1/returns/fail/${o.ref}`, { method: 'POST', token: admin, body: { reason: 'Refus' } });
  const r = await api(`/v1/returns/${o.ref}/return-to-merchant`, { method: 'POST', token: admin });
  assert.equal(r.json.status, 'RENDU');
});

test('analytics : synthèse avec taux de réussite', async () => {
  const r = await api('/v1/analytics/summary', { token: admin });
  assert.equal(r.status, 200);
  assert.ok('successRate' in r.json && 'byStatus' in r.json);
  assert.ok(typeof r.json.total === 'number');
});

test('fraude : liste des cas (score calculé)', async () => {
  const r = await api('/v1/fraud/cases', { token: admin });
  assert.equal(r.status, 200);
  const c = r.json[0];
  assert.ok(c && c.score > 0 && ['OUVERT', 'ENQUETE', 'BLANCHI', 'CONFIRME'].includes(c.status));
});

test('fraude : action de revue (enquête) tracée', async () => {
  const cases = (await api('/v1/fraud/cases', { token: admin })).json;
  const id = cases[0].id;
  const r = await api(`/v1/fraud/cases/${id}/investigate`, { method: 'POST', token: admin });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'ENQUETE');
});

test('fraude : leaderboard livreurs à risque', async () => {
  const r = await api('/v1/fraud/leaderboard', { token: adminCasa });
  assert.equal(r.status, 200);
  assert.ok(r.json.some((d) => d.driver === 'Karim El Amrani'));
});
