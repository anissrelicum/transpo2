import { Controller, Get, Post, Body, Param, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { GeoService } from './geo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

// Référentiel géographique (non lié au tenant) — lecture par tout utilisateur authentifié.
@Controller('v1/geo')
@UseGuards(JwtAuthGuard)
export class GeoController {
  constructor(@Inject(GeoService) private readonly geo: GeoService) {}

  @Get('regions')
  regions() {
    return this.geo.listRegions();
  }

  @Get('commune/:iso')
  commune(@Param('iso') iso: string) {
    return this.geo.communeShape(iso);
  }

  /**
   * Lien de localisation collé (Google Maps, WhatsApp, Waze, Plans, OSM) ou coordonnées
   * brutes → position + lien d'origine + adresse détectée (best-effort).
   * Réservé à ceux qui créent des commandes : console et marchand. Le TenantGuard coupe
   * aussi ce geste pour un espace suspendu — il déclenche des requêtes sortantes.
   */
  @Post('resolve-link')
  @HttpCode(200)
  @UseGuards(TenantGuard, RolesGuard)
  @Roles(...CONSOLE_ROLES, 'MERCHANT')
  resolveLink(@Body() body: { url?: string; lang?: string }) {
    return this.geo.resolveLink(body?.url ?? '', body?.lang === 'ar' ? 'ar' : 'fr');
  }
}
