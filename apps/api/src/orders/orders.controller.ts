import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import type { OrderStatus } from '@transpo/domain';
import { OrdersService, type CreateOrderInput } from './orders.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';

@Controller('v1/orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get()
  list(@Req() req: any, @Query('status') status?: OrderStatus) {
    return this.orders.list(req.tenantSchema, status);
  }

  @Get(':ref')
  get(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.get(req.tenantSchema, ref);
  }

  @Post()
  @Roles('ADMIN', 'DISPATCHER', 'MERCHANT')
  create(@Req() req: any, @Body() body: CreateOrderInput) {
    return this.orders.create(req.tenantSchema, body);
  }

  @Post(':ref/advance')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  advance(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.advance(req.tenantSchema, ref);
  }

  @Post(':ref/assign')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  assign(@Req() req: any, @Param('ref') ref: string, @Body() body: { driver?: string }) {
    return this.orders.assign(req.tenantSchema, ref, body?.driver ?? '');
  }

  @Post(':ref/cancel')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  cancel(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.cancel(req.tenantSchema, ref);
  }
}
