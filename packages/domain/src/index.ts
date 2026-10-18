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

/** Artefacts exigés par un niveau de preuve, dans l'ordre d'affichage. */
export function proofRequirements(level: ProofLevel): ('photo' | 'signature')[] {
  switch (level) {
    case 'photo': return ['photo'];
    case 'signature': return ['signature'];
    case 'photo_signature': return ['photo', 'signature'];
    default: return [];
  }
}

const PROOF_LABEL: Record<'photo' | 'signature', string> = { photo: 'photo', signature: 'signature' };

/**
 * Vérifie qu'une livraison porte les preuves exigées. Retourne le message
 * d'erreur à afficher, ou `null` si la preuve est complète.
 */
export function missingProof(
  level: ProofLevel,
  provided: { photo?: string | null; signature?: string | null },
): string | null {
  const missing = proofRequirements(level).filter((k) => !provided[k]);
  if (missing.length === 0) return null;
  const what = missing.map((m) => PROOF_LABEL[m]).join(' et ');
  const verb = missing.length > 1 ? 'requises' : 'requise';
  return `Preuve incomplète : ${what} ${verb} pour ce niveau (${level}).`;
}

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
export const EU561_BREAK_AFTER_HOURS = 4.5; // conduite continue avant pause obligatoire
export const EU561_WARN_BEFORE_MIN = 30;    // alerte avant la limite journalière

/** Niveau d'alerte réglementaire d'une journée de conduite. */
export type Eu561Level = 'ok' | 'pause' | 'warn' | 'limite';

export interface Eu561Status {
  /** Conduite restante avant la limite journalière, en millisecondes (jamais négative). */
  remainingMs: number;
  /** Repos estimé : le temps de service qui n'était pas de la conduite. */
  restMs: number;
  level: Eu561Level;
}

/**
 * Évalue une journée de conduite au regard du règlement EU 561/2006.
 *
 * La règle vivait en double : l'app livreur redéfinissait ses propres seuils en
 * millisecondes à côté des constantes de ce module. Deux copies d'une règle
 * réglementaire finissent par diverger — et c'est celle de l'écran qui décide de
 * l'alerte affichée au conducteur. Une seule définition, testée ici.
 */
export function eu561Status(input: { drivenMs: number; amplitudeMs: number }): Eu561Status {
  const maxMs = EU561_MAX_DRIVE_HOURS * 3_600_000;
  const drivenMs = Math.max(0, input.drivenMs);
  const remainingMs = Math.max(0, maxMs - drivenMs);
  const restMs = Math.max(0, input.amplitudeMs - drivenMs);
  const level: Eu561Level = drivenMs >= maxMs
    ? 'limite'
    : remainingMs <= EU561_WARN_BEFORE_MIN * 60_000
      ? 'warn'
      : drivenMs >= EU561_BREAK_AFTER_HOURS * 3_600_000
        ? 'pause'
        : 'ok';
  return { remainingMs, restMs, level };
}

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

/**
 * Sous-domaines d'infrastructure, jamais des tenants. Le slug d'un tenant est
 * son sous-domaine (`slug.transpo.wedo.technology`) : `api` sert l'API publique,
 * les autres sont des noms d'hôte usuels. Deux usages, à garder alignés :
 * le provisioning les refuse, et la résolution de tenant par le host les ignore
 * (sans quoi un appel authentifié vers `api.…` serait vu comme un tenant « api »
 * en conflit avec le claim du JWT).
 */
export const RESERVED_SUBDOMAINS = ['api', 'www', 'app', 'admin', 'static', 'assets', 'mail', 'smtp', 'ftp'];
export function planByCode(code: string): SaasPlan | undefined {
  return SAAS_PLANS.find((p) => p.code === code);
}

/* ========= SaaS — catalogue versionné, abonnements, facturation (spec §3-6) =========
 * Spécification : design/SPEC-PLANS-ABONNEMENTS.md
 * SAAS_PLANS ci-dessus n'est plus le catalogue : il ne sert qu'à amorcer les tables
 * `platform.plans` (packages/db/src/migrate-plans.ts) et sera retiré une fois la
 * migration passée sur tous les environnements.
 */

// `PlanBillingMode` et non `BillingMode` : ce dernier existe déjà pour le mode de
// règlement d'un marchand (prepaid/postpaid), qui n'a aucun rapport.
export const PLAN_BILLING_MODES = ['FORFAIT', 'USAGE'] as const;
export type PlanBillingMode = (typeof PLAN_BILLING_MODES)[number];

/** VOLUME : le palier atteint tarife TOUT le volume. GRADUE : chaque tranche à son prix. */
export const TIER_MODES = ['VOLUME', 'GRADUE'] as const;
export type TierMode = (typeof TIER_MODES)[number];

