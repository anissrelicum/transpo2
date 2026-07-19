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

/** Fournit le thème Radix (indigo/slate) + bascule clair/sombre, comme la maquette. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = React.useState<Appearance>('light');
  const toggle = React.useCallback(() => setAppearance((a) => (a === 'dark' ? 'light' : 'dark')), []);
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
