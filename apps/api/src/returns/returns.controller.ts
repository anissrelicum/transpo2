import { Controller, Get, Post, Body, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { ReturnsService } from './returns.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/returns')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ReturnsController {
  constructor(@Inject(ReturnsService) private readonly returns: ReturnsService) {}

  @Get()
  list(@Req() req: any) { return this.returns.list(req.tenantSchema); }

  @Post('fail/:ref')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  fail(@Req() req: any, @Param('ref') ref: string, @Body() body: { reason?: string }) {
    return this.returns.fail(req.tenantSchema, ref, body?.reason ?? '');
  }

  @Post(':ref/reschedule')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  reschedule(@Req() req: any, @Param('ref') ref: string) {
    return this.returns.reschedule(req.tenantSchema, ref);
  }

  @Post(':ref/return-to-merchant')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  returnToMerchant(@Req() req: any, @Param('ref') ref: string) {
    return this.returns.returnToMerchant(req.tenantSchema, ref);
  }
}
