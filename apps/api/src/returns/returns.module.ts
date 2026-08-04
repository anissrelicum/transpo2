import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller.js';
import { ReturnsService } from './returns.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, JwtAuthGuard, TenantGuard, RolesGuard],
  // Exporté pour l'app livreur : un échec constaté sur le terrain doit suivre
  // exactement le même chemin qu'un échec saisi par l'exploitation.
  exports: [ReturnsService],
})
export class ReturnsModule {}
