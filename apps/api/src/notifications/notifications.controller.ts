import { Controller, Get, Post, Body, Query, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
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
  list(@Req() req: any, @Query('status') status?: string, @Query('channel') channel?: string) {
    return this.svc.list(req.tenantSchema, { status, channel });
  }

  @Post('send')
  @HttpCode(200)
  send(@Req() req: any, @Body() body: SendInput) { return this.svc.send(req.tenantSchema, body); }

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
