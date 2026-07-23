import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/users')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get()
  list(@Req() req: any) {
    return this.users.list(req.tenantSchema);
  }

  @Post()
  @Roles('ADMIN')
  invite(@Req() req: any, @Body() body: { email?: string; name?: string; role?: string }) {
    return this.users.invite(req.tenantSchema, req.tenantSlug, req.user, body);
  }

  @Patch(':id/role')
  @Roles('ADMIN')
  setRole(@Req() req: any, @Param('id') id: string, @Body() body: { role?: string }) {
    return this.users.setRole(req.tenantSchema, req.tenantSlug, req.user, id, body?.role ?? '');
  }

  @Patch(':id/active')
  @Roles('ADMIN')
  setActive(@Req() req: any, @Param('id') id: string, @Body() body: { active?: boolean }) {
    return this.users.setActive(req.tenantSchema, req.tenantSlug, req.user, id, !!body?.active);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @Roles('ADMIN')
  resetPassword(@Req() req: any, @Param('id') id: string) {
    return this.users.resetPassword(req.tenantSchema, req.tenantSlug, req.user, id);
  }
}