export const SUBSCRIPTION_STATUSES = ['ESSAI', 'ACTIF', 'IMPAYE', 'SUSPENDU', 'RESILIE'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PLATFORM_INVOICE_STATUSES = ['EMISE', 'PAYEE', 'ANNULEE'] as const;
export type PlatformInvoiceStatus = (typeof PLATFORM_INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['VIREMENT', 'CHEQUE', 'ESPECES'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const TRIAL_DAYS = 14;        // durée de l'essai (spec §5.1)
export const GRACE_DAYS = 7;         // délai de grâce avant suspension (spec §13.4)
export const DEFAULT_VAT_RATE = 20;  // TVA plateforme, figée sur la facture à l'émission

/** Palier de volume. `toQty: null` = palier ouvert (obligatoirement le dernier). */
export interface PlanTier { fromQty: number; toQty: number | null; unitCentimes: number }

/** Tarif d'une version de plan. Tous les montants en centimes (spec §4.6). */
export interface PlanPricing {
  billingMode: PlanBillingMode;
  monthlyCentimes: number;
  includedOrders: number | null;
  overageCentimes: number | null;
  baseCentimes: number;
  tierMode: TierMode;
  minCentimes: number;
  tiers: PlanTier[];
}

export interface BillingLine { label: string; qty: number; unitCentimes: number; totalCentimes: number }

/**
 * Invariants d'une grille de paliers (spec §4.3) : premier palier à 1, paliers contigus
 * et sans recouvrement, exactement un palier ouvert et c'est le dernier.
 * Retourne le message d'erreur, ou `null` si la grille est valide.
 */
export function validateTiers(tiers: PlanTier[]): string | null {
  if (!tiers.length) return 'Au moins un palier est requis.';
  const s = [...tiers].sort((a, b) => a.fromQty - b.fromQty);
  if (s[0].fromQty !== 1) return 'Le premier palier doit commencer à 1.';
  for (let i = 0; i < s.length; i++) {
    const t = s[i];
    const n = i + 1;
    if (!Number.isInteger(t.fromQty) || t.fromQty < 1) return `Palier ${n} : borne basse invalide.`;
    if (!Number.isInteger(t.unitCentimes) || t.unitCentimes < 0) return `Palier ${n} : prix unitaire invalide.`;
    if (i === s.length - 1) {
      if (t.toQty !== null) return 'Le dernier palier doit être ouvert (sans borne haute).';
    } else {
      if (t.toQty === null) return `Palier ${n} : seul le dernier palier peut être ouvert.`;
      if (t.toQty < t.fromQty) return `Palier ${n} : borne haute inférieure à la borne basse.`;
      if (s[i + 1].fromQty !== t.toQty + 1) {
        return `Paliers ${n} et ${n + 1} non contigus : le suivant doit commencer à ${t.toQty + 1}.`;
      }
    }
  }
  return null;
}

const sumLines = (l: BillingLine[]): number => l.reduce((a, x) => a + x.totalCentimes, 0);
const tierLabel = (t: PlanTier): string => `${t.fromQty}–${t.toQty ?? '∞'}`;

/**
 * Calcule les lignes de facture d'une période (spec §6.2/6.3). Fonction pure : c'est le
 * seul endroit où un bug coûte de l'argent réel, il se teste sans base.
 *
 * Grille 1–100 → 6 DH, 101–500 → 4,50 DH, 501+ → 3 DH, pour 600 commandes :
 *   VOLUME → 600 × 3,00 = 1 800 DH · GRADUE → 100×6 + 400×4,50 + 100×3 = 2 700 DH
 */
export function computeBilling(
  pricing: PlanPricing,
  orders: number,
  planLabel: string,
): { lines: BillingLine[]; subtotalCentimes: number } {
  const qty = Math.max(0, Math.trunc(orders));
  const lines: BillingLine[] = [];

  if (pricing.billingMode === 'FORFAIT') {
    lines.push({
      label: `Abonnement ${planLabel}`,
      qty: 1, unitCentimes: pricing.monthlyCentimes, totalCentimes: pricing.monthlyCentimes,
    });
    const { includedOrders: inc, overageCentimes: over } = pricing;
    // overageCentimes null = dépassement affiché mais NON facturé (spec §6.3).
    if (inc != null && over != null && qty > inc) {
      const n = qty - inc;
      lines.push({
        label: `Commandes au-delà du quota (${inc})`,
        qty: n, unitCentimes: over, totalCentimes: n * over,
      });
    }
    return { lines, subtotalCentimes: sumLines(lines) };
  }

  const tiers = [...pricing.tiers].sort((a, b) => a.fromQty - b.fromQty);
  if (pricing.tierMode === 'VOLUME') {
    const t = tiers.find((x) => qty >= x.fromQty && (x.toQty === null || qty <= x.toQty));
    if (t && qty > 0) {
      lines.push({
        label: `Commandes — palier ${tierLabel(t)}`,
        qty, unitCentimes: t.unitCentimes, totalCentimes: qty * t.unitCentimes,
      });
    }
  } else {
    for (const t of tiers) {
      const hi = t.toQty === null ? qty : Math.min(qty, t.toQty);
      const n = hi - t.fromQty + 1;
      if (n > 0) {
        lines.push({
          label: `Commandes ${tierLabel(t)}`,
          qty: n, unitCentimes: t.unitCentimes, totalCentimes: n * t.unitCentimes,
        });
      }
    }
  }

  // Plancher d'abord, part fixe ensuite (spec §6.2).
  const usage = sumLines(lines);
  if (usage < pricing.minCentimes) {
    const d = pricing.minCentimes - usage;
    lines.push({ label: 'Complément — facture plancher', qty: 1, unitCentimes: d, totalCentimes: d });
  }
  if (pricing.baseCentimes > 0) {
    lines.push({
      label: 'Part fixe mensuelle',
      qty: 1, unitCentimes: pricing.baseCentimes, totalCentimes: pricing.baseCentimes,
    });
  }
  return { lines, subtotalCentimes: sumLines(lines) };
}

/** TVA appliquée sur le sous-total, jamais ligne à ligne (spec §6.5). */
export function applyVat(subtotalCentimes: number, vatRate: number): { vatCentimes: number; totalCentimes: number } {
  const vatCentimes = Math.round((subtotalCentimes * vatRate) / 100);
  return { vatCentimes, totalCentimes: subtotalCentimes + vatCentimes };
}

export const centimesToDh = (c: number): number => c / 100;
export const dhToCentimes = (dh: number): number => Math.round(dh * 100);

/* ============ Cycle d'abonnement — machine à états (spec §5, §7) ============ */

/**
 * Dates manipulées en 'YYYY-MM-DD' et calculées en UTC de bout en bout : passer par
 * un Date local ferait dériver d'un jour selon le fuseau du serveur, et une échéance
 * décalée d'un jour suspend un client trop tôt.
 */
const parseIso = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fmtIso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const addDaysIso = (iso: string, n: number): string => fmtIso(parseIso(iso) + n * 86400000);
export const periodOf = (iso: string): string => iso.slice(0, 7);
export function firstOfNextMonthIso(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return fmtIso(Date.UTC(y, m, 1));
}

/** Projection du statut d'abonnement vers `tenants.status`, que lit le paywall (spec §5.2). */
export const TENANT_STATUS_OF_SUBSCRIPTION: Record<SubscriptionStatus, TenantStatus> = {
  ESSAI: 'ESSAI',
  ACTIF: 'ACTIF',
  IMPAYE: 'ACTIF',     // relancé, mais il travaille encore : on ne coupe pas
  SUSPENDU: 'SUSPENDU',
  RESILIE: 'SUSPENDU',
};

export interface CycleSubscription {
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  renewsAt: string | null;
  hasNextPlan: boolean;
}

export type CycleAction =
  | { kind: 'TRIAL_EXPIRED'; pastDueSince: string }
  | { kind: 'SUSPEND' }
  | { kind: 'RENEW'; period: string; renewsAt: string; applyNextPlan: boolean }
  | null;

/**
 * Prochaine transition à appliquer, ou `null` si l'abonnement est à jour.
 *
 * Une seule transition par appel : l'appelant boucle jusqu'à `null`, ce qui fait
 * converger un abonnement en retard de plusieurs mois en une seule exécution du cycle
 * — et rend la fonction rejouable sans effet de bord (spec §7).
 */
export function cycleStep(s: CycleSubscription, today: string): CycleAction {
  if (s.status === 'ESSAI' && s.trialEndsAt && s.trialEndsAt < today) {
    return { kind: 'TRIAL_EXPIRED', pastDueSince: s.trialEndsAt };
  }
  if (s.status === 'IMPAYE' && s.pastDueSince && addDaysIso(s.pastDueSince, GRACE_DAYS) <= today) {
    return { kind: 'SUSPEND' };
  }
  if (s.status === 'ACTIF' && s.renewsAt && s.renewsAt <= today) {
    return {
      kind: 'RENEW',
      period: periodOf(s.renewsAt),
      renewsAt: firstOfNextMonthIso(s.renewsAt),
      applyNextPlan: s.hasNextPlan,
    };
  }
  return null;
}

/* ====================== Notifications (T19) ====================== */
// CONSOLE = notification interne, affichée dans la console (cloche + centre de notifications) :
// c'est le canal des alertes destinées à l'équipe d'exploitation, qui n'a pas de téléphone
// enregistré pour le push.
export const NOTIF_CHANNELS = ['SMS', 'WHATSAPP', 'PUSH', 'EMAIL', 'CONSOLE'] as const;
export type NotifChannel = (typeof NOTIF_CHANNELS)[number];

// Modèles bilingues. {code}/{ville} sont substitués à l'envoi. Placeholder `{x}`.
export const NOTIF_TEMPLATES: Record<string, { fr: string; ar: string; transactional: boolean }> = {
  'order.created':   { fr: 'Votre colis {code} est enregistré.', ar: 'تم تسجيل طردكم {code}.', transactional: true },
  'order.out':       { fr: 'Votre colis {code} est en cours de livraison.', ar: 'طردكم {code} في طريق التوصيل.', transactional: true },
  'order.delivered': { fr: 'Votre colis {code} a été livré. Merci !', ar: 'تم تسليم طردكم {code}. شكراً!', transactional: true },
  'order.failed':    { fr: 'Échec de livraison du colis {code}. Nouvel essai prévu.', ar: 'فشل تسليم الطرد {code}. ستتم إعادة المحاولة.', transactional: true },
  'promo':           { fr: 'Offre spéciale de la part de {x}.', ar: 'عرض خاص من {x}.', transactional: false },
  // Destiné au LIVREUR, pas au client final : c'est le seul modèle dont le destinataire
  // est un membre de l'équipe, et il part par notification push sur son téléphone.
  'driver.assigned': { fr: 'Nouvelle mission {code} — {ville}.', ar: 'مهمة جديدة {code} — {ville}.', transactional: true },
  // Affectation automatique (ADR 0004) : proposition au livreur, à accepter dans le délai.
  'driver.offer': { fr: 'Course proposée {code} — {ville}. Acceptez sous {delai} min.', ar: 'رحلة مقترحة {code} — {ville}. اقبلها خلال {delai} دقيقة.', transactional: true },
  // Alerte interne à l'exploitation : une commande que l'automate n'a pas pu placer.
  'dispatch.exception': { fr: 'Commande {ref} à affecter à la main : {motif}.', ar: 'الطلب {ref} يحتاج إسناداً يدوياً: {motif}.', transactional: true },
};
export type NotifEvent = keyof typeof NOTIF_TEMPLATES;

/** Substitue les variables `{nom}` d'un texte de modèle. Une variable absente reste visible. */
export function renderTemplate(text: string, vars: Record<string, string> = {}): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

/** Variables `{nom}` déclarées par un modèle, dédoublonnées. */
export function templateVars(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!))];
}

