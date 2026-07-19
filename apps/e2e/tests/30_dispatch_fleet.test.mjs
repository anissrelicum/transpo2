import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { api, login, waitForApi } from '../helpers.mjs';

let admin;
before(async () => {
  await waitForApi();
  admin = await login('casaexpress', 'admin@casaexpress.ma');
});

test('zones : liste seedée (Casa Centre / Casa Nord)', async () => {
  const r = await api('/v1/dispatch/zones', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.length >= 2);
  assert.ok(r.json.some((z) => z.nameFr === 'Casa Centre'));
});

test('zones : création', async () => {
  const r = await api('/v1/dispatch/zones', {
    method: 'POST', token: admin,
    body: { nameFr: 'Casa Sud', nameAr: 'الجنوب', color: 'amber', commune: 'Sidi Maârouf' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.nameFr, 'Casa Sud');
});

test('suggestion de livreur (score /100, trié)', async () => {
  // CMD-…014 : Casablanca → Casablanca ; Youssef (Casablanca) doit scorer haut.
  const r = await api('/v1/dispatch/suggest/CMD-20260712-014', { token: admin });
  assert.equal(r.status, 200);
  assert.ok(r.json.suggestions.length >= 1);
  const top = r.json.suggestions[0];
  assert.ok(top.score >= top.parts.zone); // score cohérent
  // trié décroissant
  const scores = r.json.suggestions.map((s) => s.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test('véhicules : conformité — assurance expirée non affectable', async () => {
  const r = await api('/v1/vehicles', { token: admin });
  assert.equal(r.status, 200);
  const v1234 = r.json.find((v) => v.plate === '1234-A-56');
  assert.ok(v1234, 'véhicule seedé présent');
  assert.equal(v1234.insuranceExpired, true);
  assert.equal(v1234.assignable, false); // règle métier
});

test('véhicules : création avec plaque marocaine valide', async () => {
  const plate = '4567-C-' + Math.floor(Math.random() * 90 + 10);
  const r = await api('/v1/vehicles', {
    method: 'POST', token: admin,
    body: { plate, type: 'Voiture', city: 'Casablanca', insuranceDue: '2027-01-01', ctDue: '2027-01-01' },
  });
  assert.equal(r.status, 201);
  assert.equal(r.json.assignable, true);
});

test('véhicules : plaque invalide → 400', async () => {
  const r = await api('/v1/vehicles', { method: 'POST', token: admin, body: { plate: 'ABC', type: 'Moto' } });
  assert.equal(r.status, 400);
});
