import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { withTenantDb, vehicles as vehiclesTable, drivers as driversTable } from '@transpo/db';
import { eq } from 'drizzle-orm';

const PLATE_RE = /^[0-9]{1,5}-[A-Za-z؀-ۿ]{1,2}-[0-9]{1,3}$/;
const VEHICLE_STATES = ['ACTIF', 'MAINTENANCE', 'HORS SERVICE'];

function withCompliance(v: any) {
  const today = new Date().toISOString().slice(0, 10);
  const insExpired = v.insuranceDue != null && v.insuranceDue < today;
  const ctExpired = v.ctDue != null && v.ctDue < today;
  return {
    ...v,
    insuranceExpired: insExpired,
    ctExpired,
    // Règle métier : un véhicule à l'assurance expirée ne peut pas être affecté.
    assignable: v.state === 'ACTIF' && !insExpired,
  };
}

@Injectable()
export class FleetService {
  listVehicles(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(vehiclesTable).orderBy(vehiclesTable.plate);
      return rows.map(withCompliance);
    });
  }

  createVehicle(schema: string, input: { plate: string; type: string; city?: string; state?: string; insuranceDue?: string; ctDue?: string; capacity?: string; equipment?: string[] }) {
    if (!input?.plate || !PLATE_RE.test(input.plate.trim())) {
      throw new BadRequestException('Immatriculation invalide (format marocain NNNN-L-NN).');
    }
    if (!input?.type) throw new BadRequestException('type requis.');
    const plaque = input.plate.trim();
    return withTenantDb(schema, async (db) => {
      // La plaque identifie le véhicule sur le terrain (affectation, preuve, tracking) :
      // deux lignes homonymes rendraient tout rattachement ambigu. Le contrôle existait
      // côté chauffeur (nom unique), il manquait ici (AN-16).
      const existant = await db.select().from(vehiclesTable);
      if (existant.some((v) => v.plate.trim().toLowerCase() === plaque.toLowerCase())) {
        throw new ConflictException('Un véhicule porte déjà cette immatriculation.');
      }
      const [v] = await db.insert(vehiclesTable).values({
        plate: plaque, type: input.type, city: input.city ?? null,
        state: input.state ?? 'ACTIF', insuranceDue: input.insuranceDue ?? null, ctDue: input.ctDue ?? null,
        capacity: input.capacity ?? null, equipment: Array.isArray(input.equipment) ? input.equipment : [],
      }).returning();
      return withCompliance(v);
    });
  }

  setState(schema: string, id: string, state: string) {
    if (!VEHICLE_STATES.includes(state)) throw new BadRequestException('État invalide.');
    return withTenantDb(schema, async (db) => {
      const [v] = await db.update(vehiclesTable).set({ state }).where(eq(vehiclesTable.id, id)).returning();
      if (!v) throw new NotFoundException('Véhicule introuvable.');
      return withCompliance(v);
    });
  }

  /**
   * Renouvelle une échéance (assurance ou CT) à une nouvelle date ISO.
   * Une date passée est refusée, pour la même raison que côté chauffeur (OBS-10).
   */
  renew(schema: string, id: string, field: 'insurance' | 'ct', due: string) {
    if (!due) throw new BadRequestException('Date requise.');
    if (due < new Date().toISOString().slice(0, 10)) {
      throw new BadRequestException('La nouvelle échéance doit être postérieure à aujourd’hui.');
    }
    const col = field === 'ct' ? { ctDue: due } : { insuranceDue: due };
    return withTenantDb(schema, async (db) => {
      const [v] = await db.update(vehiclesTable).set(col).where(eq(vehiclesTable.id, id)).returning();
      if (!v) throw new NotFoundException('Véhicule introuvable.');
      return withCompliance(v);
    });
  }

  /**
   * Retire un véhicule du parc.
   * Un véhicule RATTACHÉ à un chauffeur n'est pas supprimable : la suppression laissait
   * jusqu'ici une affectation morte côté chauffeur, sans le moindre avertissement, alors
   * que le retrait d'un chauffeur, lui, est protégé de la même façon (AN-15).
   */
  remove(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [cible] = await db.select().from(vehiclesTable).where(eq(vehiclesTable.id, id));
      if (!cible) throw new NotFoundException('Véhicule introuvable.');
      const attaches = await db.select().from(driversTable).where(eq(driversTable.vehicleId, id));
      if (attaches.length) {
        const noms = attaches.map((d) => d.name).join(', ');
        throw new BadRequestException(
          `Impossible : véhicule rattaché à ${noms}. Détachez-le d’abord depuis la fiche chauffeur.`,
        );
      }
      await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id));
      return { ok: true, id: cible.id };
    });
  }
}
