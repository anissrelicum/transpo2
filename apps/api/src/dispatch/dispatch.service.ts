import { Injectable, BadRequestException } from '@nestjs/common';
import { withTenantDb, zones as zonesTable, drivers as driversTable, orders as ordersTable } from '@transpo/db';
import { eq } from 'drizzle-orm';

export interface Suggestion {
  driver: string; city: string; vehicle: string;
  score: number; parts: { zone: number; dispo: number; charge: number };
}

@Injectable()
export class DispatchService {
  listZones(schema: string) {
    return withTenantDb(schema, async (db) => db.select().from(zonesTable).orderBy(zonesTable.nameFr));
  }

  createZone(schema: string, input: { nameFr: string; nameAr?: string; color?: string; commune?: string; region?: string; province?: string; centerLat?: number; centerLng?: number; polygon?: number[][] }) {
    if (!input?.nameFr) throw new BadRequestException('nameFr requis.');
    return withTenantDb(schema, async (db) => {
      const [z] = await db.insert(zonesTable).values({
        nameFr: input.nameFr, nameAr: input.nameAr ?? null,
        color: input.color ?? 'indigo', commune: input.commune ?? null, drivers: [],
        centerLat: input.centerLat ?? null, centerLng: input.centerLng ?? null,
        region: input.region ?? null, province: input.province ?? null,
        polygon: input.polygon ?? null,
      }).returning();
      return z;
    });
  }

  /** Mise à jour d'une zone (nom, couleur, commune/région/province, livreurs, polygone). */
  async updateZone(schema: string, id: string, patch: Record<string, unknown>) {
    const set: Record<string, unknown> = {};
    for (const k of ['nameFr', 'nameAr', 'color', 'commune', 'region', 'province', 'drivers', 'centerLat', 'centerLng', 'polygon'] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    if (Object.keys(set).length === 0) throw new BadRequestException('Aucun champ à mettre à jour.');
    return withTenantDb(schema, async (db) => {
      const [z] = await db.update(zonesTable).set(set).where(eq(zonesTable.id, id)).returning();
      if (!z) throw new BadRequestException('Zone introuvable.');
      return z;
    });
  }

  /** Suppression d'une zone. */
  async deleteZone(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [z] = await db.delete(zonesTable).where(eq(zonesTable.id, id)).returning();
      if (!z) throw new BadRequestException('Zone introuvable.');
      return { deleted: id };
    });
  }

  /**
   * Suggestion de livreurs pour une commande (score /100) : zone (40) + dispo (30) + faible charge (30).
   * Heuristique alignée sur la maquette (PRD Dispatch). Les livreurs indisponibles sont exclus.
   */
  suggest(schema: string, ref: string): Promise<{ order: string; suggestions: Suggestion[] }> {
    return withTenantDb(schema, async (db) => {
      const [order] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!order) throw new BadRequestException(`Commande introuvable : ${ref}`);
      const allDrivers = await db.select().from(driversTable);
      const activeOrders = await db.select().from(ordersTable);

      const suggestions = allDrivers
        .filter((d) => d.available)
        .map((d) => {
          const sameCity = d.city === order.fromCity || d.city === order.toCity;
          const load = activeOrders.filter((o) => o.driver === d.name && !['LIVREE', 'ANNULEE'].includes(o.status)).length;
          const zone = sameCity ? 40 : 15;
          const dispo = 30;
          const charge = Math.max(0, 30 - load * 10);
          return {
            driver: d.name, city: d.city ?? '', vehicle: d.vehicle ?? '',
            score: zone + dispo + charge, parts: { zone, dispo, charge },
          };
        })
        .sort((a, b) => b.score - a.score);

      return { order: ref, suggestions };
    });
  }
}
