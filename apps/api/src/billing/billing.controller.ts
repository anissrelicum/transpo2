import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
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
  quote(@Req() req: any, @Body() body: any) {
    return this.billing.quote(req.tenantSchema, {
      distanceKm: Number(body?.distanceKm) || 0,
      fragile: !!body?.fragile,
      scheduled: !!body?.scheduled,
      merchantFixedPrice: body?.merchantFixedPrice ?? null,
      discountRate: body?.discountRate ?? undefined,
    });
  }

  @Get('pricing/config')
  @Roles('ADMIN', 'COMPTABLE', 'DISPATCHER')
  pricingConfig(@Req() req: any) {
    return this.billing.pricingConfig(req.tenantSchema);
  }

  @Post('pricing/config')
  @HttpCode(200)
  @Roles('ADMIN')
  savePricingConfig(@Req() req: any, @Body() body: any) {
    return this.billing.savePricingConfig(req.tenantSchema, {
      tiers: body?.tiers ?? [],
      fragileSurcharge: Number(body?.fragileSurcharge) || 0,
      scheduledSurcharge: Number(body?.scheduledSurcharge) || 0,
      discountRate: Number(body?.discountRate) || 0,
      commissionRate: Number(body?.commissionRate) || 0,
      vatRate: Number(body?.vatRate) || 0,
    });
  }

  @Get('invoices')
  @Roles('ADMIN', 'COMPTABLE')
  invoices(@Req() req: any) {
    return this.billing.invoices(req.tenantSchema);
  }

  @Get('invoices/billing-modes')
  @Roles('ADMIN', 'COMPTABLE')
  billingModes(@Req() req: any) {
    return this.billing.billingModes(req.tenantSchema);
  }

  @Post('invoices/billing-modes')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  setBillingMode(@Req() req: any, @Body() body: { merchant: string; mode: string }) {
    return this.billing.setBillingMode(req.tenantSchema, body?.merchant, body?.mode);
  }

  @Post('invoices/generate')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  generate(@Req() req: any, @Body() body: { period?: string }) {
    return this.billing.generate(req.tenantSchema, body?.period || '2026-07');
  }

  @Post('invoices/:id/send')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  send(@Req() req: any, @Param('id') id: string) {
    return this.billing.send(req.tenantSchema, id);
  }

  @Post('invoices/:id/pay')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  pay(@Req() req: any, @Param('id') id: string) {
    return this.billing.pay(req.tenantSchema, id);
  }

  @Post('invoices/:id/dispute')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  dispute(@Req() req: any, @Param('id') id: string, @Body() body: { amount: number; note?: string }) {
    return this.billing.dispute(req.tenantSchema, id, Number(body?.amount) || 0, body?.note);
  }

  @Post('invoices/:id/resolve')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  resolve(@Req() req: any, @Param('id') id: string, @Body() body: { decision: string }) {
    return this.billing.resolveDispute(req.tenantSchema, id, body?.decision || 'avoir');
  }
}
