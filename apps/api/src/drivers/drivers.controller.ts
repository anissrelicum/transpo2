import { Controller, Get, Post, Patch, Delete, Param, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { DriversService } from './drivers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/drivers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class DriversController {
  constructor(@Inject(DriversService) private readonly drivers: DriversService) {}

  @Get()
  list(@Req() req: any) {
    return this.drivers.list(req.tenantSchema);
  }

  @Post()
  @Roles('ADMIN')
  create(@Req() req: any, @Body() body: any) {
    return this.drivers.create(req.tenantSchema, body);
  }

  // Le dispatcher pilote la disponibilité au quotidien ; le reste est réservé à l'admin.
  @Patch(':id/availability')
  @Roles('ADMIN', 'DISPATCHER')
  setAvailability(@Req() req: any, @Param('id') id: string, @Body() body: { available: boolean }) {
    return this.drivers.setAvailability(req.tenantSchema, id, body?.available);
  }

  @Post(':id/renew')
  @HttpCode(200)
  @Roles('ADMIN')
  renew(@Req() req: any, @Param('id') id: string, @Body() body: { field: 'license' | 'medical'; due: string }) {
    return this.drivers.renew(req.tenantSchema, id, body?.field, body?.due);
  }

  @Patch(':id/vehicle')
  @Roles('ADMIN')
  assignVehicle(@Req() req: any, @Param('id') id: string, @Body() body: { vehicleId: string | null }) {
    return this.drivers.assignVehicle(req.tenantSchema, id, body?.vehicleId ?? null);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.drivers.remove(req.tenantSchema, id);
  }
}
