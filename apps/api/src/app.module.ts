import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SaasModule } from './saas/saas.module.js';
import { HealthController } from './health.controller.js';

// Scoping par tenant via TenantGuard ; auth JWT + RBAC via guards (transpo-auth-security).
@Module({
  imports: [AuthModule, OrdersModule, SaasModule],
  controllers: [HealthController],
})
export class AppModule {}
