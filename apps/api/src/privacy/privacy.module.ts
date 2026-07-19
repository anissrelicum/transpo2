import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller.js';
import { PrivacyService } from './privacy.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [AuditModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class PrivacyModule {}
