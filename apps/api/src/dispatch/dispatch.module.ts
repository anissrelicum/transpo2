import { Module } from '@nestjs/common';
import { DispatchController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [DispatchController],
  providers: [DispatchService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class DispatchModule {}
