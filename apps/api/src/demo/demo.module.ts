import { Module } from '@nestjs/common';
import { PublicDemoController, SaasDemoController } from './demo.controller.js';
import { DemoService } from './demo.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Module({
  controllers: [PublicDemoController, SaasDemoController],
  providers: [DemoService, JwtAuthGuard, RolesGuard],
})
export class DemoModule {}
