import { Module } from '@nestjs/common';
import { CashController } from './cash.controller.js';
import { CashService } from './cash.service.js';
import { BillingModule } from '../billing/billing.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [BillingModule],
  controllers: [CashController],
  providers: [CashService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class CashModule {}
