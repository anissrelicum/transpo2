import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module.js';
import { HealthController } from './health.controller.js';
import { TenantMiddleware } from './tenant/tenant.middleware.js';

@Module({
  imports: [OrdersModule],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Toutes les routes /v1/* sont scoping-ées à un tenant ; /health ne l'est pas.
    consumer.apply(TenantMiddleware).forRoutes('v1/(.*)');
  }
}
