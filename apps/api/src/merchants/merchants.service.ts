import { Injectable, BadRequestException, NotFoundException, ConflictException, ForbiddenException, Inject } from '@nestjs/common';
import { withTenantDb, merchants as merchantsTable, users as usersTable } from '@transpo/db';
import {
  isPricingMode, validateMerchantPricing, effectiveCommissionRate, validateDelayPolicy, normalizeDelayPolicy,
  DELAY_MODES, type Merchant, type MerchantPricing, type PricingMode, type DeliveryTerms, type DelayPolicy,
} from '@transpo/domain';
import { and, asc, eq } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { BillingService, rowToMerchant, pricingOf } from '../billing/billing.service.js';
import type { JwtUser } from '../auth/jwt.js';

/** Distances des exemples de prix montrés avec les conditions (fiche, portail). */
export const EXAMPLE_DISTANCES_KM = [3, 15, 40];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_OK = (v: string) => /^\+?[0-9\s-]+$/.test(v) && /^\d{9,15}$/.test(v.replace(/[^\d]/g, ''));
const NAME_MAX = 120;

/** Corps accepté par POST/PATCH. Les taux sont des fractions (0,1 = 10 %). */
export interface MerchantInput {
  name?: string;
  legalName?: string | null; contactName?: string | null; email?: string | null;
  phone?: string | null; address?: string | null; taxId?: string | null;
  mode?: PricingMode; discountRate?: number | null; flatPrice?: number | null;
  commissionRate?: number | null; active?: boolean;
  /** Délai par défaut, suppléments express (DH HT) et pénalité de retard (fraction). */
  deliveryTerms?: Partial<DeliveryTerms>;
}

const IDENTITY = ['legalName', 'contactName', 'email', 'phone', 'address', 'taxId'] as const;
const PRICING_FIELDS = ['mode', 'discountRate', 'flatPrice', 'commissionRate'] as const;

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);
const texte = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Nombre optionnel : `null`/absent/'' → null ; sinon un nombre fini, ou erreur. */
function nombre(v: unknown, champ: string): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new BadRequestException(`${champ} : nombre attendu.`);
  return n;
}

function identite(body: MerchantInput): Partial<Record<(typeof IDENTITY)[number], string | null>> {
  const out: Partial<Record<(typeof IDENTITY)[number], string | null>> = {};
  for (const k of IDENTITY) if (has(body, k)) out[k] = texte(body[k]);
  if (out.email && !EMAIL_RE.test(out.email)) throw new BadRequestException('Email invalide.');
  if (out.phone && !PHONE_OK(out.phone)) throw new BadRequestException('Téléphone invalide.');
  return out;
}

/**
 * Conditions de délai validées. Champs absents = valeur actuelle (`cur`) ; un supplément
 * négatif, une pénalité hors 0..100 % ou un délai incohérent sont refusés.
 */
function conditionsDelai(v: Partial<DeliveryTerms> | undefined, cur: DeliveryTerms): DeliveryTerms {
  if (v === undefined) return cur;
  if (!v || typeof v !== 'object') throw new BadRequestException('Conditions de délai invalides.');
  const delai: DelayPolicy = v.delai ? normalizeDelayPolicy(v.delai as DelayPolicy) : cur.delai;
  const err = validateDelayPolicy(delai);
  if (err) throw new BadRequestException(err);
  const supplements: DeliveryTerms['supplements'] = {};
  const source = v.supplements ?? cur.supplements;
  for (const mode of DELAY_MODES) {
    if (mode === 'aucun') continue;
    const n = nombre((source as Record<string, unknown>)[mode], `Supplément ${mode}`);
    if (n === null || n === 0) continue;
    if (n < 0 || n > 10_000) throw new BadRequestException('Supplément express : montant entre 0 et 10 000 DH.');
    supplements[mode] = Math.round(n * 100) / 100;
  }
  const penaliteRetard = v.penaliteRetard === undefined ? cur.penaliteRetard : nombre(v.penaliteRetard, 'Pénalité de retard') ?? 0;
  if (penaliteRetard < 0 || penaliteRetard > 1) throw new BadRequestException('Pénalité de retard : taux entre 0 et 100 %.');
  return { delai, supplements, penaliteRetard };
}

/** Comptes du portail rattachés à un marchand (jamais le hash du mot de passe). */
export interface MerchantAccount { id: string; name: string; email: string; active: boolean }
export interface MerchantView extends Merchant {
  /** Commission réellement appliquée (négociée, ou défaut de l'entreprise). */
  effectiveCommissionRate: number;
  accounts: MerchantAccount[];
}

/** Ce qu'un marchand voit de SES conditions (portail, lecture seule). */
export interface MerchantConditions extends MerchantPricing {
  name: string;
  commissionRate: number;
  commissionNegotiated: boolean;
  fragileSurcharge: number;
  scheduledSurcharge: number;
  vatRate: number;
  deliveryTerms: DeliveryTerms;
  examples: { km: number; ht: number; ttc: number }[];
}

