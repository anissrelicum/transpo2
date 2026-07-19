import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, superLogin, waitForApi } from '../helpers.mjs';

before(async () => { await waitForApi(); });

test('login KO : mauvais mot de passe → 401', async () => {
  const r = await api('/v1/auth/login', { method: 'POST', tenant: 'casaexpress', body: { email: 'admin@casaexpress.ma', password: 'faux' } });
  assert.equal(r.status, 401);
});

test('login OK → JWT', async () => {
  const token = await login('casaexpress', 'admin@casaexpress.ma');
  assert.ok(token && token.length > 20);
});

test('/v1/orders sans JWT → 401', async () => {
  const r = await api('/v1/orders', { tenant: 'casaexpress' });
  assert.equal(r.status, 401);
});

test('/v1/orders avec JWT → commandes du tenant', async () => {
  const token = await login('casaexpress', 'admin@casaexpress.ma');
  const r = await api('/v1/orders', { token });
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 2); // seed casaexpress
});

test('isolation : le tenant est celui du JWT (Atlas ne voit pas CasaExpress)', async () => {
  const atlasToken = await login('atlas', 'admin@atlas.ma');
  const r = await api('/v1/orders', { token: atlasToken });
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 1);
  assert.equal(r.json[0].merchant, 'Riad Déco');
});

test('anti cross-tenant : JWT atlas + header casaexpress → 403', async () => {
  const atlasToken = await login('atlas', 'admin@atlas.ma');
  const r = await api('/v1/orders', { token: atlasToken, tenant: 'casaexpress' });
  assert.equal(r.status, 403);
});

test('RBAC : comptable interdit sur la Console SaaS → 403', async () => {
  const compta = await login('casaexpress', 'compta@casaexpress.ma');
  const r = await api('/v1/saas/tenants', { token: compta });
  assert.equal(r.status, 403);
});

test('SaaS : super-admin liste les tenants', async () => {
  const sa = await superLogin();
  const r = await api('/v1/saas/tenants', { token: sa });
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2);
});

test('SaaS : provisioning d’un tenant par le super-admin', async () => {
  const sa = await superLogin();
  const slug = 'demo' + Date.now().toString(36);
  const r = await api('/v1/saas/tenants', { method: 'POST', token: sa, body: { slug, name: 'Demo Co', city: 'Rabat', plan: 'Essai' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.provisioned, true);
  // le nouveau tenant apparaît dans la liste
  const list = await api('/v1/saas/tenants', { token: sa });
  assert.ok(list.json.some((t) => t.slug === slug));
});
