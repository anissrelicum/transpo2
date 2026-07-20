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
export type Role = 'ADMIN' | 'DISPATCHER' | 'COMPTABLE' | 'MERCHANT' | 'DRIVER' | 'SUPER_ADMIN';

export const MAX_RETURN_ATTEMPTS = 3;

/* ====================== Fraude COD — barème de signaux ====================== */
export const FRAUD_SIGNALS = {
  non_declare: { label: 'COD encaissé non déclaré', pts: 35 },
  ecart_cash: { label: 'Écart de caisse récurrent', pts: 30 },
  hors_geo: { label: 'Livraison hors géofence', pts: 28 },
  echec_sans_preuve: { label: 'Échec sans preuve GPS', pts: 22 },
  absent_eleve: { label: 'Taux « client absent » anormal', pts: 18 },
  depot_tardif: { label: 'Dépôt cash tardif (> 24 h)', pts: 15 },
} as const;
export type FraudSignal = keyof typeof FRAUD_SIGNALS;

/** Score de risque (0-100, plafonné) = somme des points des signaux. Jamais de sanction auto. */
export function fraudScore(signals: FraudSignal[]): number {
  const raw = signals.reduce((a, s) => a + (FRAUD_SIGNALS[s]?.pts ?? 0), 0);
  return Math.min(100, raw);
}

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

/* ====================== Terrain — livreur annexes (T10) ====================== */
export const DRIVER_DELIVERY_FEE = 12; // rémunération livreur par livraison réussie (DH)
export const INCIDENT_TYPES = ['ADRESSE', 'CLIENT_INJOIGNABLE', 'COLIS_ENDOMMAGE', 'VEHICULE', 'AUTRE'] as const;
export type IncidentType = (typeof INCIDENT_TYPES)[number];

/* ====================== Géo / flotte (T16) ====================== */
/** Distance en mètres entre deux points (formule de haversine). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

// Coordonnées réelles des villes (référentiel géo) — servent au calcul de distance.
export const CITY_COORDS: Record<string, [number, number]> = {
  Casablanca: [33.5731, -7.5898], Rabat: [34.0209, -6.8416], Salé: [34.0531, -6.7985],
  Marrakech: [31.6295, -7.9811], Tanger: [35.7595, -5.8340], Fès: [34.0181, -5.0078],
  Mohammedia: [33.6863, -7.3828], Kénitra: [34.2610, -6.5802], Tétouan: [35.5785, -5.3684],
  Meknès: [33.8935, -5.5473], Agadir: [30.4278, -9.5981], Oujda: [34.6867, -1.9114],
};
export const CITIES_WITH_COORDS = Object.keys(CITY_COORDS);

/** Distance routière estimée (km) entre deux villes du référentiel. */
export function cityDistanceKm(from: string, to: string): number {
  const a = CITY_COORDS[from], b = CITY_COORDS[to];
  if (!a || !b) return 0;
  if (from === to) return 6; // intra-urbain moyen
  return Math.round(haversineMeters(a[0], a[1], b[0], b[1]) / 1000);
}

/* ====================== SaaS — plans & abonnements (T18) ====================== */
export interface SaasPlan { code: string; label: string; monthlyDH: number; maxOrdersMonth: number | null; }
export const SAAS_PLANS: SaasPlan[] = [
  { code: 'Essai',         label: 'Essai (14 j)',  monthlyDH: 0,    maxOrdersMonth: 50 },
  { code: 'TPE Coursier',  label: 'TPE Coursier',  monthlyDH: 299,  maxOrdersMonth: 500 },
  { code: 'Transporteur',  label: 'Transporteur',  monthlyDH: 899,  maxOrdersMonth: 5000 },
  { code: 'Entreprise',    label: 'Entreprise',    monthlyDH: 2499, maxOrdersMonth: null },
];
export const TENANT_STATUSES = ['ESSAI', 'ACTIF', 'SUSPENDU'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];
export function planByCode(code: string): SaasPlan | undefined {
  return SAAS_PLANS.find((p) => p.code === code);
}

/* ====================== Notifications (T19) ====================== */
export const NOTIF_CHANNELS = ['SMS', 'WHATSAPP', 'PUSH', 'EMAIL'] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

// Modèles bilingues. {code}/{ville} sont substitués à l'envoi. Placeholder `{x}`.
export const NOTIF_TEMPLATES: Record<string, { fr: string; ar: string; transactional: boolean }> = {
  'order.created':   { fr: 'Votre colis {code} est enregistré.', ar: 'تم تسجيل طردكم {code}.', transactional: true },
  'order.out':       { fr: 'Votre colis {code} est en cours de livraison.', ar: 'طردكم {code} في طريق التوصيل.', transactional: true },
  'order.delivered': { fr: 'Votre colis {code} a été livré. Merci !', ar: 'تم تسليم طردكم {code}. شكراً!', transactional: true },
  'order.failed':    { fr: 'Échec de livraison du colis {code}. Nouvel essai prévu.', ar: 'فشل تسليم الطرد {code}. ستتم إعادة المحاولة.', transactional: true },
  'promo':           { fr: 'Offre spéciale de la part de {x}.', ar: 'عرض خاص من {x}.', transactional: false },
};
export type NotifEvent = keyof typeof NOTIF_TEMPLATES;

/** Rendu d'un modèle dans la langue voulue avec substitution des variables. */
export function renderNotif(event: string, lang: 'fr' | 'ar', vars: Record<string, string> = {}): string {
  const tpl = NOTIF_TEMPLATES[event];
  if (!tpl) throw new Error(`Modèle de notification inconnu : ${event}`);
  return (lang === 'ar' ? tpl.ar : tpl.fr).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Un événement transactionnel ne requiert pas de consentement marketing (loi 09-08). */
export function requiresConsent(event: string): boolean {
  return !(NOTIF_TEMPLATES[event]?.transactional ?? false);
}

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
  rating?: number | null;         // note client (1..5) post-livraison
  ratingComment?: string | null;
  hubPhase?: string | null;       // tri en hub : arrive | trier | quai
  createdAt: string;
}
