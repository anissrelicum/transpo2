import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { withTenantDb, incidents, supportMessages, orders as ordersTable,
  drivers as driversTable, vehicles as vehiclesTable, zones as zonesTable,
  tournees as tourneesTable, cashSessions, cashMovements } from '@transpo/db';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { DRIVER_DELIVERY_FEE, INCIDENT_TYPES, type IncidentType } from '@transpo/domain';

/**
 * Caisse du jour d'un livreur : l'OUVERTE d'abord, sinon la dernière déposée.
 *
 * Un dépôt clôt la session, et l'encaissement suivant en rouvre une portant la même date :
 * il peut donc y avoir plusieurs sessions par livreur et par jour. Les lectures qui se
 * contentaient de (livreur, date) en prenaient une au hasard — le livreur voyait tantôt sa
 * caisse courante, tantôt celle qu'il avait déposée, et sa déclaration pouvait être refusée
 * pour « caisse déjà déposée » alors qu'une caisse ouverte l'attendait (constaté TC-G07).
 */
async function sessionDuJour(db: any, driver: string, jour: string) {
  const [ouverte] = await db.select().from(cashSessions)
    .where(and(
      eq(cashSessions.driver, driver),
      eq(cashSessions.sessionDate, jour),
      ne(cashSessions.status, 'DEPOSE'),
    ))
    .orderBy(desc(cashSessions.createdAt));
  if (ouverte) return ouverte;
  const [derniere] = await db.select().from(cashSessions)
    .where(and(eq(cashSessions.driver, driver), eq(cashSessions.sessionDate, jour)))
    .orderBy(desc(cashSessions.createdAt));
  return derniere ?? null;
}

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

  /**
   * Tournée du jour du livreur, arrêts DANS L'ORDRE défini par l'exploitation.
   *
   * Le dispatch planifie une tournée, l'optimise, la réordonne (section I) — et rien de
   * tout cela n'atteignait le livreur : son écran « Ma tournée » retriait ses missions
   * par une heuristique locale sur des positions fictives. Deux ordres coexistaient, dont
   * un seul est décidé par l'exploitation, et ce n'était pas celui que le livreur suivait.
   */
  async myTour(schema: string, driver: string | undefined, day?: string) {
    const d = this.ensure(driver);
    const jour = day ?? new Date().toISOString().slice(0, 10);
    return withTenantDb(schema, async (db) => {
      const toutes = await db.select().from(tourneesTable).where(eq(tourneesTable.driver, d));
      // La tournée du jour, la plus récente si l'exploitation en a planifié plusieurs.
      const sienne = toutes
        .filter((t) => t.day === jour && t.status !== 'CLOTUREE')
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      if (!sienne) return null;
      const orders = sienne.stops.length
        ? await db.select().from(ordersTable).where(inArray(ordersTable.ref, sienne.stops))
        : [];
      const parRef = new Map(orders.map((o) => [o.ref, o]));
      return {
        id: sienne.id, day: sienne.day, status: sienne.status, zone: sienne.zone,
        stops: sienne.stops.map((ref) => parRef.get(ref)).filter(Boolean),
      };
    });
  }

  /* ---- Caisse du livreur ---- */

  /** Session de caisse du jour, vue par le livreur : ce qu'il doit avoir en poche. */
  async myCash(schema: string, driver?: string) {
    const d = this.ensure(driver);
    const jour = new Date().toISOString().slice(0, 10);
    return withTenantDb(schema, async (db) => {
      // Un dépôt ferme la caisse ; l'encaissement suivant en rouvre une, à la même date.
      // Prendre « la » session du jour sans distinguer montrait au livreur, au hasard, la
      // caisse déjà déposée plutôt que l'argent qu'il a réellement en poche.
      const s = await sessionDuJour(db, d, jour);
      if (!s) return null;
      const moves = await db.select().from(cashMovements).where(eq(cashMovements.sessionId, s.id));
      return {
        id: s.id, date: s.sessionDate, theorique: s.theorique, deliveries: s.deliveries,
        declared: s.declared, status: s.status, cap: s.cap,
        ecart: s.declared == null ? null : s.theorique - s.declared,
        moves: moves.map((m) => ({ ref: m.ref, recipient: m.recipient, amount: m.amount })),
      };
    });
  }

  /**
   * Le livreur déclare le cash qu'il a réellement en main, en fin de journée.
   *
   * C'est le chaînon qui manquait à la chaîne du COD : l'argent était encaissé sur le
   * terrain et l'exploitation n'en voyait que le THÉORIQUE, calculé pour lui. Sans
   * déclaration, ni dépôt ni écart n'avaient de sens — la console de caisse ne pouvait
   * rapprocher que deux chiffres qu'elle avait elle-même produits.
   */
  async declareCash(schema: string, driver: string | undefined, amount: number) {
    const d = this.ensure(driver);
    if (!Number.isFinite(amount) || amount < 0) throw new BadRequestException('Montant déclaré invalide.');
    const jour = new Date().toISOString().slice(0, 10);
    return withTenantDb(schema, async (db) => {
      const s = await sessionDuJour(db, d, jour);
      if (!s) throw new NotFoundException('Aucune caisse ouverte aujourd’hui.');
      if (s.status === 'DEPOSE') throw new BadRequestException('Caisse déjà déposée — déclaration close.');
      const montant = Math.round(amount);
      const statut = montant === s.theorique ? 'A_DEPOSER' : 'ECART';
      const [r] = await db.update(cashSessions)
        .set({ declared: montant, status: statut })
        .where(eq(cashSessions.id, s.id)).returning();
      return { id: r.id, theorique: r.theorique, declared: r.declared, status: r.status,
               ecart: r.theorique - (r.declared ?? 0) };
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
