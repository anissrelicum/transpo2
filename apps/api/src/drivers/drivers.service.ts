import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import {
  withTenantDb,
  drivers as driversTable,
  vehicles as vehiclesTable,
  orders as ordersTable,
} from '@transpo/db';
import { eq } from 'drizzle-orm';

const OPEN_STATUSES = ['NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];
// 9 à 15 CHIFFRES, espaces et tirets de présentation ignorés : « +212 6 00 00 00 00 », le
// format montré en exemple dans les formulaires, comptait 18 caractères et était refusé.
const PHONE_RE = { test: (v: string) => /^\+?[0-9\s-]+$/.test(v) && /^\d{9,15}$/.test(v.replace(/[^\d]/g, '')) };

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
      // 409 comme tout doublon de la plateforme (tenants, codes de plan, plaques).
      if (existing.length) throw new ConflictException('Un chauffeur porte déjà ce nom.');
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

  /**
   * Modifie une fiche chauffeur (ville, type de véhicule déclaré, téléphone, n° de permis).
   * Sans cette action, une donnée saisie à la création était définitivement figée — c'est ce
   * qui rendait AN-14 irréparable côté exploitant.
   * Le NOM fait exception : les commandes référencent le chauffeur par son nom, il n'est donc
   * renommable que tant qu'aucune commande ne lui est rattachée.
   */
  update(schema: string, id: string, input: {
    name?: string; city?: string; vehicle?: string; phone?: string; licenseNo?: string;
  }) {
    if (input?.phone && !PHONE_RE.test(input.phone.trim())) {
      throw new BadRequestException('Téléphone invalide.');
    }
    return withTenantDb(schema, async (db) => {
      const [cible] = await db.select().from(driversTable).where(eq(driversTable.id, id));
      if (!cible) throw new NotFoundException('Chauffeur introuvable.');

      const patch: Record<string, unknown> = {};
      if (input.city !== undefined) patch.city = input.city || null;
      if (input.vehicle !== undefined) patch.vehicle = input.vehicle || null;
      if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
      if (input.licenseNo !== undefined) patch.licenseNo = input.licenseNo.trim() || null;

      const nom = input.name?.trim();
      if (nom && nom !== cible.name) {
        const orders = await db.select().from(ordersTable);
        const liees = orders.filter((o) => o.driver === cible.name).length;
        if (liees > 0) {
          throw new BadRequestException(
            `Impossible de renommer : ${liees} commande(s) référencent ce chauffeur.`,
          );
        }
        const homonyme = await db.select().from(driversTable).where(eq(driversTable.name, nom));
        if (homonyme.length) throw new ConflictException('Un chauffeur porte déjà ce nom.');
        patch.name = nom;
      }

      if (!Object.keys(patch).length) return this.list(schema).then((l: any[]) => l.find((d) => d.id === id));
      const [d] = await db.update(driversTable).set(patch).where(eq(driversTable.id, id)).returning();
      const vehicles = await db.select().from(vehiclesTable);
      const orders = await db.select().from(ordersTable);
      return enrich(d, vehicles, orders);
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

  /**
   * Renouvelle une échéance de conformité (permis ou visite médicale).
   * Une date déjà passée est refusée : l'action est un RENOUVELLEMENT, elle ne doit pas
   * pouvoir déclasser silencieusement un chauffeur conforme (constat OBS-10).
   */
  renew(schema: string, id: string, field: 'license' | 'medical', due: string) {
    if (!due) throw new BadRequestException('Date requise.');
    if (field !== 'license' && field !== 'medical') throw new BadRequestException('Champ invalide.');
    if (due < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('La nouvelle échéance doit être postérieure à aujourd’hui.');
    }
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
   * Au DÉTACHEMENT en revanche, le libellé est conservé : c'est la capacité déclarée du
   * chauffeur à la création de sa fiche, et rien ne permettrait de la ressaisir (AN-14).
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
        .set(vehicle ? { vehicleId: vehicle.id, vehicle: vehicle.type } : { vehicleId: null })
        .where(eq(driversTable.id, id))
        .returning();
      if (!d) throw new NotFoundException('Chauffeur introuvable.');
      return enrich(d, vehicle ? [vehicle] : [], []);
    });
  }

  /**
   * Retire un chauffeur de l'effectif.
   *
   * Un départ ne se négocie pas avec le planning : un chauffeur qui s'en va, s'en va. Ses
   * courses EN COURS doivent donc être reprises par quelqu'un — `transferTo` nomme ce
   * repreneur. Sans lui, le retrait est refusé : abandonner des courses en silence
   * laisserait des colis sans porteur et des clients sans livreur.
   *
   * Les courses CLÔTURÉES ne sont pas transférées : l'historique dit qui a livré, et
   * réécrire cette attribution fausserait la performance du repreneur comme les preuves.
   */
  remove(schema: string, id: string, transferTo?: string) {
    return withTenantDb(schema, async (db) => {
      const [target] = await db.select().from(driversTable).where(eq(driversTable.id, id));
      if (!target) throw new NotFoundException('Chauffeur introuvable.');

      const orders = await db.select().from(ordersTable);
      const enCours = orders.filter((o) => o.driver === target.name && OPEN_STATUSES.includes(o.status));

      let repreneur: DriverRow | null = null;
      if (enCours.length > 0) {
        if (!transferTo) {
          throw new BadRequestException(
            `Impossible : ${enCours.length} commande(s) en cours sur ce chauffeur. Transférez-les à un autre chauffeur.`,
          );
        }
        const [r] = await db.select().from(driversTable).where(eq(driversTable.id, transferTo));
        if (!r) throw new BadRequestException('Chauffeur repreneur introuvable.');
        if (r.id === target.id) throw new BadRequestException('Le repreneur doit être un autre chauffeur.');
        // Le repreneur doit pouvoir réellement prendre les courses : un permis ou une visite
        // expirés, ou une indisponibilité, interdisent déjà toute affectation par le dispatch.
        const today = new Date().toISOString().slice(0, 10);
        const bloque = (r.licenseDue != null && r.licenseDue < today)
          || (r.medicalDue != null && r.medicalDue < today)
          || !r.available;
        if (bloque) {
          throw new BadRequestException(`${r.name} n’est pas affectable : choisissez un autre repreneur.`);
        }
        repreneur = r;
        for (const o of enCours) {
          await db.update(ordersTable).set({ driver: r.name }).where(eq(ordersTable.ref, o.ref));
        }
      }

      await db.delete(driversTable).where(eq(driversTable.id, id));
      return {
        ok: true,
        id,
        transferred: enCours.length,
        transferredTo: repreneur?.name ?? null,
      };
    });
  }
}
