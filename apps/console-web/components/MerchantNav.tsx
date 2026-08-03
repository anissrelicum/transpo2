'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flex, Text, Button } from '@radix-ui/themes';
import { ExitIcon } from '@radix-ui/react-icons';

const TABS = [
  { href: '/portail', label: 'Tableau de bord' },
  { href: '/portail/commandes', label: 'Mes commandes' },
  { href: '/portail/portefeuille', label: 'Portefeuille' },
  { href: '/portail/facture', label: 'Facture' },
];

export function MerchantNav({ name }: { name: string }) {
  const pathname = usePathname();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    window.location.assign('/login'); // navigation dure (cookies purgés côté serveur)
  }

  return (
    <Flex align="center" gap="4" wrap="wrap">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Text key={t.href} size="2" weight={active ? 'medium' : 'regular'} asChild>
            <Link
              href={t.href}
              style={{
                color: active ? 'var(--indigo-11)' : 'var(--gray-11)',
                textDecoration: 'none',
                borderBottom: active ? '2px solid var(--indigo-9)' : '2px solid transparent',
                paddingBottom: 2,
              }}
            >{t.label}</Link>
          </Text>
        );
      })}
      <Text size="2" color="gray">{name}</Text>
      <Button size="1" variant="soft" color="gray" onClick={logout}><ExitIcon /> Se déconnecter</Button>
    </Flex>
  );
}
