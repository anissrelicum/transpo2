import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { api, superLogin, waitForApi } from '../helpers.mjs';

// Utilise le tenant `atlas` (aucun autre test ne s'y connecte).
let sa;
const SLUG = 'atlas';

before(async () => { await waitForApi(); sa = await superLogin(); });
after(async () => { // toujours réactiver atlas pour ne pas polluer d'autres runs
  await api(`/v1/saas/tenants/${SLUG}/status`, { method: 'POST', token: sa, body: { status: 'ACTIF' } });
});

test('plans : catalogue exposé', async () => {
  const r = await api('/v1/saas/plans', { token: sa });
  assert.equal(r.status, 200);
  assert.ok(r.json.some((p) => p.code === 'Transporteur' && p.monthlyDH === 899));
});

test('plan : changement de plan tracé', async () => {
  const r = await api(`/v1/saas/tenants/${SLUG}/plan`, { method: 'POST', token: sa, body: { plan: 'Transporteur' } });
  assert.equal(r.status, 200);
  assert.equal(r.json.plan, 'Transporteur');
  const bad = await api(`/v1/saas/tenants/${SLUG}/plan`, { method: 'POST', token: sa, body: { plan: 'Inexistant' } });
  assert.equal(bad.status, 400);
});

test('paywall : suspension bloque le login du tenant, réactivation le rétablit', async () => {
  const s = await api(`/v1/saas/tenants/${SLUG}/status`, { method: 'POST', token: sa, body: { status: 'SUSPENDU' } });
  assert.equal(s.json.status, 'SUSPENDU');
  const blocked = await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: 'admin@atlas.ma', password: 'transpo' } });
  assert.equal(blocked.status, 403);
  await api(`/v1/saas/tenants/${SLUG}/status`, { method: 'POST', token: sa, body: { status: 'ACTIF' } });
  const ok = await api('/v1/auth/login', { method: 'POST', tenant: SLUG, body: { email: 'admin@atlas.ma', password: 'transpo' } });
  assert.equal(ok.status, 200);
});

test('statut invalide → 400', async () => {
  const r = await api(`/v1/saas/tenants/${SLUG}/status`, { method: 'POST', token: sa, body: { status: 'ZOMBIE' } });
  assert.equal(r.status, 400);
});

test('facturation plateforme : montant par tenant + usage', async () => {
  const r = await api('/v1/saas/billing', { token: sa });
  assert.equal(r.status, 200);
  const atlas = r.json.find((t) => t.slug === SLUG);
  assert.ok(atlas && typeof atlas.monthlyDH === 'number' && typeof atlas.orders === 'number');
});

test('RBAC : billing interdit hors super-admin', async () => {
  const r = await api('/v1/saas/billing');
  assert.equal(r.status, 401); // sans token
});
