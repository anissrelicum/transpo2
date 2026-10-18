// Libellés FR/AR de l'affectation automatique (ADR 0004) — réglages, chauffeurs, dispatch,
// cloche. Un dictionnaire par module (cf. skill transpo-i18n) : chaque clé ci-dessous est
// RÉELLEMENT consommée par un écran ; un libellé ajouté sans usage serait un dictionnaire mort.
import type { Lang } from '@transpo/i18n';
import { DISPATCH_EXCEPTION_META, DISPATCH_EVENT_META, type DispatchException } from '@transpo/domain';

const FR = {
  // Paramètres
  settingsTitle: 'Affectation automatique',
  settingsIntro: 'Quand elle est active, chaque nouvelle commande (et chaque commande programmée arrivée à échéance) est proposée au livreur le moins chargé dont la zone couvre le point de retrait. Il accepte ou refuse dans le délai ; sans réponse, la course passe au suivant. Le dispatcher ne traite plus que les exceptions.',
  settingsSwitch: 'Activer l’affectation automatique',
  settingsOn: 'Active', settingsOff: 'Désactivée',
  settingsTimeout: 'Délai d’acceptation', settingsTimeoutHint: '1 à 60 min',
  settingsCapacity: 'Capacité journalière par défaut', settingsCapacityHint: 'commandes / livreur / jour — modifiable par chauffeur',
  minutes: 'min', perDay: '/ jour',
  saved: 'Enregistré ✓', save: 'Enregistrer', saveFailed: 'Enregistrement impossible',
  // Chauffeurs
  capacityCol: 'Capacité / jour', capacityDefault: 'défaut ({n})', capacityField: 'Capacité journalière',
  capacityPlaceholder: 'Vide = défaut de l’entreprise ({n})',
  capacityInvalid: 'Entier entre 1 et 500, ou vide.',
  appAccount: 'App livreur', appACTIF: 'Compte actif', appSUSPENDU: 'Compte suspendu', appAUCUN: 'Sans compte',
  appHint: 'Sans compte actif, aucune proposition automatique.',
  // Dispatch
  tabExceptions: 'Exceptions', tabQueue: 'À affecter', tabOffers: 'Propositions',
  autoOnBanner: 'Affectation automatique active — vous ne traitez que les exceptions.',
  autoOffBanner: 'Affectation automatique désactivée — toutes les commandes passent par vous.',
  enableInSettings: 'Paramètres',
  noException: 'Aucune exception : l’automate a placé toutes les commandes.',
  noOffer: 'Aucune proposition en attente de réponse.',
  noQueue: 'Tout est affecté. Aucune commande en attente.',
  assign: 'Affecter', retry: 'Relancer l’auto', retrying: 'Relance…',
  retryOffer: 'Proposée à {driver}', retryException: 'Toujours en exception : {reason}',
  retryFailed: 'Relance impossible',
  declined: '{n} refus / sans réponse',
  offeredTo: 'Proposée à {driver}', expiresIn: 'expire dans {t}', expired: 'échue — en cours de réattribution',
  since: 'depuis {t}',
  legendDriver: 'Livreur en ligne', legendOrder: 'Commande à affecter',
  markerOnline: 'En ligne', markerOutOfZone: 'Hors zone', zoomIn: 'Zoomer', zoomOut: 'Dézoomer',
  pageSubtitle: 'Carte temps réel · {live} livreur(s) en ligne · {n} à affecter · {x} exception(s)',
  refresh: 'Actualiser',
  dialogTitle: 'Assigner un livreur', dialogScore: 'Score /100',
  dialogHint: '{ref} · zone (40) + disponibilité (30) + faible charge (30).',
  computing: 'Calcul des scores…', noDriver: 'Aucun livreur disponible.',
  recommended: 'Recommandé', choose: 'Choisir', close: 'Fermer', assignFailed: 'Affectation impossible',
  prepaid: 'Prépayé', partZone: 'Zone', partDispo: 'Dispo', partCharge: 'Charge',
  // Cloche
  bellTitle: 'Alertes', bellNone: 'Aucune exception de dispatch.',
  bellCount: '{n} commande(s) à affecter à la main',
  bellSeeExceptions: 'Voir les exceptions', bellSeeAll: 'Centre de notifications',
};

type Dict = { [K in keyof typeof FR]: string };

