import { Controller, Get, Post, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { TrackingService } from './tracking.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/tracking')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TrackingController {
  constructor(@Inject(TrackingService) private readonly svc: TrackingService) {}

  // Le livreur ne pousse que sa propre position (scope = claim `driver`).
  @Post('position')
  @HttpCode(200)
  @Roles('DRIVER')
  position(@Req() req: any, @Body() body: { lat: number; lng: number }) {
    return this.svc.ingest(req.tenantSchema, req.user?.driver, Number(body?.lat), Number(body?.lng));
  }

  @Get('live')
  @Roles('ADMIN', 'DISPATCHER')
  live(@Req() req: any) { return this.svc.live(req.tenantSchema); }

  @Get('alerts')
  @Roles('ADMIN', 'DISPATCHER')
  alerts(@Req() req: any) { return this.svc.alerts(req.tenantSchema); }

  @Post('geofence')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  geofence(@Req() req: any, @Body() body: any) { return this.svc.createGeofence(req.tenantSchema, body); }
}
