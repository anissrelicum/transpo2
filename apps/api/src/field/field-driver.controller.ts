import { Controller, Get, Post, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { FieldService } from './field.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Annexes livreur : incidents, support, historique/gains (scope = claim `driver`).
@Controller('v1/driver')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('DRIVER')
export class FieldDriverController {
  constructor(@Inject(FieldService) private readonly svc: FieldService) {}

  @Post('incidents')
  @HttpCode(200)
  report(@Req() req: any, @Body() body: { ref?: string; type: string; note?: string }) {
    return this.svc.reportIncident(req.tenantSchema, req.user?.driver, body);
  }

  @Get('incidents')
  myIncidents(@Req() req: any) { return this.svc.myIncidents(req.tenantSchema, req.user?.driver); }

  @Post('support')
  @HttpCode(200)
  message(@Req() req: any, @Body() body: { body: string }) {
    return this.svc.driverMessage(req.tenantSchema, req.user?.driver, body?.body);
  }

  @Get('support')
  thread(@Req() req: any) { return this.svc.thread(req.tenantSchema, req.user?.driver); }

  @Get('history')
  history(@Req() req: any) { return this.svc.history(req.tenantSchema, req.user?.driver); }
}
