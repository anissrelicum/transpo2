import { cookies } from 'next/headers';
import { t, dir, isLang, DEFAULT_LANG, type Lang, type Translate } from '@transpo/i18n';

export const LANG_COOKIE = 'lang';

/**
 * Langue de la requête, lue du cookie `lang`. Choisie côté serveur pour que le
 * rendu SSR sorte déjà dans la bonne langue et la bonne direction — sinon la
 * page s'afficherait en français puis basculerait, et le RTL sauterait.
 */
export function currentLang(): Lang {
  const v = cookies().get(LANG_COOKIE)?.value;
  return isLang(v) ? v : DEFAULT_LANG;
}

/** Raccourci pour les composants serveur : `const { tr, lang } = i18n();` */
export function i18n(): { lang: Lang; tr: Translate; dir: 'rtl' | 'ltr' } {
  const lang = currentLang();
  return { lang, tr: t(lang), dir: dir(lang) };
}
