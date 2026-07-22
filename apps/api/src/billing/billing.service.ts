import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable, invoices as invoicesTable, merchantBilling, pricingConfig } from '@transpo/db';
import { quote, cityDistanceKm, type QuoteInput, type PriceTier, PRICE_TIERS, FRAGILE_SURCHARGE, SCHEDULED_SURCHARGE, COMMISSION_RATE, VAT_RATE } from '@transpo/domain';
import { eq, asc } from 'drizzle-orm';

const STATUS_COLOR: Record<string, string> = {
  BROUILLON: 'gray', ENVOYEE: 'blue', PAYEE: 'green', LITIGE: 'red',
};

@Injectable()
export class BillingService {
  /** Config tarifaire du tenant (grille + suppléments + remise). Défaut : constantes domaine. */
  pricingConfig(schema: string) {
    return withTenantDb(schema, async (db) => {
      const [row] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 'default'));
      const tiers = (row?.tiers as PriceTier[] | undefined);
      return {
        tiers: tiers && tiers.length ? tiers : (PRICE_TIERS as PriceTier[]),
        fragileSurcharge: row?.fragileSurcharge ?? FRAGILE_SURCHARGE,
        scheduledSurcharge: row?.scheduledSurcharge ?? SCHEDULED_SURCHARGE,
        discountRate: row?.discountRate ?? 0.1,
      };
    });
  }

  savePricingConfig(schema: string, cfg: { tiers: PriceTier[]; fragileSurcharge: number; scheduledSurcharge: number; discountRate: number }) {
    return withTenantDb(schema, async (db) => {
      if (!Array.isArray(cfg?.tiers) || !cfg.tiers.length) throw new BadRequestException('Grille invalide.');
      const clean = cfg.tiers.map((t) => ({
        from: Number(t.from) || 0,
        to: t.to == null ? null : Number(t.to),
        ...(t.perKm != null ? { perKm: Number(t.perKm) } : { base: Number(t.base) || 0 }),
      }));
      await db.insert(pricingConfig).values({
        id: 'default', tiers: clean,
        fragileSurcharge: Number(cfg.fragileSurcharge) || 0,
        scheduledSurcharge: Number(cfg.scheduledSurcharge) || 0,
        discountRate: Number(cfg.discountRate) || 0,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: pricingConfig.id,
        set: {
          tiers: clean,
          fragileSurcharge: Number(cfg.fragileSurcharge) || 0,
          scheduledSurcharge: Number(cfg.scheduledSurcharge) || 0,
          discountRate: Number(cfg.discountRate) || 0,
          updatedAt: new Date(),
        },
      });
      return { ok: true };
    });
  }

  /** Devis tarifaire (cascade à 3 niveaux + TVA), en appliquant la grille configurée du tenant. */
  async quote(schema: string, input: QuoteInput) {
    const cfg = await this.pricingConfig(schema);
    return quote({
      ...input,
      tiers: input.tiers ?? cfg.tiers,
      fragileSurcharge: input.fragileSurcharge ?? cfg.fragileSurcharge,
      scheduledSurcharge: input.scheduledSurcharge ?? cfg.scheduledSurcharge,
    });
  }

  /** Factures marchand persistées, triées de la plus récente à la plus ancienne. */
  invoices(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(invoicesTable).orderBy(asc(invoicesTable.ref));
      return rows
        .map((i) => ({
          id: i.id,
          ref: i.ref,
          merchant: i.merchant,
          period: i.period,
          orders: i.ordersCount,
          deliveries: i.deliveriesAmount,
          codCollected: i.codCollected,
          commission: i.commission,
          netHt: i.netHt,
          tva: i.tva,
          ttc: i.netHt + i.tva,
          status: i.status,
          color: STATUS_COLOR[i.status] ?? 'gray',
          disputeAmount: i.disputeAmount,
          disputeNote: i.disputeNote,
        }))
        .sort((a, b) => (a.ref < b.ref ? 1 : -1));
    });
  }

  /** Mode de facturation par marchand (prépayé / postpayé). */
  billingModes(schema: string) {
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(merchantBilling).orderBy(asc(merchantBilling.merchant));
      return rows.map((r) => ({ merchant: r.merchant, mode: r.mode }));
    });
  }

  setBillingMode(schema: string, merchant: string, mode: string) {
    return withTenantDb(schema, async (db) => {
      if (mode !== 'prepaid' && mode !== 'postpaid') throw new BadRequestException('Mode invalide.');
      await db.insert(merchantBilling).values({ merchant, mode })
        .onConflictDoUpdate({ target: merchantBilling.merchant, set: { mode } });
      return { merchant, mode };
    });
  }

  /**
   * Génère des factures BROUILLON pour les marchands ayant des livraisons non encore facturées
   * sur la période courante. Montant livraisons dérivé du barème (quote) par commande livrée.
   */
  generate(schema: string, period: string) {
    return withTenantDb(schema, async (db) => {
      const existing = await db.select().from(invoicesTable);
      const already = new Set(existing.filter((i) => i.period === period).map((i) => i.merchant));
      const rows = await db.select().from(ordersTable);
      const agg = new Map<string, { deliveries: number; cod: number; orders: number }>();
      for (const o of rows) {
        if (!o.merchant || o.status !== 'LIVREE' || already.has(o.merchant)) continue;
        const ht = quote({ distanceKm: cityDistanceKm(o.fromCity, o.toCity) }).ht;
        const e = agg.get(o.merchant) ?? { deliveries: 0, cod: 0, orders: 0 };
        e.deliveries += ht;
        e.cod += o.codPaid ? o.cod : 0;
        e.orders += 1;
        agg.set(o.merchant, e);
      }
      const [yr, mo] = period.split('-');
      const created: string[] = [];
      let seq = existing.length + 1;
      for (const [merchant, e] of agg) {
        const deliveries = Math.round(e.deliveries);
        const commission = Math.round(deliveries * COMMISSION_RATE);
        const netHt = deliveries - commission;
        const tva = Math.round(netHt * VAT_RATE);
        const ref = `FCT-${yr}-${mo}-${String(seq++).padStart(4, '0')}`;
        await db.insert(invoicesTable).values({
          ref, merchant, period, ordersCount: e.orders, deliveriesAmount: deliveries,
          codCollected: e.cod, commission, netHt, tva, status: 'BROUILLON',
        });
        created.push(ref);
      }
      return { created: created.length, refs: created };
    });
  }

  private async transition(schema: string, id: string, status: string, extra: Record<string, unknown> = {}) {
    return withTenantDb(schema, async (db) => {
      const [cur] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
      if (!cur) throw new NotFoundException('Facture introuvable.');
      const [r] = await db.update(invoicesTable).set({ status, ...extra })
        .where(eq(invoicesTable.id, id)).returning();
      return { id: r.id, ref: r.ref, status: r.status };
    });
  }

  send(schema: string, id: string) { return this.transition(schema, id, 'ENVOYEE'); }
  pay(schema: string, id: string) { return this.transition(schema, id, 'PAYEE'); }

  dispute(schema: string, id: string, amount: number, note?: string) {
    return this.transition(schema, id, 'LITIGE', { disputeAmount: amount ?? null, disputeNote: note ?? null });
  }

  /** Résolution de litige : avoir (repasse en ENVOYEE) ou rejet (repasse en ENVOYEE sans avoir). */
  resolveDispute(schema: string, id: string, decision: string) {
    const status = decision === 'reject' ? 'ENVOYEE' : 'ENVOYEE';
    return this.transition(schema, id, status, { disputeNote: null, disputeAmount: null });
  }
}
