import { Controller, Get, Post, Param, Body, Req, UseGuards, Inject, HttpCode, BadRequestException } from '@nestjs/common';
import { SaasService } from './saas.service.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Console SaaS : réservé au realm super-admin plateforme.
@Controller('v1/saas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SaasController {
  constructor(
    @Inject(SaasService) private readonly saas: SaasService,
    @Inject(SubscriptionsService) private readonly subs: SubscriptionsService,
  ) {}

  // GET plans → PlansController (catalogue en base, spec §8).

  @Get('billing')
  billing() {
    return this.saas.billing();
  }

  @Get('tenants')
  list() {
    return this.saas.list();
  }

  // `tenants.status` n'est plus écrit directement : il découle de l'abonnement (spec §5.2).
  // Les anciennes routes /plan et /status sont remplacées par les actions ci-dessous.

  @Get('tenants/:slug/subscription')
  subscription(@Param('slug') slug: string) {
    return this.subs.get(slug);
  }

  @Post('tenants/:slug/subscription')
  @HttpCode(200)
  subscribe(@Req() req: any, @Param('slug') slug: string, @Body() body: { planCode?: string; immediate?: boolean }) {
    return this.subs.subscribe(req.user, slug, body ?? {});
  }

  @Post('tenants/:slug/subscription/cancel')
  @HttpCode(200)
  cancel(@Req() req: any, @Param('slug') slug: string, @Body() body: { reason?: string }) {
    return this.subs.cancel(req.user, slug, body?.reason);
  }

  @Post('tenants/:slug/subscription/suspend')
  @HttpCode(200)
  suspend(@Req() req: any, @Param('slug') slug: string, @Body() body: { reason?: string }) {
    return this.subs.suspend(req.user, slug, body?.reason);
  }

  @Post('tenants/:slug/subscription/reactivate')
  @HttpCode(200)
  reactivate(@Req() req: any, @Param('slug') slug: string) {
    return this.subs.reactivate(req.user, slug);
  }

  /** Avance le temps. Idempotent — rejouable à la main pendant la recette (spec §7). */
  @Post('cycle/run')
  @HttpCode(200)
  runCycle(@Req() req: any) {
    return this.subs.runCycle(req.user);
  }

  /** Crée ou réinitialise l'administrateur d'une organisation existante (AN-11). */
  @Post('tenants/:slug/admin')
  @HttpCode(200)
  resetAdmin(@Req() req: any, @Param('slug') slug: string, @Body() body: { email?: string; name?: string }) {
    return this.saas.resetAdmin(req.user, slug, body ?? {});
  }

  @Post('tenants')
  provision(@Req() req: any, @Body() body: { slug?: string; name?: string; city?: string; planCode?: string; adminEmail?: string; adminName?: string }) {
    if (!body?.slug || !/^[a-z0-9]+$/.test(body.slug)) {
      throw new BadRequestException('slug requis (minuscules/chiffres).');
    }
    if (!body?.name) throw new BadRequestException('name requis.');
    // Le statut n'est plus déduit du libellé du plan : tout tenant naît en ESSAI, et
    // c'est l'abonnement qui pilotera `tenants.status` ensuite (spec §5.2).
    return this.saas.provision(req.user, {
      slug: body.slug, name: body.name, city: body.city,
      planCode: body.planCode, status: 'ESSAI',
      adminEmail: body.adminEmail, adminName: body.adminName,
    });
  }
}
