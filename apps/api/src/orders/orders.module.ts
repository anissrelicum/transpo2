import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { DispatchModule } from '../dispatch/dispatch.module.js';

@Module({
  imports: [NotificationsModule, BillingModule, DispatchModule],
  controllers: [OrdersController],
  providers: [OrdersService, TenantGuard, JwtAuthGuard, RolesGuard],
})
export class OrdersModule {}
