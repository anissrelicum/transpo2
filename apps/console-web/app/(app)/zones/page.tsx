import * as React from 'react';
import { cookies } from 'next/headers';
import { Badge, Text, Flex } from '@radix-ui/themes';
import type { Zone } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';
import { CreateDialog } from '../../../components/CreateDialog';

export const dynamic = 'force-dynamic';

export default async function ZonesPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  const zones = await load((c) => c.getZones());
  return (
    <Box style={wrap}>
      <Flex justify="between" align="end">
        <PageTitle title="Zones" subtitle="Découpage géographique et livreurs affectés." />
        {canWrite && (
          <Box mb="4"><CreateDialog title="Nouvelle zone" trigger="Nouvelle zone" path="v1/dispatch/zones"
            fields={[
              { name: 'nameFr', label: 'Nom (FR)', placeholder: 'Casa Centre' },
              { name: 'nameAr', label: 'Nom (AR)', placeholder: 'الوسط' },
              { name: 'color', label: 'Couleur', type: 'select', options: ['indigo', 'cyan', 'green', 'amber', 'red', 'violet', 'orange'] },
              { name: 'commune', label: 'Commune', placeholder: 'Maârif' },
            ]} /></Box>
        )}
      </Flex>
      <DataTable<Zone>
        columns={[
          { key: 'nameFr', label: 'Zone', render: (z) => (
            <Flex align="center" gap="2">
              <Box style={{ width: 10, height: 10, borderRadius: 3, background: `var(--${z.color}-9)` }} />
              {z.nameFr}
            </Flex>
          ) },
          { key: 'nameAr', label: 'العربية', render: (z) => <Text style={{ direction: 'rtl' }}>{z.nameAr ?? '—'}</Text> },
          { key: 'commune', label: 'Commune' },
          { key: 'drivers', label: 'Livreurs', render: (z) => (
            z.drivers.length ? z.drivers.map((d) => <Badge key={d} mr="1" variant="soft">{d}</Badge>) : <Text color="gray">—</Text>
          ) },
        ]}
        rows={zones}
        empty="Aucune zone."
      />
    </Box>
  );
}
