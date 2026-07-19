import { Injectable, ConflictException, Inject } from '@nestjs/common';
import { pool, provisionTenant, type TenantInput } from '@transpo/db';
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
}
