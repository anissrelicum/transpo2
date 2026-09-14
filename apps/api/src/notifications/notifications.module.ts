import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, JwtAuthGuard, TenantGuard, RolesGuard],
  // Les événements de course notifient le client : le service sort du module.
  exports: [NotificationsService],
})
export class NotificationsModule {}
