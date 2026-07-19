import { Controller, Get, Post, Body, Param, Req, UseGuards, Inject } from '@nestjs/common';
import { DispatchService } from './dispatch.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/dispatch')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DispatchController {
  constructor(@Inject(DispatchService) private readonly dispatch: DispatchService) {}

  @Get('zones')
  zones(@Req() req: any) {
    return this.dispatch.listZones(req.tenantSchema);
  }

  @Post('zones')
  @Roles('ADMIN', 'DISPATCHER')
  createZone(@Req() req: any, @Body() body: any) {
    return this.dispatch.createZone(req.tenantSchema, body);
  }

  @Get('suggest/:ref')
  @Roles('ADMIN', 'DISPATCHER')
  suggest(@Req() req: any, @Param('ref') ref: string) {
    return this.dispatch.suggest(req.tenantSchema, ref);
  }
}
