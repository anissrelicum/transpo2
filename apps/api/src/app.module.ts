import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module.js';
import { HealthController } from './health.controller.js';

// Le scoping par tenant est assuré par TenantGuard (appliqué sur les contrôleurs /v1),
// pas par un middleware — pour que les erreurs passent par le filtre d'exceptions Nest.
@Module({
  imports: [OrdersModule],
  controllers: [HealthController],
})
export class AppModule {}
