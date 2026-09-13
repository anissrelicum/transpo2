import { Injectable, BadRequestException } from '@nestjs/common';
import { withTenantDb, zones as zonesTable, drivers as driversTable, orders as ordersTable } from '@transpo/db';
import { eq } from 'drizzle-orm';

export interface Suggestion {
  driver: string; city: string; vehicle: string;
  score: number; parts: { zone: number; dispo: number; charge: number };
}

/**
 * Un polygone de zone demande au moins trois sommets, chacun en [latitude, longitude].
 * `null` ou absent reste accepté : une zone peut n'avoir qu'un centre (cercle de démo).
 */
function verifierPolygone(polygon: number[][] | null | undefined): void {
  if (polygon == null) return;
  if (!Array.isArray(polygon) || polygon.length < 3) {
    throw new BadRequestException('Un polygone demande au moins trois sommets.');
  }
  const malForme = polygon.some(
    (p) => !Array.isArray(p) || p.length !== 2 || p.some((n) => typeof n !== 'number' || Number.isNaN(n)),
  );
  if (malForme) throw new BadRequestException('Sommet invalide : attendu [latitude, longitude].');
}

@Injectable()
export class DispatchService {
  listZones(schema: string) {
    return withTenantDb(schema, async (db) => db.select().from(zonesTable).orderBy(zonesTable.nameFr));
  }

  createZone(schema: string, input: { nameFr: string; nameAr?: string; color?: string; commune?: string; region?: string; province?: string; centerLat?: number; centerLng?: number; polygon?: number[][] }) {
    if (!input?.nameFr?.trim()) throw new BadRequestException('Nom de zone requis.');
    verifierPolygone(input.polygon);
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

  /**
   * Mise à jour d'une zone (nom, couleur, commune/région/province, livreurs, polygone).
   *
   * Trois garde-fous, tous constatés en recette (section E) :
   *  · un nom vide rendait la zone anonyme, donc introuvable dans la console ;
   *  · un polygone de moins de trois sommets ne délimite rien, n'est pas rendu sur la carte
   *    et rendrait tout géofencing muet ;
   *  · un livreur inconnu pouvait être affecté, alors que le dispatch affecte PAR NOM :
   *    la zone aurait porté un fantôme que personne ne pourrait jamais joindre.
   */
  async updateZone(schema: string, id: string, patch: Record<string, unknown>) {
    const set: Record<string, unknown> = {};
    for (const k of ['nameFr', 'nameAr', 'color', 'commune', 'region', 'province', 'drivers', 'centerLat', 'centerLng', 'polygon'] as const) {
      if (patch[k] !== undefined) set[k] = patch[k];
    }
    if (Object.keys(set).length === 0) throw new BadRequestException('Aucun champ à mettre à jour.');
    if (set.nameFr !== undefined && !String(set.nameFr).trim()) {
      throw new BadRequestException('Nom de zone requis.');
    }
    if (set.polygon !== undefined) verifierPolygone(set.polygon as number[][] | null);
    return withTenantDb(schema, async (db) => {
      if (set.drivers !== undefined) {
        const demandes = Array.isArray(set.drivers) ? (set.drivers as unknown[]).map(String) : [];
        if (demandes.length) {
          const effectif = await db.select().from(driversTable);
          const noms = new Set(effectif.map((d) => d.name));
          const inconnus = demandes.filter((n) => !noms.has(n));
          if (inconnus.length) {
            throw new BadRequestException(`Livreur inconnu : ${inconnus.join(', ')}.`);
          }
        }
      }
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

      // Un chauffeur au permis ou à la visite médicale expirés n'est pas affectable.
      const today = new Date().toISOString().slice(0, 10);
      const suggestions = allDrivers
        .filter((d) => d.available
          && !(d.licenseDue != null && d.licenseDue < today)
          && !(d.medicalDue != null && d.medicalDue < today))
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
