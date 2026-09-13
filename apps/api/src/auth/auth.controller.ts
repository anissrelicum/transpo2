import { Controller, Post, Body, Req, Inject, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  /**
   * Adresse de l'appelant, pour le comptage anti-bruteforce par source.
   * L'API est derrière l'ingress puis le BFF : `x-forwarded-for` porte la chaîne, dont
   * le premier maillon est le client. Sans cet en-tête (appel direct), on retombe sur
   * l'adresse de socket.
   */
  private ipDe(req: any): string | undefined {
    const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    return xff || req.ip || req.socket?.remoteAddress || undefined;
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
