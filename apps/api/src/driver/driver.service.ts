import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable, idempotencyKeys } from '@transpo/db';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { LIFECYCLE, type Order, type OrderStatus } from '@transpo/domain';

const ACTIVE: OrderStatus[] = ['ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];
function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}

@Injectable()
export class DriverService {
  private ensure(driver?: string): string {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    return driver;
  }

  /**
   * Enveloppe idempotente : si une clé (Idempotency-Key) a déjà été traitée,
   * renvoie la réponse mémorisée sans ré-appliquer l'effet. Cf. transpo-offline-sync.
   */
  private async idempotent<T>(schema: string, key: string | undefined, fn: () => Promise<T>): Promise<T> {
    if (!key) return fn();
    const cached = await withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
      return r?.response as T | undefined;
    });
    if (cached !== undefined) return cached;
    const result = await fn();
    await withTenantDb(schema, async (db) => {
      await db.insert(idempotencyKeys).values({ key, response: result as unknown as object })
        .onConflictDoNothing();
    });
    return result;
  }

  /** Missions du livreur : ses commandes actives, plus anciennes d'abord. */
  missions(schema: string, driver?: string): Promise<Order[]> {
    const d = this.ensure(driver);
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.driver, d), inArray(ordersTable.status, ACTIVE)))
        .orderBy(desc(ordersTable.createdAt));
      return rows.map(rowToOrder);
    });
  }

  private async ownedOrder(schema: string, driver: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException('Commande introuvable.');
      if (o.driver !== driver) throw new ForbiddenException('Commande non assignée à ce livreur.');
      return o;
    });
  }

  /** Avance au statut suivant du cycle (borne LIVRAISON : la livraison se fait via /proof). */
  async advance(schema: string, driver: string | undefined, ref: string, key?: string) {
    const d = this.ensure(driver);
    return this.idempotent(schema, key, async () => {
      const cur = await this.ownedOrder(schema, d, ref);
      const i = LIFECYCLE.indexOf(cur.status as OrderStatus);
      if (i < 0 || LIFECYCLE[i + 1] === 'LIVREE' || i >= LIFECYCLE.length - 1) {
        throw new BadRequestException('Progression impossible (livraison via preuve).');
      }
      const next = LIFECYCLE[i + 1];
      return withTenantDb(schema, async (db) => {
        const [r] = await db.update(ordersTable).set({ status: next }).where(eq(ordersTable.ref, ref)).returning();
        return rowToOrder(r);
      });
    });
  }

  /** Preuve de livraison + encaissement COD → LIVREE. Idempotent. */
  async proof(schema: string, driver: string | undefined, ref: string, body: { codCollected?: number }, key?: string) {
    const d = this.ensure(driver);
    return this.idempotent(schema, key, async () => {
      const cur = await this.ownedOrder(schema, d, ref);
      if (cur.status !== 'LIVRAISON') throw new BadRequestException('Preuve possible en cours de livraison uniquement.');
      const codPaid = cur.cod > 0 ? (body?.codCollected ?? 0) >= cur.cod : false;
      return withTenantDb(schema, async (db) => {
        const [r] = await db.update(ordersTable)
          .set({ status: 'LIVREE', codPaid })
          .where(eq(ordersTable.ref, ref)).returning();
        return rowToOrder(r);
      });
    });
  }
}
