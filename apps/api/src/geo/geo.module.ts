import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller.js';
import { GeoService } from './geo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

@Module({
  controllers: [GeoController],
  providers: [GeoService, JwtAuthGuard],
})
export class GeoModule {}