/** Rendu d'un modèle du catalogue par défaut. Les modèles persistés passent par `renderTemplate`. */
export function renderNotif(event: string, lang: 'fr' | 'ar', vars: Record<string, string> = {}): string {
  const tpl = NOTIF_TEMPLATES[event];
  if (!tpl) throw new Error(`Modèle de notification inconnu : ${event}`);
  return renderTemplate(lang === 'ar' ? tpl.ar : tpl.fr, vars);
}

/** Un événement transactionnel ne requiert pas de consentement marketing (loi 09-08). */
export function requiresConsent(event: string): boolean {
  return !(NOTIF_TEMPLATES[event]?.transactional ?? false);
}

/* ====================== Localisation d'un point de course ====================== */
/**
 * Facteur route / vol d'oiseau. La distance à vol d'oiseau (haversine) sous-estime le trajet
 * réel : le réseau urbain marocain (sens uniques, médinas, rocades) donne en pratique un
 * détour de 25 à 40 %. 1,3 est la valeur usuelle des études de « circuity » urbaines ; c'est
 * une ESTIMATION de devis, pas un calcul d'itinéraire (cf. transpo-maps-geo : le routing
 * réel viendra d'OSRM/Mapbox). Le prix final reste celui du moteur de tarification.
 */
export const ROAD_FACTOR = 1.3;
/** Longueur maximale d'un lien de carte conservé (au-delà : refusé, jamais tronqué). */
export const MAP_URL_MAX = 2048;

