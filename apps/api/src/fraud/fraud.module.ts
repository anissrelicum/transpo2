import { Module } from '@nestjs/common';
import { FraudController } from './fraud.controller.js';
import { FraudService } from './fraud.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [AuditModule],
  controllers: [FraudController],
  providers: [FraudService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class FraudModule {}
