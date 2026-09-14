import { Controller, Get, Post, Patch, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { FieldService } from './field.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Annexes livreur : incidents, support, historique/gains (scope = claim `driver`).
@Controller('v1/driver')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('DRIVER')
export class FieldDriverController {
  constructor(@Inject(FieldService) private readonly svc: FieldService) {}

  /** Fiche du livreur telle que l'exploitation la tient (véhicule, permis, zone). */
  @Get('me')
  me(@Req() req: any) { return this.svc.me(req.tenantSchema, req.user?.driver); }

  /** Le livreur se déclare disponible ou non — lu par le dispatch, pas seulement à l'écran. */
  @Patch('availability')
  availability(@Req() req: any, @Body() body: { available?: boolean }) {
    return this.svc.setAvailability(req.tenantSchema, req.user?.driver, body?.available as boolean);
  }

  /** Tournée du jour, telle que l'exploitation l'a ordonnée. */
  @Get('tour')
  tour(@Req() req: any) { return this.svc.myTour(req.tenantSchema, req.user?.driver); }

  /** Caisse du jour du livreur : ce qu'il doit avoir en poche. */
  @Get('cash')
  cash(@Req() req: any) { return this.svc.myCash(req.tenantSchema, req.user?.driver); }

  /** Déclaration du cash réellement détenu — ouvre le rapprochement côté comptabilité. */
  @Post('cash/declare')
  @HttpCode(200)
  declareCash(@Req() req: any, @Body() body: { amount?: number }) {
    return this.svc.declareCash(req.tenantSchema, req.user?.driver, Number(body?.amount));
  }

  @Post('incidents')
  @HttpCode(200)
  report(@Req() req: any, @Body() body: { ref?: string; type: string; note?: string }) {
    return this.svc.reportIncident(req.tenantSchema, req.user?.driver, body);
  }

  @Get('incidents')
  myIncidents(@Req() req: any) { return this.svc.myIncidents(req.tenantSchema, req.user?.driver); }

  @Post('support')
  @HttpCode(200)
  message(@Req() req: any, @Body() body: { body: string }) {
    return this.svc.driverMessage(req.tenantSchema, req.user?.driver, body?.body);
  }

  @Get('support')
  thread(@Req() req: any) { return this.svc.thread(req.tenantSchema, req.user?.driver); }

  @Get('history')
  history(@Req() req: any) { return this.svc.history(req.tenantSchema, req.user?.driver); }
}
