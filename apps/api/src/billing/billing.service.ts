import { Injectable } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { quote, type QuoteInput, COMMISSION_RATE, VAT_RATE } from '@transpo/domain';

@Injectable()
export class BillingService {
  /** Devis tarifaire (cascade à 3 niveaux + TVA) — logique pure du domaine. */
  quote(input: QuoteInput) {
    return quote(input);
  }

  /**
   * Factures marchand dérivées des commandes livrées : par marchand, commission 15 % + TVA 20 %.
   * (Vue calculée ; la persistance de factures viendra si nécessaire.)
   */
  invoices(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable);
      const byMerchant = new Map<string, { merchant: string; deliveries: number; codCollected: number }>();
      for (const o of rows) {
        if (!o.merchant || o.status !== 'LIVREE') continue;
        const e = byMerchant.get(o.merchant) ?? { merchant: o.merchant, deliveries: 0, codCollected: 0 };
        e.deliveries += 1;
        e.codCollected += o.codPaid ? o.cod : 0;
        byMerchant.set(o.merchant, e);
      }
      return [...byMerchant.values()].map((m) => {
        const commission = Math.round(m.codCollected * COMMISSION_RATE * 100) / 100;
        const netHt = Math.round((m.codCollected - commission) * 100) / 100;
        const tva = Math.round(netHt * VAT_RATE * 100) / 100;
        return { ...m, commission, netHt, tva, ttc: Math.round((netHt + tva) * 100) / 100 };
      });
    });
  }
}
