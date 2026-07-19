import { Controller, Get, Post, Param, Body, Query, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { TourneesService, type CreateTourInput } from './tournees.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/tournees')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER') // planification réservée à l'exploitation
export class TourneesController {
  constructor(@Inject(TourneesService) private readonly svc: TourneesService) {}

  @Get()
  list(@Req() req: any, @Query('driver') driver?: string, @Query('status') status?: string) {
    return this.svc.list(req.tenantSchema, { driver, status });
  }

  @Get(':id')
  get(@Req() req: any, @Param('id') id: string) { return this.svc.get(req.tenantSchema, id); }

  @Post()
  @HttpCode(200)
  create(@Req() req: any, @Body() body: CreateTourInput) { return this.svc.create(req.tenantSchema, body); }

  @Post(':id/reorder')
  @HttpCode(200)
  reorder(@Req() req: any, @Param('id') id: string, @Body() body: { stops: string[] }) {
    return this.svc.reorder(req.tenantSchema, id, body?.stops ?? []);
  }

  @Post(':id/advance')
  @HttpCode(200)
  advance(@Req() req: any, @Param('id') id: string) { return this.svc.advance(req.tenantSchema, id); }
}
