import { Injectable } from '@nestjs/common';
import type { Order } from '@transpo/domain';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { desc } from 'drizzle-orm';

@Injectable()
export class OrdersService {
  /** Liste les commandes du tenant courant (schéma isolé via search_path). */
  list(schema: string): Promise<Order[]> {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable).orderBy(desc(ordersTable.createdAt));
      // createdAt est une Date côté Drizzle ; on la normalise en ISO pour le contrat Order.
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) as Order[];
    });
  }
}
