// Moteur de prix d'une course : trois modes par marchand (cf. docs/adr/0003).
// Lancement : pnpm --filter @transpo/domain test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quote, validateMerchantPricing, effectiveCommissionRate, courseDistanceKm,
  cityDistanceKm, roadDistanceKm, PRICE_TIERS, type PriceTier,
} from './index.ts';

/* ---------------- Mode standard ---------------- */

test('standard : grille de distance, TVA 20 %', () => {
  const q = quote({ distanceKm: 9, merchant: { mode: 'standard' } });
  assert.equal(q.mode, 'standard');
  assert.equal(q.applied, 'grille');
  assert.equal(q.base, 48);        // palier 7–15 km
  assert.equal(q.gridBase, 48);
  assert.equal(q.ht, 48);
  assert.equal(q.tva, 9.6);
  assert.equal(q.ttc, 57.6);
  assert.equal(q.discountRate, null);
});

test('standard : palier au km au-delà de 30 km', () => {
  const q = quote({ distanceKm: 40, merchant: { mode: 'standard' } });
  assert.equal(q.base, Math.round(3.2 * 40)); // 128
});

test('standard + fragile + programmé : suppléments ajoutés avant TVA', () => {
  const q = quote({ distanceKm: 2, fragile: true, scheduled: true, merchant: { mode: 'standard' } });
  assert.equal(q.base, 22);
  assert.equal(q.surcharges, 25);  // 15 + 10
  assert.equal(q.ht, 47);
  assert.equal(q.tva, 9.4);
  assert.equal(q.ttc, 56.4);
});

/* ---------------- Mode remise ---------------- */

test('remise : grille × (1 − remise), la grille avant remise reste visible', () => {
  const q = quote({ distanceKm: 9, merchant: { mode: 'remise', discountRate: 0.1 } });
  assert.equal(q.mode, 'remise');
  assert.equal(q.applied, 'remise');
  assert.equal(q.gridBase, 48);
  assert.equal(q.base, 43.2);
  assert.equal(q.discountRate, 0.1);
  assert.equal(q.ttc, 51.84);
});

test('remise : les suppléments ne sont PAS remisés', () => {
  const q = quote({ distanceKm: 9, fragile: true, merchant: { mode: 'remise', discountRate: 0.25 } });
  assert.equal(q.base, 36);        // 48 × 0,75
  assert.equal(q.surcharges, 15);
  assert.equal(q.ht, 51);
});

/* ---------------- Mode forfait ---------------- */

test('forfait : même prix quelle que soit la distance', () => {
  const m = { mode: 'forfait' as const, flatPrice: 30 };
  const prix = [3, 15, 40, 300].map((d) => quote({ distanceKm: d, merchant: m }).ht);
  assert.deepEqual(prix, [30, 30, 30, 30]);
  assert.equal(quote({ distanceKm: 40, merchant: m }).mode, 'forfait');
  assert.equal(quote({ distanceKm: 40, merchant: m }).applied, 'fixe_marchand');
});

test('forfait : suppléments fragile/programmé AJOUTÉS au forfait, puis TVA', () => {
  const q = quote({ distanceKm: 40, fragile: true, scheduled: true, merchant: { mode: 'forfait', flatPrice: 30 } });
  assert.equal(q.base, 30);
  assert.equal(q.surcharges, 25);
  assert.equal(q.ht, 55);
  assert.equal(q.tva, 11);
  assert.equal(q.ttc, 66);
});

test('forfait : suppléments et TVA configurés par le tenant pris en compte', () => {
  const q = quote({
    distanceKm: 5, fragile: true, merchant: { mode: 'forfait', flatPrice: 25.5 },
    fragileSurcharge: 8, vatRate: 0.1,
  });
  assert.equal(q.ht, 33.5);
  assert.equal(q.tva, 3.35);
  assert.equal(q.ttc, 36.85);
});

/* ---------------- Grille configurée ---------------- */

test('la grille du tenant remplace la grille par défaut dans les trois modes', () => {
  const tiers: PriceTier[] = [{ from: 0, to: 10, base: 20 }, { from: 10, to: null, perKm: 2 }];
  assert.equal(quote({ distanceKm: 5, tiers, merchant: { mode: 'standard' } }).base, 20);
  assert.equal(quote({ distanceKm: 20, tiers, merchant: { mode: 'remise', discountRate: 0.5 } }).base, 20);
  assert.equal(quote({ distanceKm: 20, tiers, merchant: { mode: 'forfait', flatPrice: 12 } }).base, 12);
});

