import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Order } from '@transpo/domain';
import type { Tournee } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { TourneesView } from '../../../components/TourneesView';

export const dynamic = 'force-dynamic';

export default async function TourneesPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let tournees: Tournee[] = [];
  let orders: Order[] = [];
  let drivers: string[] = [];
  try {
    const c = serverClient();
    [tournees, orders] = await Promise.all([c.getTournees(), c.getOrders()]);
    if (canWrite) drivers = (await c.getDrivers()).map((d) => d.name);
  } catch {
    redirect('/login');
  }

  // Commandes non affectées, disponibles pour une nouvelle tournée.
  const unassigned = orders
    .filter((o) => !o.driver && ['NOUVELLE', 'PROGRAMMEE'].includes(o.status))
    .map((o) => ({ ref: o.ref, toCity: o.toCity }));

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <TourneesView tournees={tournees} drivers={drivers} unassigned={unassigned} canWrite={canWrite} />
    </Box>
  );
}
