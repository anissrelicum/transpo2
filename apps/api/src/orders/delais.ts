// Délais de livraison côté serveur (ADR 0006) : ce qui change sur la commande à chaque étape.
// Les règles elles-mêmes vivent dans @transpo/domain ; ici, seulement leur application.
import { BadRequestException } from '@nestjs/common';
import {
  validateDelayPolicy, normalizeDelayPolicy, dueAtAfterPickup, lateMinutes, latePenalty,
  type DelayPolicy, type DelayMode,
} from '@transpo/domain';

/** Fuseau de l'entreprise (heures limites « avant midi »). */
export async function fuseauEntreprise(client: { query: (sql: string) => Promise<{ rows: any[] }> }): Promise<string> {
  const { rows } = await client.query(`SELECT timezone FROM company_settings WHERE id = 'default'`).catch(() => ({ rows: [] as any[] }));
  return rows[0]?.timezone ?? 'Africa/Casablanca';
}

/** Délai demandé pour UNE commande (prioritaire sur celui du marchand), validé ; `null` si absent. */
export function delaiDemande(v: unknown): DelayPolicy | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object') throw new BadRequestException('Délai de livraison invalide.');
  const p = normalizeDelayPolicy(v as DelayPolicy);
  const err = validateDelayPolicy(p);
  if (err) throw new BadRequestException(err);
  return p;
}

/** Règle figée sur une commande (colonnes `delay_*`). */
export function regleDe(o: { delayMode: string; delayMinutes: number | null; delayHeure: string | null; retraitMinutes: number | null }): DelayPolicy {
  return { mode: o.delayMode as DelayMode, minutes: o.delayMinutes, heure: o.delayHeure, retraitMinutes: o.retraitMinutes };
}

/**
 * Colonnes à poser quand la commande change de statut. Au retrait (RECUPEREE) : l'heure de
 * prise en charge et, pour un délai « après retrait », l'échéance de livraison.
 */
export function surTransition(cur: Parameters<typeof regleDe>[0] & { dueAt: Date | null }, next: string, now = new Date()) {
  if (next !== 'RECUPEREE') return {};
  return { pickedAt: now, dueAt: dueAtAfterPickup(regleDe(cur), now) ?? cur.dueAt };
}

/** Colonnes à poser à la livraison : heure, minutes de retard, pénalité (DH HT) due au marchand. */
export function surLivraison(cur: { dueAt: Date | null; priceHt: number | null }, penaliteRetard: number, now = new Date()) {
  const retard = lateMinutes(cur.dueAt, now);
  return { deliveredAt: now, lateMinutes: cur.dueAt ? retard : null, latePenalty: latePenalty(cur.priceHt, penaliteRetard, retard) || null };
}
