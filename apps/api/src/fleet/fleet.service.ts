import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { withTenantDb, vehicles as vehiclesTable } from '@transpo/db';
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
    return withTenantDb(schema, async (db) => {
      const [v] = await db.insert(vehiclesTable).values({
        plate: input.plate.trim(), type: input.type, city: input.city ?? null,
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

  /** Renouvelle une échéance (assurance ou CT) à une nouvelle date ISO. */
  renew(schema: string, id: string, field: 'insurance' | 'ct', due: string) {
    if (!due) throw new BadRequestException('Date requise.');
    const col = field === 'ct' ? { ctDue: due } : { insuranceDue: due };
    return withTenantDb(schema, async (db) => {
      const [v] = await db.update(vehiclesTable).set(col).where(eq(vehiclesTable.id, id)).returning();
      if (!v) throw new NotFoundException('Véhicule introuvable.');
      return withCompliance(v);
    });
  }

  remove(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [v] = await db.delete(vehiclesTable).where(eq(vehiclesTable.id, id)).returning();
      if (!v) throw new NotFoundException('Véhicule introuvable.');
      return { ok: true, id: v.id };
    });
  }
}
