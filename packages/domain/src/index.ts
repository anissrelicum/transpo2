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

export interface QuoteInput {
  distanceKm: number;
  fragile?: boolean;
  scheduled?: boolean;
  merchantFixedPrice?: number | null; // ① prix négocié marchand
  discountRate?: number;              // ② remise contractuelle (ex. 0.1)
  tiers?: PriceTier[];                // grille configurée par tenant (défaut : PRICE_TIERS)
  fragileSurcharge?: number;          // supplément fragile configuré
  scheduledSurcharge?: number;        // supplément programmé configuré
  vatRate?: number;                   // TVA configurée par tenant (défaut : VAT_RATE)
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
  const fragileS = input.fragileSurcharge ?? FRAGILE_SURCHARGE;
  const scheduledS = input.scheduledSurcharge ?? SCHEDULED_SURCHARGE;
  const surcharges = (input.fragile ? fragileS : 0) + (input.scheduled ? scheduledS : 0);
  const gp = gridPriceFor(input.distanceKm, input.tiers ?? PRICE_TIERS);
  let base: number;
  let applied: Quote['applied'];
  if (input.merchantFixedPrice != null) { base = input.merchantFixedPrice; applied = 'fixe_marchand'; }
  else if (input.discountRate) { base = Math.round(gp * (1 - input.discountRate) * 100) / 100; applied = 'remise'; }
  else { base = gp; applied = 'grille'; }
  const ht = Math.round((base + surcharges) * 100) / 100;
  const tva = Math.round(ht * (input.vatRate ?? VAT_RATE) * 100) / 100;
  const ttc = Math.round((ht + tva) * 100) / 100;
  return { applied, base, surcharges, ht, tva, ttc };
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
  description?: string | null;
  vehicleType?: string | null;
  createdAt: string;
}
