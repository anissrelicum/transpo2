import { Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { PlansService, type VersionInput } from './plans.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

/** Catalogue de plans (spec §8). Realm plateforme uniquement. */
@Controller('v1/saas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class PlansController {
  constructor(@Inject(PlansService) private readonly plans: PlansService) {}

  @Get('plans')
  catalog(@Query('include') include?: string) {
    return this.plans.catalog(include === 'archived');
  }

  @Post('plans')
  create(@Req() req: any, @Body() body: { code?: string; labelFr?: string; labelAr?: string; description?: string; sortOrder?: number }) {
    return this.plans.createPlan(req.user, body ?? {});
  }

  @Patch('plans/:code')
  update(@Req() req: any, @Param('code') code: string, @Body() body: { labelFr?: string; labelAr?: string; description?: string; sortOrder?: number }) {
    return this.plans.updatePlan(req.user, code, body ?? {});
  }

  @Post('plans/:code/archive')
  @HttpCode(200)
  archive(@Req() req: any, @Param('code') code: string, @Body() body: { force?: boolean }) {
    return this.plans.archivePlan(req.user, code, body?.force === true);
  }

  @Post('plans/:code/restore')
  @HttpCode(200)
  restore(@Req() req: any, @Param('code') code: string) {
    return this.plans.restorePlan(req.user, code);
  }

  @Get('plans/:code/versions')
  versions(@Param('code') code: string) {
    return this.plans.versions(code);
  }

  @Post('plans/:code/versions')
  createVersion(@Req() req: any, @Param('code') code: string, @Body() body: VersionInput) {
    return this.plans.createVersion(req.user, code, body ?? ({} as VersionInput));
  }
}
