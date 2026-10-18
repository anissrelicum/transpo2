// PC flotte : hors zone sur les VRAIES zones dessinées, longueur de trace, vitesse.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanceToPolygonM, zoneStatus, pathLengthM, speedKmh } from './index.ts';

// Carré ~2,2 km de côté sur le Maârif, en [lat, lng].
const MAARIF = [[33.60, -7.65], [33.60, -7.63], [33.58, -7.63], [33.58, -7.65]];

test('à l’intérieur : distance nulle', () => {
  assert.equal(distanceToPolygonM({ lat: 33.59, lng: -7.64 }, MAARIF), 0);
});

test('dehors : distance au bord le plus proche, pas au centre', () => {
  // 0,01° de latitude au sud du bord sud ≈ 1,1 km.
  const d = distanceToPolygonM({ lat: 33.57, lng: -7.64 }, MAARIF);
  assert.ok(d > 1050 && d < 1160, `obtenu ${d}`);
});

test('hors zone = hors de TOUTES ses zones ; écart à la plus proche', () => {
  const zones = [{ nameFr: 'Maârif', polygon: MAARIF }, { nameFr: 'Loin', polygon: [[34, -7], [34, -6.9], [33.9, -6.9]] }];
  assert.deepEqual(zoneStatus({ lat: 33.59, lng: -7.64 }, zones), { zone: 'Maârif', outOfZone: false, distanceM: 0 });
  const dehors = zoneStatus({ lat: 33.57, lng: -7.64 }, zones);
  assert.equal(dehors.outOfZone, true);
  assert.equal(dehors.zone, 'Maârif');
});

test('sans zone dessinée : jamais signalé hors zone', () => {
  assert.equal(zoneStatus({ lat: 0, lng: 0 }, [{ nameFr: 'Ville', polygon: null }]).outOfZone, false);
  assert.equal(zoneStatus({ lat: 0, lng: 0 }, []).outOfZone, false);
});

test('trace : sauts GPS aberrants ignorés', () => {
  const p = [{ lat: 33.59, lng: -7.64 }, { lat: 33.591, lng: -7.64 }, { lat: 34.5, lng: -7.64 }, { lat: 33.592, lng: -7.64 }];
  const d = pathLengthM(p);
  assert.ok(d > 100 && d < 120, `obtenu ${d}`);
});

test('vitesse entre les deux derniers points', () => {
  const v = speedKmh([
    { lat: 33.59, lng: -7.64, at: '2026-10-18T10:00:00Z' },
    { lat: 33.5909, lng: -7.64, at: '2026-10-18T10:00:10Z' }, // ~100 m en 10 s
  ]);
  assert.ok(v !== null && v >= 34 && v <= 38, `obtenu ${v}`);
});
