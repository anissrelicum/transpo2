import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Driver, Vehicle } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { DriversView } from '../../../components/DriversView';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const role = cookies().get('role')?.value || '';
  const isAdmin = role === 'ADMIN';
  let drivers: Driver[] = [];
  try {
    drivers = await serverClient().getDrivers();
  } catch {
    redirect('/login');
  }
  // Parc réservé ADMIN : le rattachement véhicule n'est proposé qu'à ce rôle.
  let vehicles: Vehicle[] = [];
  if (isAdmin) {
    try { vehicles = await serverClient().getVehicles(); } catch { /* parc indisponible */ }
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <DriversView
        drivers={drivers}
        vehicles={vehicles}
        isAdmin={isAdmin}
        canDispatch={isAdmin || role === 'DISPATCHER'}
      />
    </Box>
  );
}
