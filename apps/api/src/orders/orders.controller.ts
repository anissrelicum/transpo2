import { Controller, Get, Post, Body, Param, Query, Req, UseGuards, Inject, HttpCode } from '@nestjs/common';
import type { OrderStatus } from '@transpo/domain';
import { OrdersService, type CreateOrderInput } from './orders.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { TenantGuard } from '../tenant/tenant.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles, CONSOLE_ROLES } from '../auth/roles.decorator.js';

@Controller('v1/orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles(...CONSOLE_ROLES)
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

  /** Preuve de livraison capturée par le livreur (photo / signature). */
  @Get(':ref/proof')
  proof(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.proof(req.tenantSchema, ref);
  }

  /** Journal horodaté des transitions — ce que l'onglet Historique de la fiche affiche. */
  @Get(':ref/events')
  events(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.events(req.tenantSchema, ref);
  }

  /**
   * Création d'une commande.
   * Un compte MERCHANT ne choisit pas le marchand : il est celui de son compte. Sans cette
   * contrainte, un marchand pouvait déposer des commandes au nom d'un concurrent du même
   * tenant — et les retrouver dans SA facturation.
   */
  @Post()
  @Roles('ADMIN', 'DISPATCHER', 'MERCHANT')
  create(@Req() req: any, @Body() body: CreateOrderInput) {
    const input = req.user?.role === 'MERCHANT'
      ? { ...body, merchant: req.user?.merchant ?? body.merchant }
      : body;
    return this.orders.create(req.tenantSchema, input, req.user?.sub);
  }

  @Post(':ref/advance')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  advance(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.advance(req.tenantSchema, ref, req.user?.sub);
  }

  @Post(':ref/assign')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  assign(@Req() req: any, @Param('ref') ref: string, @Body() body: { driver?: string }) {
    return this.orders.assign(req.tenantSchema, ref, body?.driver ?? '', req.user?.sub);
  }

  @Post(':ref/cancel')
  @HttpCode(200)
  @Roles('ADMIN', 'DISPATCHER')
  cancel(@Req() req: any, @Param('ref') ref: string) {
    return this.orders.cancel(req.tenantSchema, ref, req.user?.sub);
  }
}
