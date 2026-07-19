import * as React from 'react';
import type { Reconciliation } from '@transpo/api-client';
import { money } from '@transpo/ui-web';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  const rec = await load((c) => c.getReconciliation());
  return (
    <Box style={wrap}>
      <PageTitle title="Caisse" subtitle="Réconciliation COD par livreur (théorique = COD encaissés)." />
      <DataTable<Reconciliation>
        columns={[
          { key: 'driver', label: 'Livreur' },
          { key: 'deliveries', label: 'Livraisons encaissées', align: 'right' },
          { key: 'theorique', label: 'COD théorique', align: 'right', render: (r) => money(r.theorique) },
        ]}
        rows={rec}
        empty="Aucun encaissement."
      />
    </Box>
  );
}
