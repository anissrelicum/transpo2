import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { pool } from '../db/pool.js';

/**
 * Résout le tenant à partir du serveur (header `x-tenant-slug` en dev, ou sous-domaine),
 * JAMAIS d'un champ client arbitraire. Valide contre platform.tenants, puis expose
 * `req.tenantSchema` (= tenant_<slug>) au reste de la requête. Cf. skill transpo-auth-security.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  async use(req: any, _res: any, next: (err?: unknown) => void) {
    try {
      const slug =
        (req.headers['x-tenant-slug'] as string | undefined)?.trim() ||
        subdomainOf(req.headers.host);
      if (!slug) {
        throw new BadRequestException('Tenant manquant (header x-tenant-slug ou sous-domaine).');
      }
      const { rows } = await pool.query('SELECT slug FROM platform.tenants WHERE slug = $1', [slug]);
      if (!rows.length) throw new BadRequestException(`Tenant inconnu : ${slug}`);
      req.tenantSlug = slug;
      req.tenantSchema = `tenant_${slug}`;
      next();
    } catch (e) {
      next(e);
    }
  }
}

function subdomainOf(host?: string): string | null {
  if (!host) return null;
  const parts = host.split(':')[0].split('.');
  return parts.length > 2 ? parts[0] : null; // casaexpress.transpo.ma -> casaexpress
}
