import { Controller, Get, Query, UseGuards, Inject } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

// Observabilité sécurité : journal d'audit, réservé au super-admin plateforme.
@Controller('v1/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  recent(@Query('tenant') tenant?: string, @Query('action') action?: string, @Query('limit') limit?: string) {
    return this.audit.recent({ tenant, action, limit: limit ? Number(limit) : undefined });
  }
}
