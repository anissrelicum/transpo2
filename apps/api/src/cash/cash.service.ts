import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { withTenantDb, orders as ordersTable, cashSessions, cashMovements, payouts as payoutsTable } from '@transpo/db';
import { merchantPayoutNet } from '@transpo/domain';
import { eq, asc } from 'drizzle-orm';
import { BillingService } from '../billing/billing.service.js';

@Injectable()
export class CashService {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  /** Reversements COD par marchand (cash encaissé à reverser). */
  reversements(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(payoutsTable).orderBy(asc(payoutsTable.merchant));
      return rows.map((p) => ({
        id: p.id,
        merchant: p.merchant,
        period: p.period,
        orders: p.ordersCount,
        cod: p.codAmount,
        status: p.status,
        method: p.method,
        reference: p.reference,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      }));
    });
  }

  /** Marque un reversement comme versé (méthode + référence de paiement). */
  payReversement(schema: string, id: string, method: string, reference?: string) {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(payoutsTable).where(eq(payoutsTable.id, id));
      if (!cur) throw new NotFoundException('Reversement introuvable.');
      if (cur.status === 'VERSE') throw new BadRequestException('Reversement déjà versé.');
      const m = method || 'virement';
      const ref = reference || `REV-${cur.period}-${cur.merchant.slice(0, 3).toUpperCase()}`;
      const [r] = await db.update(payoutsTable)
        .set({ status: 'VERSE', method: m, reference: ref, paidAt: new Date() })
        .where(eq(payoutsTable.id, id)).returning();
      return { id: r.id, status: r.status, method: r.method, reference: r.reference };
    });
  }

  /** Génère des reversements EN_ATTENTE pour les COD encaissés non encore reversés. */
  generateReversements(schema: string, period: string) {
    return withTenantDb(schema, async (db) => {
      const existing = await db.select().from(payoutsTable);
      const already = new Set(existing.filter((p) => p.period === period).map((p) => p.merchant));
      const rows = await db.select().from(ordersTable);
      const agg = new Map<string, { cod: number; orders: number }>();
      for (const o of rows) {
        if (!o.merchant || !o.codPaid || already.has(o.merchant)) continue;
        const e = agg.get(o.merchant) ?? { cod: 0, orders: 0 };
        e.cod += o.cod; e.orders += 1;
        agg.set(o.merchant, e);
      }
      const created: string[] = [];
      for (const [merchant, e] of agg) {
        await db.insert(payoutsTable).values({
          merchant, period, ordersCount: e.orders, codAmount: e.cod, status: 'EN_ATTENTE',
        });
        created.push(merchant);
      }
      return { created: created.length, merchants: created };
    });
  }
  /** Sessions de caisse (réconciliation COD) avec leurs mouvements. */
  sessions(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(cashSessions).orderBy(asc(cashSessions.driver));
      const moves = await db.select().from(cashMovements);
      return rows.map((s) => {
        const declared = s.status === 'EN_COURS' ? null : s.declared;
        const ecart = declared == null ? null : s.theorique - declared;
        return {
          id: s.id,
          driver: s.driver,
          ini: s.ini,
          date: s.sessionDate,
          theorique: s.theorique,
          declared,
          deposited: s.deposited,
          deliveries: s.deliveries,
          cap: s.cap,
          status: s.status,
          reason: s.reason,
          note: s.note,
          ecart,
          moves: moves
            .filter((m) => m.sessionId === s.id)
            .map((m) => ({ ref: m.ref, recipient: m.recipient, amount: m.amount, matched: m.matched })),
        };
      });
    });
  }

  /** Enregistre le dépôt en agence d'une session « à déposer » (clôture). */
  deposit(schema: string, id: string) {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(cashSessions).where(eq(cashSessions.id, id));
      if (!cur) throw new NotFoundException('Session introuvable.');
      if (cur.status === 'DEPOSE') throw new BadRequestException('Session déjà déposée.');
      const amount = cur.declared ?? cur.theorique;
      const [r] = await db.update(cashSessions)
        .set({ status: 'DEPOSE', deposited: amount })
        .where(eq(cashSessions.id, id)).returning();
      return { id: r.id, status: r.status, deposited: r.deposited };
    });
  }

  /** Résout l'écart d'une session (motif + note), puis la clôture. */
  resolve(schema: string, id: string, reason: string, note?: string) {
    return withTenantDb(schema, async (db) => {
      if (!reason) throw new BadRequestException('Motif requis.');
      const [cur] = await db.select().from(cashSessions).where(eq(cashSessions.id, id));
      if (!cur) throw new NotFoundException('Session introuvable.');
      const amount = cur.declared ?? cur.theorique;
      const [r] = await db.update(cashSessions)
        .set({ status: 'DEPOSE', deposited: amount, reason, note: note ?? null })
        .where(eq(cashSessions.id, id)).returning();
      return { id: r.id, status: r.status, reason: r.reason };
    });
  }
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
  async merchantPayouts(schema: string) {
    const { commissionRate } = await this.billing.pricingConfig(schema);
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
        commissionRate,
        net: merchantPayoutNet(m.brut, commissionRate),
      }));
    });
  }
}
