import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { ConsoleUser } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { UsersView } from '../../../components/UsersView';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  let users: ConsoleUser[] = [];
  // L'effectif alimente le choix du chauffeur lors de l'invitation d'un compte livreur :
  // un accès terrain se rattache à une fiche existante, jamais à un nom saisi au clavier.
  let chauffeurs: string[] = [];
  try {
    const c = serverClient();
    users = await c.getUsers();
    if (isAdmin) {
      try { chauffeurs = (await c.getDrivers()).map((d) => d.name); } catch { /* effectif indisponible */ }
    }
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <UsersView users={users} isAdmin={isAdmin} chauffeurs={chauffeurs} />
    </Box>
  );
}
