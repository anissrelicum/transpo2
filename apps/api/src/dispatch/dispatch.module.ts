import { Module } from '@nestjs/common';
import { DispatchController } from './dispatch.controller.js';
import { DispatchService } from './dispatch.service.js';
import { AutoDispatchService } from './auto-dispatch.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [NotificationsModule],
  controllers: [DispatchController],
  providers: [DispatchService, AutoDispatchService, JwtAuthGuard, TenantGuard, RolesGuard],
  // Les commandes (création, échéance) et l'app livreur (acceptation) déclenchent l'automate.
  exports: [AutoDispatchService],
})
export class DispatchModule {}
