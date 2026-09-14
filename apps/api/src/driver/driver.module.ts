import { Module } from '@nestjs/common';
import { DriverController } from './driver.controller.js';
import { DriverService } from './driver.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { ReturnsModule } from '../returns/returns.module.js';
import { FraudModule } from '../fraud/fraud.module.js';
import { TrackingModule } from '../tracking/tracking.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [ReturnsModule, FraudModule, TrackingModule, NotificationsModule],
  controllers: [DriverController],
  providers: [DriverService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class DriverModule {}
