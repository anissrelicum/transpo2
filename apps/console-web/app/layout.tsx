import '@radix-ui/themes/styles.css';
import * as React from 'react';
import { Theme } from '@radix-ui/themes';
import { RADIX_THEME } from '@transpo/design-tokens';

export const metadata = { title: 'Transpo — Console transport' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0 }}>
        <Theme
          accentColor={RADIX_THEME.accentColor as any}
          grayColor={RADIX_THEME.grayColor as any}
          radius={RADIX_THEME.radius as any}
          panelBackground={RADIX_THEME.panelBackground as any}
        >
          {children}
        </Theme>
      </body>
    </html>
  );
}
