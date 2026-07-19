import * as React from 'react';
import { cookies } from 'next/headers';
import { Badge, Text, Flex } from '@radix-ui/themes';
import type { ReturnRow } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';
import { ActionButton } from '../../../components/ActionButton';

export const dynamic = 'force-dynamic';

const COLOR: Record<string, string> = { A_TRAITER: 'amber', REPROGRAMME: 'blue', RENDU: 'green' };

export default async function ReturnsPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  const returns = await load((c) => c.getReturns());

  const columns: any[] = [
    { key: 'ref', label: 'Commande' },
    { key: 'reason', label: 'Motif', render: (r: ReturnRow) => <Text color="gray">{r.reason}</Text> },
    { key: 'attempts', label: 'Tentatives', align: 'right' },
    { key: 'status', label: 'Statut', render: (r: ReturnRow) => <Badge color={(COLOR[r.status] as any) || 'gray'}>{r.status}</Badge> },
  ];
  if (canWrite) {
    columns.push({
      key: 'actions', label: '', render: (r: ReturnRow) => (
        r.status === 'RENDU' ? <Text color="gray" size="1">—</Text> : (
          <Flex gap="1" wrap="wrap">
            <ActionButton path={`v1/returns/${encodeURIComponent(r.ref)}/reschedule`} color="blue">Reprogrammer</ActionButton>
            <ActionButton path={`v1/returns/${encodeURIComponent(r.ref)}/return-to-merchant`} color="green">Rendre au marchand</ActionButton>
          </Flex>
        )
      ),
    });
  }

  return (
    <Box style={wrap}>
      <PageTitle title="Retours" subtitle="Logistique inverse : tentatives, reprogrammation, renvoi marchand." />
      <DataTable<ReturnRow> columns={columns} rows={returns} empty="Aucun retour." />
    </Box>
  );
}
