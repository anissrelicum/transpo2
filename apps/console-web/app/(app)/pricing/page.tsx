import * as React from 'react';
import { Grid, Card, Flex, Text, Badge } from '@radix-ui/themes';
import { PRICE_TIERS, FRAGILE_SURCHARGE, SCHEDULED_SURCHARGE } from '@transpo/domain';
import { money } from '@transpo/ui-web';
import { PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

type Tier = { from: number; to: number | null; base?: number; perKm?: number };

export default function PricingPage() {
  const rows: Tier[] = PRICE_TIERS as any;
  return (
    <Box style={wrap}>
      <PageTitle title="Tarification" subtitle="Grille standard par palier de distance + suppléments." />
      <DataTable<Tier>
        columns={[
          { key: 'palier', label: 'Palier (km)', render: (t) => t.to === null ? `${t.from}+ km` : `${t.from} – ${t.to} km` },
          { key: 'tarif', label: 'Tarif', align: 'right', render: (t) => t.perKm != null ? `${money(t.perKm)} / km` : money(t.base ?? 0) },
        ]}
        rows={rows}
      />
      <Grid columns={{ initial: '1', sm: '2' }} gap="3" mt="4">
        <Card size="2"><Flex justify="between" align="center"><Text weight="medium">Supplément fragile</Text><Badge color="amber">{money(FRAGILE_SURCHARGE)}</Badge></Flex></Card>
        <Card size="2"><Flex justify="between" align="center"><Text weight="medium">Supplément programmé</Text><Badge color="blue">{money(SCHEDULED_SURCHARGE)}</Badge></Flex></Card>
      </Grid>
    </Box>
  );
}
