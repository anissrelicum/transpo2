import { Injectable, ConflictException, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { pool, provisionTenant, schemaFor, hashPassword, type TenantInput } from '@transpo/db';
import { RESERVED_SUBDOMAINS, planByCode } from '@transpo/domain';
import { AuditService } from '../audit/audit.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import type { JwtUser } from '../auth/jwt.js';

@Injectable()
export class SaasService {
  // @Inject explicite : requis sous tsx/esbuild (pas de métadonnée de type émise).
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(SubscriptionsService) private readonly subs: SubscriptionsService,
  ) {}

  /** Tenants + abonnement courant : la console affiche l'un sans l'autre nulle part. */
  list() {
    return pool
      .query(
        `SELECT t.slug, t.name, t.city, t.plan, t.status, t.created_at AS "createdAt",
                s.status AS "subStatus", s.trial_ends_at::text AS "trialEndsAt",
                s.renews_at::text AS "renewsAt", s.past_due_since::text AS "pastDueSince",
                s.status_reason AS "statusReason",
                p.code AS "planCode", np.code AS "nextPlanCode", np.label_fr AS "nextPlanLabel"
           FROM platform.tenants t
           LEFT JOIN platform.subscriptions s ON s.tenant_id = t.id AND s.ended_at IS NULL
           LEFT JOIN platform.plan_versions v ON v.id = s.plan_version_id
           LEFT JOIN platform.plans p ON p.id = v.plan_id
           LEFT JOIN platform.plan_versions nv ON nv.id = s.next_plan_version_id
           LEFT JOIN platform.plans np ON np.id = nv.plan_id
          ORDER BY t.created_at DESC`,
      )
      .then((r) => r.rows);
  }

  /**
   * Provisionne un tenant : schéma + tables + ligne plateforme, puis **abonnement d'essai**.
   * Tout tenant naît en essai daté (spec §5.1) — le plan choisi n'est pas le statut, c'est
   * l'offre vers laquelle l'essai convertira.
   * Si un compte admin est fourni (adminEmail + adminName), il est créé dans la même
   * transaction, avec un mot de passe temporaire retourné une seule fois (AN-01).
   */
  async provision(actor: JwtUser, input: TenantInput & { planCode?: string; adminEmail?: string; adminName?: string }) {
    if (RESERVED_SUBDOMAINS.includes(input.slug)) {
      throw new BadRequestException(`Slug réservé à l’infrastructure : ${input.slug}`);
    }
    const exists = await pool.query('SELECT 1 FROM platform.tenants WHERE slug = $1', [input.slug]);
    if (exists.rowCount) throw new ConflictException(`Tenant déjà existant : ${input.slug}`);

    const adminEmail = input.adminEmail?.trim().toLowerCase() || null;
    const adminName = input.adminName?.trim() || null;
    if ((adminEmail || adminName) && !(adminEmail && adminName)) {
      throw new BadRequestException('adminEmail et adminName vont de pair.');
    }
    if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      throw new BadRequestException('Email admin invalide.');
    }
    const tempPassword = adminEmail ? randomBytes(9).toString('base64url') : null;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await provisionTenant(client, input);
      const { rows } = await client.query<{ id: string }>(
        'SELECT id FROM platform.tenants WHERE slug = $1', [input.slug],
      );
      // Sans plan explicite, l'essai porte sur le plan d'essai du catalogue.
      await this.subs.startTrial(client, rows[0].id, input.planCode ?? 'essai');
      if (adminEmail && adminName && tempPassword) {
        const hash = await hashPassword(tempPassword);
        await client.query(
          `INSERT INTO "${schemaFor(input.slug)}".users (email, password_hash, name, role)
           VALUES ($1, $2, $3, 'ADMIN')`,
          [adminEmail, hash, adminName],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    await this.audit.record(actor, 'tenant.provision', {
      target: input.slug,
      detail: { plan: input.plan, admin: adminEmail },
    });
    return {
      slug: input.slug,
      provisioned: true,
      admin: adminEmail ? { email: adminEmail, name: adminName, tempPassword } : null,
    };
  }

  /**
   * Crée ou réinitialise l'administrateur d'une organisation DÉJÀ provisionnée.
   *
   * Le provisioning crée l'admin (AN-01), mais une organisation antérieure à ce correctif —
   * ou dont le dernier administrateur a été désactivé en base — n'avait plus aucun moyen de
   * reprendre la main : ni écran, ni endpoint, même pour le super-admin. Il fallait un accès
   * shell à la production (AN-11). Cette action referme ce trou, et elle est tracée.
   *
   * Si l'adresse existe déjà dans l'organisation, le compte est réactivé, repassé ADMIN et
   * son mot de passe régénéré ; sinon un nouvel administrateur est créé. Le mot de passe
   * temporaire n'est renvoyé qu'une fois.
   */
  async resetAdmin(actor: JwtUser, slug: string, input: { email?: string; name?: string }) {
    const email = input?.email?.trim().toLowerCase();
    const name = input?.name?.trim();
    if (!email || !name) throw new BadRequestException('email et name requis.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email admin invalide.');

    const { rows } = await pool.query('SELECT slug FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) throw new NotFoundException(`Tenant inconnu : ${slug}`);

    const tempPassword = randomBytes(9).toString('base64url');
    const hash = await hashPassword(tempPassword);
    const schema = schemaFor(slug);
    const client = await pool.connect();
    let cree = false;
    try {
      await client.query('BEGIN');
      const existant = await client.query(
        `SELECT email FROM "${schema}".users WHERE email = $1`, [email],
      );
      if (existant.rowCount) {
        await client.query(
          `UPDATE "${schema}".users
              SET password_hash = $2, name = $3, role = 'ADMIN', active = true
            WHERE email = $1`,
          [email, hash, name],
        );
      } else {
        cree = true;
        await client.query(
          `INSERT INTO "${schema}".users (email, password_hash, name, role)
           VALUES ($1, $2, $3, 'ADMIN')`,
          [email, hash, name],
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    await this.audit.record(actor, cree ? 'tenant.admin.create' : 'tenant.admin.reset', {
      target: slug,
      detail: { admin: email },
    });
    return { slug, created: cree, admin: { email, name, tempPassword } };
  }

  /** Facturation plateforme : montant mensuel par tenant (plan) + usage (commandes). */
  async billing() {
    const { rows: tenants } = await pool.query(
      'SELECT slug, name, plan, status FROM platform.tenants ORDER BY name',
    );
    // Tarif courant du catalogue, indexé par libellé (= valeur de `tenants.plan`).
    const { rows: catalog } = await pool.query<{ label: string; monthlyDH: number; quota: number | null }>(
      `SELECT p.label_fr AS label, (v.monthly_centimes / 100) AS "monthlyDH", v.included_orders AS quota
         FROM platform.plans p
         -- Tarif EN VIGUEUR aujourd'hui, et non la dernière version publiée : une version
         -- à effet futur ne doit pas être facturée avant sa date (cf. catalogue).
         JOIN platform.plan_versions v ON v.plan_id = p.id
           AND v.effective_from <= current_date
           AND (v.effective_to IS NULL OR v.effective_to >= current_date)`,
    );
    const byLabel = new Map(catalog.map((r) => [r.label, r]));

    const client = await pool.connect();
    try {
      const out = [];
      for (const t of tenants) {
        const fromCatalog = byLabel.get(t.plan);
        const legacy = planByCode(t.plan);
        const p = fromCatalog
          ? { monthlyDH: fromCatalog.monthlyDH, maxOrdersMonth: fromCatalog.quota }
          : legacy && { monthlyDH: legacy.monthlyDH, maxOrdersMonth: legacy.maxOrdersMonth };
        let orders = 0;
        try {
          await client.query(`SET search_path TO "${schemaFor(t.slug)}", platform`);
          const r = await client.query('SELECT count(*)::int AS c FROM orders');
          orders = r.rows[0]?.c ?? 0;
        } catch { /* schéma non provisionné : usage 0 */ }
        const monthlyDH = p?.monthlyDH ?? 0;
        out.push({
          slug: t.slug, name: t.name, plan: t.plan, status: t.status,
          monthlyDH, orders, quota: p?.maxOrdersMonth ?? null,
          overQuota: p?.maxOrdersMonth != null && orders > p.maxOrdersMonth,
        });
      }
      return out;
    } finally {
      client.release();
    }
  }
}
