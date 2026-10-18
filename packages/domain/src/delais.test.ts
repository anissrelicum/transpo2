// Délais de livraison : échéances, retard, urgence, supplément express, pénalité.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDelayPolicy, initialDeadlines, dueAtAfterPickup, deadlineState, lateMinutes, isUrgent,
  delaySurcharge, latePenalty, zonedTime, describeDelay,
} from './index.ts';

const TZ = 'Africa/Casablanca';

test('règles invalides refusées', () => {
  assert.equal(validateDelayPolicy({ mode: 'aucun' }), null);
  assert.match(validateDelayPolicy({ mode: 'apres_retrait' })!, /minutes/);
  assert.match(validateDelayPolicy({ mode: 'apres_commande', minutes: 2 })!, /minutes/);
  assert.match(validateDelayPolicy({ mode: 'heure_limite', heure: '25:00' })!, /HH:MM/);
  assert.equal(validateDelayPolicy({ mode: 'heure_limite', heure: '12:00', retraitMinutes: 30 }), null);
  assert.match(validateDelayPolicy({ mode: 'bidon' as never })!, /invalide/);
});

test('heure locale → instant UTC (Casablanca = UTC+1 hors ramadan)', () => {
  assert.equal(zonedTime('2026-10-18', '12:00', TZ).toISOString(), '2026-10-18T11:00:00.000Z');
});

test('express : échéance = commande + N min ; retrait limite ramené à l’échéance', () => {
  const c = new Date('2026-10-18T09:00:00Z');
  const r = initialDeadlines({ mode: 'apres_commande', minutes: 60, retraitMinutes: 90 }, c, TZ);
  assert.equal(r.dueAt!.toISOString(), '2026-10-18T10:00:00.000Z');
  assert.equal(r.pickupDueAt!.toISOString(), '2026-10-18T10:00:00.000Z');
});

test('avant midi : le jour même, ou le lendemain si midi est passé', () => {
  const matin = initialDeadlines({ mode: 'heure_limite', heure: '12:00' }, new Date('2026-10-18T08:00:00Z'), TZ);
  assert.equal(matin.dueAt!.toISOString(), '2026-10-18T11:00:00.000Z');
  const apresMidi = initialDeadlines({ mode: 'heure_limite', heure: '12:00' }, new Date('2026-10-18T13:00:00Z'), TZ);
  assert.equal(apresMidi.dueAt!.toISOString(), '2026-10-19T11:00:00.000Z');
});

test('restaurant : l’échéance part du retrait, pas de la commande', () => {
  const p = { mode: 'apres_retrait' as const, minutes: 30, retraitMinutes: 20 };
  const c = initialDeadlines(p, new Date('2026-10-18T12:00:00Z'), TZ);
  assert.equal(c.dueAt, null);
  assert.equal(c.pickupDueAt!.toISOString(), '2026-10-18T12:20:00.000Z');
  assert.equal(dueAtAfterPickup(p, new Date('2026-10-18T12:15:00Z'))!.toISOString(), '2026-10-18T12:45:00.000Z');
});

test('à risque AVANT le retard ; retrait limite ignoré une fois le colis en main', () => {
  const now = new Date('2026-10-18T10:00:00Z');
  const dueAt = '2026-10-18T10:20:00Z';
  assert.equal(deadlineState({ dueAt, pickedUp: true, now, etaMin: 10 }), 'ok');
  assert.equal(deadlineState({ dueAt, pickedUp: true, now, etaMin: 30 }), 'a_risque');
  assert.equal(deadlineState({ dueAt: '2026-10-18T09:59:00Z', pickedUp: true, now }), 'en_retard');
  assert.equal(deadlineState({ dueAt: null, pickupDueAt: '2026-10-18T09:00:00Z', pickedUp: true, now }), 'sans');
  assert.equal(deadlineState({ dueAt: null, pickupDueAt: '2026-10-18T09:00:00Z', pickedUp: false, now }), 'en_retard');
});

test('minutes de retard', () => {
  assert.equal(lateMinutes('2026-10-18T10:00:00Z', '2026-10-18T09:50:00Z'), 0);
  assert.equal(lateMinutes('2026-10-18T10:00:00Z', '2026-10-18T10:12:30Z'), 13);
  assert.equal(lateMinutes(null, '2026-10-18T10:12:30Z'), 0);
});

test('urgence : échéance dans l’heure, ou délai court après retrait', () => {
  const now = new Date('2026-10-18T10:00:00Z');
  assert.equal(isUrgent({ policy: { mode: 'apres_commande', minutes: 45 }, dueAt: '2026-10-18T10:45:00Z', now }), true);
  assert.equal(isUrgent({ policy: { mode: 'heure_limite', heure: '18:00' }, dueAt: '2026-10-18T17:00:00Z', now }), false);
  assert.equal(isUrgent({ policy: { mode: 'apres_retrait', minutes: 30 }, now }), true);
  assert.equal(isUrgent({ policy: { mode: 'aucun' }, now }), false);
});

test('supplément express et pénalité de retard', () => {
  const terms = { delai: { mode: 'aucun' as const }, supplements: { apres_commande: 15 }, penaliteRetard: 0.5 };
  assert.equal(delaySurcharge(terms, 'apres_commande'), 15);
  assert.equal(delaySurcharge(terms, 'heure_limite'), 0);
  assert.equal(delaySurcharge(terms, 'aucun'), 0);
  assert.equal(latePenalty(32, 0.5, 12), 16);
  assert.equal(latePenalty(32, 0.5, 0), 0);
  assert.equal(latePenalty(32, 0, 30), 0);
});

test('libellés', () => {
  assert.equal(describeDelay({ mode: 'heure_limite', heure: '12:00' }), 'avant 12:00');
  assert.equal(describeDelay({ mode: 'apres_retrait', minutes: 30 }), '30 min après la prise en charge');
});
