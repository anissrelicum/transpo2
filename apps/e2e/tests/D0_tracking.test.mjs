import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

const DRIVER = 'Youssef Benali';
// Casablanca ~ (33.5731, -7.5898) ; Rabat ~ (34.0209, -6.8416) → ~87 km.
const CASA = { lat: 33.5731, lng: -7.5898 };
const RABAT = { lat: 34.0209, lng: -6.8416 };
let admin, driver;

before(async () => {
  await waitForApi();
  admin = await login('e2e', 'admin@e2e.ma');
  driver = await login('e2e', 'livreur@e2e.ma');
  await api('/v1/tracking/geofence', { method: 'POST', token: admin, body: { driver: DRIVER, name: 'Casa Centre', centerLat: CASA.lat, centerLng: CASA.lng, radiusM: 5000 } });
});

test('flotte : position dans la zone → pas d’alerte', async () => {
  const p = await api('/v1/tracking/position', { method: 'POST', token: driver, body: CASA });
  assert.equal(p.status, 200);
  const live = await api('/v1/tracking/live', { token: admin });
  assert.equal(live.status, 200);
  const me = live.json.find((d) => d.driver === DRIVER);
  assert.ok(me && me.outOfZone === false && me.distanceM < 5000);
});

test('géofencing : sortie de zone → alerte', async () => {
  await api('/v1/tracking/position', { method: 'POST', token: driver, body: RABAT });
  const alerts = await api('/v1/tracking/alerts', { token: admin });
  assert.equal(alerts.status, 200);
  const me = alerts.json.find((d) => d.driver === DRIVER);
  assert.ok(me && me.outOfZone === true && me.distanceM > 5000);
});

test('live : reflète la dernière position (Rabat)', async () => {
  const live = await api('/v1/tracking/live', { token: admin });
  const me = live.json.find((d) => d.driver === DRIVER);
  assert.ok(Math.abs(me.lat - RABAT.lat) < 0.01);
});

test('RBAC : le livreur ne voit pas le PC flotte', async () => {
  const r = await api('/v1/tracking/live', { token: driver });
  assert.equal(r.status, 403);
});

test('RBAC : un admin ne pousse pas de position (rôle DRIVER requis)', async () => {
  const r = await api('/v1/tracking/position', { method: 'POST', token: admin, body: CASA });
  assert.equal(r.status, 403);
});
