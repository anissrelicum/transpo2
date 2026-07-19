import { Module } from '@nestjs/common';
import { FieldDriverController } from './field-driver.controller.js';
import { FieldOpsController } from './field-ops.controller.js';
import { FieldService } from './field.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [FieldDriverController, FieldOpsController],
  providers: [FieldService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class FieldModule {}
