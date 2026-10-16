import '@radix-ui/themes/styles.css';
import * as React from 'react';
import { AppThemeProvider } from '../components/theme-provider';
import { i18n } from '../lib/i18n';

export const metadata = {
  title: 'Portrail — Console',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
};

// Sans viewport, les téléphones affichaient la console comme une page de bureau réduite :
// texte minuscule à la connexion (constaté sur Android, 16/10).
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#0B1537' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // `lang` et `dir` sont posés au rendu serveur : la page sort déjà dans la
  // bonne direction, sans bascule visible au chargement.
  const { lang, dir } = i18n();
  return (
    <html lang={lang} dir={dir}>
      <body style={{ margin: 0 }}>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
