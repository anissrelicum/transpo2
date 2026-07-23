import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { AuditModule } from '../audit/audit.module.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  imports: [AuditModule],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard, TenantGuard, RolesGuard],
})
export class UsersModule {}
