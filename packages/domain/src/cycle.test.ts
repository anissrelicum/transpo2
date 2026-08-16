// Machine à états de l'abonnement — spec §5, §7.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cycleStep, addDaysIso, firstOfNextMonthIso, periodOf,
  TENANT_STATUS_OF_SUBSCRIPTION, GRACE_DAYS, TRIAL_DAYS,
  type CycleSubscription, type SubscriptionStatus,
} from './index.ts';

const sub = (over: Partial<CycleSubscription> = {}): CycleSubscription => ({
  status: 'ACTIF', trialEndsAt: null, pastDueSince: null,
  renewsAt: '2026-09-01', hasNextPlan: false, ...over,
});

/**
 * Applique le cycle jusqu'à stabilisation, comme le fait le service.
 * Retourne la suite des transitions — c'est elle qu'on vérifie.
 */
function runUntilStable(s: CycleSubscription, today: string, max = 12): string[] {
  const seen: string[] = [];
  let cur = { ...s };
  for (let i = 0; i < max; i++) {
    const a = cycleStep(cur, today);
    if (!a) return seen;
    seen.push(a.kind);
    if (a.kind === 'TRIAL_EXPIRED') cur = { ...cur, status: 'IMPAYE', pastDueSince: a.pastDueSince, trialEndsAt: null };
    else if (a.kind === 'SUSPEND') cur = { ...cur, status: 'SUSPENDU' };
    else cur = { ...cur, renewsAt: a.renewsAt, hasNextPlan: false };
  }
  throw new Error(`cycle non convergent : ${seen.join(' → ')}`);
}

/* ------------------------------- Dates ------------------------------- */

test('addDaysIso franchit les mois', () => {
  assert.equal(addDaysIso('2026-08-30', 7), '2026-09-06');
  assert.equal(addDaysIso('2026-08-16', TRIAL_DAYS), '2026-08-30');
});

test('addDaysIso franchit les années', () => {
  assert.equal(addDaysIso('2026-12-28', 7), '2027-01-04');
});

test('firstOfNextMonthIso passe à décembre puis à janvier', () => {
  assert.equal(firstOfNextMonthIso('2026-11-01'), '2026-12-01');
  assert.equal(firstOfNextMonthIso('2026-12-01'), '2027-01-01');
});

test('firstOfNextMonthIso gère février et les fins de mois', () => {
  assert.equal(firstOfNextMonthIso('2026-01-31'), '2026-02-01');
  assert.equal(firstOfNextMonthIso('2026-02-28'), '2026-03-01');
});

test('periodOf extrait le mois', () => {
  assert.equal(periodOf('2026-09-01'), '2026-09');
});

/* ---------------------------- Fin d'essai ---------------------------- */

test('un essai en cours ne déclenche rien', () => {
  const s = sub({ status: 'ESSAI', trialEndsAt: '2026-08-30', renewsAt: null });
  assert.equal(cycleStep(s, '2026-08-16'), null);
});

test('un essai expire le lendemain de son échéance, pas le jour même', () => {
  const s = sub({ status: 'ESSAI', trialEndsAt: '2026-08-30', renewsAt: null });
  assert.equal(cycleStep(s, '2026-08-30'), null, 'le dernier jour d’essai reste utilisable');
  assert.equal(cycleStep(s, '2026-08-31')?.kind, 'TRIAL_EXPIRED');
});

test('l’essai expiré date l’impayé de la fin d’essai, pas du jour du passage du cron', () => {
  const s = sub({ status: 'ESSAI', trialEndsAt: '2026-08-01', renewsAt: null });
  const a = cycleStep(s, '2026-08-20');
  assert.deepEqual(a, { kind: 'TRIAL_EXPIRED', pastDueSince: '2026-08-01' });
});

/* ------------------------- Grâce et suspension ------------------------- */

test('l’impayé n’est pas suspendu pendant la grâce', () => {
  const s = sub({ status: 'IMPAYE', pastDueSince: '2026-08-01', renewsAt: null });
  assert.equal(cycleStep(s, addDaysIso('2026-08-01', GRACE_DAYS - 1)), null);
});

test('l’impayé est suspendu à l’échéance exacte de la grâce', () => {
  const s = sub({ status: 'IMPAYE', pastDueSince: '2026-08-01', renewsAt: null });
  assert.equal(cycleStep(s, addDaysIso('2026-08-01', GRACE_DAYS))?.kind, 'SUSPEND');
});

