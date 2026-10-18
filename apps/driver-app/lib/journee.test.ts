// La journée en arrêts : cible retrait/livraison, regroupement des retraits d'un même lieu,
// ordre (tournée de l'agence > ordre manuel > plus proche voisin), détection d'arrivée.
// Lancement : pnpm --filter @transpo/driver-app test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Order } from '@transpo/domain';
import { arretDe, grouper, ordonnerArrets, estArrive, distanceKm, minutesEstimees, formatDistance } from './journee.ts';

const ATELIER = { pickupLat: 33.5869, pickupLng: -7.6328 };

function cmd(ref: string, p: Partial<Order> = {}): Order {
  return {
    ref, code: ref.slice(-8), status: 'ASSIGNEE', merchant: 'Maison Argane', fromCity: 'Casablanca', toCity: 'Casablanca',
    driver: 'Y', cod: 0, codPaid: false, size: 'Petit', proofLevel: 'aucune', createdAt: '2026-10-18T08:00:00Z',
    pickupAddress: '14 rue Ahmed El Mokri', ...ATELIER, ...p,
  } as Order;
}

test('avant récupération, l’arrêt est le retrait ; ensuite, la livraison', () => {
  const o = cmd('A', { dropLat: 33.58, dropLng: -7.64, dropAddress: 'Bd Ghandi', dropContact: 'Adil' });
  assert.equal(arretDe(o).type, 'retrait');
  assert.deepEqual(arretDe(o).pos, { lat: 33.5869, lng: -7.6328 });
  const recup = arretDe({ ...o, status: 'RECUPEREE' });
  assert.equal(recup.type, 'livraison');
  assert.equal(recup.contact, 'Adil');
  assert.equal(recup.telephone, null, 'le numéro du destinataire n’est jamais exposé');
});

test('un point sans coordonnées n’a pas de position inventée', () => {
  const o = cmd('A', { pickupLat: null, pickupLng: null });
  assert.equal(arretDe(o).pos, null);
});

test('les retraits d’un même lieu forment un seul arrêt ; pas les livraisons', () => {
  const r = grouper([cmd('A'), cmd('B'), cmd('C', { pickupLat: 33.6, pickupLng: -7.6 })].map(arretDe));
  assert.equal(r.length, 2);
  assert.deepEqual(r[0]!.commandes.map((o) => o.ref), ['A', 'B']);
  const l = grouper([cmd('D', { status: 'LIVRAISON', dropLat: 33.58, dropLng: -7.64 }), cmd('E', { status: 'LIVRAISON', dropLat: 33.58, dropLng: -7.64 })].map(arretDe));
  assert.equal(l.length, 2, 'deux clients = deux preuves, deux encaissements');
});

test('sans tournée planifiée : plus proche voisin depuis la position du livreur', () => {
  const loin = cmd('LOIN', { status: 'RECUPEREE', dropLat: 33.547, dropLng: -7.623 });
  const pres = cmd('PRES', { status: 'RECUPEREE', dropLat: 33.5833, dropLng: -7.6385 });
  const sansPos = cmd('TEXTE', { status: 'RECUPEREE' });
  const r = ordonnerArrets([loin, sansPos, pres], { tournee: null, ordreManuel: null, moi: { lat: 33.585, lng: -7.64 } });
  assert.deepEqual(r.map((a) => a.order.ref), ['PRES', 'LOIN', 'TEXTE'], 'les points non localisés passent à la fin');
});

test('la tournée de l’agence fait foi, avant l’ordre manuel', () => {
  const a = cmd('A', { status: 'RECUPEREE', dropLat: 33.58, dropLng: -7.64 });
  const b = cmd('B', { status: 'RECUPEREE', dropLat: 33.59, dropLng: -7.63 });
  const r = ordonnerArrets([a, b], { tournee: ['B', 'A'], ordreManuel: ['A', 'B'], moi: null });
  assert.deepEqual(r.map((x) => x.order.ref), ['B', 'A']);
  const m = ordonnerArrets([a, b], { tournee: null, ordreManuel: ['B', 'A'], moi: null });
  assert.deepEqual(m.map((x) => x.order.ref), ['B', 'A']);
});

test('les missions terminées ne sont plus des arrêts', () => {
  const r = ordonnerArrets([cmd('A', { status: 'LIVREE' }), cmd('B', { status: 'ECHOUEE' }), cmd('C')], { tournee: null, ordreManuel: null, moi: null });
  assert.deepEqual(r.map((a) => a.order.ref), ['C']);
});

test('arrivée détectée à moins de 120 m, pas au-delà', () => {
  const a = arretDe(cmd('A'));
  assert.equal(estArrive({ lat: 33.5870, lng: -7.6329 }, a), true);
  assert.equal(estArrive({ lat: 33.5900, lng: -7.6328 }, a), false);
  assert.equal(estArrive(null, a), false);
});

test('estimations lisibles', () => {
  const d = distanceKm({ lat: 33.5869, lng: -7.6328 }, { lat: 33.5795, lng: -7.646 });
  assert.ok(d > 1.3 && d < 1.6);
  assert.ok(minutesEstimees(d) >= 4 && minutesEstimees(d) <= 7);
  assert.equal(formatDistance(0.45, 'fr'), '450 m');
  assert.equal(formatDistance(3.42, 'fr'), '3,4 km');
});

test('une échéance dans l’heure passe devant le plus proche voisin', () => {
  const now = new Date('2026-10-18T10:00:00Z').getTime();
  const pres = cmd('PRES', { status: 'RECUPEREE', dropLat: 33.5833, dropLng: -7.6385 });
  const urgentLoin = cmd('URGENT', { status: 'RECUPEREE', dropLat: 33.547, dropLng: -7.623, dueAt: '2026-10-18T10:30:00Z', delayMode: 'apres_commande' });
  const tardive = cmd('TARD', { status: 'RECUPEREE', dropLat: 33.59, dropLng: -7.64, dueAt: '2026-10-18T16:00:00Z', delayMode: 'heure_limite' });
  const r = ordonnerArrets([pres, tardive, urgentLoin], { tournee: null, ordreManuel: null, moi: { lat: 33.585, lng: -7.64 }, now });
  assert.equal(r[0]!.order.ref, 'URGENT');
  assert.equal(r[0]!.echeance, '2026-10-18T10:30:00.000Z');
});

test('au retrait, le retrait limite compte ; un arrêt groupé prend l’échéance la plus proche', () => {
  const a = cmd('A', { pickupDueAt: '2026-10-18T10:20:00Z', dueAt: '2026-10-18T11:00:00Z' });
  const b = cmd('B', { dueAt: '2026-10-18T10:10:00Z' });
  assert.equal(arretDe(a).echeance, '2026-10-18T10:20:00.000Z');
  const [g] = grouper([a, b].map(arretDe));
  assert.equal(g!.echeance, '2026-10-18T10:10:00.000Z');
});
