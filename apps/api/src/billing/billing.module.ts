import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [BillingController],
  providers: [BillingService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class BillingModule {}
