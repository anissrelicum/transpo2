import { Controller, Get, Post, Body, Req, UseGuards, Inject } from '@nestjs/common';
import { FleetService } from './fleet.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/vehicles')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class FleetController {
  constructor(@Inject(FleetService) private readonly fleet: FleetService) {}

  @Get()
  list(@Req() req: any) {
    return this.fleet.listVehicles(req.tenantSchema);
  }

  @Post()
  @Roles('ADMIN')
  create(@Req() req: any, @Body() body: any) {
    return this.fleet.createVehicle(req.tenantSchema, body);
  }
}