const AR: Dict = {
  settingsTitle: 'الإسناد التلقائي',
  settingsIntro: 'عند تفعيله، يُعرض كل طلب جديد (وكل طلب مبرمج حان موعده) على السائق الأقل انشغالاً الذي تغطي منطقته نقطة الاستلام. يقبل أو يرفض خلال المهلة؛ وبدون رد ينتقل الطلب إلى السائق التالي. لا يعالج الموزّع سوى الاستثناءات.',
  settingsSwitch: 'تفعيل الإسناد التلقائي',
  settingsOn: 'مفعّل', settingsOff: 'معطّل',
  settingsTimeout: 'مهلة القبول', settingsTimeoutHint: 'من 1 إلى 60 دقيقة',
  settingsCapacity: 'السعة اليومية الافتراضية', settingsCapacityHint: 'طلبات / سائق / يوم — قابلة للتعديل لكل سائق',
  minutes: 'د', perDay: '/ يوم',
  saved: 'تم الحفظ ✓', save: 'حفظ', saveFailed: 'تعذّر الحفظ',
  capacityCol: 'السعة / يوم', capacityDefault: 'افتراضي ({n})', capacityField: 'السعة اليومية',
  capacityPlaceholder: 'فارغ = القيمة الافتراضية للشركة ({n})',
  capacityInvalid: 'عدد صحيح بين 1 و500، أو فارغ.',
  appAccount: 'تطبيق السائق', appACTIF: 'حساب مفعّل', appSUSPENDU: 'حساب موقوف', appAUCUN: 'بدون حساب',
  appHint: 'بدون حساب مفعّل، لا عروض تلقائية.',
  tabExceptions: 'الاستثناءات', tabQueue: 'للإسناد', tabOffers: 'العروض',
  autoOnBanner: 'الإسناد التلقائي مفعّل — لا تعالج سوى الاستثناءات.',
  autoOffBanner: 'الإسناد التلقائي معطّل — كل الطلبات تمر عبرك.',
  enableInSettings: 'الإعدادات',
  noException: 'لا توجد استثناءات: أسند النظام كل الطلبات.',
  noOffer: 'لا توجد عروض في انتظار الرد.',
  noQueue: 'كل الطلبات مسندة. لا يوجد طلب في الانتظار.',
  assign: 'إسناد', retry: 'إعادة الإسناد التلقائي', retrying: 'جارٍ الإعادة…',
  retryOffer: 'عُرض على {driver}', retryException: 'ما زال استثناءً: {reason}',
  retryFailed: 'تعذّرت الإعادة',
  declined: '{n} رفض / بدون رد',
  offeredTo: 'معروض على {driver}', expiresIn: 'ينتهي خلال {t}', expired: 'انتهى — قيد إعادة الإسناد',
  since: 'منذ {t}',
  legendDriver: 'سائق متصل', legendOrder: 'طلب للإسناد',
  markerOnline: 'متصل', markerOutOfZone: 'خارج المنطقة', zoomIn: 'تكبير', zoomOut: 'تصغير',
  pageSubtitle: 'خريطة مباشرة · {live} سائق(ون) متصل(ون) · {n} للإسناد · {x} استثناء(ات)',
  refresh: 'تحديث',
  dialogTitle: 'إسناد سائق', dialogScore: 'النقاط /100',
  dialogHint: '{ref} · المنطقة (40) + التوفر (30) + انخفاض الحمل (30).',
  computing: 'جارٍ حساب النقاط…', noDriver: 'لا يوجد سائق متاح.',
  recommended: 'موصى به', choose: 'اختيار', close: 'إغلاق', assignFailed: 'تعذّر الإسناد',
  prepaid: 'مدفوع مسبقاً', partZone: 'المنطقة', partDispo: 'التوفر', partCharge: 'الحمل',
  bellTitle: 'التنبيهات', bellNone: 'لا توجد استثناءات في التوزيع.',
  bellCount: '{n} طلب(ات) تحتاج إسناداً يدوياً',
  bellSeeExceptions: 'عرض الاستثناءات', bellSeeAll: 'مركز الإشعارات',
};

export type DispatchKey = keyof typeof FR;
export type DispatchT = (k: DispatchKey, vars?: Record<string, string | number>) => string;

export function dispatchT(lang: Lang): DispatchT {
  const table: Dict = lang === 'ar' ? AR : FR;
  return (k, vars) => {
    const raw = table[k] ?? FR[k];
    return vars ? raw.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`)) : raw;
  };
}

/** Libellé + explication d'un motif d'exception (source : packages/domain). */
export function exceptionLabel(reason: DispatchException, lang: Lang): { label: string; hint: string } {
  const m = DISPATCH_EXCEPTION_META[reason];
  return lang === 'ar' ? { label: m.ar, hint: m.hintAr } : { label: m.fr, hint: m.hintFr };
}

/** Couleur sémantique d'un motif (rouge = structurel, ambre = conjoncturel). */
export const EXCEPTION_COLOR: Record<DispatchException, 'red' | 'amber' | 'orange'> = {
  ZONE_NON_COUVERTE: 'red',
  AUCUN_LIVREUR_DISPONIBLE: 'orange',
  CAPACITE_ATTEINTE: 'amber',
  REFUSEE_PAR_TOUS: 'amber',
};

/** Libellé d'un fait d'affectation automatique du journal de commande, ou `null`. */
export function dispatchEventLabel(status: string, lang: Lang): string | null {
  const m = DISPATCH_EVENT_META[status];
  return m ? (lang === 'ar' ? m.ar : m.fr) : null;
}

/** « 2 min 05 » / « 45 s » — compte à rebours lisible. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
}
