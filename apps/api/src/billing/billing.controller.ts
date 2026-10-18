import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode, ForbiddenException, BadRequestException } from '@nestjs/common';
import { validateMerchantPricing } from '@transpo/domain';
import { BillingService } from './billing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  /**
   * Devis tarifaire. L'assistant de commande du portail marchand l'appelle aussi, d'où
   * MERCHANT en plus des rôles console.
   *
   * - `merchant` (nom) : applique les conditions de ce marchand (grille, remise, forfait).
   *   Pour un compte MERCHANT, c'est TOUJOURS son marchand (claim du JWT) : le corps est
   *   ignoré, et les surcharges ad hoc ci-dessous aussi — un marchand ne peut ni lire les
   *   conditions d'un concurrent ni s'en inventer.
   * - `conditions` (console) : simule des conditions non encore enregistrées (dialogue de
   *   la fiche marchand, exemples de prix).
   * - `merchantFixedPrice` / `discountRate` (console) : simulation historique de la cascade.
   */
  @Post('pricing/quote')
  @Roles(...CONSOLE_ROLES, 'MERCHANT')
  @HttpCode(200)
  quote(@Req() req: any, @Body() body: any) {
    const base = {
      distanceKm: Math.max(0, Number(body?.distanceKm) || 0),
      fragile: !!body?.fragile,
      scheduled: !!body?.scheduled,
    };
    if (req.user?.role === 'MERCHANT') {
      if (!req.user?.merchant) throw new ForbiddenException('Compte marchand non rattaché à un marchand.');
      return this.billing.quoteForMerchant(req.tenantSchema, req.user.merchant, base);
    }
    if (body?.conditions) {
      const conditions = {
        mode: body.conditions.mode,
        discountRate: body.conditions.discountRate ?? null,
        flatPrice: body.conditions.flatPrice ?? null,
      };
      const err = validateMerchantPricing(conditions);
      if (err) throw new BadRequestException(err);
      return this.billing.quote(req.tenantSchema, { ...base, merchant: conditions });
    }
    if (typeof body?.merchant === 'string' && body.merchant.trim()) {
      return this.billing.quoteForMerchant(req.tenantSchema, body.merchant.trim(), base);
    }
    return this.billing.quote(req.tenantSchema, {
      ...base,
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
    return this.billing.generate(req.tenantSchema, body?.period || periodeCourante());
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

/** Période comptable courante (`AAAA-MM`) à l'heure du Maroc — défaut quand le client n'en envoie pas. */
function periodeCourante(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit' }).format(new Date());
}
