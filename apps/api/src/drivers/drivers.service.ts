import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import {
  withTenantDb,
  drivers as driversTable,
  vehicles as vehiclesTable,
  orders as ordersTable,
} from '@transpo/db';
import { eq } from 'drizzle-orm';

const OPEN_STATUSES = ['NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];
const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

type DriverRow = typeof driversTable.$inferSelect;
type VehicleRow = typeof vehiclesTable.$inferSelect;
type OrderRow = typeof ordersTable.$inferSelect;

/**
 * Enrichit un chauffeur : conformité (permis, visite médicale), véhicule rattaché
 * et performance dérivée des commandes. `assignable` est la règle métier utilisée
 * par le dispatch : un permis ou une visite expirés interdisent l'affectation.
 */
function enrich(d: DriverRow, vehicles: VehicleRow[], orders: OrderRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  const licenseExpired = d.licenseDue != null && d.licenseDue < today;
  const medicalExpired = d.medicalDue != null && d.medicalDue < today;

  const linked = d.vehicleId ? vehicles.find((v) => v.id === d.vehicleId) ?? null : null;
  const mine = orders.filter((o) => o.driver === d.name);
  const delivered = mine.filter((o) => o.status === 'LIVREE').length;
  const failed = mine.filter((o) => o.status === 'ECHOUEE' || o.status === 'RETOUR').length;
  const active = mine.filter((o) => OPEN_STATUSES.includes(o.status)).length;
  const closed = delivered + failed;

  return {
    ...d,
    licenseExpired,
    medicalExpired,
    assignable: d.available && !licenseExpired && !medicalExpired,
    vehiclePlate: linked?.plate ?? null,
    vehicleState: linked?.state ?? null,
    stats: {
      delivered,
      failed,
      active,
      successRate: closed ? Math.round((delivered / closed) * 100) : null,
    },
  };
}

@Injectable()
export class DriversService {
  list(schema: string) {
    return withTenantDb(schema, async (db) => {
      const [rows, vehicles, orders] = await Promise.all([
        db.select().from(driversTable).orderBy(driversTable.name),
        db.select().from(vehiclesTable),
        db.select().from(ordersTable),
      ]);
      return rows.map((d) => enrich(d, vehicles, orders));
    });
  }

  create(schema: string, input: {
    name?: string; city?: string; vehicle?: string; phone?: string;
    licenseNo?: string; licenseDue?: string; medicalDue?: string; available?: boolean;
  }) {
    const name = input?.name?.trim();
    if (!name) throw new BadRequestException('Nom requis.');
    if (input.phone && !PHONE_RE.test(input.phone.trim())) {
      throw new BadRequestException('Téléphone invalide.');
    }
    return withTenantDb(schema, async (db) => {
      const existing = await db.select().from(driversTable).where(eq(driversTable.name, name));
      // Les commandes référencent le chauffeur par son nom : il doit rester unique.
      if (existing.length) throw new BadRequestException('Un chauffeur porte déjà ce nom.');
      const [d] = await db.insert(driversTable).values({
        name,
        city: input.city ?? null,
        vehicle: input.vehicle ?? null,
        phone: input.phone?.trim() ?? null,
        licenseNo: input.licenseNo?.trim() ?? null,
        licenseDue: input.licenseDue ?? null,
        medicalDue: input.medicalDue ?? null,
        available: input.available ?? true,
      }).returning();
      return enrich(d, [], []);
    });
  }

  setAvailability(schema: string, id: string, available: boolean) {
    if (typeof available !== 'boolean') throw new BadRequestException('Disponibilité invalide.');
    return withTenantDb(schema, async (db) => {
      const [d] = await db.update(driversTable).set({ available }).where(eq(driversTable.id, id)).returning();
      if (!d) throw new NotFoundException('Chauffeur introuvable.');
      const orders = await db.select().from(ordersTable);
      return enrich(d, [], orders);
    });
  }

  /** Renouvelle une échéance de conformité (permis ou visite médicale). */
  renew(schema: string, id: string, field: 'license' | 'medical', due: string) {
    if (!due) throw new BadRequestException('Date requise.');
    if (field !== 'license' && field !== 'medical') throw new BadRequestException('Champ invalide.');
    const patch = field === 'license' ? { licenseDue: due } : { medicalDue: due };
    return withTenantDb(schema, async (db) => {
      const [d] = await db.update(driversTable).set(patch).where(eq(driversTable.id, id)).returning();
      if (!d) throw new NotFoundException('Chauffeur introuvable.');
      return enrich(d, [], []);
    });
  }

  /**
   * Rattache un véhicule du parc au chauffeur. Le libellé `vehicle` est synchronisé
   * sur le type du véhicule pour que le scoring dispatch reste cohérent.
   */
  assignVehicle(schema: string, id: string, vehicleId: string | null) {
    return withTenantDb(schema, async (db) => {
      let vehicle: VehicleRow | null = null;
      if (vehicleId) {
        const [v] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, vehicleId));
        if (!v) throw new NotFoundException('Véhicule introuvable.');
        if (v.state !== 'ACTIF') throw new BadRequestException('Véhicule non actif : rattachement impossible.');
        vehicle = v;
      }
      const [d] = await db.update(driversTable)
        .set({ vehicleId: vehicle?.id ?? null, vehicle: vehicle?.type ?? null })
        .where(eq(driversTable.id, id))
        .returning();
      if (!d) throw new NotFoundException('Chauffeur introuvable.');
      return enrich(d, vehicle ? [vehicle] : [], []);
    });
  }

  remove(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [target] = await db.select().from(driversTable).where(eq(driversTable.id, id));
      if (!target) throw new NotFoundException('Chauffeur introuvable.');
      const orders = await db.select().from(ordersTable);
      const open = orders.filter((o) => o.driver === target.name && OPEN_STATUSES.includes(o.status)).length;
      if (open > 0) {
        throw new BadRequestException(`Impossible : ${open} commande(s) en cours sur ce chauffeur.`);
      }
      await db.delete(driversTable).where(eq(driversTable.id, id));
      return { ok: true, id };
    });
  }
}
