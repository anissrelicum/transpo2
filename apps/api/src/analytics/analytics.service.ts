import { Injectable } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';

@Injectable()
export class AnalyticsService {
  /** Synthèse opérationnelle dérivée des commandes (taux de réussite, répartition statuts). */
  summary(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable);
      const total = rows.length;
      const byStatus: Record<string, number> = {};
      for (const o of rows) byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
      const delivered = byStatus['LIVREE'] ?? 0;
      const failed = (byStatus['ECHOUEE'] ?? 0) + (byStatus['RETOUR'] ?? 0);
      const closed = delivered + failed;
      const successRate = closed ? Math.round((delivered / closed) * 1000) / 10 : 0;
      const codCollected = rows.filter((o) => o.codPaid).reduce((a, o) => a + o.cod, 0);
      return { total, byStatus, delivered, failed, successRate, codCollected };
    });
  }
}
