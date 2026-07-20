import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { Order } from '@transpo/domain';

const PHASES = ['arrive', 'trier', 'quai'] as const;
type Phase = (typeof PHASES)[number];

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

@Injectable()
export class HubService {
  /** Colis présents dans le hub (hub_phase renseignée). */
  list(schema: string): Promise<Order[]> {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable).where(isNotNull(ordersTable.hubPhase));
      return rows.map(rowToOrder);
    });
  }

  /** Scan d'entrée : code colis → phase 'trier'. */
  async scan(schema: string, code: string): Promise<Order> {
    if (!code || code.length !== 8) throw new BadRequestException('Code colis invalide (8 caractères).');
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.code, code.toUpperCase()));
      if (!o) throw new NotFoundException('Code inconnu sur ce hub.');
      const [r] = await db.update(ordersTable).set({ hubPhase: 'trier' }).where(eq(ordersTable.code, code.toUpperCase())).returning();
      return rowToOrder(r);
    });
  }

  /** Déplace un colis vers une phase (arrive → trier → quai). */
  async setPhase(schema: string, ref: string, phase: string): Promise<Order> {
    if (!PHASES.includes(phase as Phase)) throw new BadRequestException(`Phase invalide : ${phase}`);
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      const [r] = await db.update(ordersTable).set({ hubPhase: phase }).where(eq(ordersTable.ref, ref)).returning();
      return rowToOrder(r);
    });
  }
}
