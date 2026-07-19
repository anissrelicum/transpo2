import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Zone } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';
import { ZonesView } from '../../../components/ZonesView';

export const dynamic = 'force-dynamic';

export default async function ZonesPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let zones: Zone[] = [];
  let drivers: string[] = [];
  try {
    const c = serverClient();
    zones = await c.getZones();
    drivers = (await c.getDrivers()).map((d) => d.name);
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader title="Zones" subtitle="Découpage géographique et affectation des livreurs" />
      <ZonesView zones={zones} drivers={drivers} canWrite={canWrite} />
    </Box>
  );
}