export interface LatLng { lat: number; lng: number }

export function isLatitude(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -90 && n <= 90;
}
export function isLongitude(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= -180 && n <= 180;
}

/**
 * Distance routière ESTIMÉE (km, 1 décimale) entre deux points précis :
 * haversine × ROAD_FACTOR, plancher à 1 km (une course n'est jamais facturée « 0 km »).
 */
export function roadDistanceKm(a: LatLng, b: LatLng): number {
  const km = (haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000) * ROAD_FACTOR;
  return Math.max(1, Math.round(km * 10) / 10);
}

/**
 * Lien de carte partageable pour des coordonnées, quand aucun lien d'origine n'existe
 * (épingle posée à la main). Format « Maps URLs » de Google : ouvert par l'app Google Maps
 * sur Android/iOS, par le navigateur ailleurs — sans clé d'API.
 */
export function shareableMapUrl(lat: number, lng: number): string {
  const f = (n: number) => String(Math.round(n * 1e6) / 1e6);
  return `https://www.google.com/maps/search/?api=1&query=${f(lat)},${f(lng)}`;
}

export interface PriceTier { from: number; to: number | null; base?: number; perKm?: number }

/** Prix grille pour une distance selon une grille de paliers (défaut : PRICE_TIERS). */
export function gridPriceFor(distanceKm: number, tiers: PriceTier[] = PRICE_TIERS): number {
  const t = tiers.find((x) => (x.to === null ? distanceKm >= x.from : distanceKm >= x.from && distanceKm < x.to)) ?? tiers[0];
  if (!t) return 0;
  return t.perKm ? Math.round(t.perKm * distanceKm) : (t.base ?? 0);
}

function gridPrice(distanceKm: number): number {
  return gridPriceFor(distanceKm, PRICE_TIERS);
}

/* ============ Conditions tarifaires par marchand (cf. docs/adr/0003) ============
 * Un transporteur travaille avec plusieurs marchands aux conditions commerciales
 * différentes : l'un paie la grille de distance de l'entreprise, l'autre une remise
 * négociée sur cette grille, un troisième un forfait par livraison quelle que soit la
 * distance. Ces conditions sont portées par la fiche marchand ; le moteur ci-dessous est
 * le SEUL endroit où elles se traduisent en prix (devis, création de commande, facture).
 */
export const PRICING_MODES = ['standard', 'remise', 'forfait'] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

/** Conditions tarifaires d'un marchand (sous-ensemble de la fiche marchand). */
export interface MerchantPricing {
  mode: PricingMode;
  /** Remise sur la grille, en fraction (0,1 = −10 %). Requise en mode `remise`. */
  discountRate?: number | null;
  /** Montant fixe HT par livraison (DH). Requis en mode `forfait`. */
  flatPrice?: number | null;
}

export function isPricingMode(v: unknown): v is PricingMode {
  return typeof v === 'string' && (PRICING_MODES as readonly string[]).includes(v);
}

/**
 * Cohérence des conditions avec leur mode. Retourne le message d'erreur, ou `null`.
 * Mêmes règles que les CHECK de la table `merchants` (migration 0028) : la base est le
 * dernier rempart, ce contrôle donne un message lisible avant d'y arriver.
 */
export function validateMerchantPricing(p: MerchantPricing): string | null {
  if (!isPricingMode(p.mode)) return `Mode tarifaire invalide (attendu : ${PRICING_MODES.join(', ')}).`;
  const has = (v: unknown) => v !== null && v !== undefined;
  if (p.mode === 'remise') {
    const r = p.discountRate;
    if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0 || r >= 1) {
      return 'Remise : un pourcentage strictement compris entre 0 et 100 % est requis.';
    }
    if (has(p.flatPrice)) return 'Remise : pas de forfait à renseigner.';
  }
  if (p.mode === 'forfait') {
    const f = p.flatPrice;
    if (typeof f !== 'number' || !Number.isFinite(f) || f <= 0) return 'Forfait : un montant strictement positif est requis.';
    if (has(p.discountRate)) return 'Forfait : pas de remise à renseigner.';
  }
  if (p.mode === 'standard' && (has(p.discountRate) || has(p.flatPrice))) {
    return 'Grille standard : ni remise ni forfait à renseigner.';
  }
  return null;
}

/** Commission COD applicable : celle négociée avec le marchand, à défaut celle de l'entreprise. */
export function effectiveCommissionRate(merchantRate: number | null | undefined, companyRate: number): number {
  return merchantRate == null ? companyRate : merchantRate;
}

/** Origine de la distance facturée : deux épingles posées, ou ville à ville. */
export type DistanceSource = 'points' | 'villes';

