// Affichage du catalogue de plans — design/SPEC-PLANS-ABONNEMENTS.md.
// Les montants arrivent en centimes : la conversion se fait ici, à la frontière UI.
import type { PlanVersionRow, SaasPlanRow } from '@transpo/api-client';

/** 89900 → « 899 DH » · 450 → « 4,50 DH ». Pas de décimales inutiles. */
export function dh(centimes: number): string {
  const v = centimes / 100;
  return `${v.toLocaleString('fr-FR', {
    minimumFractionDigits: centimes % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} DH`;
}

/** Résumé tarifaire en une ligne. Un plan USAGE n'a pas de prix mensuel à afficher. */
export function priceLabel(v: PlanVersionRow | null): string {
  if (!v) return 'Aucun tarif';
  if (v.billingMode === 'FORFAIT') {
    return v.monthlyCentimes === 0 ? 'Gratuit' : `${dh(v.monthlyCentimes)}/mois`;
  }
  if (!v.tiers.length) return 'À l’usage';
  const cheapest = Math.min(...v.tiers.map((t) => t.unitCentimes));
  return `À l’usage — dès ${dh(cheapest)}/cmd`;
}

/** Ce que le plan inclut : quota pour un forfait, nombre de paliers pour l'usage. */
export function quotaLabel(v: PlanVersionRow | null): string {
  if (!v) return '—';
  if (v.billingMode === 'USAGE') {
    return `${v.tiers.length} palier${v.tiers.length > 1 ? 's' : ''} · ${v.tierMode === 'VOLUME' ? 'rétroactif' : 'par tranche'}`;
  }
  return v.includedOrders != null
    ? `${v.includedOrders.toLocaleString('fr-FR')} cmd/mois`
    : 'Commandes illimitées';
}

/**
 * Retrouve le plan d'un tenant. `tenants.plan` porte le LIBELLÉ FR, pas le code —
 * c'est l'existant, et il reste ainsi jusqu'à ce que L2 le fasse dériver de l'abonnement.
 */
export function planOfTenant(plans: SaasPlanRow[], tenantPlan: string): SaasPlanRow | undefined {
  return plans.find((p) => p.labelFr === tenantPlan);
}
