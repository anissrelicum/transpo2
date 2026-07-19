import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';

@Controller('v1/orders')
@UseGuards(JwtAuthGuard, TenantGuard) // JWT requis, puis tenant dérivé du claim
export class OrdersController {
  // @Inject explicite : l'injection par type ne marche pas sous tsx/esbuild
  // (pas de métadonnée de décorateur émise).
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any) {
    // req.tenantSchema est posé par le TenantGuard (dérivé du serveur).
    return this.orders.list(req.tenantSchema);
  }
}
