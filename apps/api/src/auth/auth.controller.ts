import { Controller, Post, Body, Req, Inject, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service.js';

/**
 * Adresse d'un réseau privé, d'un lien local ou de la boucle locale — donc jamais celle
 * d'un client sur Internet. Les plages sont celles de la RFC 1918, de la RFC 4193 (IPv6
 * unique-local) et des adresses de boucle, plus le préfixe `::ffff:` des adresses IPv4
 * représentées en IPv6.
 */
function estPrivee(ip: string): boolean {
  const v = ip.replace(/^::ffff:/i, '');
  if (v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
  const o = v.split('.').map(Number);
  if (o.length !== 4 || o.some((n) => !Number.isInteger(n))) return false;
  return o[0] === 10 || o[0] === 127
    || (o[0] === 172 && o[1]! >= 16 && o[1]! <= 31)
    || (o[0] === 192 && o[1] === 168)
    || (o[0] === 169 && o[1] === 254);
}

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /**
   * Adresse du CLIENT, pour le comptage anti-bruteforce par source.
   *
   * On ne retombe PLUS sur l'adresse de socket quand elle est privée. L'API est derrière
   * l'ingress puis le BFF : si la chaîne `x-forwarded-for` ne parvient pas jusqu'ici, la
   * socket porte l'adresse d'un pod du cluster — la même pour TOUT LE MONDE. Le compteur
   * « par source » devenait alors un compteur unique et partagé : trente mauvais mots de
   * passe, venus de n'importe qui, refusaient la connexion à tous les utilisateurs pendant
   * le reste de la fenêtre de quinze minutes. Un déni de service à trente tentatives,
   * constaté sur le homelab le 14/09 (TC-B16) — et subi le matin même sans le reconnaître.
   *
   * Mieux vaut NE PAS compter par source que compter tout le monde ensemble : sans adresse
   * de client identifiable, seul le compteur par compte s'applique. Le comptage par source
   * suppose que l'ingress propage `X-Real-IP` ou `X-Forwarded-For` jusqu'ici.
   */
  private ipDe(req: any): string | undefined {
    const reelle = (req.headers['x-real-ip'] as string | undefined)?.trim();
    const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const candidate = reelle || xff || req.ip || req.socket?.remoteAddress || undefined;
    return candidate && !estPrivee(candidate) ? candidate : undefined;
  }

  // Login utilisateur de tenant. Tenant via header x-tenant-slug (dev) ou sous-domaine.
  @Post('login')
  @HttpCode(200)
  login(@Req() req: any, @Body() body: { email?: string; password?: string }) {
    const slug = (req.headers['x-tenant-slug'] as string | undefined)?.trim();
    return this.auth.loginTenant(slug, body?.email ?? '', body?.password ?? '', this.ipDe(req));
  }

  // Login super-admin plateforme (realm séparé).
  @Post('super/login')
  @HttpCode(200)
  superLogin(@Req() req: any, @Body() body: { email?: string; password?: string }) {
    return this.auth.loginSuperAdmin(body?.email ?? '', body?.password ?? '', this.ipDe(req));
  }
}
