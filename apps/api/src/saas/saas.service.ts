import { Injectable, ConflictException, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { pool, provisionTenant, schemaFor, type TenantInput } from '@transpo/db';
import { SAAS_PLANS, TENANT_STATUSES, planByCode, type TenantStatus } from '@transpo/domain';
import { AuditService } from '../audit/audit.service.js';
import type { JwtUser } from '../auth/jwt.js';

@Injectable()
export class SaasService {
  // @Inject explicite : requis sous tsx/esbuild (pas de métadonnée de type émise).
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  list() {
    return pool
      .query('SELECT slug, name, city, plan, status, created_at AS "createdAt" FROM platform.tenants ORDER BY created_at DESC')
      .then((r) => r.rows);
  }

  /** Provisionne un tenant (crée le schéma + tables + ligne). Réservé SUPER_ADMIN. Tracé. */
  async provision(actor: JwtUser, input: TenantInput) {
    const exists = await pool.query('SELECT 1 FROM platform.tenants WHERE slug = $1', [input.slug]);
    if (exists.rowCount) throw new ConflictException(`Tenant déjà existant : ${input.slug}`);

    const client = await pool.connect();
    try {
      await provisionTenant(client, input);
    } finally {
      client.release();
    }
    await this.audit.record(actor, 'tenant.provision', { target: input.slug, detail: { plan: input.plan } });
    return { slug: input.slug, provisioned: true };
  }

  /** Catalogue des plans (source unique : domaine). */
  plans() {
    return SAAS_PLANS;
  }

  private async tenantOrThrow(slug: string) {
    const { rows } = await pool.query('SELECT slug, plan, status FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) throw new NotFoundException(`Tenant inconnu : ${slug}`);
    return rows[0];
  }

  /** Change le plan d'abonnement d'un tenant. Réservé SUPER_ADMIN. Tracé. */
  async changePlan(actor: JwtUser, slug: string, plan: string) {
    await this.tenantOrThrow(slug);
    if (!planByCode(plan)) throw new BadRequestException(`Plan inconnu : ${plan}`);
    const { rows } = await pool.query(
      'UPDATE platform.tenants SET plan = $2 WHERE slug = $1 RETURNING slug, plan, status',
      [slug, plan],
    );
    await this.audit.record(actor, 'tenant.plan', { target: slug, detail: { plan } });
    return rows[0];
  }

  /** Change le statut (paywall : SUSPENDU bloque le login des utilisateurs du tenant). Tracé. */
  async setStatus(actor: JwtUser, slug: string, status: string) {
    await this.tenantOrThrow(slug);
    if (!TENANT_STATUSES.includes(status as TenantStatus)) {
      throw new BadRequestException(`Statut invalide : ${status}`);
    }
    const { rows } = await pool.query(
      'UPDATE platform.tenants SET status = $2 WHERE slug = $1 RETURNING slug, plan, status',
      [slug, status],
    );
    await this.audit.record(actor, 'tenant.status', { target: slug, detail: { status } });
    return rows[0];
  }

  /** Facturation plateforme : montant mensuel par tenant (plan) + usage (commandes). */
  async billing() {
    const { rows: tenants } = await pool.query(
      'SELECT slug, name, plan, status FROM platform.tenants ORDER BY name',
    );
    const client = await pool.connect();
    try {
      const out = [];
      for (const t of tenants) {
        const p = planByCode(t.plan);
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
