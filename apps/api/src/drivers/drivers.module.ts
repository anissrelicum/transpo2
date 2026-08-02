import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller.js';
import { DriversService } from './drivers.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [DriversController],
  providers: [DriversService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class DriversModule {}
