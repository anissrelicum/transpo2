import * as React from 'react';
import { Badge, Text } from '@radix-ui/themes';
import type { ReturnRow } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { A_TRAITER: 'amber', REPROGRAMME: 'blue', RENDU: 'green' };

export default async function ReturnsPage() {
  const returns = await load((c) => c.getReturns());
  return (
    <Box style={wrap}>
      <PageTitle title="Retours" subtitle="Logistique inverse : tentatives, reprogrammation, renvoi marchand." />
      <DataTable<ReturnRow>
        columns={[
          { key: 'ref', label: 'Commande' },
          { key: 'reason', label: 'Motif', render: (r) => <Text color="gray">{r.reason}</Text> },
          { key: 'attempts', label: 'Tentatives', align: 'right' },
          { key: 'status', label: 'Statut', render: (r) => <Badge color={(COLOR[r.status] as any) || 'gray'}>{r.status}</Badge> },
        ]}
        rows={returns}
        empty="Aucun retour."
      />
    </Box>
  );
}
