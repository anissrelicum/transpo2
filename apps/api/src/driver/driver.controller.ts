import { Controller, Get, Post, Param, Body, Req, Headers, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { DriverService } from './driver.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/driver')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('DRIVER') // app livreur : scope = claim `driver`
export class DriverController {
  constructor(@Inject(DriverService) private readonly svc: DriverService) {}

  @Get('missions')
  missions(@Req() req: any) { return this.svc.missions(req.tenantSchema, req.user?.driver); }

  @Post('orders/:ref/advance')
  @HttpCode(200)
  advance(@Req() req: any, @Param('ref') ref: string, @Headers('idempotency-key') key?: string) {
    return this.svc.advance(req.tenantSchema, req.user?.driver, ref, key);
  }

  @Post('orders/:ref/proof')
  @HttpCode(200)
  proof(
    @Req() req: any,
    @Param('ref') ref: string,
    @Body() body: { codCollected?: number },
    @Headers('idempotency-key') key?: string,
  ) {
    return this.svc.proof(req.tenantSchema, req.user?.driver, ref, body ?? {}, key);
  }
}
