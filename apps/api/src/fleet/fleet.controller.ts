import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
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

  @Patch(':id/state')
  @Roles('ADMIN')
  setState(@Req() req: any, @Param('id') id: string, @Body() body: { state: string }) {
    return this.fleet.setState(req.tenantSchema, id, body?.state);
  }

  @Post(':id/renew')
  @HttpCode(200)
  @Roles('ADMIN')
  renew(@Req() req: any, @Param('id') id: string, @Body() body: { field: 'insurance' | 'ct'; due: string }) {
    return this.fleet.renew(req.tenantSchema, id, body?.field, body?.due);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.fleet.remove(req.tenantSchema, id);
  }
}
