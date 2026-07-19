import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode, BadRequestException } from '@nestjs/common';
import { SaasService } from './saas.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Console SaaS : réservé au realm super-admin plateforme.
@Controller('v1/saas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SaasController {
  constructor(@Inject(SaasService) private readonly saas: SaasService) {}

  @Get('plans')
  plans() {
    return this.saas.plans();
  }

  @Get('billing')
  billing() {
    return this.saas.billing();
  }

  @Get('tenants')
  list() {
    return this.saas.list();
  }

  @Post('tenants/:slug/plan')
  @HttpCode(200)
  changePlan(@Req() req: any, @Param('slug') slug: string, @Body() body: { plan: string }) {
    if (!body?.plan) throw new BadRequestException('plan requis.');
    return this.saas.changePlan(req.user, slug, body.plan);
  }

  @Post('tenants/:slug/status')
  @HttpCode(200)
  setStatus(@Req() req: any, @Param('slug') slug: string, @Body() body: { status: string }) {
    if (!body?.status) throw new BadRequestException('status requis.');
    return this.saas.setStatus(req.user, slug, body.status);
  }

  @Post('tenants')
  provision(@Req() req: any, @Body() body: { slug?: string; name?: string; city?: string; plan?: string }) {
    if (!body?.slug || !/^[a-z0-9]+$/.test(body.slug)) {
      throw new BadRequestException('slug requis (minuscules/chiffres).');
    }
    if (!body?.name) throw new BadRequestException('name requis.');
    return this.saas.provision(req.user, {
      slug: body.slug, name: body.name, city: body.city, plan: body.plan, status: body.plan === 'Essai' ? 'ESSAI' : 'ACTIF',
    });
  }
}
