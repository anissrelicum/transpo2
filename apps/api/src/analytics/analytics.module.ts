import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService, JwtAuthGuard, TenantGuard],
})
export class AnalyticsModule {}
