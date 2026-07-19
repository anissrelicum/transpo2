import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Box, Button } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';
import { OrdersClient } from '../../../components/OrdersClient';

export const dynamic = 'force-dynamic';

export default async function OrdersPage({ searchParams }: { searchParams: { q?: string } }) {
  const role = cookies().get('role')?.value || '';
  const canCreate = ['ADMIN', 'DISPATCHER', 'MERCHANT'].includes(role);
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(role);

  let all: Order[] = [];
  let driverNames: string[] = [];
  try {
    const c = serverClient();
    all = await c.getOrders();
    if (canWrite) driverNames = (await c.getDrivers()).map((d) => d.name);
  } catch {
    redirect('/login');
  }

  const cities = [...new Set(all.flatMap((o) => [o.fromCity, o.toCity]))].sort();
  const merchants = [...new Set(all.map((o) => o.merchant).filter(Boolean) as string[])].sort();

  return (
    <Box style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Commandes"
        subtitle={`${all.length} commande(s) · toutes périodes`}
        actions={canCreate ? (
          <Button asChild><Link href="/orders/new"><PlusIcon /> Nouvelle commande</Link></Button>
        ) : undefined}
      />
      <OrdersClient
        orders={all}
        drivers={driverNames}
        cities={cities}
        merchants={merchants}
        canWrite={canWrite}
        initialQuery={searchParams.q}
      />
    </Box>
  );
}
