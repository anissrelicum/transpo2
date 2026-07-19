import { Controller, Get, Post, Body, Req, UseGuards, Inject, BadRequestException } from '@nestjs/common';
import { SaasService } from './saas.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Console SaaS : réservé au realm super-admin plateforme.
@Controller('v1/saas/tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SaasController {
  constructor(@Inject(SaasService) private readonly saas: SaasService) {}

  @Get()
  list() {
    return this.saas.list();
  }

  @Post()
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
