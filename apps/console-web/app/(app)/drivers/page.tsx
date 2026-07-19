import * as React from 'react';
import { Badge } from '@radix-ui/themes';
import type { Driver } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const drivers = await load((c) => c.getDrivers());
  return (
    <Box style={wrap}>
      <PageTitle title="Chauffeurs" subtitle="Livreurs de l’organisation et disponibilité." />
      <DataTable<Driver>
        columns={[
          { key: 'name', label: 'Nom' },
          { key: 'city', label: 'Ville' },
          { key: 'vehicle', label: 'Véhicule' },
          { key: 'available', label: 'Disponibilité', render: (d) => (
            <Badge color={d.available ? 'green' : 'gray'}>{d.available ? 'Disponible' : 'Indisponible'}</Badge>
          ) },
        ]}
        rows={drivers}
        empty="Aucun chauffeur."
      />
    </Box>
  );
}
