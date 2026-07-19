import { Module } from '@nestjs/common';
import { FleetController } from './fleet.controller.js';
import { FleetService } from './fleet.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [FleetController],
  providers: [FleetService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class FleetModule {}
