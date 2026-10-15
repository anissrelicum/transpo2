// Localisation par lien + coordonnées (migration 0027, ADR 0002) : création, validation,
// résolution de lien, correction, exposition au livreur et export 09-08.
// Les liens testés ici sont lisibles SANS réseau sortant (coordonnées dans l'URL) : la
// suite reste verte sur une CI isolée. Le suivi réel d'un lien court est couvert par les
// tests unitaires (fetch simulé) et par la vérification manuelle décrite dans l'ADR.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

const DRIVER = 'Youssef Benali';
const LIEN_PLACE = 'https://www.google.com/maps/place/Twin+Center/@33.5880,-7.6330,17z/data=!3m1!4b1!4m6!3m5!8m2!3d33.5856!4d-7.6339';
let admin, compta, merchant, driver;

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  compta = await login('e2e', 'compta@e2e.ma');
  merchant = await login('e2e', 'marchand@e2e.ma');
  driver = await login('e2e', 'livreur@e2e.ma');
});

/* ---------------- Résolution de lien ---------------- */
test('resolve-link : lieu Google → `!3d!4d` (précis) et lien d’origine conservé', async () => {
  const r = await api('/v1/geo/resolve-link', { method: 'POST', token: admin, body: { url: LIEN_PLACE } });
  assert.equal(r.status, 200);
  assert.equal(r.json.lat, 33.5856);
  assert.equal(r.json.lng, -7.6339);
  assert.equal(r.json.precision, 'exacte');
  assert.equal(r.json.source, 'google');
  assert.equal(r.json.url, LIEN_PLACE);
});

test('resolve-link : coordonnées brutes et message WhatsApp', async () => {
  const brut = await api('/v1/geo/resolve-link', { method: 'POST', token: admin, body: { url: '33.5731, -7.5898' } });
  assert.equal(brut.status, 200);
  assert.deepEqual([brut.json.lat, brut.json.lng, brut.json.source], [33.5731, -7.5898, 'coordonnees']);
  assert.equal(brut.json.url, 'https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898');
  const wa = await api('/v1/geo/resolve-link', {
    method: 'POST', token: admin, body: { url: '📍 Ma position https://waze.com/ul?ll=33.5731%2C-7.5898&navigate=yes' },
  });
  assert.equal(wa.status, 200);
  assert.equal(wa.json.source, 'waze');
});

test('resolve-link : lien hors liste blanche → 422 HOTE_REFUSE ; texte → 422 ; vide → 400', async () => {
  const ssrf = await api('/v1/geo/resolve-link', { method: 'POST', token: admin, body: { url: 'http://169.254.169.254/latest/meta-data/' } });
  assert.equal(ssrf.status, 422);
  assert.equal(ssrf.json.code, 'HOTE_REFUSE');
  const texte = await api('/v1/geo/resolve-link', { method: 'POST', token: admin, body: { url: 'derrière la mosquée' } });
  assert.equal(texte.status, 422);
  assert.equal(texte.json.code, 'LIEN_NON_RECONNU');
  const vide = await api('/v1/geo/resolve-link', { method: 'POST', token: admin, body: {} });
  assert.equal(vide.status, 400);
  assert.equal(vide.json.code, 'LIEN_VIDE');
});

test('resolve-link : RBAC — console et marchand oui, livreur non, anonyme non', async () => {
  const body = { url: '33.5731, -7.5898' };
  assert.equal((await api('/v1/geo/resolve-link', { method: 'POST', token: merchant, body })).status, 200);
  assert.equal((await api('/v1/geo/resolve-link', { method: 'POST', token: compta, body })).status, 200);
  assert.equal((await api('/v1/geo/resolve-link', { method: 'POST', token: driver, body })).status, 403);
  assert.equal((await api('/v1/geo/resolve-link', { method: 'POST', body })).status, 401);
});

/* ---------------- Création ---------------- */
test('création : lien d’origine conservé ; coordonnées seules → lien partageable généré', async () => {
  const r = await api('/v1/orders', {
    method: 'POST', token: admin,
    body: {
      fromCity: 'Casablanca', toCity: 'Casablanca', dropPhone: '+212600000001',
      pickupLat: 33.5856, pickupLng: -7.6339, pickupMapUrl: LIEN_PLACE,
      dropLat: 33.5731, dropLng: -7.5898,
    },
  });
  assert.equal(r.status, 201);
  const o = (await api(`/v1/orders/${r.json.ref}`, { token: admin })).json;
  assert.deepEqual([o.pickupLat, o.pickupLng, o.pickupMapUrl], [33.5856, -7.6339, LIEN_PLACE]);
  assert.deepEqual([o.dropLat, o.dropLng], [33.5731, -7.5898]);
  assert.equal(o.dropMapUrl, 'https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898');
  // Exposé aussi dans la liste.
  const liste = (await api('/v1/orders', { token: admin })).json;
  assert.equal(liste.find((x) => x.ref === o.ref)?.pickupMapUrl, LIEN_PLACE);
});

test('création : commande sans localisation → champs nuls (rétrocompatible)', async () => {
  const r = await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat' } });
  assert.equal(r.status, 201);
  assert.equal(r.json.pickupLat, null);
  assert.equal(r.json.dropMapUrl, null);
});

