import { Controller, Get, Post, Param, Body, Inject, HttpCode } from '@nestjs/common';
import { PublicService } from './public.service.js';

// Aucun guard : suivi public du client final. Tenant = segment d'URL du lien de suivi.
@Controller('v1/public/track')
export class PublicController {
  constructor(@Inject(PublicService) private readonly svc: PublicService) {}

  @Get(':slug/:code')
  track(@Param('slug') slug: string, @Param('code') code: string) {
    return this.svc.track(slug, code);
  }

  @Post(':slug/:code/rate')
  @HttpCode(200)
  rate(
    @Param('slug') slug: string,
    @Param('code') code: string,
    @Body() body: { score: number; comment?: string },
  ) {
    return this.svc.rate(slug, code, Number(body?.score), body?.comment);
  }
}
