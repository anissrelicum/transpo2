import * as React from 'react';
import { redirect } from 'next/navigation';
import { CITY_COORDS } from '@transpo/domain';
import type { Zone, FleetLive, Driver } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { FleetView } from '../../../components/FleetView';

export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  let live: FleetLive[] = [];
  let zones: Zone[] = [];
  let drivers: Driver[] = [];
  try {
    const c = serverClient();
    [live, zones, drivers] = await Promise.all([c.getFleetLive(), c.getZones(), c.getDrivers()]);
  } catch {
    redirect('/login');
  }

  const center: [number, number] = live.length
    ? [live.reduce((s, l) => s + l.lat, 0) / live.length, live.reduce((s, l) => s + l.lng, 0) / live.length]
    : (CITY_COORDS['Casablanca'] as [number, number]);

  return (
    // Pleine largeur : la carte est l'outil principal de l'écran.
    <FleetView live={live} zones={zones} drivers={drivers} center={center} />
  );
}
