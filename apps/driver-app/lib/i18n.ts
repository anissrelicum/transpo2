// Langue de l'app livreur — état courant persisté + bascule FR/AR + RTL natif.
// PAS de dictionnaire ici : les libellés (FR et AR) sont repris écran par écran
// depuis `design/lot3-app-livreur.jsx` par chaque écran (cf. skill transpo-i18n :
// "un dictionnaire non consommé = correction inopérante" — donc pas de dictionnaire
// mort ici non plus). On réutilise `@transpo/i18n` (Lang, dir, isLang…) pour rester
// aligné avec la console web plutôt que de redéfinir ces primitives.
import { useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import { readJson, writeJson } from './storage';
import { DEFAULT_LANG, dir, isLang, type Lang } from '@transpo/i18n';

const STORAGE_KEY = 'transpo.lang';

let currentLang: Lang = DEFAULT_LANG;
let hydrated = false;
let hydrationPromise: Promise<Lang> | null = null;
const listeners = new Set<(lang: Lang) => void>();

function notify(): void {
  for (const fn of listeners) fn(currentLang);
}

/**
 * Applique la direction RTL au niveau natif. `I18nManager.forceRTL` ne
 * remonte pas l'arbre déjà monté : RN fige la direction au lancement du
 * bundle JS, donc un changement ne prend pleinement effet natif (miroir des
 * `flexDirection: 'row'`, marges physiques, etc.) qu'après un redémarrage de
 * l'app. On l'appelle quand même pour que le prochain lancement soit correct,
 * et on signale si CE changement nécessite un redémarrage immédiat.
 */
function applyRTL(lang: Lang): boolean {
  const shouldBeRTL = dir(lang) === 'rtl';
  const restartRequired = I18nManager.isRTL !== shouldBeRTL;
  I18nManager.allowRTL(shouldBeRTL);
  I18nManager.forceRTL(shouldBeRTL);
  return restartRequired;
}

/** Charge la langue persistée. Idempotent — sûr à appeler depuis plusieurs écrans. */
export function hydrateLanguage(): Promise<Lang> {
  if (hydrated) return Promise.resolve(currentLang);
  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      const stored = await readJson<string>(STORAGE_KEY, DEFAULT_LANG);
      currentLang = isLang(stored) ? stored : DEFAULT_LANG;
      applyRTL(currentLang);
      hydrated = true;
      notify();
      return currentLang;
    })();
  }
  return hydrationPromise;
}

export function getLanguage(): Lang {
  return currentLang;
}

/**
 * Change la langue courante, la persiste et applique le RTL natif.
 * `restartRequired` : `true` si l'app doit redémarrer pour que la mise en
 * page se réoriente réellement (bascule FR↔AR) — à afficher à l'utilisateur.
 */
export async function setLanguage(lang: Lang): Promise<{ restartRequired: boolean }> {
  const restartRequired = applyRTL(lang);
  currentLang = lang;
  hydrated = true;
  await writeJson(STORAGE_KEY, lang);
  notify();
  return { restartRequired };
}

export async function toggleLanguage(): Promise<{ lang: Lang; restartRequired: boolean }> {
  const next: Lang = currentLang === 'ar' ? 'fr' : 'ar';
  const { restartRequired } = await setLanguage(next);
  return { lang: next, restartRequired };
}

/** Langue courante + direction, réactif (re-rend au changement). Hydrate au premier montage. */
export function useLanguage(): {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  rtl: boolean;
  setLanguage: typeof setLanguage;
  toggleLanguage: typeof toggleLanguage;
} {
  const [lang, setLang] = useState(currentLang);

  useEffect(() => {
    hydrateLanguage().then(setLang);
    listeners.add(setLang);
    return () => {
      listeners.delete(setLang);
    };
  }, []);

  return { lang, dir: dir(lang), rtl: dir(lang) === 'rtl', setLanguage, toggleLanguage };
}

export type { Lang };
export { dir };
