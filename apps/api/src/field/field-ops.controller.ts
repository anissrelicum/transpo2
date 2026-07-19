import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { FieldService } from './field.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Côté exploitation : suivi des incidents et réponses support.
@Controller('v1/field')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class FieldOpsController {
  constructor(@Inject(FieldService) private readonly svc: FieldService) {}

  @Get('incidents')
  incidents(@Req() req: any, @Query('status') status?: string) {
    return this.svc.listIncidents(req.tenantSchema, status);
  }

  @Post('incidents/:id/resolve')
  @HttpCode(200)
  resolve(@Req() req: any, @Param('id') id: string) { return this.svc.resolveIncident(req.tenantSchema, id); }

  @Get('support/:driver')
  thread(@Req() req: any, @Param('driver') driver: string) { return this.svc.thread(req.tenantSchema, driver); }

  @Post('support/:driver/reply')
  @HttpCode(200)
  reply(@Req() req: any, @Param('driver') driver: string, @Body() body: { body: string }) {
    return this.svc.opsReply(req.tenantSchema, driver, body?.body);
  }
}
