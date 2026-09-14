import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { withTenantDb, incidents, supportMessages, orders as ordersTable,
  drivers as driversTable, vehicles as vehiclesTable, zones as zonesTable } from '@transpo/db';
import { and, asc, desc, eq } from 'drizzle-orm';
import { DRIVER_DELIVERY_FEE, INCIDENT_TYPES, type IncidentType } from '@transpo/domain';

@Injectable()
export class FieldService {
  private ensure(driver?: string): string {
    if (!driver) throw new ForbiddenException('Compte non rattaché à un livreur.');
    return driver;
  }

  /* ---- Fiche du livreur ---- */

  /**
   * La fiche que l'exploitation tient sur le livreur, rendue au livreur lui-même.
   *
   * L'app affichait jusqu'ici un véhicule, un permis et une zone INVENTÉS (« Moto ·
   * 7890-B-12 ») : un livreur y lisait des informations qui n'étaient pas les siennes,
   * sur l'écran même censé les porter — et la seule fiche qui fasse foi, celle du parc,
   * n'avait aucun chemin vers son téléphone.
   */
  async me(schema: string, driver?: string) {
    const d = this.ensure(driver);
    return withTenantDb(schema, async (db) => {
      const [fiche] = await db.select().from(driversTable).where(eq(driversTable.name, d));
      if (!fiche) throw new NotFoundException('Fiche chauffeur introuvable.');
      const [vehicule] = fiche.vehicleId
        ? await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, fiche.vehicleId))
        : [];
      const toutes = await db.select().from(zonesTable);
      const sienne = toutes.find((z) => (z.drivers ?? []).includes(d));
      return {
        name: fiche.name,
        city: fiche.city,
        available: fiche.available,
        phone: fiche.phone,
        vehicle: fiche.vehicle,
        plate: vehicule?.plate ?? null,
        licenseNo: fiche.licenseNo,
        licenseDue: fiche.licenseDue,
        medicalDue: fiche.medicalDue,
        zone: sienne?.nameFr ?? null,
      };
    });
  }

  /**
   * Le livreur déclare sa disponibilité depuis son téléphone.
   *
   * Elle ne vivait que dans l'état local de l'écran : un livreur pouvait se déclarer
   * indisponible et continuer de recevoir des missions, le dispatch n'en sachant rien
   * (le score d'affectation lit `drivers.available`). L'interrupteur mentait au seul
   * qui pouvait s'y fier.
   */
  async setAvailability(schema: string, driver: string | undefined, available: boolean) {
    const d = this.ensure(driver);
    if (typeof available !== 'boolean') throw new BadRequestException('Disponibilité attendue (booléen).');
    return withTenantDb(schema, async (db) => {
      const [maj] = await db.update(driversTable).set({ available })
        .where(eq(driversTable.name, d)).returning();
      if (!maj) throw new NotFoundException('Fiche chauffeur introuvable.');
      return { name: maj.name, available: maj.available };
    });
  }

  /* ---- Incidents ---- */
  async reportIncident(schema: string, driver: string | undefined, body: { ref?: string; type: string; note?: string }) {
    const d = this.ensure(driver);
    if (!INCIDENT_TYPES.includes(body?.type as IncidentType)) throw new BadRequestException('Type d’incident invalide.');
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(incidents)
        .values({ driver: d, ref: body.ref ?? null, type: body.type, note: body.note ?? null })
        .returning();
      return r;
    });
  }

  myIncidents(schema: string, driver?: string) {
    const d = this.ensure(driver);
    return withTenantDb(schema, async (db) =>
      db.select().from(incidents).where(eq(incidents.driver, d)).orderBy(desc(incidents.createdAt)));
  }

  listIncidents(schema: string, status?: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(incidents).orderBy(desc(incidents.createdAt));
      return status ? rows.filter((i) => i.status === status) : rows;
    });
  }

  async resolveIncident(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [i] = await db.select().from(incidents).where(eq(incidents.id, id));
      if (!i) throw new NotFoundException('Incident introuvable.');
      const [r] = await db.update(incidents).set({ status: 'TRAITE' }).where(eq(incidents.id, id)).returning();
      return r;
    });
  }

  /* ---- Support (chat livreur ↔ ops) ---- */
  private async post(schema: string, driver: string, sender: 'driver' | 'ops', body: string) {
    if (!body?.trim()) throw new BadRequestException('Message vide.');
    return withTenantDb(schema, async (db) => {
      const [r] = await db.insert(supportMessages).values({ driver, sender, body }).returning();
      return r;
    });
  }
  driverMessage(schema: string, driver: string | undefined, body: string) {
    return this.post(schema, this.ensure(driver), 'driver', body);
  }
  opsReply(schema: string, driver: string, body: string) {
    return this.post(schema, driver, 'ops', body);
  }
  thread(schema: string, driver: string) {
    return withTenantDb(schema, async (db) =>
      db.select().from(supportMessages).where(eq(supportMessages.driver, driver)).orderBy(asc(supportMessages.createdAt)));
  }

  /* ---- Historique & gains ---- */
  async history(schema: string, driver?: string) {
    const d = this.ensure(driver);
    return withTenantDb(schema, async (db) => {
      const delivered = await db.select().from(ordersTable)
        .where(and(eq(ordersTable.driver, d), eq(ordersTable.status, 'LIVREE')))
        .orderBy(desc(ordersTable.createdAt));
      const codCollected = delivered.filter((o) => o.codPaid).reduce((s, o) => s + o.cod, 0);
      return {
        driver: d,
        deliveries: delivered.length,
        gains: delivered.length * DRIVER_DELIVERY_FEE,
        feePerDelivery: DRIVER_DELIVERY_FEE,
        codCollected,
        orders: delivered.map((o) => ({ ref: o.ref, toCity: o.toCity, cod: o.cod, codPaid: o.codPaid })),
      };
    });
  }
}
