import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { Order } from '@transpo/domain';
import { CITY_COORDS } from '@transpo/domain';
import type { Zone, FleetLive } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';
import { DispatchView } from '../../../components/DispatchView';

export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  let orders: Order[] = [];
  let zones: Zone[] = [];
  let live: FleetLive[] = [];
  try {
    const c = serverClient();
    [orders, zones] = await Promise.all([c.getOrders(), c.getZones()]);
    try { live = await c.getFleetLive(); } catch { /* pas de positions */ }
  } catch {
    redirect('/login');
  }

  const unassigned = orders.filter((o) => !o.driver && ['NOUVELLE', 'PROGRAMMEE'].includes(o.status));

  // Centre : moyenne des zones géolocalisées, sinon Casablanca.
  const geoZones = zones.filter((z) => z.centerLat != null && z.centerLng != null);
  const center: [number, number] = geoZones.length
    ? [geoZones.reduce((s, z) => s + z.centerLat!, 0) / geoZones.length, geoZones.reduce((s, z) => s + z.centerLng!, 0) / geoZones.length]
    : (CITY_COORDS['Casablanca'] as [number, number]);

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title="Dispatch"
        subtitle={`Carte temps réel · ${live.length} livreur(s) en ligne · ${unassigned.length} à affecter`}
      />
      <DispatchView orders={orders} zones={zones} live={live} center={center} />
    </Box>
  );
}
