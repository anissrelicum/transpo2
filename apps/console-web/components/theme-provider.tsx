'use client';
import * as React from 'react';
import { Theme } from '@radix-ui/themes';
import { RADIX_THEME } from '@transpo/design-tokens';

type Appearance = 'light' | 'dark';
const ThemeCtx = React.createContext<{ appearance: Appearance; toggle: () => void }>({
  appearance: 'light',
  toggle: () => {},
});
export const useAppTheme = () => React.useContext(ThemeCtx);

const STORAGE_KEY = 'transpo.console.theme';

/**
 * Fournit le thème Radix (indigo/slate) + bascule clair/sombre, comme la maquette.
 *
 * La préférence est PERSISTÉE : elle ne vivait que dans l'état du composant, si bien que
 * chaque navigation (les pages sont rendues côté serveur) ramenait l'exploitant au thème
 * clair. Choisir le sombre ne tenait donc que le temps d'un écran — autant dire jamais.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = React.useState<Appearance>('light');

  // Relecture après montage : le rendu serveur ne connaît pas le stockage du navigateur.
  React.useEffect(() => {
    try {
      const gardee = window.localStorage.getItem(STORAGE_KEY);
      if (gardee === 'dark' || gardee === 'light') setAppearance(gardee);
    } catch { /* stockage indisponible (navigation privée) : on reste en clair */ }
  }, []);

  const toggle = React.useCallback(() => setAppearance((a) => {
    const suivant: Appearance = a === 'dark' ? 'light' : 'dark';
    try { window.localStorage.setItem(STORAGE_KEY, suivant); } catch { /* sans persistance */ }
    return suivant;
  }), []);
  return (
    <ThemeCtx.Provider value={{ appearance, toggle }}>
      <Theme
        appearance={appearance}
        accentColor={RADIX_THEME.accentColor as any}
        grayColor={RADIX_THEME.grayColor as any}
        radius={RADIX_THEME.radius as any}
        panelBackground={RADIX_THEME.panelBackground as any}
        style={{ minHeight: '100vh' }}
      >
        {children}
      </Theme>
    </ThemeCtx.Provider>
  );
}
