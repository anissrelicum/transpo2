import * as React from 'react';
import { cookies } from 'next/headers';
import { Badge, Text, Flex } from '@radix-ui/themes';
import type { Vehicle } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';
import { CreateDialog } from '../../../components/CreateDialog';

export const dynamic = 'force-dynamic';

// Conformité : assurance/CT échus (comparaison de dates ISO) → alerte visuelle.
function expired(due: string | null): boolean {
  if (!due) return false;
  return new Date(due).getTime() < Date.now();
}

export default async function VehiclesPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  const vehicles = await load((c) => c.getVehicles());
  return (
    <Box style={wrap}>
      <Flex justify="between" align="end">
        <PageTitle title="Véhicules" subtitle="Parc et conformité (assurance / contrôle technique)." />
        {isAdmin && (
          <Box mb="4"><CreateDialog title="Nouveau véhicule" trigger="Nouveau véhicule" path="v1/vehicles"
            fields={[
              { name: 'plate', label: 'Immatriculation', placeholder: '1234-A-56' },
              { name: 'type', label: 'Type', type: 'select', options: ['Moto', 'Fourgon', 'Voiture', 'Camion'] },
              { name: 'city', label: 'Ville', placeholder: 'Casablanca' },
              { name: 'insuranceDue', label: 'Assurance (AAAA-MM-JJ)', placeholder: '2026-12-31' },
              { name: 'ctDue', label: 'Contrôle technique (AAAA-MM-JJ)', placeholder: '2027-03-01' },
            ]} /></Box>
        )}
      </Flex>
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
