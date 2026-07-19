import { Controller, Get, Post, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  // Devis tarifaire (accessible à tous les rôles authentifiés du tenant).
  @Post('pricing/quote')
  @HttpCode(200)
  quote(@Body() body: any) {
    return this.billing.quote({
      distanceKm: Number(body?.distanceKm) || 0,
      fragile: !!body?.fragile,
      scheduled: !!body?.scheduled,
      merchantFixedPrice: body?.merchantFixedPrice ?? null,
      discountRate: body?.discountRate ?? undefined,
    });
  }

  @Get('invoices')
  @Roles('ADMIN', 'COMPTABLE')
  invoices(@Req() req: any) {
    return this.billing.invoices(req.tenantSchema);
  }
}
