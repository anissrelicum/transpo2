import { Controller, Get, Post, Query, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { PrivacyService } from './privacy.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/privacy')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN') // droits des personnes : réservé à l'admin du tenant
export class PrivacyController {
  constructor(@Inject(PrivacyService) private readonly svc: PrivacyService) {}

  @Get('export')
  export(@Req() req: any, @Query('subject') subject: string) {
    return this.svc.export(req.tenantSchema, subject);
  }

  @Post('erase')
  @HttpCode(200)
  erase(@Req() req: any, @Body() body: { subject: string }) {
    return this.svc.erase(req.tenantSchema, req.tenantSlug, req.user, body?.subject);
  }
}
