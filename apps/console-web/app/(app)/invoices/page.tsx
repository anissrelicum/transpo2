import * as React from 'react';
import type { Invoice } from '@transpo/api-client';
import { money } from '@transpo/ui-web';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  const invoices = await load((c) => c.getInvoices());
  return (
    <Box style={wrap}>
      <PageTitle title="Factures" subtitle="Factures marchand dérivées des livraisons (commission 15 % + TVA 20 %)." />
      <DataTable<Invoice>
        columns={[
          { key: 'merchant', label: 'Marchand' },
          { key: 'deliveries', label: 'Livraisons', align: 'right' },
          { key: 'codCollected', label: 'COD encaissé', align: 'right', render: (r) => money(r.codCollected) },
          { key: 'commission', label: 'Commission', align: 'right', render: (r) => money(r.commission) },
          { key: 'tva', label: 'TVA', align: 'right', render: (r) => money(r.tva) },
          { key: 'ttc', label: 'TTC', align: 'right', render: (r) => money(r.ttc) },
        ]}
        rows={invoices}
        empty="Aucune facture."
      />
    </Box>
  );
}
