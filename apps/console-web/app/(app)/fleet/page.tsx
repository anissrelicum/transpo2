import * as React from 'react';
import { Callout, Badge, Text } from '@radix-ui/themes';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';
import type { FleetLive } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function FleetPage() {
  const live = await load((c) => c.getFleetLive());
  const alerts = live.filter((l) => l.outOfZone);

  return (
    <Box style={wrap}>
      <PageTitle title="PC flotte — temps réel" subtitle="Dernière position par livreur et géofencing (alertes sortie de zone)." />
      {alerts.length > 0 && (
        <Callout.Root color="red" mb="3" role="alert">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{alerts.length} livreur(s) hors de leur zone.</Callout.Text>
        </Callout.Root>
      )}
      <DataTable<FleetLive>
        columns={[
          { key: 'driver', label: 'Livreur' },
          { key: 'zone', label: 'Zone', render: (l) => l.zone ?? <Text color="gray">—</Text> },
          { key: 'pos', label: 'Position', render: (l) => <Text color="gray" size="1">{l.lat.toFixed(4)}, {l.lng.toFixed(4)}</Text> },
          { key: 'distanceM', label: 'Écart zone', align: 'right', render: (l) => l.distanceM == null ? '—' : `${l.distanceM} m` },
          { key: 'outOfZone', label: 'État', render: (l) => (
            <Badge color={l.outOfZone ? 'red' : 'green'}>{l.outOfZone ? 'Hors zone' : 'Dans la zone'}</Badge>
          ) },
        ]}
        rows={live}
        empty="Aucune position reçue."
      />
    </Box>
  );
}
