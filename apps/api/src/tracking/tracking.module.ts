import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [TrackingController],
  providers: [TrackingService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class TrackingModule {}
