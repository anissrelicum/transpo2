import { Controller, Get, Post, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/settings')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settings: SettingsService) {}

  @Get('company')
  get(@Req() req: any) {
    return this.settings.get(req.tenantSchema);
  }

  @Post('company')
  @HttpCode(200)
  @Roles('ADMIN')
  save(@Req() req: any, @Body() body: any) {
    return this.settings.save(req.tenantSchema, body);
  }
}
