import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { DemoService, type DemandeEntrante } from './demo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

/** Dépôt public depuis le site vitrine : AUCUN guard, c'est le principe. */
@Controller('v1/public/demo-request')
export class PublicDemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}

  @Post()
  @HttpCode(200)
  deposer(@Body() body: DemandeEntrante) {
    return this.demo.deposer(body ?? {});
  }
}

/** Lecture et suivi : réservés au realm super-admin plateforme. */
@Controller('v1/saas/demo-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class SaasDemoController {
  constructor(@Inject(DemoService) private readonly demo: DemoService) {}

  @Get()
  lister(@Query('statut') statut?: string) {
    return this.demo.lister(statut);
  }

  @Patch(':id')
  suivre(@Param('id') id: string, @Body() body: { statut: string; note?: string }) {
    return this.demo.suivre(id, body?.statut, body?.note);
  }
}
