import { Injectable, BadRequestException, ConflictException, NotFoundException, Inject } from '@nestjs/common';
import { pool } from '@transpo/db';
import type pg from 'pg';
import {
  cycleStep, addDaysIso, periodOf, firstOfNextMonthIso,
  TENANT_STATUS_OF_SUBSCRIPTION, TRIAL_DAYS,
  type CycleSubscription, type SubscriptionStatus,
} from '@transpo/domain';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

const today = (): string => new Date().toISOString().slice(0, 10);
/** Garde-fou de la boucle de convergence : 24 mois de retard suffisent largement. */
const MAX_STEPS = 24;

/**
 * Cycle de vie de l'abonnement (spec §5, §7).
 *
 * Règle structurante : `tenants.status` n'est plus écrit à la main nulle part. Il est la
 * projection de `subscriptions.status`, posée par `project()` — c'est lui que lit le paywall
 * du login, donc toute divergence coupe (ou rouvre) l'accès à tort.
 */
@Injectable()
export class SubscriptionsService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  /* --------------------------------- Lecture --------------------------------- */

  async get(slug: string) {
    const { rows } = await pool.query(
      `SELECT s.id, s.status, s.started_at::text AS "startedAt", s.trial_ends_at::text AS "trialEndsAt",
              s.past_due_since::text AS "pastDueSince", s.current_period AS "currentPeriod",
              s.renews_at::text AS "renewsAt", s.ended_at::text AS "endedAt", s.status_reason AS "statusReason",
              p.code AS "planCode", p.label_fr AS "planLabel", v.version AS "planVersion",
              v.billing_mode AS "billingMode", v.monthly_centimes AS "monthlyCentimes",
              np.code AS "nextPlanCode", np.label_fr AS "nextPlanLabel"
         FROM platform.subscriptions s
         JOIN platform.tenants t ON t.id = s.tenant_id
         JOIN platform.plan_versions v ON v.id = s.plan_version_id
         JOIN platform.plans p ON p.id = v.plan_id
         LEFT JOIN platform.plan_versions nv ON nv.id = s.next_plan_version_id
         LEFT JOIN platform.plans np ON np.id = nv.plan_id
        WHERE t.slug = $1 AND s.ended_at IS NULL`,
      [slug],
    );
    if (!rows.length) return null;
    const s = rows[0];
    return { ...s, trialDaysLeft: this.trialDaysLeft(s.status, s.trialEndsAt) };
  }

  /** Jours d'essai restants, `null` hors essai. Négatif impossible : borné à 0. */
  private trialDaysLeft(status: string, trialEndsAt: string | null): number | null {
    if (status !== 'ESSAI' || !trialEndsAt) return null;
    const ms = Date.parse(`${trialEndsAt}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`);
    return Math.max(0, Math.round(ms / 86400000));
  }

  /* -------------------------------- Écriture --------------------------------- */

  /**
   * Souscrire ou changer de plan. Un changement depuis un abonnement ACTIF prend effet
   * à la prochaine échéance (pas de proration — spec §12) ; `immediate` force l'application
   * tout de suite, ce qui reste une décision de super-admin.
   */
  async subscribe(actor: JwtUser, slug: string, input: { planCode?: string; immediate?: boolean }) {
    if (!input.planCode) throw new BadRequestException('planCode requis.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenant = await this.tenantOrThrow(client, slug);
      const version = await this.currentVersionOrThrow(client, input.planCode);
      const current = await this.currentSubscription(client, tenant.id);
      const day = today();
      let outcome: string;

      if (!current) {
        await client.query(
          `INSERT INTO platform.subscriptions
             (tenant_id, plan_version_id, status, started_at, current_period, renews_at)
           VALUES ($1,$2,'ACTIF',$3,$4,$5)`,
          [tenant.id, version.id, day, periodOf(day), firstOfNextMonthIso(day)],
        );
        outcome = 'souscription';
      } else if (current.status === 'ACTIF' && !input.immediate) {
        if (current.plan_version_id === version.id) {
          throw new ConflictException('Ce plan est déjà celui de l’abonnement courant.');
        }
        await client.query(
          'UPDATE platform.subscriptions SET next_plan_version_id = $2 WHERE id = $1',
          [current.id, version.id],
        );
        outcome = `changement programmé au ${current.renews_at}`;
      } else {
        // ESSAI converti, IMPAYE/SUSPENDU régularisé, ou changement immédiat forcé :
        // l'abonnement repart propre sur la période en cours.
        await client.query(
          `UPDATE platform.subscriptions
              SET plan_version_id = $2, next_plan_version_id = NULL, status = 'ACTIF',
                  trial_ends_at = NULL, past_due_since = NULL, status_reason = NULL,
                  current_period = $3, renews_at = $4
            WHERE id = $1`,
          [current.id, version.id, periodOf(day), firstOfNextMonthIso(day)],
        );
        outcome = current.status === 'ESSAI' ? 'essai converti' : 'abonnement régularisé';
      }

      await this.project(client, tenant.id);
      await client.query('COMMIT');
      await this.audit.record(actor, 'subscription.subscribe', {
        tenant: slug, target: slug, detail: { plan: input.planCode, outcome },
      });
      return { slug, plan: input.planCode, outcome };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  /** Résilie : l'abonnement est clos, le tenant perd l'accès. Un nouveau pourra être souscrit. */
  async cancel(actor: JwtUser, slug: string, reason?: string) {
    return this.transition(actor, slug, 'subscription.cancel', async (client, sub) => {
      await client.query(
        `UPDATE platform.subscriptions
            SET status = 'RESILIE', ended_at = $2, renews_at = NULL,
                next_plan_version_id = NULL, status_reason = $3
          WHERE id = $1`,
        [sub.id, today(), reason ?? null],
      );
      return 'RESILIE';
    }, reason);
  }

  /** Suspension manuelle — l'abonnement reste courant, seul l'accès est coupé. */
  async suspend(actor: JwtUser, slug: string, reason?: string) {
    return this.transition(actor, slug, 'subscription.suspend', async (client, sub) => {
      if (sub.status === 'RESILIE') throw new ConflictException('Abonnement déjà résilié.');
      await client.query(
        `UPDATE platform.subscriptions SET status = 'SUSPENDU', status_reason = $2 WHERE id = $1`,
        [sub.id, reason ?? null],
      );
      return 'SUSPENDU';
    }, reason);
  }

  /** Réactive un abonnement suspendu ou impayé, et repart sur la période courante. */
  async reactivate(actor: JwtUser, slug: string) {
    return this.transition(actor, slug, 'subscription.reactivate', async (client, sub) => {
      if (!['SUSPENDU', 'IMPAYE'].includes(sub.status)) {
        throw new ConflictException(`Rien à réactiver : abonnement ${sub.status}.`);
      }
      const day = today();
      await client.query(
        `UPDATE platform.subscriptions
            SET status = 'ACTIF', past_due_since = NULL, status_reason = NULL,
                trial_ends_at = NULL, current_period = $2, renews_at = $3
          WHERE id = $1`,
        [sub.id, periodOf(day), firstOfNextMonthIso(day)],
      );
      return 'ACTIF';
    });
  }

  /* ---------------------------------- Cycle ---------------------------------- */

  /**
   * Fait avancer le temps (spec §7). Idempotent : les transitions sont conditionnées à des
   * dates, donc deux exécutions le même jour donnent le même état. Rejouable à la main,
   * ce qui permet de tester l'expiration d'un essai sans attendre la fin de l’essai.
   */
  async runCycle(actor: JwtUser | null) {
    const day = today();
    const summary = { trialsExpired: 0, suspended: 0, renewed: 0, projected: 0 };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT s.id, s.tenant_id, s.status, s.trial_ends_at::text AS "trialEndsAt",
                s.past_due_since::text AS "pastDueSince", s.renews_at::text AS "renewsAt",
                s.next_plan_version_id AS "nextPlanVersionId"
           FROM platform.subscriptions s WHERE s.ended_at IS NULL FOR UPDATE`,
      );

      for (const r of rows) {
        let state: CycleSubscription = {
          status: r.status as SubscriptionStatus,
          trialEndsAt: r.trialEndsAt, pastDueSince: r.pastDueSince,
          renewsAt: r.renewsAt, hasNextPlan: !!r.nextPlanVersionId,
        };

        for (let i = 0; i < MAX_STEPS; i++) {
          const action = cycleStep(state, day);
          if (!action) break;

          if (action.kind === 'TRIAL_EXPIRED') {
            await client.query(
              `UPDATE platform.subscriptions
                  SET status = 'IMPAYE', past_due_since = $2, trial_ends_at = NULL,
                      status_reason = 'Essai expiré sans souscription'
                WHERE id = $1`,
              [r.id, action.pastDueSince],
            );
            state = { ...state, status: 'IMPAYE', pastDueSince: action.pastDueSince, trialEndsAt: null };
            summary.trialsExpired++;
          } else if (action.kind === 'SUSPEND') {
            await client.query(
              `UPDATE platform.subscriptions
                  SET status = 'SUSPENDU',
                      status_reason = COALESCE(status_reason, '') || ' — suspendu après délai de grâce'
                WHERE id = $1`,
              [r.id],
            );
            state = { ...state, status: 'SUSPENDU' };
            summary.suspended++;
          } else {
            // Reconduction tacite. L3 accrochera l'émission de la facture ici même.
            await client.query(
              `UPDATE platform.subscriptions
                  SET current_period = $2, renews_at = $3,
                      plan_version_id = COALESCE(next_plan_version_id, plan_version_id),
                      next_plan_version_id = NULL
                WHERE id = $1`,
              [r.id, action.period, action.renewsAt],
            );
            state = { ...state, renewsAt: action.renewsAt, hasNextPlan: false };
            summary.renewed++;
          }
        }

        if (await this.project(client, r.tenant_id)) summary.projected++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (actor) await this.audit.record(actor, 'subscription.cycle', { detail: summary });
    return { day, ...summary };
  }

  /* -------------------------------- Interne ---------------------------------- */

  /** Crée l'essai à la volée d'un provisioning. Appelé dans la transaction du provisioning. */
  async startTrial(client: pg.PoolClient, tenantId: string, planCode: string): Promise<void> {
    const version = await this.currentVersionOrThrow(client, planCode);
    const day = today();
    await client.query(
      `INSERT INTO platform.subscriptions
         (tenant_id, plan_version_id, status, started_at, trial_ends_at, current_period, renews_at)
       VALUES ($1,$2,'ESSAI',$3,$4,$5,$6)`,
      [tenantId, version.id, day, addDaysIso(day, TRIAL_DAYS), periodOf(day), firstOfNextMonthIso(day)],
    );
    await this.project(client, tenantId);
  }

  /**
   * Aligne `tenants.status` (et `tenants.plan`) sur l'abonnement courant.
   * Retourne `true` si quelque chose a bougé.
   */
  private async project(client: pg.PoolClient, tenantId: string): Promise<boolean> {
    const { rows } = await client.query<{ status: SubscriptionStatus; label: string }>(
      `SELECT s.status, p.label_fr AS label
         FROM platform.subscriptions s
         JOIN platform.plan_versions v ON v.id = s.plan_version_id
         JOIN platform.plans p ON p.id = v.plan_id
        WHERE s.tenant_id = $1 AND s.ended_at IS NULL`,
      [tenantId],
    );
    // Sans abonnement courant (résilié), le tenant reste suspendu : pas d'accès sans contrat.
    const target = rows.length ? TENANT_STATUS_OF_SUBSCRIPTION[rows[0].status] : 'SUSPENDU';
    const res = rows.length
      ? await client.query(
          'UPDATE platform.tenants SET status = $2, plan = $3 WHERE id = $1 AND (status <> $2 OR plan <> $3)',
          [tenantId, target, rows[0].label],
        )
      : await client.query(
          'UPDATE platform.tenants SET status = $2 WHERE id = $1 AND status <> $2', [tenantId, target],
        );
    return (res.rowCount ?? 0) > 0;
  }

  private async transition(
    actor: JwtUser, slug: string, action: string,
    apply: (client: pg.PoolClient, sub: any) => Promise<string>,
    reason?: string,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const tenant = await this.tenantOrThrow(client, slug);
      const sub = await this.currentSubscription(client, tenant.id);
      if (!sub) throw new NotFoundException(`Aucun abonnement courant pour ${slug}.`);
      const status = await apply(client, sub);
      await this.project(client, tenant.id);
      await client.query('COMMIT');
      await this.audit.record(actor, action, { tenant: slug, target: slug, detail: { reason, status } });
      return { slug, status };
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  private async tenantOrThrow(client: pg.PoolClient, slug: string) {
    const { rows } = await client.query<{ id: string }>(
      'SELECT id FROM platform.tenants WHERE slug = $1', [slug],
    );
    if (!rows.length) throw new NotFoundException(`Tenant inconnu : ${slug}`);
    return rows[0];
  }

  private async currentSubscription(client: pg.PoolClient, tenantId: string) {
    const { rows } = await client.query(
      `SELECT id, status, plan_version_id, renews_at::text AS renews_at
         FROM platform.subscriptions
        WHERE tenant_id = $1 AND ended_at IS NULL FOR UPDATE`,
      [tenantId],
    );
    return rows[0] ?? null;
  }

  private async currentVersionOrThrow(client: pg.PoolClient, planCode: string) {
    const { rows } = await client.query<{ id: string }>(
      `SELECT v.id FROM platform.plan_versions v
         JOIN platform.plans p ON p.id = v.plan_id
        WHERE p.code = $1 AND p.archived_at IS NULL AND v.effective_to IS NULL`,
      [planCode],
    );
    if (!rows.length) {
      throw new BadRequestException(`Plan indisponible : ${planCode} (inconnu, archivé, ou sans tarif).`);
    }
    return rows[0];
  }
}