test('création : validation des coordonnées et du lien → 400', async () => {
  const cas = [
    { dropLat: 91, dropLng: -7.5 },
    { dropLat: 33.5, dropLng: -181 },
    { dropLat: 33.5 },
    { dropLat: '33.5', dropLng: -7.5 },
    { dropMapUrl: 'https://maps.app.goo.gl/AbC' },
    { dropLat: 33.5, dropLng: -7.5, dropMapUrl: 'javascript:alert(1)' },
    { dropLat: 33.5, dropLng: -7.5, dropMapUrl: 'https://maps.google.com/?q=' + 'a'.repeat(2100) },
  ];
  for (const extra of cas) {
    const r = await api('/v1/orders', { method: 'POST', token: admin, body: { fromCity: 'Casablanca', toCity: 'Rabat', ...extra } });
    assert.equal(r.status, 400, `devait refuser ${JSON.stringify(extra).slice(0, 80)}`);
  }
});

test('création par le marchand : localisation acceptée', async () => {
  const r = await api('/v1/orders', {
    method: 'POST', token: merchant,
    body: { fromCity: 'Casablanca', toCity: 'Casablanca', dropLat: 33.5731, dropLng: -7.5898, dropMapUrl: 'https://maps.google.com/?q=33.5731,-7.5898' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.dropMapUrl, 'https://maps.google.com/?q=33.5731,-7.5898');
});

/* ---------------- Correction ---------------- */
test('PATCH locations : corrige un point, laisse l’autre, refuse sur course close', async () => {
  const o = (await api('/v1/orders', {
    method: 'POST', token: admin,
    body: { fromCity: 'Casablanca', toCity: 'Casablanca', pickupLat: 33.5856, pickupLng: -7.6339, dropLat: 33.5, dropLng: -7.6 },
  })).json;
  const p = await api(`/v1/orders/${o.ref}/locations`, {
    method: 'PATCH', token: admin, body: { dropLat: 33.5731, dropLng: -7.5898, dropMapUrl: 'https://waze.com/ul?ll=33.5731,-7.5898' },
  });
  assert.equal(p.status, 200);
  assert.deepEqual([p.json.dropLat, p.json.dropMapUrl], [33.5731, 'https://waze.com/ul?ll=33.5731,-7.5898']);
  assert.equal(p.json.pickupLat, 33.5856, 'le point non fourni reste inchangé');
  assert.equal((await api(`/v1/orders/${o.ref}/locations`, { method: 'PATCH', token: admin, body: { dropLat: 99, dropLng: 0 } })).status, 400);
  assert.equal((await api(`/v1/orders/${o.ref}/locations`, { method: 'PATCH', token: compta, body: { dropLat: 33, dropLng: -7 } })).status, 403);
  await api(`/v1/orders/${o.ref}/cancel`, { method: 'POST', token: admin });
  assert.equal((await api(`/v1/orders/${o.ref}/locations`, { method: 'PATCH', token: admin, body: { dropLat: 33, dropLng: -7 } })).status, 400);
});

/* ---------------- Livreur ---------------- */
test('livreur : missions et tournée portent coordonnées + lien, jamais le téléphone client', async () => {
  const o = (await api('/v1/orders', {
    method: 'POST', token: admin,
    body: {
      fromCity: 'Casablanca', toCity: 'Casablanca', dropPhone: '+212600000002',
      pickupLat: 33.5856, pickupLng: -7.6339, pickupMapUrl: LIEN_PLACE, dropLat: 33.5731, dropLng: -7.5898,
    },
  })).json;
  await api(`/v1/orders/${o.ref}/assign`, { method: 'POST', token: admin, body: { driver: DRIVER } });
  const m = (await api('/v1/driver/missions', { token: driver })).json.find((x) => x.ref === o.ref);
  assert.ok(m, 'mission visible');
  assert.equal(m.pickupMapUrl, LIEN_PLACE);
  assert.deepEqual([m.dropLat, m.dropLng], [33.5731, -7.5898]);
  assert.ok(m.dropMapUrl);
  assert.equal(m.dropPhone, undefined, 'le numéro du destinataire ne descend pas chez le livreur');

  const tour = await api('/v1/driver/tour', { token: driver });
  assert.equal(tour.status, 200);
  for (const stop of tour.json?.stops ?? []) assert.equal(stop.dropPhone, undefined);
});

/* ---------------- Loi 09-08 ---------------- */
test('export 09-08 : position et lien inclus ; effacement : position effacée', async () => {
  const SUBJECT = '+212611223344';
  const o = (await api('/v1/orders', {
    method: 'POST', token: admin,
    body: { fromCity: 'Casablanca', toCity: 'Casablanca', dropPhone: SUBJECT, dropLat: 33.5731, dropLng: -7.5898 },
  })).json;
  const exp = await api(`/v1/privacy/export?subject=${encodeURIComponent(SUBJECT)}`, { token: admin });
  const course = exp.json.orders.find((x) => x.ref === o.ref);
  assert.equal(course.dropLat, 33.5731);
  assert.ok(course.dropMapUrl);
  await api('/v1/privacy/erase', { method: 'POST', token: admin, body: { subject: SUBJECT } });
  const apres = (await api(`/v1/orders/${o.ref}`, { token: admin })).json;
  assert.deepEqual([apres.dropLat, apres.dropLng, apres.dropMapUrl], [null, null, null]);
});
