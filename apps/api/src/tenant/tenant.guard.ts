import { CanActivate, ExecutionContext, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { pool } from '../db/pool.js';

/**
 * Résout le tenant du contexte serveur et pose req.tenantSchema.
 * Priorité : claim `tenant` du JWT (req.user) > header `x-tenant-slug` (dev) > sous-domaine.
 * Si le JWT porte un tenant, un header divergent est refusé (anti cross-tenant).
 * À utiliser APRÈS JwtAuthGuard sur les routes authentifiées. Cf. skill transpo-auth-security.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const fromJwt: string | undefined = req.user?.tenant;
    const fromHeader =
      (req.headers['x-tenant-slug'] as string | undefined)?.trim() || subdomainOf(req.headers.host);
    const slug = fromJwt || fromHeader;

    if (!slug) throw new BadRequestException('Tenant manquant (header x-tenant-slug ou sous-domaine).');
    if (fromJwt && fromHeader && fromJwt !== fromHeader) {
      throw new ForbiddenException('Incohérence de tenant.'); // le JWT prime
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
