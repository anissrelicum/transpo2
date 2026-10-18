import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Order } from '@transpo/domain';
import { CITY_COORDS } from '@transpo/domain';
import type { Zone, FleetLive, DispatchExceptionRow, PendingOffer } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { currentLang } from '../../../lib/i18n';
import { dispatchT } from '../../../lib/dispatch-i18n';
import { PageHeader } from '../../../components/ui';
import { DispatchView, type DispatchTab } from '../../../components/DispatchView';

export const dynamic = 'force-dynamic';

const TABS: DispatchTab[] = ['exceptions', 'queue', 'offers'];

export default async function DispatchPage({ searchParams }: { searchParams?: { vue?: string } }) {
  const lang = currentLang();
  const dt = dispatchT(lang);
  const role = cookies().get('role')?.value || '';
  let orders: Order[] = [];
  let zones: Zone[] = [];
  let live: FleetLive[] = [];
  let exceptions: DispatchExceptionRow[] = [];
  let offers: PendingOffer[] = [];
  let autoDispatch = false;
  try {
    const c = serverClient();
    [orders, zones] = await Promise.all([c.getOrders(), c.getZones()]);
    try { live = await c.getFleetLive(); } catch { /* pas de positions */ }
    // File de l'automate : réservée ADMIN/DISPATCHER (le comptable n'en a pas l'usage).
    try { [exceptions, offers] = await Promise.all([c.getDispatchExceptions(), c.getPendingOffers()]); } catch { /* rôle sans accès */ }
    try { autoDispatch = (await c.getDispatchSettings()).autoDispatch; } catch { /* défaut : coupé */ }
  } catch {
    redirect('/login');
  }

  const unassigned = orders.filter((o) => !o.driver && ['NOUVELLE', 'PROGRAMMEE'].includes(o.status));
  // Automate actif : le dispatcher arrive sur ce qui l'attend vraiment, les exceptions.
  const asked = searchParams?.vue as DispatchTab | undefined;
  const initialTab: DispatchTab = asked && TABS.includes(asked) ? asked : (autoDispatch ? 'exceptions' : 'queue');

  // Centre : moyenne des zones géolocalisées, sinon Casablanca.
  const geoZones = zones.filter((z) => z.centerLat != null && z.centerLng != null);
  const center: [number, number] = geoZones.length
    ? [geoZones.reduce((s, z) => s + z.centerLat!, 0) / geoZones.length, geoZones.reduce((s, z) => s + z.centerLng!, 0) / geoZones.length]
    : (CITY_COORDS['Casablanca'] as [number, number]);

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title="Dispatch"
        subtitle={dt('pageSubtitle', { live: live.length, n: unassigned.length, x: exceptions.length })}
      />
      <DispatchView
        key={initialTab}
        orders={orders} zones={zones} live={live} center={center}
        exceptions={exceptions} offers={offers} autoDispatch={autoDispatch}
        canConfigure={role === 'ADMIN'} initialTab={initialTab} lang={lang}
      />
    </Box>
  );
}
