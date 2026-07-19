import { Controller, Get, Post, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { CashService } from './cash.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/cash')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CashController {
  constructor(@Inject(CashService) private readonly cash: CashService) {}

  @Post('collect/:ref')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  collect(@Req() req: any, @Param('ref') ref: string) {
    return this.cash.collect(req.tenantSchema, ref);
  }

  @Get('reconciliation')
  @Roles('ADMIN', 'COMPTABLE')
  reconciliation(@Req() req: any) {
    return this.cash.reconciliation(req.tenantSchema);
  }

  @Get('payouts')
  @Roles('ADMIN', 'COMPTABLE')
  payouts(@Req() req: any) {
    return this.cash.merchantPayouts(req.tenantSchema);
  }
}
