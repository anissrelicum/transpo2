import * as React from 'react';
import { Badge } from '@radix-ui/themes';
import type { Payout } from '@transpo/api-client';
import { money } from '@transpo/ui-web';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function PayoutPage() {
  const payouts = await load((c) => c.getPayouts());
  return (
    <Box style={wrap}>
      <PageTitle title="Reversement COD" subtitle="Montant net à reverser aux marchands (brut − commission)." />
      <DataTable<Payout>
        columns={[
          { key: 'merchant', label: 'Marchand' },
          { key: 'orders', label: 'Commandes', align: 'right' },
          { key: 'brut', label: 'Brut (COD)', align: 'right', render: (r) => money(r.brut) },
          { key: 'commissionRate', label: 'Commission', align: 'right', render: (r) => <Badge color="gray">{Math.round(r.commissionRate * 100)} %</Badge> },
          { key: 'net', label: 'Net à reverser', align: 'right', render: (r) => money(r.net) },
        ]}
        rows={payouts}
        empty="Aucun reversement en attente."
      />
    </Box>
  );
}
