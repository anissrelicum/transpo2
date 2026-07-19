// @transpo/domain — langage ubiquitaire & règles pures (source unique de vérité).
// Aucune dépendance UI/serveur. Importé par le back ET les fronts.
// Réf : skill transpo-domain, PRD-00 §4-5.

/* ====================== Cycle de vie d'une commande ====================== */
export const ORDER_STATUS = [
  'PROGRAMMEE', 'NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE',
  'LIVRAISON', 'LIVREE', 'ECHOUEE', 'RETOUR', 'ANNULEE',
] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

// Chemin nominal (séquentiel). Les transitions valides en dérivent.
export const LIFECYCLE: OrderStatus[] = [
  'PROGRAMMEE', 'NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON', 'LIVREE',
];

export const STATUS_META: Record<OrderStatus, { fr: string; ar: string; color: string }> = {
  PROGRAMMEE: { fr: 'Programmée', ar: 'مبرمجة', color: 'gray' },
  NOUVELLE:   { fr: 'Nouvelle', ar: 'جديدة', color: 'blue' },
  ASSIGNEE:   { fr: 'Assignée', ar: 'مُسندة', color: 'indigo' },
  RETRAIT:    { fr: 'En route (retrait)', ar: 'في الطريق (الاستلام)', color: 'cyan' },
  RECUPEREE:  { fr: 'Récupérée', ar: 'تم الاستلام', color: 'violet' },
  LIVRAISON:  { fr: 'En route (livraison)', ar: 'في الطريق (التسليم)', color: 'amber' },
  LIVREE:     { fr: 'Livrée', ar: 'تم التسليم', color: 'green' },
  ECHOUEE:    { fr: 'Échouée', ar: 'فشل', color: 'red' },
  RETOUR:     { fr: 'Retour', ar: 'إرجاع', color: 'orange' },
  ANNULEE:    { fr: 'Annulée', ar: 'ملغاة', color: 'gray' },
};

/** Transition autorisée ? Le serveur est autoritaire sur le lifecycle (cf. transpo-offline-sync). */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (to === 'ANNULEE') return from !== 'LIVREE' && from !== 'ANNULEE';
  if (to === 'ECHOUEE') return from === 'LIVRAISON';
  if (to === 'RETOUR') return from === 'ECHOUEE';
  const i = LIFECYCLE.indexOf(from), j = LIFECYCLE.indexOf(to);
  return i >= 0 && j === i + 1; // uniquement l'étape suivante du chemin nominal
}

/* ====================== Enums métier ====================== */
export const PROOF_LEVELS = ['aucune', 'photo', 'signature', 'photo_signature'] as const;
export type ProofLevel = (typeof PROOF_LEVELS)[number]; // canonique: photo_signature (jamais photo_sig)

export const PARCEL_SIZES = ['Petit', 'Moyen', 'Grand', 'Très grand'] as const;
export type ParcelSize = (typeof PARCEL_SIZES)[number];

export type CashStatus = 'EQUILIBRE' | 'ECART' | 'A_DEPOSER' | 'DEPOSE' | 'EN_COURS';
export type ReturnStatus = 'A_TRAITER' | 'REPLANIFIE' | 'RETOUR_HUB' | 'A_RENDRE' | 'RENDU' | 'SOUFFRANCE';
export type FraudStatus = 'OUVERT' | 'ENQUETE' | 'BLANCHI' | 'CONFIRME';
export type BillingMode = 'prepaid' | 'postpaid';
export type Role = 'ADMIN' | 'DISPATCHER' | 'COMPTABLE' | 'MERCHANT' | 'SUPER_ADMIN';

export const MAX_RETURN_ATTEMPTS = 3;

/* ====================== Règles chiffrées ====================== */
export const COMMISSION_RATE = 0.15; // 15 % par défaut (configurable par tenant)
export const VAT_RATE = 0.20;        // TVA 20 %
export const EU561_MAX_DRIVE_HOURS = 9;
export const EU561_BREAK_MIN = 45;   // pause obligatoire après 4h30 cumulées

/** Reversement marchand : net = brut − commission. */
export function merchantPayoutNet(codBrut: number, rate: number = COMMISSION_RATE): number {
  return Math.round(codBrut * (1 - rate) * 100) / 100;
}

/* ====================== Tarification (cascade à 3 niveaux) ====================== */
// Grille standard par palier de distance (DH). Dernier palier au km.
export const PRICE_TIERS = [
  { from: 0, to: 3, base: 22 },
  { from: 3, to: 7, base: 32 },
  { from: 7, to: 15, base: 48 },
  { from: 15, to: 30, base: 75 },
  { from: 30, to: null as number | null, perKm: 3.2 },
];
export const FRAGILE_SURCHARGE = 15;
export const SCHEDULED_SURCHARGE = 10;

function gridPrice(distanceKm: number): number {
  const t = PRICE_TIERS.find((x) => (x.to === null ? distanceKm >= x.from : distanceKm >= x.from && distanceKm < x.to)) ?? PRICE_TIERS[0];
  return t.perKm ? Math.round(t.perKm * distanceKm) : (t.base ?? 0);
}

export interface QuoteInput {
  distanceKm: number;
  fragile?: boolean;
  scheduled?: boolean;
  merchantFixedPrice?: number | null; // ① prix négocié marchand
  discountRate?: number;              // ② remise contractuelle (ex. 0.1)
}
export interface Quote {
  applied: 'fixe_marchand' | 'remise' | 'grille';
  base: number; surcharges: number; ht: number; tva: number; ttc: number;
}

/**
 * Cascade tarifaire à PRIORITÉ STRICTE : ① prix fixe marchand → ② remise → ③ grille standard.
 * Le 1er niveau applicable l'emporte. Majorations fragile/programmée + TVA ajoutées ensuite.
 * Cf. transpo-domain / PRD-01 Tarification.
 */
export function quote(input: QuoteInput): Quote {
  const surcharges = (input.fragile ? FRAGILE_SURCHARGE : 0) + (input.scheduled ? SCHEDULED_SURCHARGE : 0);
  let base: number;
  let applied: Quote['applied'];
  if (input.merchantFixedPrice != null) { base = input.merchantFixedPrice; applied = 'fixe_marchand'; }
  else if (input.discountRate) { base = Math.round(gridPrice(input.distanceKm) * (1 - input.discountRate) * 100) / 100; applied = 'remise'; }
  else { base = gridPrice(input.distanceKm); applied = 'grille'; }
  const ht = Math.round((base + surcharges) * 100) / 100;
  const tva = Math.round(ht * VAT_RATE * 100) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  return { applied, base, surcharges, ht, tva, ttc };
}

/* ====================== Format monétaire ====================== */
export function money(n: number): string {
  const f = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
  return f.replace(/ | /g, ' ') + ' DH';
}

/* ====================== Type Order (contrat partagé) ====================== */
export interface Order {
  ref: string;
  code: string;            // 8 car., code de suivi
  status: OrderStatus;
  merchant: string | null;
  fromCity: string;
  toCity: string;
  driver: string | null;
  cod: number;             // 0 = prépayé
  codPaid: boolean;
  size: ParcelSize;
  proofLevel: ProofLevel;
  createdAt: string;
}
