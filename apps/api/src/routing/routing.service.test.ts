// Itinéraires (ADR 0007) : lecture des points, et repli sans moteur — jamais d'écran vide.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoutingService, estimation } from './routing.service.ts';

test('points lus dans l’ordre ; invalides ou trop peu refusés', () => {
  assert.deepEqual(RoutingService.lirePoints('33.58,-7.64;33.59,-7.63'), [{ lat: 33.58, lng: -7.64 }, { lat: 33.59, lng: -7.63 }]);
  assert.throws(() => RoutingService.lirePoints('33.58,-7.64'), /deux points/);
  assert.throws(() => RoutingService.lirePoints('33.58,-7.64;abc,1'), /invalide/);
  assert.throws(() => RoutingService.lirePoints('95,0;0,0'), /invalide/);
});

test('moteur indisponible : estimation en lignes droites, marquée comme telle', async () => {
  process.env.OSRM_URL = 'http://127.0.0.1:9';
  const r = await new RoutingService().route([{ lat: 33.5869, lng: -7.6328 }, { lat: 33.5795, lng: -7.646 }, { lat: 33.547, lng: -7.623 }]);
  assert.equal(r.source, 'estimation');
  assert.equal(r.legs.length, 2);
  assert.equal(r.geometry.length, 3);
  assert.equal(r.durationS, r.legs[0]!.durationS + r.legs[1]!.durationS);
});

test('estimation : 1,3 × vol d’oiseau à 25 km/h', () => {
  const r = estimation([{ lat: 33.59, lng: -7.64 }, { lat: 33.6, lng: -7.64 }]); // ~1,1 km
  assert.ok(r.distanceM > 1400 && r.distanceM < 1500, String(r.distanceM));
  assert.ok(r.durationS > 200 && r.durationS < 220, String(r.durationS));
});
