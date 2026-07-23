import { Module } from '@nestjs/common';
import { MerchantController } from './merchant.controller.js';
import { MerchantService } from './merchant.service.js';
import { BillingModule } from '../billing/billing.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [BillingModule],
  controllers: [MerchantController],
  providers: [MerchantService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class MerchantModule {}
