import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenantDb, tournees as tourTable, orders as ordersTable } from '@transpo/db';
import { desc, eq, inArray } from 'drizzle-orm';
import type { OrderStatus } from '@transpo/domain';

export interface CreateTourInput {
  driver: string; zone?: string; day: string; stops: string[];
}
const STATUS_FLOW: Record<string, string> = { PLANIFIEE: 'EN_COURS', EN_COURS: 'CLOTUREE' };

@Injectable()
export class TourneesService {
  list(schema: string, filters: { driver?: string; status?: string } = {}) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(tourTable).orderBy(desc(tourTable.createdAt));
      return rows.filter((t) =>
        (!filters.driver || t.driver === filters.driver) &&
        (!filters.status || t.status === filters.status));
    });
  }

  /** Détail avec résolution des commandes de chaque arrêt (dans l'ordre). */
  async get(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [t] = await db.select().from(tourTable).where(eq(tourTable.id, id));
      if (!t) throw new NotFoundException('Tournée introuvable.');
      const orders = t.stops.length
        ? await db.select().from(ordersTable).where(inArray(ordersTable.ref, t.stops))
        : [];
      const byRef = new Map(orders.map((o) => [o.ref, o]));
      return { ...t, orders: t.stops.map((ref) => byRef.get(ref)).filter(Boolean) };
    });
  }

  /** Crée une tournée à partir de commandes existantes et assigne le livreur. */
  async create(schema: string, input: CreateTourInput) {
    if (!input.driver) throw new BadRequestException('Livreur requis.');
    if (!input.day) throw new BadRequestException('Date requise.');
    if (!input.stops?.length) throw new BadRequestException('Au moins une commande requise.');
    const stops = [...new Set(input.stops)];

    return withTenantDb(schema, async (db) => {
      const found = await db.select().from(ordersTable).where(inArray(ordersTable.ref, stops));
      if (found.length !== stops.length) {
        const missing = stops.filter((r) => !found.some((o) => o.ref === r));
        throw new BadRequestException(`Commande(s) introuvable(s) : ${missing.join(', ')}`);
      }
      // Assigne le livreur ; les commandes NOUVELLE/PROGRAMMEE passent ASSIGNEE.
      for (const o of found) {
        const status = (o.status === 'NOUVELLE' || o.status === 'PROGRAMMEE')
          ? 'ASSIGNEE' as OrderStatus : (o.status as OrderStatus);
        await db.update(ordersTable).set({ driver: input.driver, status })
          .where(eq(ordersTable.ref, o.ref));
      }
      const [t] = await db.insert(tourTable).values({
        driver: input.driver, zone: input.zone ?? null, day: input.day, stops,
      }).returning();
      return t;
    });
  }

  /** Réordonne les arrêts (même ensemble de commandes). */
  async reorder(schema: string, id: string, stops: string[]) {
    return withTenantDb(schema, async (db) => {
      const [t] = await db.select().from(tourTable).where(eq(tourTable.id, id));
      if (!t) throw new NotFoundException('Tournée introuvable.');
      const same = stops.length === t.stops.length && [...stops].sort().join() === [...t.stops].sort().join();
      if (!same) throw new BadRequestException('Réordonnancement : le même ensemble d’arrêts est requis.');
      const [r] = await db.update(tourTable).set({ stops }).where(eq(tourTable.id, id)).returning();
      return r;
    });
  }

  /** Avance le statut de la tournée (PLANIFIEE → EN_COURS → CLOTUREE). */
  async advance(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [t] = await db.select().from(tourTable).where(eq(tourTable.id, id));
      if (!t) throw new NotFoundException('Tournée introuvable.');
      const next = STATUS_FLOW[t.status];
      if (!next) throw new BadRequestException('Tournée déjà clôturée.');
      const [r] = await db.update(tourTable).set({ status: next }).where(eq(tourTable.id, id)).returning();
      return r;
    });
  }
}
