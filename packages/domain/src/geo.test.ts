// Localisation d'un point de course : distance routière estimée et lien partageable.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roadDistanceKm, shareableMapUrl, isLatitude, isLongitude, ROAD_FACTOR, haversineMeters } from './index.ts';

const MAARIF = { lat: 33.5883, lng: -7.6324 };
const AIN_DIAB = { lat: 33.5952, lng: -7.6870 };

test('distance routière = haversine × facteur route, 1 décimale', () => {
  const vol = haversineMeters(MAARIF.lat, MAARIF.lng, AIN_DIAB.lat, AIN_DIAB.lng) / 1000;
  assert.equal(roadDistanceKm(MAARIF, AIN_DIAB), Math.round(vol * ROAD_FACTOR * 10) / 10);
  assert.ok(roadDistanceKm(MAARIF, AIN_DIAB) > vol);
});

test('distance routière : plancher à 1 km (deux points voisins)', () => {
  assert.equal(roadDistanceKm(MAARIF, { lat: 33.5884, lng: -7.6325 }), 1);
});

test('distance routière symétrique', () => {
  assert.equal(roadDistanceKm(MAARIF, AIN_DIAB), roadDistanceKm(AIN_DIAB, MAARIF));
});

test('lien partageable : format Maps URLs, 6 décimales max', () => {
  assert.equal(
    shareableMapUrl(33.57312345678, -7.58981234),
    'https://www.google.com/maps/search/?api=1&query=33.573123,-7.589812',
  );
});

test('bornes lat/lng', () => {
  assert.ok(isLatitude(90) && isLatitude(-90) && isLatitude(0));
  assert.ok(!isLatitude(90.0001) && !isLatitude(NaN) && !isLatitude('33' as unknown));
  assert.ok(isLongitude(180) && isLongitude(-180));
  assert.ok(!isLongitude(180.5) && !isLongitude(Infinity));
});
