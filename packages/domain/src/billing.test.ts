// Moteur de facturation plateforme — spec §6.2/6.3, §4.3.
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeBilling, validateTiers, applyVat, dhToCentimes,
  type PlanPricing, type PlanTier,
} from './index.ts';

/** Grille de référence de la spec : 1–100 → 6 DH, 101–500 → 4,50 DH, 501+ → 3 DH. */
const GRILLE: PlanTier[] = [
  { fromQty: 1,   toQty: 100,  unitCentimes: 600 },
  { fromQty: 101, toQty: 500,  unitCentimes: 450 },
  { fromQty: 501, toQty: null, unitCentimes: 300 },
];

const usage = (over: Partial<PlanPricing> = {}): PlanPricing => ({
  billingMode: 'USAGE', monthlyCentimes: 0, includedOrders: null, overageCentimes: null,
  baseCentimes: 0, tierMode: 'VOLUME', minCentimes: 0, tiers: GRILLE, ...over,
});

const forfait = (over: Partial<PlanPricing> = {}): PlanPricing => ({
  billingMode: 'FORFAIT', monthlyCentimes: dhToCentimes(899), includedOrders: 5000,
  overageCentimes: 150, baseCentimes: 0, tierMode: 'VOLUME', minCentimes: 0, tiers: [], ...over,
});

/* ---------------- Mode USAGE : l'écart VOLUME / GRADUE ---------------- */

test('VOLUME : le palier atteint tarife tout le volume — 600 cmd = 1 800 DH', () => {
  const { subtotalCentimes } = computeBilling(usage(), 600, 'Pay as you go');
  assert.equal(subtotalCentimes, dhToCentimes(1800));
});

test('GRADUE : chaque tranche à son prix — 600 cmd = 2 700 DH', () => {
  const { lines, subtotalCentimes } = computeBilling(usage({ tierMode: 'GRADUE' }), 600, 'Pay as you go');
  assert.equal(subtotalCentimes, dhToCentimes(2700));
  // 100 × 6 + 400 × 4,50 + 100 × 3 — une ligne par tranche entamée.
  assert.deepEqual(lines.map((l) => l.qty), [100, 400, 100]);
});

test('les deux modes coïncident tant qu’on reste dans le premier palier', () => {
  const v = computeBilling(usage(), 80, 'P').subtotalCentimes;
  const g = computeBilling(usage({ tierMode: 'GRADUE' }), 80, 'P').subtotalCentimes;
  assert.equal(v, dhToCentimes(480));
  assert.equal(g, v);
});

test('VOLUME : bornes de palier — 100 puis 101 commandes', () => {
  assert.equal(computeBilling(usage(), 100, 'P').subtotalCentimes, 100 * 600);
  assert.equal(computeBilling(usage(), 101, 'P').subtotalCentimes, 101 * 450);
});

test('VOLUME : franchir un palier fait BAISSER la facture (dégressif assumé)', () => {
  const a = computeBilling(usage(), 500, 'P').subtotalCentimes; // 500 × 4,50 = 2 250 DH
  const b = computeBilling(usage(), 501, 'P').subtotalCentimes; // 501 × 3,00 = 1 503 DH
  assert.ok(b < a, 'le palier supérieur doit être moins cher au total');
});

test('GRADUE : la facture est monotone croissante', () => {
  const p = usage({ tierMode: 'GRADUE' });
  let prev = -1;
  for (const q of [0, 1, 99, 100, 101, 499, 500, 501, 1000]) {
    const t = computeBilling(p, q, 'P').subtotalCentimes;
    assert.ok(t >= prev, `${q} commandes : total en recul`);
    prev = t;
  }
});

test('aucune commande : rien à facturer', () => {
  assert.equal(computeBilling(usage(), 0, 'P').subtotalCentimes, 0);
  assert.equal(computeBilling(usage({ tierMode: 'GRADUE' }), 0, 'P').subtotalCentimes, 0);
});

test('facture plancher appliquée avant la part fixe', () => {
  const p = usage({ minCentimes: dhToCentimes(200), baseCentimes: dhToCentimes(50) });
  // 10 cmd = 60 DH < plancher 200 DH → 200, puis + 50 de part fixe.
  const { subtotalCentimes } = computeBilling(p, 10, 'P');
  assert.equal(subtotalCentimes, dhToCentimes(250));
});