test('essai expiré depuis longtemps : impayé PUIS suspendu en une exécution', () => {
  const s = sub({ status: 'ESSAI', trialEndsAt: '2026-07-01', renewsAt: null });
  assert.deepEqual(runUntilStable(s, '2026-08-16'), ['TRIAL_EXPIRED', 'SUSPEND']);
});

test('un abonnement suspendu ne bouge plus tout seul', () => {
  assert.equal(cycleStep(sub({ status: 'SUSPENDU', renewsAt: '2026-01-01' }), '2026-08-16'), null);
});

test('un abonnement résilié ne bouge plus tout seul', () => {
  assert.equal(cycleStep(sub({ status: 'RESILIE', renewsAt: '2026-01-01' }), '2026-08-16'), null);
});

/* ----------------------------- Reconduction ----------------------------- */

test('pas de reconduction avant l’échéance', () => {
  assert.equal(cycleStep(sub({ renewsAt: '2026-09-01' }), '2026-08-31'), null);
});

test('reconduction le jour de l’échéance', () => {
  const a = cycleStep(sub({ renewsAt: '2026-09-01' }), '2026-09-01');
  assert.deepEqual(a, { kind: 'RENEW', period: '2026-09', renewsAt: '2026-10-01', applyNextPlan: false });
});

test('un cron manqué plusieurs mois rattrape une période par mois', () => {
  const s = sub({ renewsAt: '2026-06-01' });
  // juin, juillet, août : trois périodes, aucune sautée — L3 y accrochera une facture.
  assert.deepEqual(runUntilStable(s, '2026-08-16'), ['RENEW', 'RENEW', 'RENEW']);
});

test('le changement de plan ne s’applique qu’à la reconduction', () => {
  const s = sub({ renewsAt: '2026-09-01', hasNextPlan: true });
  assert.equal(cycleStep(s, '2026-08-31'), null, 'rien avant l’échéance');
  assert.equal((cycleStep(s, '2026-09-01') as any).applyNextPlan, true);
});

/* ------------------------------ Idempotence ------------------------------ */

test('rejouer le cycle le même jour ne produit plus rien', () => {
  const cases: CycleSubscription[] = [
    sub({ status: 'ESSAI', trialEndsAt: '2026-07-01', renewsAt: null }),
    sub({ status: 'IMPAYE', pastDueSince: '2026-07-01', renewsAt: null }),
    sub({ renewsAt: '2026-06-01' }),
  ];
  for (const c of cases) {
    runUntilStable(c, '2026-08-16');           // 1re exécution : converge
    const again = runUntilStable(stabilize(c, '2026-08-16'), '2026-08-16');
    assert.deepEqual(again, [], 'une seconde exécution doit être neutre');
  }
});

/** Rejoue le cycle et retourne l'état final, pour vérifier qu'il est stable. */
function stabilize(s: CycleSubscription, today: string): CycleSubscription {
  let cur = { ...s };
  for (let i = 0; i < 12; i++) {
    const a = cycleStep(cur, today);
    if (!a) return cur;
    if (a.kind === 'TRIAL_EXPIRED') cur = { ...cur, status: 'IMPAYE', pastDueSince: a.pastDueSince, trialEndsAt: null };
    else if (a.kind === 'SUSPEND') cur = { ...cur, status: 'SUSPENDU' };
    else cur = { ...cur, renewsAt: a.renewsAt, hasNextPlan: false };
  }
  throw new Error('non convergent');
}

/* ------------------------------- Projection ------------------------------- */

test('un impayé laisse le tenant actif, une suspension le coupe', () => {
  assert.equal(TENANT_STATUS_OF_SUBSCRIPTION.IMPAYE, 'ACTIF');
  assert.equal(TENANT_STATUS_OF_SUBSCRIPTION.SUSPENDU, 'SUSPENDU');
  assert.equal(TENANT_STATUS_OF_SUBSCRIPTION.RESILIE, 'SUSPENDU');
});

test('tout statut d’abonnement se projette sur un statut de tenant connu', () => {
  const statuses: SubscriptionStatus[] = ['ESSAI', 'ACTIF', 'IMPAYE', 'SUSPENDU', 'RESILIE'];
  for (const s of statuses) {
    assert.ok(['ESSAI', 'ACTIF', 'SUSPENDU'].includes(TENANT_STATUS_OF_SUBSCRIPTION[s]), s);
  }
});
