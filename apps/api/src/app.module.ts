import { Module } from '@nestjs/common';
import { OrdersModule } from './orders/orders.module.js';
import { AuthModule } from './auth/auth.module.js';
import { SaasModule } from './saas/saas.module.js';
import { DispatchModule } from './dispatch/dispatch.module.js';
import { FleetModule } from './fleet/fleet.module.js';
import { CashModule } from './cash/cash.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ReturnsModule } from './returns/returns.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { FraudModule } from './fraud/fraud.module.js';
import { MerchantModule } from './merchant/merchant.module.js';
import { PublicModule } from './public/public.module.js';
import { TourneesModule } from './tournees/tournees.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrivacyModule } from './privacy/privacy.module.js';
import { DriverModule } from './driver/driver.module.js';
import { GeoModule } from './geo/geo.module.js';
import { HubModule } from './hub/hub.module.js';
import { TrackingModule } from './tracking/tracking.module.js';
import { FieldModule } from './field/field.module.js';
import { UsersModule } from './users/users.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { HealthController } from './health.controller.js';

// Scoping par tenant via TenantGuard ; auth JWT + RBAC via guards (transpo-auth-security).
@Module({
  imports: [
    AuthModule, OrdersModule, SaasModule, DispatchModule, FleetModule,
    CashModule, BillingModule, ReturnsModule, AnalyticsModule, FraudModule, MerchantModule,
    PublicModule, TourneesModule, NotificationsModule, PrivacyModule, DriverModule,
    TrackingModule, FieldModule, GeoModule, HubModule, UsersModule, SettingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
