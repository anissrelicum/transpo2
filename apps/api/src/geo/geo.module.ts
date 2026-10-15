import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller.js';
import { GeoService } from './geo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [GeoController],
  providers: [GeoService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class GeoModule {}
