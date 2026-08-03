import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { AnalyticsService } from './analytics.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/analytics')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@Req() req: any) { return this.analytics.summary(req.tenantSchema); }
}
