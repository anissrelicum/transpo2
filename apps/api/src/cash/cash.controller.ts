import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
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

  @Get('sessions')
  @Roles('ADMIN', 'COMPTABLE')
  sessions(@Req() req: any) {
    return this.cash.sessions(req.tenantSchema);
  }

  @Post('sessions/:id/deposit')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  deposit(@Req() req: any, @Param('id') id: string) {
    return this.cash.deposit(req.tenantSchema, id);
  }

  @Post('sessions/:id/resolve')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  resolve(@Req() req: any, @Param('id') id: string, @Body() body: { reason: string; note?: string }) {
    return this.cash.resolve(req.tenantSchema, id, body?.reason, body?.note);
  }

  @Get('reversements')
  @Roles('ADMIN', 'COMPTABLE')
  reversements(@Req() req: any) {
    return this.cash.reversements(req.tenantSchema);
  }

  @Post('reversements/generate')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  generateReversements(@Req() req: any, @Body() body: { period?: string }) {
    return this.cash.generateReversements(req.tenantSchema, body?.period || '2026-07');
  }

  @Post('reversements/:id/pay')
  @HttpCode(200)
  @Roles('ADMIN', 'COMPTABLE')
  payReversement(@Req() req: any, @Param('id') id: string, @Body() body: { method?: string; reference?: string }) {
    return this.cash.payReversement(req.tenantSchema, id, body?.method || 'virement', body?.reference);
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
