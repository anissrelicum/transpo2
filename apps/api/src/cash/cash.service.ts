import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { merchantPayoutNet, COMMISSION_RATE } from '@transpo/domain';
import { eq } from 'drizzle-orm';

@Injectable()
export class CashService {
  /** Encaissement du COD d'une commande (codPaid=true). */
  collect(schema: string, ref: string) {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(ordersTable).where(eq(ordersTable.ref, ref));
      if (!cur) throw new NotFoundException(`Commande introuvable : ${ref}`);
      if (cur.cod <= 0) throw new BadRequestException('Commande sans COD.');
      const [r] = await db.update(ordersTable).set({ codPaid: true }).where(eq(ordersTable.ref, ref)).returning();
      return { ref: r.ref, cod: r.cod, codPaid: r.codPaid };
    });
  }

  /** Réconciliation par livreur : théorique = somme des COD encaissés (codPaid) des livraisons. */
  reconciliation(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable);
      const byDriver = new Map<string, { driver: string; theorique: number; deliveries: number }>();
      for (const o of rows) {
        if (!o.driver || !o.codPaid) continue;
        const e = byDriver.get(o.driver) ?? { driver: o.driver, theorique: 0, deliveries: 0 };
        e.theorique += o.cod; e.deliveries += 1;
        byDriver.set(o.driver, e);
      }
      return [...byDriver.values()];
    });
  }

  /** Aperçu de reversement marchand : brut (COD encaissés) − commission = net. */
  merchantPayouts(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable);
      const byMerchant = new Map<string, { merchant: string; brut: number; orders: number }>();
      for (const o of rows) {
        if (!o.merchant || !o.codPaid) continue;
        const e = byMerchant.get(o.merchant) ?? { merchant: o.merchant, brut: 0, orders: 0 };
        e.brut += o.cod; e.orders += 1;
        byMerchant.set(o.merchant, e);
      }
      return [...byMerchant.values()].map((m) => ({
        ...m,
        commissionRate: COMMISSION_RATE,
        net: merchantPayoutNet(m.brut),
      }));
    });
  }
}
