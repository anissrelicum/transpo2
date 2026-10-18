import { Module } from '@nestjs/common';
import { RoutingController } from './routing.controller.js';
import { RoutingService } from './routing.service.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [RoutingController],
  providers: [RoutingService, TenantGuard, JwtAuthGuard, RolesGuard],
  exports: [RoutingService],
})
export class RoutingModule {}
