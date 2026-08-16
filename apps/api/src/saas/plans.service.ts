import { Injectable, BadRequestException, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { pool } from '@transpo/db';
import {
  PLAN_BILLING_MODES, TIER_MODES, validateTiers,
  type PlanBillingMode, type TierMode, type PlanTier,
} from '@transpo/domain';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

/** Tarif d'une version, tel qu'envoyé par la console. Montants en centimes (spec §4.6). */
export interface VersionInput {
  billingMode: PlanBillingMode;
  monthlyCentimes?: number;
  includedOrders?: number | null;
  overageCentimes?: number | null;
  baseCentimes?: number;
  tierMode?: TierMode;
  minCentimes?: number;
  tiers?: PlanTier[];
  effectiveFrom?: string; // 'YYYY-MM-DD', défaut aujourd'hui
}

const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = (): string => new Date().toISOString().slice(0, 10);

/** Catalogue de plans versionné (spec §3, §8). Tout est réservé SUPER_ADMIN et tracé. */
@Injectable()
export class PlansService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  /* -------------------------------- Lecture -------------------------------- */

  /** Catalogue complet : plan + version de tarif courante + nb d'abonnés. */
  async catalog(includeArchived = false) {
    const { rows } = await pool.query(
      `SELECT p.code, p.label_fr AS "labelFr", p.label_ar AS "labelAr", p.description,
              p.sort_order AS "sortOrder", (p.archived_at IS NOT NULL) AS archived,
              v.id AS "versionId", v.version, v.billing_mode AS "billingMode",
              v.monthly_centimes AS "monthlyCentimes", v.included_orders AS "includedOrders",
              v.overage_centimes AS "overageCentimes", v.base_centimes AS "baseCentimes",
              v.tier_mode AS "tierMode", v.min_centimes AS "minCentimes",
              -- ::text — sans ça, pg renvoie un Date JS et la sérialisation décale d'un jour.
              v.effective_from::text AS "effectiveFrom",
              (SELECT count(*)::int FROM platform.subscriptions s
                 JOIN platform.plan_versions vv ON vv.id = s.plan_version_id
                WHERE vv.plan_id = p.id AND s.ended_at IS NULL) AS subscribers
         FROM platform.plans p
         LEFT JOIN platform.plan_versions v ON v.plan_id = p.id AND v.effective_to IS NULL
        ${includeArchived ? '' : 'WHERE p.archived_at IS NULL'}
        ORDER BY p.sort_order, p.label_fr`,
    );
    const tiers = await this.tiersByVersion(rows.map((r) => r.versionId).filter(Boolean));
    return rows.map((r) => ({
      code: r.code, labelFr: r.labelFr, labelAr: r.labelAr, description: r.description,
      sortOrder: r.sortOrder, archived: r.archived, subscribers: r.subscribers,
      current: r.versionId ? this.versionRow(r, tiers[r.versionId] ?? []) : null,
    }));
  }

  /** Historique des tarifs d'un plan, du plus récent au plus ancien. */
  async versions(code: string) {
    const plan = await this.planOrThrow(code);
    const { rows } = await pool.query(
      `SELECT v.id AS "versionId", v.version, v.billing_mode AS "billingMode",
              v.monthly_centimes AS "monthlyCentimes", v.included_orders AS "includedOrders",
              v.overage_centimes AS "overageCentimes", v.base_centimes AS "baseCentimes",
              v.tier_mode AS "tierMode", v.min_centimes AS "minCentimes",
              v.effective_from::text AS "effectiveFrom", v.effective_to::text AS "effectiveTo",
              (SELECT count(*)::int FROM platform.subscriptions s
                WHERE s.plan_version_id = v.id AND s.ended_at IS NULL) AS subscribers
         FROM platform.plan_versions v
        WHERE v.plan_id = $1 ORDER BY v.version DESC`,
      [plan.id],
    );
    const tiers = await this.tiersByVersion(rows.map((r) => r.versionId));
    return rows.map((r) => ({
      ...this.versionRow(r, tiers[r.versionId] ?? []),
      effectiveTo: r.effectiveTo ?? null,
      subscribers: r.subscribers,
    }));
  }

  /* -------------------------------- Écriture ------------------------------- */

  async createPlan(actor: JwtUser, input: { code?: string; labelFr?: string; labelAr?: string; description?: string; sortOrder?: number }) {
    const code = (input.code ?? '').trim().toLowerCase();
    if (!CODE_RE.test(code)) {
      throw new BadRequestException('Code invalide : minuscules, chiffres et tirets (ex. « pay-as-you-go »).');
    }
    if (!input.labelFr?.trim()) throw new BadRequestException('Libellé français requis.');
    if (!input.labelAr?.trim()) throw new BadRequestException('Libellé arabe requis.');

    const dup = await pool.query('SELECT 1 FROM platform.plans WHERE code = $1', [code]);
    if (dup.rowCount) throw new ConflictException(`Plan déjà existant : ${code}`);

    const { rows } = await pool.query(
      `INSERT INTO platform.plans (code, label_fr, label_ar, description, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING code`,
      [code, input.labelFr.trim(), input.labelAr.trim(), input.description?.trim() || null, input.sortOrder ?? 0],
    );
    await this.audit.record(actor, 'plan.create', { target: code });
    return rows[0];
  }

  /** Identité commerciale seulement — le tarif passe par une nouvelle version. */
  async updatePlan(actor: JwtUser, code: string, patch: { labelFr?: string; labelAr?: string; description?: string; sortOrder?: number }) {
    await this.planOrThrow(code);
    const sets: string[] = [];
    const params: unknown[] = [code];
    const push = (col: string, val: unknown) => { params.push(val); sets.push(`${col} = $${params.length}`); };
    if (patch.labelFr !== undefined) {
      if (!patch.labelFr.trim()) throw new BadRequestException('Libellé français requis.');
      push('label_fr', patch.labelFr.trim());
    }
    if (patch.labelAr !== undefined) {
      if (!patch.labelAr.trim()) throw new BadRequestException('Libellé arabe requis.');
      push('label_ar', patch.labelAr.trim());
    }
    if (patch.description !== undefined) push('description', patch.description.trim() || null);
    if (patch.sortOrder !== undefined) push('sort_order', patch.sortOrder);
    if (!sets.length) throw new BadRequestException('Aucune modification.');

    const { rows } = await pool.query(
      `UPDATE platform.plans SET ${sets.join(', ')} WHERE code = $1 RETURNING code`, params,
    );
    await this.audit.record(actor, 'plan.update', { target: code, detail: patch });
    return rows[0];
  }

  /** Archiver : le plan sort du catalogue souscriptible, ses abonnés restent en place. */
  async archivePlan(actor: JwtUser, code: string, force = false) {
    const plan = await this.planOrThrow(code);
    const { rows: [{ n }] } = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM platform.subscriptions s
         JOIN platform.plan_versions v ON v.id = s.plan_version_id
        WHERE v.plan_id = $1 AND s.ended_at IS NULL`,
      [plan.id],
    );
    if (n > 0 && !force) {
      throw new ConflictException(`${n} organisation(s) sont abonnées à ce plan. Archivage refusé.`);
    }
    await pool.query('UPDATE platform.plans SET archived_at = now() WHERE code = $1', [code]);
    await this.audit.record(actor, 'plan.archive', { target: code, detail: { subscribers: n, force } });
    return { code, archived: true, subscribers: n };
  }

  async restorePlan(actor: JwtUser, code: string) {
    await this.planOrThrow(code);
    await pool.query('UPDATE platform.plans SET archived_at = NULL WHERE code = $1', [code]);
    await this.audit.record(actor, 'plan.restore', { target: code });
    return { code, archived: false };
  }

  /**
   * Nouvelle version de tarif. La version courante est close la veille de la date d'effet.
   * Les abonnements existants pointent l'ancienne version : leur prix ne bouge pas (spec §2).
   */
  async createVersion(actor: JwtUser, code: string, input: VersionInput) {
    const plan = await this.planOrThrow(code);
    const from = input.effectiveFrom ?? today();
    if (!DATE_RE.test(from)) throw new BadRequestException('Date d’effet invalide (attendu AAAA-MM-JJ).');
    const pricing = this.normalize(input);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [current] } = await client.query<{ id: string; version: number; from: string }>(
        `SELECT id, version, effective_from::text AS from FROM platform.plan_versions
          WHERE plan_id = $1 AND effective_to IS NULL FOR UPDATE`,
        [plan.id],
      );
      if (current && from <= current.from) {
        throw new BadRequestException(
          `La date d’effet doit être postérieure au ${current.from} (version ${current.version}).`,
        );
      }
      // Garde-fou : on ne retarife jamais une période déjà facturée (spec §8).
      const billed = await client.query(
        `SELECT 1 FROM platform.platform_invoices i
           JOIN platform.subscriptions s ON s.id = i.subscription_id
           JOIN platform.plan_versions v ON v.id = s.plan_version_id
          WHERE v.plan_id = $1 AND i.status <> 'ANNULEE' AND i.period >= $2 LIMIT 1`,
        [plan.id, from.slice(0, 7)],
      );
      if (billed.rowCount) throw new BadRequestException('Période déjà facturée : choisissez une date d’effet ultérieure.');

      const { rows: [{ next }] } = await client.query<{ next: number }>(
        'SELECT COALESCE(max(version), 0) + 1 AS next FROM platform.plan_versions WHERE plan_id = $1',
        [plan.id],
      );

      // Fermer AVANT d'insérer : l'index partiel n'autorise qu'une version ouverte.
      if (current) {
        await client.query(
          `UPDATE platform.plan_versions SET effective_to = ($2::date - 1) WHERE id = $1`,
          [current.id, from],
        );
      }

      const { rows: [v] } = await client.query<{ id: string }>(
        `INSERT INTO platform.plan_versions
           (plan_id, version, billing_mode, monthly_centimes, included_orders, overage_centimes,
            base_centimes, tier_mode, min_centimes, effective_from)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          plan.id, next, pricing.billingMode, pricing.monthlyCentimes, pricing.includedOrders,
          pricing.overageCentimes, pricing.baseCentimes, pricing.tierMode, pricing.minCentimes, from,
        ],
      );
      for (const t of pricing.tiers) {
        await client.query(
          `INSERT INTO platform.plan_tiers (plan_version_id, from_qty, to_qty, unit_centimes)
           VALUES ($1,$2,$3,$4)`,
          [v.id, t.fromQty, t.toQty, t.unitCentimes],
        );
      }

      await client.query('COMMIT');
      await this.audit.record(actor, 'plan.version', {
        target: code, detail: { version: next, billingMode: pricing.billingMode, effectiveFrom: from },
      });
      return { code, version: next, effectiveFrom: from };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /* -------------------------------- Interne -------------------------------- */

  private async planOrThrow(code: string) {
    const { rows } = await pool.query<{ id: string; code: string }>(
      'SELECT id, code FROM platform.plans WHERE code = $1', [code],
    );
    if (!rows.length) throw new NotFoundException(`Plan inconnu : ${code}`);
    return rows[0];
  }

  private async tiersByVersion(ids: string[]): Promise<Record<string, PlanTier[]>> {
    if (!ids.length) return {};
    const { rows } = await pool.query(
      `SELECT plan_version_id AS vid, from_qty AS "fromQty", to_qty AS "toQty", unit_centimes AS "unitCentimes"
         FROM platform.plan_tiers WHERE plan_version_id = ANY($1::uuid[]) ORDER BY from_qty`,
      [ids],
    );
    const out: Record<string, PlanTier[]> = {};
    for (const r of rows) {
      (out[r.vid] ??= []).push({ fromQty: r.fromQty, toQty: r.toQty, unitCentimes: r.unitCentimes });
    }
    return out;
  }

  private versionRow(r: any, tiers: PlanTier[]) {
    return {
      id: r.versionId, version: r.version, billingMode: r.billingMode,
      monthlyCentimes: r.monthlyCentimes, includedOrders: r.includedOrders,
      overageCentimes: r.overageCentimes, baseCentimes: r.baseCentimes,
      tierMode: r.tierMode, minCentimes: r.minCentimes,
      effectiveFrom: r.effectiveFrom,
      tiers,
    };
  }

  /** Valide et complète l'entrée tarifaire selon le mode. */
  private normalize(i: VersionInput) {
    if (!PLAN_BILLING_MODES.includes(i.billingMode)) {
      throw new BadRequestException(`Mode de facturation inconnu : ${i.billingMode}`);
    }
    const int = (v: unknown, label: string, def = 0): number => {
      const n = v === undefined || v === null ? def : Number(v);
      if (!Number.isInteger(n) || n < 0) throw new BadRequestException(`${label} : entier positif attendu (en centimes).`);
      return n;
    };

    if (i.billingMode === 'FORFAIT') {
      const includedOrders = i.includedOrders == null ? null : int(i.includedOrders, 'Quota de commandes');
      const overageCentimes = i.overageCentimes == null ? null : int(i.overageCentimes, 'Prix du dépassement');
      if (includedOrders == null && overageCentimes != null) {
        throw new BadRequestException('Un prix de dépassement exige un quota de commandes.');
      }
      return {
        billingMode: 'FORFAIT' as const,
        monthlyCentimes: int(i.monthlyCentimes, 'Montant mensuel'),
        includedOrders, overageCentimes,
        baseCentimes: 0, tierMode: 'VOLUME' as const, minCentimes: 0, tiers: [] as PlanTier[],
      };
    }

    const tierMode = i.tierMode ?? 'VOLUME';
    if (!TIER_MODES.includes(tierMode)) throw new BadRequestException(`Mode de palier inconnu : ${tierMode}`);
    const tiers = (i.tiers ?? []).map((t) => ({
      fromQty: Number(t.fromQty),
      toQty: t.toQty == null ? null : Number(t.toQty),
      unitCentimes: int(t.unitCentimes, 'Prix unitaire du palier'),
    }));
    const err = validateTiers(tiers);
    if (err) throw new BadRequestException(err);

    return {
      billingMode: 'USAGE' as const,
      monthlyCentimes: 0, includedOrders: null, overageCentimes: null,
      baseCentimes: int(i.baseCentimes, 'Part fixe'),
      tierMode, minCentimes: int(i.minCentimes, 'Facture plancher'), tiers,
    };
  }
}
