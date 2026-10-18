import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { RoutingService } from './routing.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/routing')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RoutingController {
  constructor(@Inject(RoutingService) private readonly svc: RoutingService) {}

  /** Itinéraire par les rues passant par les points donnés, dans l'ordre (`lat,lng;lat,lng;…`). */
  @Get('route')
  @Roles(...CONSOLE_ROLES, 'DRIVER')
  route(@Query('points') points?: string) {
    return this.svc.route(RoutingService.lirePoints(points));
  }
}
