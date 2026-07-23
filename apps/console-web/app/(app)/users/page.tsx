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
  try {
    users = await serverClient().getUsers();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <UsersView users={users} isAdmin={isAdmin} />
    </Box>
  );
}