test('le plancher ne s’applique plus dès que l’usage le dépasse', () => {
  const p = usage({ minCentimes: dhToCentimes(200) });
  assert.equal(computeBilling(p, 100, 'P').subtotalCentimes, dhToCentimes(600));
});

/* ---------------- Mode FORFAIT ---------------- */

test('FORFAIT sous le quota : seul l’abonnement est facturé', () => {
  const { lines, subtotalCentimes } = computeBilling(forfait(), 4200, 'Transporteur');
  assert.equal(lines.length, 1);
  assert.equal(subtotalCentimes, dhToCentimes(899));
});

test('FORFAIT au-dessus du quota : dépassement facturé à part', () => {
  const { lines, subtotalCentimes } = computeBilling(forfait(), 5240, 'Transporteur');
  assert.equal(lines.length, 2);
  assert.equal(lines[1].qty, 240);
  assert.equal(subtotalCentimes, dhToCentimes(899) + 240 * 150);
});

test('FORFAIT sans prix de dépassement : quota indicatif, jamais facturé', () => {
  const { lines, subtotalCentimes } = computeBilling(forfait({ overageCentimes: null }), 99999, 'T');
  assert.equal(lines.length, 1);
  assert.equal(subtotalCentimes, dhToCentimes(899));
});

test('FORFAIT sans quota : illimité', () => {
  const p = forfait({ includedOrders: null });
  assert.equal(computeBilling(p, 99999, 'T').subtotalCentimes, dhToCentimes(899));
});

/* ---------------- Invariants de grille (spec §4.3) ---------------- */

test('grille de référence valide', () => {
  assert.equal(validateTiers(GRILLE), null);
});

test('grille vide refusée', () => {
  assert.match(validateTiers([]) ?? '', /au moins un palier/i);
});

test('premier palier ne commençant pas à 1 refusé', () => {
  const t: PlanTier[] = [{ fromQty: 10, toQty: null, unitCentimes: 500 }];
  assert.match(validateTiers(t) ?? '', /commencer à 1/i);
});

test('paliers non contigus refusés, avec la borne attendue', () => {
  const t: PlanTier[] = [
    { fromQty: 1, toQty: 100, unitCentimes: 600 },
    { fromQty: 150, toQty: null, unitCentimes: 300 },
  ];
  assert.match(validateTiers(t) ?? '', /non contigus.*101/i);
});

test('paliers qui se recouvrent refusés', () => {
  const t: PlanTier[] = [
    { fromQty: 1, toQty: 200, unitCentimes: 600 },
    { fromQty: 101, toQty: null, unitCentimes: 300 },
  ];
  assert.notEqual(validateTiers(t), null);
});

test('dernier palier borné refusé (la grille doit couvrir l’infini)', () => {
  const t: PlanTier[] = [{ fromQty: 1, toQty: 100, unitCentimes: 600 }];
  assert.match(validateTiers(t) ?? '', /ouvert/i);
});

test('palier ouvert ailleurs qu’en dernier refusé', () => {
  const t: PlanTier[] = [
    { fromQty: 1, toQty: null, unitCentimes: 600 },
    { fromQty: 101, toQty: null, unitCentimes: 300 },
  ];
  assert.notEqual(validateTiers(t), null);
});

test('grille désordonnée acceptée : la validation trie avant de vérifier', () => {
  assert.equal(validateTiers([GRILLE[2], GRILLE[0], GRILLE[1]]), null);
});

test('prix unitaire négatif refusé', () => {
  const t: PlanTier[] = [{ fromQty: 1, toQty: null, unitCentimes: -1 }];
  assert.notEqual(validateTiers(t), null);
});

/* ---------------- TVA ---------------- */

test('TVA appliquée sur le sous-total', () => {
  const { vatCentimes, totalCentimes } = applyVat(dhToCentimes(1800), 20);
  assert.equal(vatCentimes, dhToCentimes(360));
  assert.equal(totalCentimes, dhToCentimes(2160));
});

test('TVA arrondie au centime, pas tronquée', () => {
  assert.equal(applyVat(333, 20).vatCentimes, 67); // 66,6 → 67
});
