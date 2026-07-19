import { Controller, Get, Req, UseGuards, Inject } from '@nestjs/common';
import { MerchantService } from './merchant.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/merchant')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('MERCHANT') // portail réservé au marchand ; scope = son claim `merchant`
export class MerchantController {
  constructor(@Inject(MerchantService) private readonly merchant: MerchantService) {}

  @Get('orders')
  orders(@Req() req: any) { return this.merchant.orders(req.tenantSchema, req.user?.merchant); }

  @Get('dashboard')
  dashboard(@Req() req: any) { return this.merchant.dashboard(req.tenantSchema, req.user?.merchant); }

  @Get('wallet')
  wallet(@Req() req: any) { return this.merchant.wallet(req.tenantSchema, req.user?.merchant); }

  @Get('invoice')
  invoice(@Req() req: any) { return this.merchant.invoice(req.tenantSchema, req.user?.merchant); }
}
