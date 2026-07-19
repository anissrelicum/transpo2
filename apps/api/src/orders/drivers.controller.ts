import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';

@Controller('v1/drivers')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DriversController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any) {
    return this.orders.listDrivers(req.tenantSchema);
  }
}
