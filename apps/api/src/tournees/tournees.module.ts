import { Module } from '@nestjs/common';
import { TourneesController } from './tournees.controller.js';
import { TourneesService } from './tournees.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [TourneesController],
  providers: [TourneesService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class TourneesModule {}
