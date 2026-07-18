import { Controller, Get, Req } from '@nestjs/common';
import { OrdersService } from './orders.service.js';

@Controller('v1/orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any) {
    // req.tenantSchema est posé par le TenantMiddleware (dérivé du serveur).
    return this.orders.list(req.tenantSchema);
  }
}
