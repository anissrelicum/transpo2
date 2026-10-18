import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { withTenantDb, orders as ordersTable, invoices as invoicesTable, merchantBilling, pricingConfig, merchants as merchantsTable } from '@transpo/db';
import {
  quote, cityDistanceKm, effectiveCommissionRate, delaySurcharge, isDelayMode, DEFAULT_DELIVERY_TERMS,
  type QuoteInput, type Quote, type PriceTier, type MerchantPricing, type PricingMode, type Merchant,
  type DeliveryTerms, type DelayMode,
  PRICE_TIERS, FRAGILE_SURCHARGE, SCHEDULED_SURCHARGE, COMMISSION_RATE, VAT_RATE,
} from '@transpo/domain';
import { eq, asc } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

const STATUS_COLOR: Record<string, string> = {
  BROUILLON: 'gray', ENVOYEE: 'blue', PAYEE: 'green', LITIGE: 'red',
};

/** Conditions de délai stockées (jsonb) → contrat `DeliveryTerms`, valeurs par défaut comprises. */
export function termsOf(v: unknown): DeliveryTerms {
  const t = (v && typeof v === 'object' ? v : {}) as Partial<DeliveryTerms>;
  const delai = t.delai && isDelayMode(t.delai.mode) ? t.delai : DEFAULT_DELIVERY_TERMS.delai;
  return {
    delai,
    supplements: t.supplements && typeof t.supplements === 'object' ? t.supplements : {},
    penaliteRetard: typeof t.penaliteRetard === 'number' ? t.penaliteRetard : 0,
  };
}

