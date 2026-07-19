import * as React from 'react';
import { Badge, Text, Flex } from '@radix-ui/themes';
import type { Zone } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function ZonesPage() {
  const zones = await load((c) => c.getZones());
  return (
    <Box style={wrap}>
      <PageTitle title="Zones" subtitle="Découpage géographique et livreurs affectés." />
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
