import { Controller, Get, Param, UseGuards, Inject } from '@nestjs/common';
import { GeoService } from './geo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

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
}