/**
 * Fiches marchand et conditions tarifaires négociées (cf. docs/adr/0003).
 * Écriture : ADMIN et COMPTABLE ; lecture : console ; un marchand ne lit que les siennes.
 */
@Injectable()
export class MerchantsService {
  constructor(
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BillingService) private readonly billing: BillingService,
  ) {}

  async list(schema: string): Promise<MerchantView[]> {
    const { companyRate } = await this.billing.commissionRates(schema);
    return withTenantDb(schema, async (db) => {
      const rows = await db.select().from(merchantsTable).orderBy(asc(merchantsTable.name));
      const comptes = await db.select().from(usersTable).where(eq(usersTable.role, 'MERCHANT'));
      return rows.map((r) => this.view(rowToMerchant(r), companyRate, comptes));
    });
  }

  async get(schema: string, id: string): Promise<MerchantView> {
    const { companyRate } = await this.billing.commissionRates(schema);
    return withTenantDb(schema, async (db) => {
      const r = await this.findRow(db, id);
      const comptes = await db.select().from(usersTable)
        .where(and(eq(usersTable.role, 'MERCHANT'), eq(usersTable.merchant, r.name)));
      return this.view(rowToMerchant(r), companyRate, comptes);
    });
  }

  /**
   * Conditions d'un marchand, vues par lui-même. `allowedName` est le claim `merchant`
   * du JWT : demander la fiche d'un autre (par id) est refusé, pas masqué.
   */
  async conditionsOf(schema: string, allowedName: string | undefined, id?: string): Promise<MerchantConditions> {
    if (!allowedName) throw new ForbiddenException('Compte marchand non rattaché à un marchand.');
    const fiche = await withTenantDb(schema, async (db) => {
      const [r] = id
        ? await db.select().from(merchantsTable).where(eq(merchantsTable.id, id))
        : await db.select().from(merchantsTable).where(eq(merchantsTable.name, allowedName));
      return r ? rowToMerchant(r) : null;
    });
    if (id && (!fiche || fiche.name !== allowedName)) {
      throw new ForbiddenException('Conditions d’un autre marchand : accès refusé.');
    }
    const cfg = await this.billing.pricingConfig(schema);
    // Un compte portail antérieur aux fiches peut ne pas en avoir : il est à la grille.
    const pricing: MerchantPricing = fiche ? pricingOf(fiche) : { mode: 'standard' };
    const examples = await Promise.all(EXAMPLE_DISTANCES_KM.map(async (km) => {
      const q = await this.billing.quote(schema, { distanceKm: km, merchant: pricing });
      return { km, ht: q.ht, ttc: q.ttc };
    }));
    return {
      name: fiche?.name ?? allowedName,
      ...pricing,
      discountRate: pricing.discountRate ?? null,
      flatPrice: pricing.flatPrice ?? null,
      commissionRate: effectiveCommissionRate(fiche?.commissionRate, cfg.commissionRate),
      commissionNegotiated: fiche?.commissionRate != null,
      fragileSurcharge: cfg.fragileSurcharge,
      scheduledSurcharge: cfg.scheduledSurcharge,
      vatRate: cfg.vatRate,
      deliveryTerms: fiche?.deliveryTerms ?? { delai: { mode: 'aucun' }, supplements: {}, penaliteRetard: 0 },
      examples,
    };
  }

  async create(schema: string, tenant: string, actor: JwtUser, body: MerchantInput): Promise<MerchantView> {
    const b = body ?? {};
    const name = texte(b.name);
    if (!name) throw new BadRequestException('Nom du marchand requis.');
    if (name.length > NAME_MAX) throw new BadRequestException(`Nom trop long (${NAME_MAX} caractères au plus).`);
    const mode = b.mode ?? 'standard';
    const pricing = this.pricing({ mode, discountRate: b.discountRate, flatPrice: b.flatPrice });
    const commissionRate = this.commission(b.commissionRate);
    const deliveryTerms = conditionsDelai(b.deliveryTerms, { delai: { mode: 'aucun' }, supplements: {}, penaliteRetard: 0 });
    const values = {
      name, ...identite(b), pricingMode: pricing.mode,
      discountRate: pricing.discountRate ?? null, flatPrice: pricing.flatPrice ?? null,
      commissionRate, active: b.active === undefined ? true : !!b.active, deliveryTerms,
    };
    const created = await withTenantDb(schema, async (db) => {
      const [dup] = await db.select().from(merchantsTable).where(eq(merchantsTable.name, name));
      if (dup) throw new ConflictException(`Un marchand porte déjà ce nom : ${name}.`);
      const [r] = await db.insert(merchantsTable).values(values).returning();
      return rowToMerchant(r);
    });
    await this.audit.record(actor, 'merchant.create', {
      tenant, target: created.id,
      detail: { name, mode: created.mode, discountRate: created.discountRate, flatPrice: created.flatPrice, commissionRate },
    });
    return this.get(schema, created.id);
  }

  /**
   * Mise à jour partielle. Changer de mode efface les paramètres des autres modes qui ne
   * sont pas explicitement fournis ; un paramètre fourni qui contredit le mode est refusé.
   * Le nom n'est pas modifiable : c'est la clé de rattachement des commandes et comptes.
   */
  async update(schema: string, tenant: string, actor: JwtUser, id: string, body: MerchantInput): Promise<MerchantView> {
    const b = body ?? {};
    const { before, after } = await withTenantDb(schema, async (db) => {
      const cur = rowToMerchant(await this.findRow(db, id));
      if (has(b, 'name') && texte(b.name) !== cur.name) {
        throw new BadRequestException('Le nom d’un marchand n’est pas modifiable (il rattache ses commandes et ses comptes).');
      }
      const mode = has(b, 'mode') ? b.mode! : cur.mode;
      const pricing = this.pricing({
        mode,
        discountRate: has(b, 'discountRate') ? b.discountRate : (mode === 'remise' ? cur.discountRate : null),
        flatPrice: has(b, 'flatPrice') ? b.flatPrice : (mode === 'forfait' ? cur.flatPrice : null),
      });
      const set = {
        ...identite(b),
        pricingMode: pricing.mode,
        discountRate: pricing.discountRate ?? null,
        flatPrice: pricing.flatPrice ?? null,
        commissionRate: has(b, 'commissionRate') ? this.commission(b.commissionRate) : cur.commissionRate,
        deliveryTerms: conditionsDelai(b.deliveryTerms, cur.deliveryTerms),
        ...(has(b, 'active') ? { active: !!b.active } : {}),
        updatedAt: new Date(),
      };
      const [r] = await db.update(merchantsTable).set(set).where(eq(merchantsTable.id, id)).returning();
      return { before: cur, after: rowToMerchant(r) };
    });

    // Journal d'audit : tout changement de conditions tarifaires est tracé (qui, quand,
    // avant → après). C'est ce qui permet de répondre à « depuis quand ce prix ? ».
    const avant = Object.fromEntries(PRICING_FIELDS.map((k) => [k, before[k]]));
    const apres = Object.fromEntries(PRICING_FIELDS.map((k) => [k, after[k]]));
    if (JSON.stringify(avant) !== JSON.stringify(apres)) {
      await this.audit.record(actor, 'merchant.pricing_change', { tenant, target: id, detail: { name: after.name, from: avant, to: apres } });
    }
    // Le délai promis, le prix de l'express et la pénalité engagent l'entreprise : tracés.
    if (JSON.stringify(before.deliveryTerms) !== JSON.stringify(after.deliveryTerms)) {
      await this.audit.record(actor, 'merchant.delivery_terms_change', { tenant, target: id, detail: { name: after.name, from: before.deliveryTerms, to: after.deliveryTerms } });
    }
    if (before.active !== after.active) {
      await this.audit.record(actor, after.active ? 'merchant.reactivate' : 'merchant.deactivate', { tenant, target: id, detail: { name: after.name } });
    }
    return this.get(schema, id);
  }

  /* ---------------- interne ---------------- */

  private async findRow(db: Parameters<Parameters<typeof withTenantDb>[1]>[0], id: string) {
    // id non UUID → 404 propre plutôt qu'une erreur de cast Postgres (500).
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('Marchand introuvable.');
    const [r] = await db.select().from(merchantsTable).where(eq(merchantsTable.id, id));
    if (!r) throw new NotFoundException('Marchand introuvable.');
    return r;
  }

  private pricing(p: { mode: unknown; discountRate: unknown; flatPrice: unknown }): MerchantPricing {
    if (!isPricingMode(p.mode)) throw new BadRequestException('Mode tarifaire invalide (standard, remise ou forfait).');
    const out: MerchantPricing = {
      mode: p.mode,
      discountRate: nombre(p.discountRate, 'Remise'),
      flatPrice: nombre(p.flatPrice, 'Forfait'),
    };
    if (out.flatPrice != null) out.flatPrice = Math.round(out.flatPrice * 100) / 100;
    const err = validateMerchantPricing(out);
    if (err) throw new BadRequestException(err);
    return out;
  }

  private commission(v: unknown): number | null {
    const n = nombre(v, 'Commission');
    if (n === null) return null;
    if (n < 0 || n > 1) throw new BadRequestException('Commission : taux entre 0 et 100 %.');
    return n;
  }

  private view(m: Merchant, companyRate: number, comptes: (typeof usersTable.$inferSelect)[]): MerchantView {
    return {
      ...m,
      effectiveCommissionRate: effectiveCommissionRate(m.commissionRate, companyRate),
      accounts: comptes.filter((u) => u.merchant === m.name)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, active: u.active })),
    };
  }
}
