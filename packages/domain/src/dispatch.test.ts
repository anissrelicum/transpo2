// Affectation automatique équitable (ADR 0004) : couverture de zone, éligibilité, capacité,
// ordre d'équité et motifs d'exception.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pointInPolygon, zoneCovers, planAutoDispatch, compareCandidates, compareUrgentCandidates, dayInTimeZone, normalizePlace,
  type DispatchCandidate, type DispatchZone,
} from './index.ts';

const TODAY = '2026-10-18';
// Carré autour du Maârif (Casablanca), en [lat, lng] comme les zones du dispatch.
const MAARIF_BOX = [[33.57, -7.65], [33.57, -7.61], [33.60, -7.61], [33.60, -7.65]];
const MAARIF = { lat: 33.5883, lng: -7.6324 };
const AIN_SEBAA = { lat: 33.6050, lng: -7.5300 };

const zone = (drivers: string[], over: Partial<DispatchZone> = {}): DispatchZone => ({
  nameFr: 'Casa Centre', drivers, polygon: MAARIF_BOX,
  province: 'Casablanca', commune: 'Maârif', region: 'Casablanca-Settat', ...over,
});
const driver = (name: string, over: Partial<DispatchCandidate> = {}): DispatchCandidate => ({
  name, available: true, accountActive: true, licenseDue: '2030-01-01', medicalDue: '2030-01-01',
  capacity: 10, load: 0, lastPosition: null, ...over,
});
const plan = (drivers: DispatchCandidate[], zones: DispatchZone[], extra: { point?: typeof MAARIF | null; city?: string; asked?: string[] } = {}) =>
  planAutoDispatch({
    pickup: { city: extra.city ?? 'Casablanca', point: extra.point === undefined ? MAARIF : extra.point },
    drivers, zones, alreadyAsked: extra.asked ?? [], today: TODAY,
  });

/* ---------------- Couverture de zone ---------------- */

test('point dans le polygone : dedans / dehors', () => {
  assert.equal(pointInPolygon(MAARIF, MAARIF_BOX), true);
  assert.equal(pointInPolygon(AIN_SEBAA, MAARIF_BOX), false);
});

test('polygone dégénéré (< 3 sommets) : ne couvre rien', () => {
  assert.equal(pointInPolygon(MAARIF, [[33.5, -7.6], [33.6, -7.7]]), false);
});

test('zone avec polygone + retrait géolocalisé : seul le polygone fait foi (pas la ville)', () => {
  assert.equal(zoneCovers(zone([]), { city: 'Casablanca', point: MAARIF }), true);
  // Même ville, mais hors du polygone : la zone ne couvre PAS ce retrait.
  assert.equal(zoneCovers(zone([]), { city: 'Casablanca', point: AIN_SEBAA }), false);
});

test('retrait sans coordonnées : repli sur la ville (province, commune, région)', () => {
  assert.equal(zoneCovers(zone([]), { city: 'Casablanca', point: null }), true);
  assert.equal(zoneCovers(zone([]), { city: 'maarif', point: null }), true, 'commune, accents et casse ignorés');
  assert.equal(zoneCovers(zone([], { province: null, commune: null }), { city: 'Settat', point: null }), true, 'nom composant la région');
  assert.equal(zoneCovers(zone([]), { city: 'Rabat', point: null }), false);
});

test('zone sans polygone + retrait géolocalisé : repli sur la ville', () => {
  assert.equal(zoneCovers(zone([], { polygon: null }), { city: 'Casablanca', point: AIN_SEBAA }), true);
});

test('normalisation des lieux', () => {
  assert.equal(normalizePlace('  Fès '), 'fes');
  assert.equal(normalizePlace('Aïn Sebaâ'), 'ain sebaa');
});

/* ---------------- Éligibilité ---------------- */

test('jamais un livreur dont la zone ne couvre pas le retrait', () => {
  const r = plan([driver('Hors Zone', { load: 0 }), driver('Dans Zone', { load: 9 })], [zone(['Dans Zone'])]);
  assert.equal(r.kind, 'offer');
  assert.equal(r.kind === 'offer' && r.driver.name, 'Dans Zone');
  assert.equal(r.excluded['Hors Zone'], 'HORS_ZONE');
});

