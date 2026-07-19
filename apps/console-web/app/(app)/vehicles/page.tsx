import * as React from 'react';
import { Badge, Text } from '@radix-ui/themes';
import type { Vehicle } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

// Conformité : assurance/CT échus (comparaison de dates ISO) → alerte visuelle.
function expired(due: string | null): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}

export default async function VehiclesPage() {
  const vehicles = await load((c) => c.getVehicles());
  return (
    <Box style={wrap}>
      <PageTitle title="Véhicules" subtitle="Parc et conformité (assurance / contrôle technique)." />
      <DataTable<Vehicle>
        columns={[
          { key: 'plate', label: 'Immatriculation' },
          { key: 'type', label: 'Type' },
          { key: 'city', label: 'Ville' },
          { key: 'state', label: 'État', render: (v) => <Badge color={v.state === 'ACTIF' ? 'green' : 'gray'}>{v.state}</Badge> },
          { key: 'insuranceDue', label: 'Assurance', render: (v) => (
            v.insuranceDue
              ? <Badge color={expired(v.insuranceDue) ? 'red' : 'gray'}>{expired(v.insuranceDue) ? 'Échue · ' : ''}{v.insuranceDue}</Badge>
              : <Text color="gray">—</Text>
          ) },
          { key: 'ctDue', label: 'Contrôle tech.', render: (v) => (
            v.ctDue
              ? <Badge color={expired(v.ctDue) ? 'red' : 'gray'}>{expired(v.ctDue) ? 'Échu · ' : ''}{v.ctDue}</Badge>
              : <Text color="gray">—</Text>
          ) },
        ]}
        rows={vehicles}
        empty="Aucun véhicule."
      />
    </Box>
  );
}
