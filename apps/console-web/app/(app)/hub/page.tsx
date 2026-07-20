import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../../lib/server';
import { HubView } from '../../../components/HubView';

export const dynamic = 'force-dynamic';

export default async function HubPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let parcels: Order[] = [];
  try {
    parcels = await serverClient().getHub();
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <HubView parcels={parcels} canWrite={canWrite} />
    </Box>
  );
}
