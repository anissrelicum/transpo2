import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { DispatchService } from './dispatch.service.js';
import { AutoDispatchService } from './auto-dispatch.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/dispatch')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
export class DispatchController {
  constructor(
    @Inject(DispatchService) private readonly dispatch: DispatchService,
    @Inject(AutoDispatchService) private readonly auto: AutoDispatchService,
  ) {}

  @Get('zones')
  zones(@Req() req: any) {
    return this.dispatch.listZones(req.tenantSchema);
  }

  @Post('zones')
  @Roles('ADMIN', 'DISPATCHER')
  createZone(@Req() req: any, @Body() body: any) {
    return this.dispatch.createZone(req.tenantSchema, body);
  }

  @Patch('zones/:id')
  @Roles('ADMIN', 'DISPATCHER')
  updateZone(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.dispatch.updateZone(req.tenantSchema, id, body);
  }

  @Delete('zones/:id')
  @Roles('ADMIN', 'DISPATCHER')
  deleteZone(@Req() req: any, @Param('id') id: string) {
    return this.dispatch.deleteZone(req.tenantSchema, id);
  }

  @Get('suggest/:ref')
  @Roles('ADMIN', 'DISPATCHER')
  suggest(@Req() req: any, @Param('ref') ref: string) {
    return this.dispatch.suggest(req.tenantSchema, ref);
  }

  /* ---------------- Affectation automatique (ADR 0004) ---------------- */

  /** Réglages : lecture ouverte à la console (la page Paramètres les affiche à tous). */
  @Get('settings')
  settings(@Req() req: any) {
    return this.auto.getSettings(req.tenantSchema);
  }

  /** Interrupteur, délai d'acceptation, capacité par défaut : décision d'administrateur. */
  @Put('settings')
  @Roles('ADMIN')
  saveSettings(@Req() req: any, @Body() body: any) {
    return this.auto.saveSettings(req.tenantSchema, body ?? {}, req.user?.sub);
  }

  /** File d'exceptions : commandes que l'automate n'a pas pu placer, avec leur motif. */
  @Get('exceptions')
  @Roles('ADMIN', 'DISPATCHER')
  exceptions(@Req() req: any) {
    return this.auto.exceptions(req.tenantSchema);
  }

  /** Propositions en attente de réponse d'un livreur. */
  @Get('offers')
  @Roles('ADMIN', 'DISPATCHER')
  offers(@Req() req: any) {
    return this.auto.pendingOffers(req.tenantSchema);
  }

  /** Propositions successives d'une commande (tous tours). */
  @Get('offers/:ref')
  @Roles('ADMIN', 'DISPATCHER')
  offersOf(@Req() req: any, @Param('ref') ref: string) {
    return this.auto.offersOf(req.tenantSchema, ref);
  }

  /** Relance l'affectation automatique d'une commande (nouveau tour). */
  @Post('auto/:ref/retry')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  retry(@Req() req: any, @Param('ref') ref: string) {
    return this.auto.retry(req.tenantSchema, ref, req.user?.sub);
  }

  /**
   * Exécute tout de suite la passe de l'automate sur ce tenant (expirations + rattrapage),
   * sans attendre la passe périodique. Sûr à rejouer et à lancer en parallèle.
   */
  @Post('auto/run')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  run(@Req() req: any) {
    return this.auto.processTenant(req.tenantSchema);
  }
}
