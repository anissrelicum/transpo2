import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Module({
  controllers: [OrdersController],
  providers: [OrdersService, TenantGuard, JwtAuthGuard],
})
export class OrdersModule {}
