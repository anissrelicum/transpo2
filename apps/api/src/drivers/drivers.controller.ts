import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { DriversService } from './drivers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/drivers')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
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

  @Patch(':id')
  @Roles('ADMIN')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.drivers.update(req.tenantSchema, id, body ?? {});
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

  // `transferTo` en query : un DELETE porte mal un corps, et le repreneur fait partie de
  // l'adresse de l'action (« retirer X en confiant ses courses à Y »).
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Req() req: any, @Param('id') id: string, @Query('transferTo') transferTo?: string) {
    return this.drivers.remove(req.tenantSchema, id, transferTo);
  }
}
