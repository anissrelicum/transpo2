import { Injectable, ForbiddenException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable } from '@transpo/db';
import { desc, eq } from 'drizzle-orm';
import { COMMISSION_RATE, VAT_RATE, type Order } from '@transpo/domain';

function rowToOrder(r: any): Order {
  return { ...r, createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt } as Order;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Portail marchand : toutes les vues sont scopées au marchand du JWT (claim `merchant`),
 * résolu côté serveur — jamais depuis un champ contrôlé par le client (cf. transpo-auth-security).
 */
@Injectable()
export class MerchantService {
  private ensure(merchant?: string): string {
    if (!merchant) throw new ForbiddenException('Compte marchand non rattaché à un marchand.');
    return merchant;
  }

  /** Commandes du marchand (les siennes uniquement). */
  orders(schema: string, merchant?: string): Promise<Order[]> {
    const m = this.ensure(merchant);
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(ordersTable)
        .where(eq(ordersTable.merchant, m)).orderBy(desc(ordersTable.createdAt));
      return rows.map(rowToOrder);
    });
  }

  /** KPIs marchand : volume, livrées, en cours, COD encaissé, taux de réussite. */
  async dashboard(schema: string, merchant?: string) {
    const rows = await this.orders(schema, merchant);
    const total = rows.length;
    const delivered = rows.filter((o) => o.status === 'LIVREE').length;
    const cancelled = rows.filter((o) => o.status === 'ANNULEE').length;
    const inTransit = rows.filter((o) => !['LIVREE', 'ANNULEE', 'RENDU'].includes(o.status)).length;
    const codPending = rows.filter((o) => o.cod > 0 && !o.codPaid).reduce((s, o) => s + o.cod, 0);
    const finished = delivered + cancelled;
    const successRate = finished ? round2((delivered / finished) * 100) : 0;
    return { total, delivered, cancelled, inTransit, codPending, successRate };
  }

  /** Portefeuille : COD encaissé net de commission (ce que la plateforme doit reverser). */
  async wallet(schema: string, merchant?: string) {
    const rows = await this.orders(schema, merchant);
    const codCollected = rows.filter((o) => o.codPaid).reduce((s, o) => s + o.cod, 0);
    const commission = round2(codCollected * COMMISSION_RATE);
    const net = round2(codCollected - commission);
    return { codCollected, commissionRate: COMMISSION_RATE, commission, net };
  }

  /** Facture marchand dérivée des livraisons (commission 15 % + TVA 20 %). */
  async invoice(schema: string, merchant?: string) {
    const m = this.ensure(merchant);
    const rows = (await this.orders(schema, merchant)).filter((o) => o.status === 'LIVREE');
    const deliveries = rows.length;
    const codCollected = rows.filter((o) => o.codPaid).reduce((s, o) => s + o.cod, 0);
    const commission = round2(codCollected * COMMISSION_RATE);
    const netHt = round2(codCollected - commission);
    const tva = round2(netHt * VAT_RATE);
    return { merchant: m, deliveries, codCollected, commission, netHt, tva, ttc: round2(netHt + tva) };
  }
}