/** Ligne `merchants` → contrat partagé `Merchant`. */
export function rowToMerchant(r: typeof merchantsTable.$inferSelect): Merchant {
  return {
    id: r.id, name: r.name, legalName: r.legalName, contactName: r.contactName,
    email: r.email, phone: r.phone, address: r.address, taxId: r.taxId,
    mode: r.pricingMode as PricingMode, discountRate: r.discountRate, flatPrice: r.flatPrice,
    commissionRate: r.commissionRate, active: r.active, deliveryTerms: termsOf(r.deliveryTerms),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

/** Conditions tarifaires d'une fiche marchand, sous la forme attendue par le moteur. */
export const pricingOf = (m: Pick<Merchant, 'mode' | 'discountRate' | 'flatPrice'>): MerchantPricing =>
  ({ mode: m.mode, discountRate: m.discountRate, flatPrice: m.flatPrice });

/** Fiche marchand par nom (clé de rattachement), ou `null`. */
export async function findMerchantByName(db: NodePgDatabase, name: string): Promise<Merchant | null> {
  const [r] = await db.select().from(merchantsTable).where(eq(merchantsTable.name, name));
  return r ? rowToMerchant(r) : null;
}

/**
 * Fiche marchand par nom, créée aux conditions standard si elle manque. Les commandes et
 * comptes portail désignent un marchand par son nom : tout nom en circulation doit avoir
 * sa fiche, sans quoi ses conditions ne pourraient jamais être négociées.
 */
export async function ensureMerchant(db: NodePgDatabase, name: string): Promise<Merchant> {
  await db.insert(merchantsTable).values({ name }).onConflictDoNothing({ target: merchantsTable.name });
  return (await findMerchantByName(db, name))!;
}

/** Prix d'une course, prêt à être figé sur la commande, et les conditions de délai du marchand. */
export interface CoursePrice extends Quote { distanceKm: number; terms: DeliveryTerms }

@Injectable()
export class BillingService {
  /** Config tarifaire du tenant (grille + suppléments + remise + commission + TVA). Défaut : constantes domaine. */
  pricingConfig(schema: string) {
    return withTenantDb(schema, async (db) => {
      const [row] = await db.select().from(pricingConfig).where(eq(pricingConfig.id, 'default'));
      const tiers = (row?.tiers as PriceTier[] | undefined);
      return {
        tiers: tiers && tiers.length ? tiers : (PRICE_TIERS as PriceTier[]),
        fragileSurcharge: row?.fragileSurcharge ?? FRAGILE_SURCHARGE,
        scheduledSurcharge: row?.scheduledSurcharge ?? SCHEDULED_SURCHARGE,
        discountRate: row?.discountRate ?? 0.1,
        commissionRate: row?.commissionRate ?? COMMISSION_RATE,
        vatRate: row?.vatRate ?? VAT_RATE,
      };
    });
  }

  savePricingConfig(schema: string, cfg: { tiers: PriceTier[]; fragileSurcharge: number; scheduledSurcharge: number; discountRate: number; commissionRate: number; vatRate: number }) {
    return withTenantDb(schema, async (db) => {
      if (!Array.isArray(cfg?.tiers) || !cfg.tiers.length) throw new BadRequestException('Grille invalide.');
      const clean = cfg.tiers.map((t) => ({
        from: Number(t.from) || 0,
        to: t.to == null ? null : Number(t.to),
        ...(t.perKm != null ? { perKm: Number(t.perKm) } : { base: Number(t.base) || 0 }),
      }));
      const values = {
        tiers: clean,
        fragileSurcharge: Number(cfg.fragileSurcharge) || 0,
        scheduledSurcharge: Number(cfg.scheduledSurcharge) || 0,
        discountRate: Number(cfg.discountRate) || 0,
        commissionRate: Math.min(Math.max(Number(cfg.commissionRate) || 0, 0), 1),
        vatRate: Math.min(Math.max(Number(cfg.vatRate) || 0, 0), 1),
        updatedAt: new Date(),
      };
      await db.insert(pricingConfig).values({ id: 'default', ...values })
        .onConflictDoUpdate({ target: pricingConfig.id, set: values });
      return { ok: true };
    });
  }

  /** Devis tarifaire (conditions marchand ou cascade historique + TVA), à la grille configurée du tenant. */
  async quote(schema: string, input: QuoteInput): Promise<Quote> {
    const cfg = await this.pricingConfig(schema);
    return quote({
      ...input,
      tiers: input.tiers ?? cfg.tiers,
      fragileSurcharge: input.fragileSurcharge ?? cfg.fragileSurcharge,
      scheduledSurcharge: input.scheduledSurcharge ?? cfg.scheduledSurcharge,
      // PAS de remise par défaut : la cascade de tarification (prix fixe marchand >
      // grille remisée > grille standard) la fait dépendre du CONTRAT du marchand, pas du
      // tenant. L'appliquer d'office remiserait toutes les courses, y compris celles de
      // marchands sans accord — cf. apps/e2e/tests/40_cash_billing.test.mjs, qui fixe
      // cette cascade. Le simulateur de `/pricing`, lui, a sa case « Remise contractuelle »
      // cochée par défaut : c'est ce défaut d'écran qui trompe, pas le moteur.
      vatRate: input.vatRate ?? cfg.vatRate,
    });
  }

  /**
   * Devis aux conditions d'un marchand désigné par son nom. Marchand inconnu ou absent →
   * grille standard (un devis ne crée jamais de fiche). Retourne aussi la fiche trouvée,
   * pour que l'appelant puisse afficher le mode appliqué.
   */
  async quoteForMerchant(
    schema: string,
    merchant: string | null | undefined,
    input: Omit<QuoteInput, 'merchant' | 'merchantFixedPrice' | 'discountRate' | 'delaySurcharge'> & { delayMode?: DelayMode },
  ): Promise<Quote & { merchant: string | null; deliveryTerms: DeliveryTerms }> {
    const fiche = merchant ? await withTenantDb(schema, (db) => findMerchantByName(db, merchant)) : null;
    const terms = fiche?.deliveryTerms ?? DEFAULT_DELIVERY_TERMS;
    const { delayMode, ...reste } = input;
    const q = await this.quote(schema, {
      ...reste, merchant: fiche ? pricingOf(fiche) : { mode: 'standard' },
      delaySurcharge: delaySurcharge(terms, delayMode ?? terms.delai.mode),
    });
    // Le délai par défaut du marchand accompagne le devis : l'assistant de commande le
    // propose sans requête de plus.
    return { ...q, merchant: fiche?.name ?? null, deliveryTerms: terms };
  }

  /**
   * Prix d'une course à sa création, aux conditions du marchand (fiche créée aux conditions
   * standard si elle manque). C'est CE prix qui est figé sur la commande puis facturé.
   * Un marchand désactivé ne peut plus passer commande.
   */
  async priceCourse(
    schema: string,
    input: { merchant: string | null; distanceKm: number; fragile: boolean; scheduled: boolean; delayMode?: DelayMode | null },
  ): Promise<CoursePrice> {
    let conditions: MerchantPricing = { mode: 'standard' };
    let terms: DeliveryTerms = DEFAULT_DELIVERY_TERMS;
    if (input.merchant) {
      const fiche = await withTenantDb(schema, (db) => ensureMerchant(db, input.merchant!));
      if (!fiche.active) throw new BadRequestException(`Marchand désactivé : ${fiche.name}.`);
      conditions = pricingOf(fiche);
      terms = fiche.deliveryTerms;
    }
    const q = await this.quote(schema, {
      distanceKm: input.distanceKm, fragile: input.fragile, scheduled: input.scheduled, merchant: conditions,
      // Supplément express : celui du délai RETENU pour la commande (défaut du marchand ou choix).
      delaySurcharge: delaySurcharge(terms, input.delayMode ?? terms.delai.mode),
    });
    return { ...q, distanceKm: input.distanceKm, terms };
  }

  /**
   * Commission COD applicable à chaque marchand : son taux négocié, à défaut celui de
   * l'entreprise. Une seule source pour la facture, le reversement et le portefeuille.
   */
  async commissionRates(schema: string): Promise<{ companyRate: number; rateFor: (merchant: string) => number }> {
    const { commissionRate } = await this.pricingConfig(schema);
    const rows = await withTenantDb(schema, (db) => db.select().from(merchantsTable));
    const negocie = new Map(rows.map((r) => [r.name, r.commissionRate]));
    return {
      companyRate: commissionRate,
      rateFor: (merchant: string) => effectiveCommissionRate(negocie.get(merchant), commissionRate),
    };
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
          latePenalties: i.latePenalties,
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
   * sur la période courante.
   *
   * Montant livraisons = prix HT FIGÉ sur chaque commande à sa création, aux conditions du
   * marchand (grille, remise ou forfait). Les commandes antérieures au figeage (prix NULL)
   * sont recalculées à la grille standard du tenant, distance de ville à ville — ce qui
   * s'appliquait à l'époque, faute de conditions par marchand.
   * Commission = taux négocié du marchand, à défaut celui de l'entreprise.
   */
  async generate(schema: string, period: string) {
    const cfg = await this.pricingConfig(schema);
    const { rateFor } = await this.commissionRates(schema);
    return withTenantDb(schema, async (db) => {
      const existing = await db.select().from(invoicesTable);
      const already = new Set(existing.filter((i) => i.period === period).map((i) => i.merchant));
      const rows = await db.select().from(ordersTable);
      const agg = new Map<string, { deliveries: number; cod: number; orders: number; penalites: number }>();
      for (const o of rows) {
        if (!o.merchant || o.status !== 'LIVREE' || already.has(o.merchant)) continue;
        const ht = o.priceHt ?? quote({
          distanceKm: cityDistanceKm(o.fromCity, o.toCity), tiers: cfg.tiers, merchant: { mode: 'standard' },
        }).ht;
        const e = agg.get(o.merchant) ?? { deliveries: 0, cod: 0, orders: 0, penalites: 0 };
        // Une livraison en retard est facturée moins cher : la remise négociée (pénalité de
        // retard du marchand), figée sur la commande à la livraison.
        const penalite = Math.min(ht, o.latePenalty ?? 0);
        e.deliveries += ht - penalite;
        e.penalites += penalite;
        e.cod += o.codPaid ? o.cod : 0;
        e.orders += 1;
        agg.set(o.merchant, e);
      }
      const [yr, mo] = period.split('-');
      const created: string[] = [];
      let seq = existing.length + 1;
      for (const [merchant, e] of agg) {
        const deliveries = Math.round(e.deliveries);
        const commission = Math.round(deliveries * rateFor(merchant));
        const netHt = deliveries - commission;
        const tva = Math.round(netHt * cfg.vatRate);
        const ref = `FCT-${yr}-${mo}-${String(seq++).padStart(4, '0')}`;
        await db.insert(invoicesTable).values({
          ref, merchant, period, ordersCount: e.orders, deliveriesAmount: deliveries,
          codCollected: e.cod, commission, netHt, tva, status: 'BROUILLON', latePenalties: Math.round(e.penalites),
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