/**
 * Distance facturée d'une course. UNE seule règle, partagée par l'assistant (devis affiché)
 * et l'API (prix enregistré) : sans quoi le prix montré au marchand et le prix facturé
 * divergeraient dès qu'un des deux évolue.
 *  - deux points localisés → distance routière estimée entre les épingles ;
 *  - sinon → distance de ville à ville du référentiel.
 */
export function courseDistanceKm(input: {
  fromCity: string; toCity: string;
  pickup?: LatLng | null; drop?: LatLng | null;
}): { km: number; source: DistanceSource } {
  if (input.pickup && input.drop) return { km: roadDistanceKm(input.pickup, input.drop), source: 'points' };
  return { km: cityDistanceKm(input.fromCity, input.toCity), source: 'villes' };
}

export interface QuoteInput {
  distanceKm: number;
  fragile?: boolean;
  scheduled?: boolean;
  /**
   * Conditions du marchand. Quand elles sont fournies, elles DÉCIDENT seules du mode
   * (les deux champs historiques ci-dessous sont alors ignorés).
   */
  merchant?: MerchantPricing | null;
  merchantFixedPrice?: number | null; // historique : ① prix négocié marchand
  discountRate?: number;              // historique : ② remise contractuelle (ex. 0.1)
  tiers?: PriceTier[];                // grille configurée par tenant (défaut : PRICE_TIERS)
  fragileSurcharge?: number;          // supplément fragile configuré
  scheduledSurcharge?: number;        // supplément programmé configuré
  vatRate?: number;                   // TVA configurée par tenant (défaut : VAT_RATE)
}
export interface Quote {
  /** Libellé historique du niveau de cascade retenu (conservé pour les appelants existants). */
  applied: 'fixe_marchand' | 'remise' | 'grille';
  /** Mode tarifaire effectivement appliqué (vocabulaire de la fiche marchand). */
  mode: PricingMode;
  /** Prix grille avant remise, pour la distance — affiché à titre de comparaison. */
  gridBase: number;
  /** Remise appliquée (fraction), `null` hors mode remise. */
  discountRate: number | null;
  base: number; surcharges: number; ht: number; tva: number; ttc: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const MODE_OF_APPLIED: Record<Quote['applied'], PricingMode> = { fixe_marchand: 'forfait', remise: 'remise', grille: 'standard' };

/**
 * Prix d'une course. Trois modes, calculés ici et nulle part ailleurs :
 *  - standard : grille de distance + suppléments ;
 *  - remise   : grille × (1 − remise) + suppléments ;
 *  - forfait  : montant fixe + suppléments (fragile/programmé AJOUTÉS au forfait, décision
 *               produit — un colis fragile coûte plus cher à manipuler, quel que soit le contrat).
 * La TVA s'applique au HT dans tous les modes.
 *
 * Sans conditions marchand, la cascade historique reste valable : ① prix fixe → ② remise
 * → ③ grille standard, le premier niveau applicable l'emporte (cf. PRD-01 Tarification).
 */
export function quote(input: QuoteInput): Quote {
  const fragileS = input.fragileSurcharge ?? FRAGILE_SURCHARGE;
  const scheduledS = input.scheduledSurcharge ?? SCHEDULED_SURCHARGE;
  const surcharges = (input.fragile ? fragileS : 0) + (input.scheduled ? scheduledS : 0);
  const gp = gridPriceFor(input.distanceKm, input.tiers ?? PRICE_TIERS);

  let fixed: number | null = null;
  let rate: number | null = null;
  if (input.merchant) {
    const m = input.merchant;
    if (m.mode === 'forfait' && m.flatPrice != null) fixed = m.flatPrice;
    else if (m.mode === 'remise' && m.discountRate) rate = m.discountRate;
  } else if (input.merchantFixedPrice != null) {
    fixed = input.merchantFixedPrice;
  } else if (input.discountRate) {
    rate = input.discountRate;
  }

  let base: number;
  let applied: Quote['applied'];
  if (fixed != null) { base = r2(fixed); applied = 'fixe_marchand'; }
  else if (rate != null) { base = r2(gp * (1 - rate)); applied = 'remise'; }
  else { base = gp; applied = 'grille'; }
  const ht = r2(base + surcharges);
  const tva = r2(ht * (input.vatRate ?? VAT_RATE));
  const ttc = r2(ht + tva);
  return { applied, mode: MODE_OF_APPLIED[applied], gridBase: gp, discountRate: applied === 'remise' ? rate : null, base, surcharges, ht, tva, ttc };
}

/* ====================== Format monétaire ====================== */
export function money(n: number): string {
  const f = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
  // Isolat directionnel : en contexte RTL (interface arabe), l'algorithme bidi
  // découpe sinon le montant et sa devise en segments qu'il réordonne —
  // « 7 990,00 DH » s'affichait « 990,00 7 DH ». U+2066…U+2069 le traite comme
  // un bloc gauche-à-droite unique, sans effet visible en contexte LTR.
  return `⁦${f.replace(/ | /g, ' ')} DH⁩`;
}

/* ====================== Affectation automatique (ADR 0004) ====================== */
// Règles PURES de l'affectation automatique équitable. Le serveur les applique ; la console
// et l'app livreur n'en recalculent rien (elles affichent ce que le serveur a décidé).

/** Réglages d'entreprise de l'affectation automatique. */
export interface AutoDispatchSettings {
  /** Interrupteur d'entreprise. Désactivé par défaut : rien ne part sans décision explicite. */
  autoDispatch: boolean;
  /** Délai laissé au livreur pour accepter une proposition (minutes). */
  offerTimeoutMin: number;
  /** Nombre maximal de commandes affectées à un livreur par jour (défaut d'entreprise). */
  defaultDailyCapacity: number;
}
export const AUTO_DISPATCH_DEFAULTS: AutoDispatchSettings = {
  autoDispatch: false, offerTimeoutMin: 3, defaultDailyCapacity: 20,
};
export const OFFER_TIMEOUT_BOUNDS = { min: 1, max: 60 } as const;
export const DAILY_CAPACITY_BOUNDS = { min: 1, max: 500 } as const;

/** Statuts d'une proposition faite à un livreur. */
export const OFFER_STATUSES = ['PROPOSEE', 'ACCEPTEE', 'REFUSEE', 'EXPIREE', 'ANNULEE'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** Motifs pour lesquels l'automate n'a pas pu placer une commande (→ file d'exceptions). */
export const DISPATCH_EXCEPTIONS = [
  'AUCUN_LIVREUR_DISPONIBLE', 'ZONE_NON_COUVERTE', 'CAPACITE_ATTEINTE', 'REFUSEE_PAR_TOUS',
] as const;
export type DispatchException = (typeof DISPATCH_EXCEPTIONS)[number];

export const DISPATCH_EXCEPTION_META: Record<DispatchException, { fr: string; ar: string; hintFr: string; hintAr: string }> = {
  AUCUN_LIVREUR_DISPONIBLE: {
    fr: 'Aucun livreur disponible', ar: 'لا يوجد سائق متاح',
    hintFr: 'Des livreurs couvrent la zone, mais aucun n’est disponible, en règle et doté d’un compte actif.',
    hintAr: 'يوجد سائقون يغطون المنطقة، لكن لا أحد منهم متاح أو وثائقه سارية أو حسابه مفعّل.',
  },
  ZONE_NON_COUVERTE: {
    fr: 'Zone non couverte', ar: 'منطقة غير مغطاة',
    hintFr: 'Aucune zone d’un livreur ne couvre le point de retrait.',
    hintAr: 'لا توجد منطقة سائق تغطي نقطة الاستلام.',
  },
  CAPACITE_ATTEINTE: {
    fr: 'Capacité atteinte', ar: 'السعة مكتملة',
    hintFr: 'Tous les livreurs éligibles ont atteint leur capacité du jour.',
    hintAr: 'بلغ جميع السائقين المؤهلين سعتهم اليومية.',
  },
  REFUSEE_PAR_TOUS: {
    fr: 'Refusée par tous', ar: 'رفضها الجميع',
    hintFr: 'Tous les livreurs éligibles ont refusé ou laissé expirer la proposition.',
    hintAr: 'رفض جميع السائقين المؤهلين العرض أو تركوه ينتهي.',
  },
};

/**
 * Libellés des faits d'affectation automatique écrits au journal de la commande
 * (`order_events.status`). Ce ne sont PAS des statuts de commande : la commande reste
 * `NOUVELLE` tant qu'aucune proposition n'est acceptée.
 */
export const DISPATCH_EVENT_META: Record<string, { fr: string; ar: string }> = {
  OFFRE_PROPOSEE: { fr: 'Proposée à un livreur', ar: 'عُرضت على سائق' },
  OFFRE_ACCEPTEE: { fr: 'Proposition acceptée', ar: 'تم قبول العرض' },
  OFFRE_REFUSEE: { fr: 'Proposition refusée', ar: 'تم رفض العرض' },
  OFFRE_EXPIREE: { fr: 'Proposition expirée', ar: 'انتهت صلاحية العرض' },
  OFFRE_ANNULEE: { fr: 'Proposition annulée', ar: 'أُلغي العرض' },
  EXCEPTION_DISPATCH: { fr: 'Exception de dispatch', ar: 'استثناء في التوزيع' },
  RELANCE_DISPATCH: { fr: 'Affectation automatique relancée', ar: 'أُعيد إطلاق التوزيع التلقائي' },
};

/**
 * Point dans un polygone (lancer de rayon). Polygone en `[latitude, longitude]`, comme
 * les zones du dispatch ; un point sur le bord est indifféremment dedans ou dehors (sans
 * conséquence à l'échelle d'une zone de livraison).
 */
export function pointInPolygon(point: LatLng, polygon: number[][]): boolean {
  if (!Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  const x = point.lng, y = point.lat;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i]![0]!, xi = polygon[i]![1]!;
    const yj = polygon[j]![0]!, xj = polygon[j]![1]!;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Normalise un nom de lieu pour comparaison : casse, accents, tirets, espaces. */
export function normalizePlace(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Zone telle que la lit l'automate. `drivers` = NOMS des livreurs rattachés. */
export interface DispatchZone {
  nameFr: string;
  drivers: string[];
  polygon: number[][] | null;
  province: string | null;
  commune: string | null;
  region: string | null;
}

/** Point de retrait de la commande : coordonnées si connues, ville sinon. */
export interface DispatchPickup { city: string; point: LatLng | null }

/**
 * Une zone couvre-t-elle le point de retrait ?
 *  · coordonnées connues ET polygone dessiné → point dans le polygone (seul critère) ;
 *  · sinon → correspondance de ville : la ville de retrait est la province ou la commune
 *    de la zone, ou l'un des noms composant sa région (« Casablanca-Settat »).
 */
export function zoneCovers(zone: DispatchZone, pickup: DispatchPickup): boolean {
  const poly = Array.isArray(zone.polygon) && zone.polygon.length >= 3 ? zone.polygon : null;
  if (pickup.point && poly) return pointInPolygon(pickup.point, poly);
  const city = normalizePlace(pickup.city);
  if (!city) return false;
  if (normalizePlace(zone.province) === city || normalizePlace(zone.commune) === city) return true;
  const regionParts = (zone.region ?? '').split(/[-–]/).map(normalizePlace).filter(Boolean);
  return regionParts.includes(city);
}

/** Livreur tel que l'évalue l'automate, avec sa charge du jour déjà comptée. */
export interface DispatchCandidate {
  name: string;
  available: boolean;
  /** Compte de l'app livreur actif. Sans compte (ou compte suspendu), personne ne peut accepter. */
  accountActive: boolean;
  licenseDue: string | null;  // YYYY-MM-DD
  medicalDue: string | null;  // YYYY-MM-DD
  /** Capacité du jour (propre au livreur, à défaut celle de l'entreprise). */
  capacity: number;
  /** Commandes affectées aujourd'hui + propositions en cours. */
  load: number;
  /** Dernière position GPS connue, si elle existe. */
  lastPosition: LatLng | null;
}

/** Motif d'écart d'un livreur, du plus structurant au plus conjoncturel. */
export type CandidateExclusion =
  | 'HORS_ZONE' | 'INDISPONIBLE' | 'SANS_COMPTE' | 'PERMIS_EXPIRE' | 'VISITE_EXPIREE'
  | 'DEJA_SOLLICITE' | 'CAPACITE_ATTEINTE';

/** Un livreur classé : sa charge relative et sa distance au retrait (km, si connue). */
export interface RankedCandidate {
  name: string; load: number; capacity: number; ratio: number; distanceKm: number | null;
}

export type DispatchPlan =
  | { kind: 'offer'; driver: RankedCandidate; ranking: RankedCandidate[]; excluded: Record<string, CandidateExclusion> }
  | { kind: 'exception'; reason: DispatchException; excluded: Record<string, CandidateExclusion> };

/**
 * Écarte (ou non) un livreur pour une commande, en dehors de sa charge.
 * `today` au format YYYY-MM-DD dans le fuseau de l'entreprise.
 */
function exclusionOf(d: DispatchCandidate, today: string): CandidateExclusion | null {
  if (!d.available) return 'INDISPONIBLE';
  if (!d.accountActive) return 'SANS_COMPTE';
  if (d.licenseDue != null && d.licenseDue < today) return 'PERMIS_EXPIRE';
  if (d.medicalDue != null && d.medicalDue < today) return 'VISITE_EXPIREE';
  return null;
}

/** Classement équitable : charge relative croissante, puis distance, puis nom. */
export function compareCandidates(a: RankedCandidate, b: RankedCandidate): number {
  if (a.ratio !== b.ratio) return a.ratio - b.ratio;
  // Distance connue avant distance inconnue : à charge égale, on ne parie pas sur un
  // livreur dont on ignore la position.
  if (a.distanceKm != null && b.distanceKm != null && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
  if (a.distanceKm != null && b.distanceKm == null) return -1;
  if (a.distanceKm == null && b.distanceKm != null) return 1;
  return a.name.localeCompare(b.name, 'fr');
}

/**
 * Décide à qui proposer une commande — ou pourquoi personne.
 *
 * Éligible = la zone du livreur couvre le retrait, ET il est disponible, doté d'un compte
 * actif, permis et visite médicale valides, ET il n'a pas déjà été sollicité pour cette
 * commande dans le tour courant, ET sa charge du jour est sous sa capacité.
 *
 * ÉQUITÉ, pas « le meilleur score rafle tout » : parmi les éligibles, le MOINS CHARGÉ au
 * regard de sa capacité (charge / capacité) ; à égalité, le plus proche du retrait (dernière
 * position GPS) ; puis le nom, pour un résultat déterministe.
 *
 * Le motif d'exception suit l'entonnoir, du plus structurant au plus conjoncturel :
 * personne ne couvre la zone → ZONE_NON_COUVERTE ; personne de disponible et en règle →
 * AUCUN_LIVREUR_DISPONIBLE ; tous déjà sollicités → REFUSEE_PAR_TOUS ; tous pleins →
 * CAPACITE_ATTEINTE.
 */
export function planAutoDispatch(input: {
  pickup: DispatchPickup;
  drivers: DispatchCandidate[];
  zones: DispatchZone[];
  /** Livreurs déjà sollicités pour cette commande dans le tour courant (refus, expiration). */
  alreadyAsked: string[];
  today: string;
}): DispatchPlan {
  const excluded: Record<string, CandidateExclusion> = {};
  const covering = new Set<string>();
  for (const z of input.zones) {
    if (zoneCovers(z, input.pickup)) for (const n of z.drivers) covering.add(n);
  }
  const inZone = input.drivers.filter((d) => {
    if (covering.has(d.name)) return true;
    excluded[d.name] = 'HORS_ZONE';
    return false;
  });
  if (inZone.length === 0) return { kind: 'exception', reason: 'ZONE_NON_COUVERTE', excluded };

  const fit = inZone.filter((d) => {
    const why = exclusionOf(d, input.today);
    if (why) excluded[d.name] = why;
    return !why;
  });
  if (fit.length === 0) return { kind: 'exception', reason: 'AUCUN_LIVREUR_DISPONIBLE', excluded };

  const asked = new Set(input.alreadyAsked);
  const fresh = fit.filter((d) => {
    if (!asked.has(d.name)) return true;
    excluded[d.name] = 'DEJA_SOLLICITE';
    return false;
  });
  if (fresh.length === 0) return { kind: 'exception', reason: 'REFUSEE_PAR_TOUS', excluded };

  const withRoom = fresh.filter((d) => {
    if (d.load < d.capacity) return true;
    excluded[d.name] = 'CAPACITE_ATTEINTE';
    return false;
  });
  if (withRoom.length === 0) return { kind: 'exception', reason: 'CAPACITE_ATTEINTE', excluded };

  const ranking = withRoom.map((d): RankedCandidate => ({
    name: d.name, load: d.load, capacity: d.capacity,
    ratio: d.capacity > 0 ? d.load / d.capacity : Number.POSITIVE_INFINITY,
    distanceKm: d.lastPosition && input.pickup.point
      ? Math.round(haversineMeters(d.lastPosition.lat, d.lastPosition.lng, input.pickup.point.lat, input.pickup.point.lng) / 100) / 10
      : null,
  })).sort(compareCandidates);
  return { kind: 'offer', driver: ranking[0]!, ranking, excluded };
}

/** Date du jour (YYYY-MM-DD) dans un fuseau donné — la « journée » de la capacité. */
export function dayInTimeZone(date: Date, timeZone = 'Africa/Casablanca'): string {
  // en-CA formate en AAAA-MM-JJ.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
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
  // Coordonnées des deux points de la course. Facultatives : les commandes créées avant
  // qu'elles soient conservées n'en portent pas, et la ville reste le minimum vital.
  pickupContact?: string | null;
  pickupPhone?: string | null;
  pickupAddress?: string | null;
  pickupNotes?: string | null;
  dropContact?: string | null;
  dropPhone?: string | null;
  dropAddress?: string | null;
  dropNotes?: string | null;
  // Localisation précise (WGS84) et lien de carte d'origine, transmis au livreur pour
  // naviguer. Absents quand le point n'a été saisi qu'en texte (cf. migration 0027).
  pickupLat?: number | null;
  pickupLng?: number | null;
  pickupMapUrl?: string | null;
  dropLat?: number | null;
  dropLng?: number | null;
  dropMapUrl?: string | null;
  description?: string | null;
  vehicleType?: string | null;
  fragile?: boolean;
  // Prix figé à la création (cf. migration 0028) : c'est lui que la facture reprend. Absent
  // (null) pour les commandes antérieures, que la facturation recalcule à la grille.
  pricingMode?: PricingMode | null;
  distanceKm?: number | null;
  priceBase?: number | null;
  priceSurcharges?: number | null;
  priceHt?: number | null;
  priceVat?: number | null;
  priceTtc?: number | null;
  // Affectation automatique (ADR 0004). `dispatchException` : motif pour lequel l'automate
  // n'a pas pu placer la commande (file d'exceptions du dispatch).
  assignedAt?: string | null;
  dispatchException?: DispatchException | null;
  dispatchExceptionAt?: string | null;
  dispatchRound?: number;
  createdAt: string;
}

/* ====================== Marchand (contrat partagé) ====================== */
/**
 * Fiche marchand. `name` est la clé de rattachement historique : c'est la même chaîne que
 * `orders.merchant` et `users.merchant`, d'où son caractère non modifiable.
 */
export interface Merchant extends MerchantPricing {
  id: string;
  name: string;
  legalName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  discountRate: number | null;
  flatPrice: number | null;
  /** Commission COD négociée (fraction) ; `null` = taux de l'entreprise. */
  commissionRate: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ====================== Suivi de flotte (PC flotte) ====================== */

/**
 * Distance (m) d'un point à un polygone `[lat, lng]` : 0 à l'intérieur, sinon distance au
 * bord le plus proche. Projection locale équirectangulaire : précise au mètre près à
 * l'échelle d'une ville, sans dépendance géographique.
 */
export function distanceToPolygonM(point: LatLng, polygon: number[][]): number {
  if (!Array.isArray(polygon) || polygon.length < 3) return Infinity;
  if (pointInPolygon(point, polygon)) return 0;
  const k = Math.cos((point.lat * Math.PI) / 180);
  const xy = (lat: number, lng: number) => [(lng - point.lng) * k * 111_320, (lat - point.lat) * 110_540] as const;
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, ay] = xy(polygon[j]![0]!, polygon[j]![1]!);
    const [bx, by] = xy(polygon[i]![0]!, polygon[i]![1]!);
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
}

/**
 * Situation d'un livreur vis-à-vis de SES zones (celles qui le citent). Hors zone = hors de
 * toutes ; `distanceM` = écart à la plus proche. Sans zone dessinée : rien à signaler.
 */
export function zoneStatus(point: LatLng, zones: { nameFr: string; polygon: number[][] | null }[]):
  { zone: string | null; outOfZone: boolean; distanceM: number | null } {
  const dessinees = zones.filter((z) => Array.isArray(z.polygon) && z.polygon.length >= 3);
  if (!dessinees.length) return { zone: zones[0]?.nameFr ?? null, outOfZone: false, distanceM: null };
  let plus = dessinees[0]!, dMin = Infinity;
  for (const z of dessinees) {
    const d = distanceToPolygonM(point, z.polygon!);
    if (d < dMin) { dMin = d; plus = z; }
  }
  return { zone: plus.nameFr, outOfZone: dMin > 0, distanceM: Math.round(dMin) };
}

/** Longueur (m) d'une trace ordonnée. Les sauts aberrants (> 2 km entre deux points) sont ignorés. */
export function pathLengthM(points: { lat: number; lng: number }[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const s = haversineMeters(points[i - 1]!.lat, points[i - 1]!.lng, points[i]!.lat, points[i]!.lng);
    if (s < 2000) d += s;
  }
  return d;
}

/** Vitesse instantanée (km/h) entre les deux dernières positions horodatées ; `null` si incalculable. */
export function speedKmh(points: { lat: number; lng: number; at: string | Date }[]): number | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2]!, b = points[points.length - 1]!;
  const dt = (new Date(b.at).getTime() - new Date(a.at).getTime()) / 3_600_000;
  if (dt <= 0) return null;
  return Math.round(haversineMeters(a.lat, a.lng, b.lat, b.lng) / 1000 / dt);
}
