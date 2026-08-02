import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';

@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService, JwtAuthGuard, TenantGuard],
})
export class ReviewsModule {}
