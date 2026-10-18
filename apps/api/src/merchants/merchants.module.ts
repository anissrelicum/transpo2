import { Module } from '@nestjs/common';
import { MerchantsController } from './merchants.controller.js';
import { MerchantsService } from './merchants.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { AuditModule } from '../audit/audit.module.js';
import { BillingModule } from '../billing/billing.module.js';

@Module({
  imports: [AuditModule, BillingModule],
  controllers: [MerchantsController],
  providers: [MerchantsService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class MerchantsModule {}
