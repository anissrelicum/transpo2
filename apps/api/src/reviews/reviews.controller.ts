import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { ReviewsService } from './reviews.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/reviews')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
export class ReviewsController {
  constructor(@Inject(ReviewsService) private readonly reviews: ReviewsService) {}

  @Get()
  list(@Req() req: any) {
    return this.reviews.list(req.tenantSchema);
  }
}
