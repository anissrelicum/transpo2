import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { pool } from '../db/pool.js';

/**
 * Résout le tenant côté serveur (header `x-tenant-slug` en dev, ou sous-domaine), JAMAIS d'un
 * champ client arbitraire. Valide contre platform.tenants et expose `req.tenantSchema`.
 * Un Guard (et non un middleware) : ainsi les exceptions passent par le filtre Nest → vrai 400.
 * Cf. skill transpo-auth-security.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
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
    return true;
  }
}

function subdomainOf(host?: string): string | null {
  if (!host) return null;
  const parts = host.split(':')[0].split('.');
  return parts.length > 2 ? parts[0] : null; // casaexpress.transpo.ma -> casaexpress
}
