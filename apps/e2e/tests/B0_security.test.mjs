import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, superLogin, waitForApi } from '../helpers.mjs';

let sa, admin;
const SUBJECT = '+212600000099';

before(async () => {
  await waitForApi();
  sa = await superLogin();
  admin = await login('e2e', 'admin@e2e.ma');
});

test('observabilité : journal d’audit lisible par le super-admin', async () => {
  const r = await api('/v1/audit?limit=50', { token: sa });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.json) && r.json.length > 0);
  assert.ok('action' in r.json[0] && 'actor' in r.json[0]);
});

test('observabilité : audit interdit hors super-admin', async () => {
  const r = await api('/v1/audit', { token: admin });
  assert.equal(r.status, 403);
});

test('RGPD : export puis effacement des données d’une personne', async () => {
  // Génère des données rattachées au sujet
  await api('/v1/notifications/consent', { method: 'POST', token: admin, body: { subject: SUBJECT, channel: 'SMS', optedIn: true } });
  await api('/v1/notifications/send', { method: 'POST', token: admin, body: { event: 'order.created', recipient: SUBJECT, channel: 'SMS', vars: { code: 'X1' } } });

  const exp = await api(`/v1/privacy/export?subject=${encodeURIComponent(SUBJECT)}`, { token: admin });
  assert.equal(exp.status, 200);
  assert.ok(exp.json.consents.length >= 1 && exp.json.notifications.length >= 1);

  const era = await api('/v1/privacy/erase', { method: 'POST', token: admin, body: { subject: SUBJECT } });
  assert.equal(era.status, 200);
  assert.ok(era.json.consentsDeleted >= 1 && era.json.notificationsAnonymised >= 1);

  const after = await api(`/v1/privacy/export?subject=${encodeURIComponent(SUBJECT)}`, { token: admin });
  assert.equal(after.json.consents.length, 0);
  assert.equal(after.json.notifications.length, 0);
});

test('sécurité : anti-bruteforce sur le login (429 après 5 échecs)', async () => {
  const bad = { email: 'attacker@casaexpress.ma', password: 'faux' };
  for (let i = 0; i < 5; i++) {
    const r = await api('/v1/auth/login', { method: 'POST', tenant: 'casaexpress', body: bad });
    assert.equal(r.status, 401);
  }
  const locked = await api('/v1/auth/login', { method: 'POST', tenant: 'casaexpress', body: bad });
  assert.equal(locked.status, 429);
});

// AN-10 : la suspension doit couper les sessions déjà ouvertes (le JWT vit 12 h),
// sans jamais bloquer le realm plateforme — sinon plus personne ne peut réactiver.
test('paywall : la suspension coupe les sessions en cours, la plateforme reste utilisable', async () => {
  // Garantit un abonnement courant sur e2e (la suspension exige un abonnement).
  const sub = await api('/v1/saas/tenants/e2e/subscription', { token: sa });
  if (!sub.json) {
    const plans = await api('/v1/saas/plans', { token: sa });
    const plan = plans.json.find((p) => p.code === 'essai') ?? plans.json[0];
    const s = await api('/v1/saas/tenants/e2e/subscription', { method: 'POST', token: sa, body: { planCode: plan.code } });
    assert.equal(s.status, 200, `souscription e2e → ${JSON.stringify(s.json)}`);
  }

  // Session ouverte AVANT la suspension : le token est valide.
  const tok = await login('e2e', 'admin@e2e.ma');
  assert.equal((await api('/v1/orders', { token: tok })).status, 200);

  const s = await api('/v1/saas/tenants/e2e/subscription/suspend', { method: 'POST', token: sa, body: { reason: 'test AN-10' } });
  assert.equal(s.status, 200, `suspend e2e → ${JSON.stringify(s.json)}`);

  try {
    // Lecture ET écriture refusées immédiatement pour le token vivant.
    const read = await api('/v1/orders', { token: tok });
    assert.equal(read.status, 403);
    assert.match(read.json?.message ?? '', /suspendu/);
    const write = await api('/v1/orders', { method: 'POST', token: tok, body: { fromCity: 'A', toCity: 'B' } });
    assert.equal(write.status, 403);

    // Le realm plateforme ne passe pas par TenantGuard : tout reste pilotable.
    assert.equal((await api('/v1/saas/tenants', { token: sa })).status, 200);
    assert.equal((await api('/v1/audit?limit=1', { token: sa })).status, 200);
  } finally {
    // Toujours réactiver pour ne pas polluer les suites suivantes.
    await api('/v1/saas/tenants/e2e/subscription/reactivate', { method: 'POST', token: sa, body: {} });
  }
  // L'accès revient immédiatement pour la même session.
  assert.equal((await api('/v1/orders', { token: tok })).status, 200);
});
