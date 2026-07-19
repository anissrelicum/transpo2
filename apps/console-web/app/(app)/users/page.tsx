import * as React from 'react';
import { cookies } from 'next/headers';
import { Card, Flex, Text, Heading, Avatar, Badge, Separator } from '@radix-ui/themes';
import { PageTitle, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default function UsersPage() {
  const jar = cookies();
  const name = jar.get('name')?.value || 'Utilisateur';
  const role = jar.get('role')?.value || '—';
  const tenant = jar.get('tenant')?.value || '—';
  const initials = name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

  return (
    <Box style={{ ...wrap, maxWidth: 640 }}>
      <PageTitle title="Utilisateurs" subtitle="Compte connecté à cette session." />
      <Card size="3">
        <Flex align="center" gap="4">
          <Avatar size="6" radius="full" fallback={initials} color="indigo" />
          <Box>
            <Heading size="5">{name}</Heading>
            <Flex align="center" gap="2" mt="2">
              <Badge color="indigo">{role}</Badge>
              <Badge color="gray" variant="soft">Organisation : {tenant}</Badge>
            </Flex>
          </Box>
        </Flex>
        <Separator my="4" size="4" />
        <Text size="2" color="gray">
          La gestion complète des utilisateurs (création, rôles, désactivation) est
          administrée côté serveur par tenant. Cette vue reflète votre session courante.
        </Text>
      </Card>
    </Box>
  );
}