test('écartés : indisponible, sans compte, permis expiré, visite expirée', () => {
  const r = plan([
    driver('A', { available: false }),
    driver('B', { accountActive: false }),
    driver('C', { licenseDue: '2026-10-17' }),
    driver('D', { medicalDue: '2025-01-01' }),
    driver('E'),
  ], [zone(['A', 'B', 'C', 'D', 'E'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'E');
  assert.deepEqual(r.excluded, { A: 'INDISPONIBLE', B: 'SANS_COMPTE', C: 'PERMIS_EXPIRE', D: 'VISITE_EXPIREE' });
});

test('échéance le jour même : encore valide', () => {
  const r = plan([driver('A', { licenseDue: TODAY, medicalDue: TODAY })], [zone(['A'])]);
  assert.equal(r.kind, 'offer');
});

/* ---------------- Équité ---------------- */

test('équité : le MOINS chargé au regard de sa capacité, pas le moins chargé en absolu', () => {
  // A : 4/20 = 0,2 ; B : 3/5 = 0,6 → A, bien que B ait moins de courses.
  const r = plan([driver('B', { load: 3, capacity: 5 }), driver('A', { load: 4, capacity: 20 })], [zone(['A', 'B'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'A');
  assert.equal(r.kind === 'offer' && r.driver.ratio, 0.2);
});

test('à charge égale : le plus proche du retrait (dernière position GPS)', () => {
  const r = plan([
    driver('Loin', { lastPosition: AIN_SEBAA }),
    driver('Près', { lastPosition: { lat: 33.589, lng: -7.633 } }),
  ], [zone(['Loin', 'Près'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'Près');
  assert.ok(r.kind === 'offer' && r.driver.distanceKm !== null && r.driver.distanceKm < 1);
});

test('à charge égale : position connue avant position inconnue', () => {
  const r = plan([driver('Aucune'), driver('Connue', { lastPosition: AIN_SEBAA })], [zone(['Aucune', 'Connue'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'Connue');
});

test('à charge et distance égales : ordre alphabétique (déterministe)', () => {
  const r = plan([driver('Zineb'), driver('Amine'), driver('Mehdi')], [zone(['Zineb', 'Amine', 'Mehdi'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'Amine');
  assert.deepEqual(r.kind === 'offer' && r.ranking.map((x) => x.name), ['Amine', 'Mehdi', 'Zineb']);
});

test('compareCandidates : ordre total stable', () => {
  const a = { name: 'A', load: 1, capacity: 10, ratio: 0.1, distanceKm: 5 };
  const b = { name: 'B', load: 1, capacity: 10, ratio: 0.1, distanceKm: 2 };
  assert.ok(compareCandidates(b, a) < 0);
  assert.ok(compareCandidates(a, { ...a, ratio: 0.5 }) < 0);
});

/* ---------------- Capacité ---------------- */

test('capacité : un livreur plein est écarté, le suivant prend la course', () => {
  const r = plan([driver('Plein', { load: 10, capacity: 10 }), driver('Libre', { load: 9, capacity: 10 })], [zone(['Plein', 'Libre'])]);
  assert.equal(r.kind === 'offer' && r.driver.name, 'Libre');
  assert.equal(r.excluded['Plein'], 'CAPACITE_ATTEINTE');
});

/* ---------------- Motifs d'exception ---------------- */

test('exception ZONE_NON_COUVERTE : aucun livreur ne couvre le retrait', () => {
  const r = plan([driver('A')], [zone(['A'])], { point: AIN_SEBAA });
  assert.deepEqual(r.kind === 'exception' && r.reason, 'ZONE_NON_COUVERTE');
});

test('exception ZONE_NON_COUVERTE : zone sans livreur rattaché', () => {
  const r = plan([driver('A')], [zone([])]);
  assert.equal(r.kind === 'exception' && r.reason, 'ZONE_NON_COUVERTE');
});

test('exception AUCUN_LIVREUR_DISPONIBLE : la zone est couverte, mais personne n’est en état', () => {
  const r = plan([driver('A', { available: false }), driver('B', { accountActive: false })], [zone(['A', 'B'])]);
  assert.equal(r.kind === 'exception' && r.reason, 'AUCUN_LIVREUR_DISPONIBLE');
});

test('exception CAPACITE_ATTEINTE : tous les éligibles sont pleins', () => {
  const r = plan([driver('A', { load: 5, capacity: 5 }), driver('B', { load: 7, capacity: 7 })], [zone(['A', 'B'])]);
  assert.equal(r.kind === 'exception' && r.reason, 'CAPACITE_ATTEINTE');
});

test('exception REFUSEE_PAR_TOUS : tous les éligibles ont déjà été sollicités', () => {
  const r = plan([driver('A'), driver('B')], [zone(['A', 'B'])], { asked: ['A', 'B'] });
  assert.equal(r.kind === 'exception' && r.reason, 'REFUSEE_PAR_TOUS');
});

test('déjà sollicité : on passe au suivant, même s’il est plus chargé', () => {
  const r = plan([driver('A', { load: 0 }), driver('B', { load: 5 })], [zone(['A', 'B'])], { asked: ['A'] });
  assert.equal(r.kind === 'offer' && r.driver.name, 'B');
  assert.equal(r.excluded['A'], 'DEJA_SOLLICITE');
});

/* ---------------- Journée de capacité ---------------- */

test('journée de capacité : fuseau de Casablanca, pas UTC', () => {
  // 23h30 UTC le 17 = 00h30 le 18 à Casablanca (UTC+1).
  assert.equal(dayInTimeZone(new Date('2026-10-17T23:30:00Z'), 'Africa/Casablanca'), '2026-10-18');
  assert.equal(dayInTimeZone(new Date('2026-10-17T22:30:00Z'), 'Africa/Casablanca'), '2026-10-17');
});

test('urgent : le plus proche du retrait l’emporte sur le moins chargé', () => {
  const pres = { name: 'Proche', load: 8, capacity: 10, ratio: 0.8, distanceKm: 0.6 };
  const loin = { name: 'Loin', load: 1, capacity: 10, ratio: 0.1, distanceKm: 6.2 };
  assert.equal([pres, loin].sort(compareCandidates)[0]!.name, 'Loin', 'équité hors urgence');
  assert.equal([pres, loin].sort(compareUrgentCandidates)[0]!.name, 'Proche', 'urgence : la distance d’abord');
});
