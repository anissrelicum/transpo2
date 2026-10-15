// Validation de la localisation d'un point de course — cf. localisation.ts.
// Lancement : pnpm --filter @transpo/api test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { normaliserLocalisation } from './localisation.ts';

const refuse = (f: () => unknown, motif: RegExp) =>
  assert.throws(f, (e) => e instanceof BadRequestException && motif.test(e.message));

test('rien fourni → aucune localisation', () => {
  assert.deepEqual(normaliserLocalisation('retrait', undefined, undefined, undefined), { lat: null, lng: null, mapUrl: null });
  assert.deepEqual(normaliserLocalisation('retrait', null, null, ''), { lat: null, lng: null, mapUrl: null });
});

test('coordonnées + lien d’origine : conservés tels quels', () => {
  const url = 'https://maps.app.goo.gl/AbCdEf123';
  assert.deepEqual(normaliserLocalisation('livraison', 33.5731, -7.5898, url), { lat: 33.5731, lng: -7.5898, mapUrl: url });
});

test('coordonnées sans lien → lien Google Maps partageable généré', () => {
  const r = normaliserLocalisation('livraison', 33.5731, -7.5898, undefined);
  assert.equal(r.mapUrl, 'https://www.google.com/maps/search/?api=1&query=33.5731,-7.5898');
});

test('bornes : lat ∈ [-90,90], lng ∈ [-180,180], nombres seulement', () => {
  refuse(() => normaliserLocalisation('retrait', 91, 0, undefined), /latitude invalide/);
  refuse(() => normaliserLocalisation('retrait', 33, -181, undefined), /longitude invalide/);
  refuse(() => normaliserLocalisation('retrait', '33.5', -7.5, undefined), /latitude invalide/);
  refuse(() => normaliserLocalisation('retrait', Number.NaN, -7.5, undefined), /latitude invalide/);
});

test('latitude sans longitude → refusé', () => {
  refuse(() => normaliserLocalisation('livraison', 33.5, undefined, undefined), /vont ensemble/);
});

test('lien sans coordonnées → refusé (à résoudre d’abord)', () => {
  refuse(() => normaliserLocalisation('livraison', undefined, undefined, 'https://maps.app.goo.gl/x'), /resolve-link/);
});

test('lien : http(s) seulement, 2048 caractères au plus', () => {
  refuse(() => normaliserLocalisation('livraison', 33.5, -7.5, 'javascript:alert(1)'), /http\(s\)/);
  refuse(() => normaliserLocalisation('livraison', 33.5, -7.5, 'intent://maps#Intent;end'), /http\(s\)/);
  refuse(() => normaliserLocalisation('livraison', 33.5, -7.5, 'pas un lien'), /invalide/);
  refuse(() => normaliserLocalisation('livraison', 33.5, -7.5, 'https://maps.google.com/?q=' + 'a'.repeat(2048)), /trop long/);
});
