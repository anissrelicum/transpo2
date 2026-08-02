import { Controller, Get, Post, Put, Body, Query, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { NotificationsService, type SendInput } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/notifications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN', 'DISPATCHER')
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly svc: NotificationsService) {}

  @Get()
  list(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('event') event?: string,
  ) {
    return this.svc.list(req.tenantSchema, { status, channel, event });
  }

  @Post('send')
  @HttpCode(200)
  send(@Req() req: any, @Body() body: SendInput) { return this.svc.send(req.tenantSchema, body); }

  @Post(':id/retry')
  @HttpCode(200)
  retry(@Req() req: any, @Param('id') id: string) { return this.svc.retry(req.tenantSchema, id); }

  // --- Modèles bilingues : lecture ouverte à la console, édition réservée à l'ADMIN. ---
  // Le COMPTABLE consulte les modèles (la page l'était déjà avant persistance) sans pouvoir les éditer.
  @Get('templates')
  @Roles('ADMIN', 'DISPATCHER', 'COMPTABLE')
  templates(@Req() req: any) { return this.svc.listTemplates(req.tenantSchema); }

  @Put('templates/:event')
  @Roles('ADMIN')
  saveTemplate(@Req() req: any, @Param('event') event: string, @Body() body: any) {
    return this.svc.saveTemplate(req.tenantSchema, event, body ?? {});
  }

  @Post('templates/:event/reset')
  @HttpCode(200)
  @Roles('ADMIN')
  resetTemplate(@Req() req: any, @Param('event') event: string) {
    return this.svc.resetTemplate(req.tenantSchema, event);
  }

  @Get('consent/:subject')
  consents(@Req() req: any, @Param('subject') subject: string) {
    return this.svc.consents(req.tenantSchema, subject);
  }

  @Post('consent')
  @HttpCode(200)
  setConsent(@Req() req: any, @Body() body: { subject: string; channel: string; optedIn: boolean }) {
    return this.svc.setConsent(req.tenantSchema, body?.subject, body?.channel, !!body?.optedIn);
  }
}
