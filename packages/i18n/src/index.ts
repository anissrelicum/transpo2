// @transpo/i18n — bilingue FR/AR + RTL. Source unique des libellés partagés (web + RN).
// Cf. skill transpo-i18n. RÈGLE : toujours consommer le helper, jamais de chaîne en dur à l'écran.
import { STATUS_META, type OrderStatus } from '@transpo/domain';

export type Lang = 'fr' | 'ar';

export function dir(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Libellé de statut localisé (réutilise STATUS_META du domaine — pas de retraduction). */
export function statusLabel(status: OrderStatus, lang: Lang): string {
  const m = STATUS_META[status];
  return lang === 'ar' ? m.ar : m.fr;
}

// Dictionnaire partagé (clés transverses). Chaque écran peut compléter avec son propre bloc.
const DICT = {
  fr: {
    appName: 'Transpo',
    login: 'Se connecter', logout: 'Se déconnecter', email: 'E-mail', password: 'Mot de passe',
    orders: 'Commandes', dashboard: 'Tableau de bord', search: 'Rechercher',
    save: 'Enregistrer', cancel: 'Annuler', create: 'Créer', confirm: 'Confirmer',
    tenants: 'Locataires', provision: 'Provisionner un tenant',
    loading: 'Chargement…', empty: 'Aucune donnée', error: 'Une erreur est survenue',
  },
  ar: {
    appName: 'Transpo',
    login: 'تسجيل الدخول', logout: 'تسجيل الخروج', email: 'البريد الإلكتروني', password: 'كلمة المرور',
    orders: 'الطلبات', dashboard: 'لوحة القيادة', search: 'بحث',
    save: 'حفظ', cancel: 'إلغاء', create: 'إنشاء', confirm: 'تأكيد',
    tenants: 'المستأجرون', provision: 'تزويد مستأجر',
    loading: 'جارٍ التحميل…', empty: 'لا توجد بيانات', error: 'حدث خطأ',
  },
} as const;

export type DictKey = keyof typeof DICT['fr'];

/** Renvoie la fonction de traduction pour une langue. Usage : const tr = t('ar'); tr('orders'). */
export function t(lang: Lang): (key: DictKey) => string {
  const table = DICT[lang] ?? DICT.fr;
  return (key) => table[key] ?? DICT.fr[key] ?? String(key);
}

export { DICT };
