// @transpo/i18n — bilingue FR/AR + RTL. Source unique des libellés partagés (web + RN).
// Cf. skill transpo-i18n. RÈGLE : toujours consommer le helper, jamais de chaîne en dur à l'écran.
import { STATUS_META, type OrderStatus } from '@transpo/domain';

export const LANGS = ['fr', 'ar'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'fr';

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

export function dir(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Nom de la langue dans sa propre langue (sélecteur). */
export const LANG_LABEL: Record<Lang, string> = { fr: 'Français', ar: 'العربية' };

/** Libellé de statut localisé (réutilise STATUS_META du domaine — pas de retraduction). */
export function statusLabel(status: OrderStatus, lang: Lang): string {
  const m = STATUS_META[status];
  return lang === 'ar' ? m.ar : m.fr;
}

/**
 * Dictionnaire par espace de noms. Le français fait foi : une clé absente en
 * arabe retombe dessus plutôt que d'afficher la clé brute à l'écran.
 */
const FR = {
  common: {
    appName: 'Transpo',
    login: 'Se connecter', logout: 'Se déconnecter', email: 'E-mail', password: 'Mot de passe',
    search: 'Rechercher', save: 'Enregistrer', cancel: 'Annuler', create: 'Créer', confirm: 'Confirmer',
    edit: 'Modifier', remove: 'Retirer', close: 'Fermer', back: 'Retour', all: 'Tous',
    loading: 'Chargement…', empty: 'Aucune donnée', error: 'Une erreur est survenue',
    yes: 'Oui', no: 'Non', language: 'Langue', theme: 'Thème',
  },
  nav: {
    operations: 'Opérations', fleet: 'Flotte', billing: 'Facturation', administration: 'Administration',
    dashboard: 'Tableau de bord', orders: 'Commandes', analytics: 'Analytics & SLA', fraud: 'Fraude COD',
    tournees: 'Tournées', dispatch: 'Dispatch', fleetLive: 'PC flotte', zones: 'Zones', hub: 'Tri en hub',
    returns: 'Retours', vehicles: 'Véhicules', drivers: 'Chauffeurs', pricing: 'Tarification',
    invoices: 'Factures', cash: 'Caisse', payout: 'Reversement COD', users: 'Utilisateurs',
    notifications: 'Notifications', reviews: 'Avis clients', templates: 'Modèles de notif.',
    settings: 'Paramètres', searchPlaceholder: 'Rechercher une commande, un marchand, un code…',
  },
  roles: {
    ADMIN: 'Administrateur', DISPATCHER: 'Dispatcher', COMPTABLE: 'Comptable',
    MERCHANT: 'Marchand', DRIVER: 'Livreur', SUPER_ADMIN: 'Plateforme', UNKNOWN: 'Utilisateur',
  },
  login: {
    subtitle: 'Console transport', saasSubtitle: 'Console SaaS — plateforme',
    organisation: 'Organisation', realm: 'Realm', platform: 'plateforme',
    signingIn: 'Connexion…', failed: 'Échec de connexion',
    hostHint: 'L’organisation est déterminée par l’adresse (sous-domaine).',
    platformHint: 'Compte plateforme, hors organisation.',
    toSaas: 'Connexion console SaaS (plateforme) →', toTenant: '← Connexion à une organisation',
  },
  dashboard: {
    title: 'Tableau de bord', subtitle: 'Vue opérationnelle du {date}',
    export: 'Exporter', orders: 'Commandes', inProgress: 'En cours', delivered: 'Livrées',
    failed: 'Échouées', codCollected: 'COD encaissé', total: 'total en base', cumul: 'cumul',
    unassigned: '{n} non affectées', toProcess: 'à traiter', reversable: 'reversable',
    activity: 'Activité de la journée', activityHint: 'Commandes créées par heure',
    peak: 'Pic à {hour}h', urgent: 'Commandes urgentes', seeAll: 'Tout voir',
    noUrgent: 'Aucune commande urgente.', compliance: 'Conformité flotte',
    complianceHint: 'Échéances à traiter', noAlert: 'Aucune échéance en alerte.',
    codToday: 'COD du jour', toPay: 'à reverser', collected: 'Encaissé', toCollect: 'À encaisser',
    merchantPayout: 'Reversement marchands', open: 'Ouvrir',
  },
} as const;

/**
 * Structure du dictionnaire : les **clés** viennent du français (qui fait foi),
 * les valeurs sont élargies à `string` — sans quoi `as const` figerait chaque
 * libellé en type littéral et l'arabe deviendrait inassignable.
 */
type Dict = { [N in keyof typeof FR]: { [K in keyof (typeof FR)[N]]: string } };

const AR: Dict = {
  common: {
    appName: 'Transpo',
    login: 'تسجيل الدخول', logout: 'تسجيل الخروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    search: 'بحث', save: 'حفظ', cancel: 'إلغاء', create: 'إنشاء', confirm: 'تأكيد',
    edit: 'تعديل', remove: 'إزالة', close: 'إغلاق', back: 'رجوع', all: 'الكل',
    loading: 'جارٍ التحميل…', empty: 'لا توجد بيانات', error: 'حدث خطأ',
    yes: 'نعم', no: 'لا', language: 'اللغة', theme: 'المظهر',
  },
  nav: {
    operations: 'العمليات', fleet: 'الأسطول', billing: 'الفوترة', administration: 'الإدارة',
    dashboard: 'لوحة القيادة', orders: 'الطلبات', analytics: 'التحليلات', fraud: 'الاحتيال',
    tournees: 'الجولات', dispatch: 'التوزيع', fleetLive: 'مركز الأسطول', zones: 'المناطق', hub: 'الفرز',
    returns: 'المرتجعات', vehicles: 'المركبات', drivers: 'السائقون', pricing: 'التسعير',
    invoices: 'الفواتير', cash: 'الصندوق', payout: 'تحويل المبالغ', users: 'المستخدمون',
    notifications: 'الإشعارات', reviews: 'آراء العملاء', templates: 'نماذج الإشعارات',
    settings: 'الإعدادات', searchPlaceholder: 'ابحث عن طلب أو تاجر أو رمز…',
  },
  roles: {
    ADMIN: 'مدير', DISPATCHER: 'موزّع', COMPTABLE: 'محاسب',
    MERCHANT: 'تاجر', DRIVER: 'سائق', SUPER_ADMIN: 'المنصة', UNKNOWN: 'مستخدم',
  },
  login: {
    subtitle: 'كونسول النقل', saasSubtitle: 'كونسول المنصة',
    organisation: 'المؤسسة', realm: 'النطاق', platform: 'المنصة',
    signingIn: 'جارٍ الاتصال…', failed: 'فشل تسجيل الدخول',
    hostHint: 'تُحدَّد المؤسسة من العنوان (النطاق الفرعي).',
    platformHint: 'حساب المنصة، خارج أي مؤسسة.',
    toSaas: '← كونسول المنصة', toTenant: 'الاتصال بمؤسسة →',
  },
  dashboard: {
    title: 'لوحة القيادة', subtitle: 'نظرة تشغيلية ليوم {date}',
    export: 'تصدير', orders: 'الطلبات', inProgress: 'قيد التنفيذ', delivered: 'تم التسليم',
    failed: 'فاشلة', codCollected: 'المبالغ المحصلة', total: 'الإجمالي في القاعدة', cumul: 'التراكمي',
    unassigned: '{n} غير مسندة', toProcess: 'للمعالجة', reversable: 'قابلة للتحويل',
    activity: 'نشاط اليوم', activityHint: 'الطلبات المنشأة حسب الساعة',
    peak: 'الذروة عند {hour}س', urgent: 'طلبات عاجلة', seeAll: 'عرض الكل',
    noUrgent: 'لا توجد طلبات عاجلة.', compliance: 'امتثال الأسطول',
    complianceHint: 'استحقاقات للمعالجة', noAlert: 'لا توجد استحقاقات.',
    codToday: 'تحصيل اليوم', toPay: 'للتحويل', collected: 'محصّل', toCollect: 'للتحصيل',
    merchantPayout: 'تحويل للتجار', open: 'فتح',
  },
};

const DICT: Record<Lang, Dict> = { fr: FR, ar: AR };

type Ns = keyof Dict;
export type Key = { [N in Ns]: `${N}.${Extract<keyof Dict[N], string>}` }[Ns];

/**
 * Fonction de traduction. Usage : `const tr = t('ar'); tr('nav.orders')`.
 * `vars` substitue les jetons `{nom}` du libellé.
 */
export function t(lang: Lang): (key: Key, vars?: Record<string, string | number>) => string {
  const table = DICT[lang] ?? DICT.fr;
  return (key, vars) => {
    const [ns, k] = key.split('.') as [Ns, string];
    const raw =
      (table[ns] as Record<string, string>)?.[k] ??
      (DICT.fr[ns] as Record<string, string>)?.[k] ??
      key;
    return vars ? raw.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? `{${v}}`)) : raw;
  };
}

export type Translate = ReturnType<typeof t>;
export { DICT };
