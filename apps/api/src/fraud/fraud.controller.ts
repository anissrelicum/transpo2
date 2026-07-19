import { Controller, Get, Post, Param, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import { FraudService } from './fraud.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/fraud')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('ADMIN') // arbitrage fraude réservé à l'admin
export class FraudController {
  constructor(@Inject(FraudService) private readonly fraud: FraudService) {}

  @Get('cases')
  list(@Req() req: any) { return this.fraud.list(req.tenantSchema); }

  @Get('leaderboard')
  leaderboard(@Req() req: any) { return this.fraud.leaderboard(req.tenantSchema); }

  @Post('cases/:id/:action')
  @HttpCode(200)
  act(@Req() req: any, @Param('id') id: string, @Param('action') action: string) {
    return this.fraud.act(req.tenantSchema, req.tenantSlug, req.user, id, action);
  }
}
