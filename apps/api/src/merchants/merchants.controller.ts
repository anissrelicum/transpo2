import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Inject } from '@nestjs/common';
import { MerchantsService, type MerchantInput } from './merchants.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

/**
 * Fiches marchand et conditions tarifaires.
 *
 * | Rôle        | Liste / fiche | Créer / modifier | Ses conditions |
 * |-------------|---------------|------------------|----------------|
 * | ADMIN       | oui           | oui              | —              |
 * | COMPTABLE   | oui           | oui              | —              |
 * | DISPATCHER  | oui (lecture) | non (403)        | —              |
 * | MERCHANT    | non (403)     | non (403)        | les siennes    |
 */
@Controller('v1/merchants')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
export class MerchantsController {
  constructor(@Inject(MerchantsService) private readonly merchants: MerchantsService) {}

  @Get()
  list(@Req() req: any) {
    return this.merchants.list(req.tenantSchema);
  }

  /** Conditions du marchand connecté (portail). Déclarée avant `:id`. */
  @Get('me')
  @Roles('MERCHANT')
  me(@Req() req: any) {
    return this.merchants.conditionsOf(req.tenantSchema, req.user?.merchant);
  }

  /** Fiche complète (console) ; un marchand n'obtient que SES conditions, et 403 sinon. */
  @Get(':id')
  @Roles(...CONSOLE_ROLES, 'MERCHANT')
  get(@Req() req: any, @Param('id') id: string) {
    if (req.user?.role === 'MERCHANT') return this.merchants.conditionsOf(req.tenantSchema, req.user?.merchant, id);
    return this.merchants.get(req.tenantSchema, id);
  }

  @Post()
  @Roles('ADMIN', 'COMPTABLE')
  create(@Req() req: any, @Body() body: MerchantInput) {
    return this.merchants.create(req.tenantSchema, req.tenantSlug, req.user, body);
  }

  @Patch(':id')
  @Roles('ADMIN', 'COMPTABLE')
  update(@Req() req: any, @Param('id') id: string, @Body() body: MerchantInput) {
    return this.merchants.update(req.tenantSchema, req.tenantSlug, req.user, id, body);
  }
}
