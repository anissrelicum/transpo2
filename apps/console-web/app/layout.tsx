import '@radix-ui/themes/styles.css';
import * as React from 'react';
import { AppThemeProvider } from '../components/theme-provider';

export const metadata = { title: 'Transpo — Console transport' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <AppThemeProvider>{children}</AppThemeProvider>
      </body>
    </html>
  );
}
