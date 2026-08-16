import { Module } from '@nestjs/common';
import { SaasController } from './saas.controller.js';
import { SaasService } from './saas.service.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [AuditModule],
  controllers: [PlansController, SaasController],
  providers: [PlansService, SubscriptionsService, SaasService, JwtAuthGuard, RolesGuard],
})
export class SaasModule {}
