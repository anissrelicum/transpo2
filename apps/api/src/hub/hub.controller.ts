import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { HubService } from './hub.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/hub')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class HubController {
  constructor(@Inject(HubService) private readonly hub: HubService) {}

  @Get()
  list(@Req() req: any) { return this.hub.list(req.tenantSchema); }

  @Post('scan')
  @HttpCode(200)
  scan(@Req() req: any, @Body() body: { code: string }) { return this.hub.scan(req.tenantSchema, body?.code); }

  @Post(':ref/phase')
  @HttpCode(200)
  setPhase(@Req() req: any, @Param('ref') ref: string, @Body() body: { phase: string }) {
    return this.hub.setPhase(req.tenantSchema, ref, body?.phase);
  }
}
