import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin;
const SUBJECT = '+212600000090';

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
});

test('transactionnel : envoyé sans consentement (exempté 09-08)', async () => {
  const r = await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'order.delivered', recipient: SUBJECT, channel: 'SMS', vars: { code: 'TRACK123' } } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'SENT');
  assert.ok(r.json.body.includes('TRACK123'));
});

test('marketing : bloqué sans consentement', async () => {
  const r = await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'promo', recipient: SUBJECT, channel: 'SMS', vars: { x: 'CasaExpress' } } });
  assert.equal(r.status, 200);
  assert.equal(r.json.status, 'BLOCKED');
  assert.ok(r.json.reason.includes('09-08'));
});

test('consentement : opt-in débloque le marketing', async () => {
  const c = await api('/v1/notifications/consent', { method: 'POST', token: admin, body: { subject: SUBJECT, channel: 'SMS', optedIn: true } });
  assert.equal(c.status, 200);
  assert.equal(c.json.optedIn, true);
  const r = await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'promo', recipient: SUBJECT, channel: 'SMS', vars: { x: 'CasaExpress' } } });
  assert.equal(r.json.status, 'SENT');
});

test('modèle AR : rendu dans la bonne langue', async () => {
  const r = await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'order.created', recipient: SUBJECT, channel: 'WHATSAPP', lang: 'ar', vars: { code: 'ABC' } } });
  assert.equal(r.json.lang, 'ar');
  assert.ok(r.json.body.includes('ABC') && /[؀-ۿ]/.test(r.json.body)); // contient de l'arabe
});

test('canal invalide → 400', async () => {
  const r = await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'order.created', recipient: SUBJECT, channel: 'PIGEON' } });
  assert.equal(r.status, 400);
});

test('centre : liste filtrable par statut', async () => {
  const r = await api('/v1/notifications?status=BLOCKED', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.every((n) => n.status === 'BLOCKED'));
});
