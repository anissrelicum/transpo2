import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Vehicle } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { VehiclesView } from '../../../components/VehiclesView';

export const dynamic = 'force-dynamic';

export default async function VehiclesPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  let vehicles: Vehicle[] = [];
  try {
    vehicles = await serverClient().getVehicles();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <VehiclesView vehicles={vehicles} isAdmin={isAdmin} />
    </Box>
  );
}