/* ---------------- Compatibilité des appelants historiques ---------------- */

test('compatibilité : sans conditions marchand, cascade ① fixe → ② remise → ③ grille', () => {
  assert.equal(quote({ distanceKm: 9 }).applied, 'grille');
  assert.equal(quote({ distanceKm: 9, discountRate: 0.1 }).base, 43.2);
  const fixe = quote({ distanceKm: 9, merchantFixedPrice: 40, discountRate: 0.1 });
  assert.equal(fixe.applied, 'fixe_marchand');
  assert.equal(fixe.mode, 'forfait');
  assert.equal(fixe.base, 40);
});

test('des conditions marchand rendent les champs historiques inopérants', () => {
  // Un appelant ne peut pas « ajouter » un prix fixe par-dessus les conditions du marchand.
  const q = quote({ distanceKm: 9, merchant: { mode: 'standard' }, merchantFixedPrice: 1, discountRate: 0.9 });
  assert.equal(q.mode, 'standard');
  assert.equal(q.base, 48);
});

test('remise sans taux : retombe sur la grille plutôt que de facturer 0', () => {
  assert.equal(quote({ distanceKm: 9, merchant: { mode: 'remise', discountRate: null } }).base, 48);
});

/* ---------------- Validation des conditions ---------------- */

test('validation : conditions cohérentes acceptées', () => {
  assert.equal(validateMerchantPricing({ mode: 'standard' }), null);
  assert.equal(validateMerchantPricing({ mode: 'remise', discountRate: 0.1 }), null);
  assert.equal(validateMerchantPricing({ mode: 'forfait', flatPrice: 30 }), null);
});

test('validation : remise hors ]0, 1[ refusée', () => {
  for (const r of [0, 1, -0.1, 1.5, null, Number.NaN]) {
    assert.notEqual(validateMerchantPricing({ mode: 'remise', discountRate: r }), null, `remise ${r}`);
  }
});

test('validation : forfait nul, négatif ou absent refusé', () => {
  for (const f of [0, -5, null, undefined]) {
    assert.notEqual(validateMerchantPricing({ mode: 'forfait', flatPrice: f }), null, `forfait ${f}`);
  }
});

test('validation : champ d’un autre mode refusé (pas de forfait « dormant »)', () => {
  assert.notEqual(validateMerchantPricing({ mode: 'standard', flatPrice: 30 }), null);
  assert.notEqual(validateMerchantPricing({ mode: 'remise', discountRate: 0.1, flatPrice: 30 }), null);
  assert.notEqual(validateMerchantPricing({ mode: 'forfait', flatPrice: 30, discountRate: 0.1 }), null);
  assert.notEqual(validateMerchantPricing({ mode: 'gratuit' as never }), null);
});

/* ---------------- Commission & distance ---------------- */

test('commission : taux marchand prioritaire, sinon taux entreprise', () => {
  assert.equal(effectiveCommissionRate(null, 0.15), 0.15);
  assert.equal(effectiveCommissionRate(undefined, 0.15), 0.15);
  assert.equal(effectiveCommissionRate(0.1, 0.15), 0.1);
  assert.equal(effectiveCommissionRate(0, 0.15), 0); // 0 % négocié ≠ « non renseigné »
});

test('distance facturée : deux épingles → distance routière, sinon ville à ville', () => {
  const a = { lat: 33.5883, lng: -7.6324 }, b = { lat: 33.5952, lng: -7.6870 };
  assert.deepEqual(courseDistanceKm({ fromCity: 'Casablanca', toCity: 'Rabat', pickup: a, drop: b }), { km: roadDistanceKm(a, b), source: 'points' });
  assert.deepEqual(courseDistanceKm({ fromCity: 'Casablanca', toCity: 'Rabat', pickup: a }), { km: cityDistanceKm('Casablanca', 'Rabat'), source: 'villes' });
  assert.equal(courseDistanceKm({ fromCity: 'Casablanca', toCity: 'Casablanca' }).km, 6);
});

test('grille par défaut inchangée (non-régression des paliers)', () => {
  assert.equal(PRICE_TIERS.length, 5);
});
