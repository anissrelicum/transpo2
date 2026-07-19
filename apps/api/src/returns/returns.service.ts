import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable, returns as returnsTable } from '@transpo/db';
import { MAX_RETURN_ATTEMPTS } from '@transpo/domain';
import { eq } from 'drizzle-orm';

@Injectable()
export class ReturnsService {
  /** Échec de livraison → commande ECHOUEE + création/incrément du retour. */
  fail(schema: string, ref: string, reason: string) {
    if (!reason) throw new BadRequestException('Motif requis.');
    return withTenantDb(schema, async (db) => {
      const [o] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!o) throw new NotFoundException(`Commande introuvable : ${ref}`);
      await db.update(ordersTable).set({ status: 'ECHOUEE' }).where(eq(ordersTable.ref, ref));
      const [existing] = await db.select().from(returnsTable).where(eq(returnsTable.ref, ref));
      if (existing) {
        const [r] = await db.update(returnsTable)
          .set({ attempts: existing.attempts + 1, reason, status: 'A_TRAITER' })
          .where(eq(returnsTable.ref, ref)).returning();
        return r;
      }
      const [r] = await db.insert(returnsTable).values({ ref, reason, attempts: 1, status: 'A_TRAITER' }).returning();
      return r;
    });
  }

  list(schema: string) {
    return withTenantDb(schema, async (db) => db.select().from(returnsTable).orderBy(returnsTable.createdAt));
  }

  /** Reprogrammer une tentative (si < MAX). Remet la commande en LIVRAISON. */
  reschedule(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(returnsTable).where(eq(returnsTable.ref, ref));
      if (!r) throw new NotFoundException(`Retour introuvable : ${ref}`);
      if (r.attempts >= MAX_RETURN_ATTEMPTS) {
        throw new BadRequestException(`Plafond de ${MAX_RETURN_ATTEMPTS} tentatives atteint.`);
      }
      await db.update(ordersTable).set({ status: 'LIVRAISON' }).where(eq(ordersTable.ref, ref));
      const [updated] = await db.update(returnsTable)
        .set({ attempts: r.attempts + 1, status: 'REPLANIFIE' }).where(eq(returnsTable.ref, ref)).returning();
      return updated;
    });
  }

  /** Retour au marchand → commande RETOUR, retour RENDU. */
  returnToMerchant(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [r] = await db.select().from(returnsTable).where(eq(returnsTable.ref, ref));
      if (!r) throw new NotFoundException(`Retour introuvable : ${ref}`);
      await db.update(ordersTable).set({ status: 'RETOUR' }).where(eq(ordersTable.ref, ref));
      const [updated] = await db.update(returnsTable).set({ status: 'RENDU' }).where(eq(returnsTable.ref, ref)).returning();
      return updated;
    });
  }
}
