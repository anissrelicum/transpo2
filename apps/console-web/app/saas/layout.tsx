import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box, Flex, Heading, Badge } from '@radix-ui/themes';
import { SaasNav } from '../../components/SaasNav';

export const dynamic = 'force-dynamic';

/**
 * Console SaaS : realm plateforme, hors tenant. Le JWT porte `platform: true`
 * et le rôle SUPER_ADMIN — l'API refuse tout autre rôle, ce garde-fou n'est
 * qu'un raccourci d'affichage pour éviter une page vide.
 */
export default function SaasLayout({ children }: { children: React.ReactNode }) {
  const jar = cookies();
  if (jar.get('role')?.value !== 'SUPER_ADMIN') redirect('/login?realm=saas');
  const name = jar.get('name')?.value || 'Plateforme';

  return (
    <Box style={{ minHeight: '100vh', background: 'var(--gray-2)' }}>
      <Box style={{ borderBottom: '1px solid var(--gray-a5)', background: 'var(--color-panel-solid)' }}>
        <Flex align="center" justify="between" gap="4" px="5" py="3" style={{ maxWidth: 1300, margin: '0 auto' }}>
          <Flex align="center" gap="3">
            <Heading size="4">Transpo</Heading>
            <Badge color="amber" variant="soft">Console SaaS</Badge>
          </Flex>
          <SaasNav name={name} />
        </Flex>
      </Box>
      <Box px="5" py="5" style={{ maxWidth: 1300, margin: '0 auto' }}>{children}</Box>
    </Box>
  );
}
