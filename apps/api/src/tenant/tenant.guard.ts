import { CanActivate, ExecutionContext, Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { pool } from '../db/pool.js';
import { RESERVED_SUBDOMAINS } from '@transpo/domain';

/**
 * Résout le tenant du contexte serveur et pose req.tenantSchema.
 *
 * Priorité : claim `tenant` du JWT (req.user) > header `x-tenant-slug` > sous-domaine.
 * Un HEADER divergent du JWT est refusé : c'est une tentative inter-tenant délibérée.
 * Le SOUS-DOMAINE, lui, ne sert que de repli quand rien d'autre ne désigne le tenant — il
 * décrit l'infrastructure, pas l'intention de l'appelant.
 *
 * Cette distinction n'existait pas, et elle coûtait cher : l'API servie sur
 * `transpo-api.wedowonders.com` se voyait déduire le tenant « transpo-api », qui divergeait
 * du JWT — donc 403 « Incohérence de tenant » sur CHAQUE appel authentifié de l'application
 * livreur. La réserve prévue pour `api.…` ne couvrait pas ce nom d'hôte.
 *
 * À utiliser APRÈS JwtAuthGuard sur les routes authentifiées. Cf. skill transpo-auth-security.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const fromJwt: string | undefined = req.user?.tenant;
    const fromHeader = (req.headers['x-tenant-slug'] as string | undefined)?.trim() || null;
    const fromHost = subdomainOf(req.headers.host);
    const slug = fromJwt || fromHeader || fromHost;

    if (!slug) throw new BadRequestException('Tenant manquant (header x-tenant-slug ou sous-domaine).');
    if (fromJwt && fromHeader && fromJwt !== fromHeader) {
      throw new ForbiddenException('Incohérence de tenant.'); // le JWT prime
    }
    const { rows } = await pool.query('SELECT slug, status FROM platform.tenants WHERE slug = $1', [slug]);
    if (!rows.length) throw new BadRequestException(`Tenant inconnu : ${slug}`);
    // Paywall (AN-10) : la suspension coupe les sessions déjà ouvertes — le JWT vit 12 h,
    // ne vérifier qu'au login laisserait l'accès en lecture/écriture pendant tout ce délai.
    // Le realm plateforme (/v1/saas, /v1/audit) ne passe PAS par ce garde : il doit rester
    // utilisable pour réactiver les tenants, même si tous sont suspendus.
    if (rows[0].status === 'SUSPENDU') {
      throw new ForbiddenException('Espace suspendu — contactez la plateforme.');
    }
    req.tenantSlug = slug;
    req.tenantSchema = `tenant_${slug}`;
    return true;
  }
}

function subdomainOf(host?: string): string | null {
  if (!host) return null;
  const parts = host.split(':')[0].split('.');
  if (parts.length <= 2) return null;
  const first = parts[0]!.toLowerCase(); // casaexpress.transpo.ma -> casaexpress
  // `api.…` sert l'API publique (mobile) : ce n'est pas un tenant, et le prendre
  // pour tel ferait échouer tout appel authentifié en « incohérence de tenant ».
  return RESERVED_SUBDOMAINS.includes(first) ? null : first;
}
