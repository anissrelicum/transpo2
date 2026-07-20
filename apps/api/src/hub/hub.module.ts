import { Module } from '@nestjs/common';
import { HubController } from './hub.controller.js';
import { HubService } from './hub.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [HubController],
  providers: [HubService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class HubModule {}
