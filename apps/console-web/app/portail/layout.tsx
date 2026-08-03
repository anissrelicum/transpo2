import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box, Flex, Heading, Badge } from '@radix-ui/themes';
import { MerchantNav } from '../../components/MerchantNav';

export const dynamic = 'force-dynamic';

/**
 * Portail marchand : même tenant que la console transport, mais toutes les vues
 * sont scopées au claim `merchant` du JWT côté API. Le garde-fou de rôle ici
 * n'est qu'un raccourci d'affichage — c'est l'API qui fait autorité.
 */
export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  const jar = cookies();
  if (!jar.get('token')?.value) redirect('/login');
  if (jar.get('role')?.value !== 'MERCHANT') redirect('/dashboard');
  const name = jar.get('name')?.value || 'Marchand';

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      <Box style={{ borderBottom: '1px solid var(--gray-a5)', background: 'var(--color-panel-solid)' }}>
        <Flex align="center" justify="between" gap="4" px="5" py="3" wrap="wrap" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <Flex align="center" gap="3">
            <Heading size="4">Transpo</Heading>
            <Badge color="indigo" variant="soft">Espace marchand</Badge>
          </Flex>
          <MerchantNav name={name} />
        </Flex>
      </Box>
      <Box px="5" py="5" style={{ maxWidth: 1200, margin: '0 auto' }}>{children}</Box>
    </Box>
  );
}
