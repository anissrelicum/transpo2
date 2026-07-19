import * as React from 'react';
import { Grid, Heading, Badge, Text } from '@radix-ui/themes';
import { StatusBadge, CodChip } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import type { Zone } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  const [orders, zones] = await load((c) => Promise.all([c.getOrders(), c.getZones()]));
  const toAssign = orders.filter((o) => !o.driver && !['LIVREE', 'ANNULEE', 'RENDU'].includes(o.status));

  return (
    <Box style={wrap}>
      <PageTitle title="Dispatch" subtitle="Commandes à assigner et zones de couverture." />
      <Heading size="4" mb="2">À assigner ({toAssign.length})</Heading>
      <Box mb="5">
        <DataTable<Order>
          columns={[
            { key: 'ref', label: 'Référence' },
            { key: 'merchant', label: 'Marchand' },
            { key: 'route', label: 'Trajet', render: (o) => <Text color="gray">{o.fromCity} → {o.toCity}</Text> },
            { key: 'status', label: 'Statut', render: (o) => <StatusBadge status={o.status} /> },
            { key: 'cod', label: 'COD', align: 'right', render: (o) => <CodChip amount={o.cod} paid={o.codPaid} /> },
          ]}
          rows={toAssign}
          empty="Toutes les commandes sont assignées."
        />
      </Box>

      <Heading size="4" mb="2">Zones</Heading>
      <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="3">
        {zones.map((z: Zone) => (
          <Box key={z.id} style={{ border: '1px solid var(--gray-a4)', borderRadius: 'var(--radius-3)', padding: 12 }}>
            <Badge color={z.color as any} mb="1">{z.nameFr}</Badge>
            <Text as="p" size="1" color="gray">{z.commune ?? '—'} · {z.drivers.length} livreur(s)</Text>
          </Box>
        ))}
      </Grid>
    </Box>
  );
}
