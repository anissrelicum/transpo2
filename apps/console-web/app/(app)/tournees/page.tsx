import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box, Flex, Heading, Text, Card, Table, Badge } from '@radix-ui/themes';
import type { Tournee } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { ActionButton } from '../../../components/ActionButton';
import { CreateDialog } from '../../../components/CreateDialog';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  PLANIFIEE: 'blue', EN_COURS: 'amber', CLOTUREE: 'green',
};

export default async function TourneesPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let tournees: Tournee[] = [];
  try {
    tournees = await serverClient().getTournees();
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Flex justify="between" align="start" mb="4">
        <Box>
          <Heading size="6" weight="bold" mb="1">Tournées</Heading>
          <Text as="p" size="2" color="gray">Regroupements multi-arrêts par livreur.</Text>
        </Box>
        {canWrite && (
          <CreateDialog title="Nouvelle tournée" trigger="Nouvelle tournée" path="v1/tournees"
            fields={[
              { name: 'driver', label: 'Livreur', placeholder: 'Youssef Benali' },
              { name: 'day', label: 'Jour (AAAA-MM-JJ)', placeholder: '2026-07-20' },
              { name: 'zone', label: 'Zone', placeholder: 'Casa Centre' },
              { name: 'stops', label: 'Commandes (réfs séparées par des virgules)', type: 'csv', placeholder: 'CMD-…, CMD-…' },
            ]} />
        )}
      </Flex>

      <Card size="1">
        <Table.Root variant="ghost">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Zone</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Jour</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Arrêts</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
              {canWrite && <Table.ColumnHeaderCell></Table.ColumnHeaderCell>}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tournees.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={canWrite ? 6 : 5}><Text size="2" color="gray">Aucune tournée planifiée.</Text></Table.Cell>
              </Table.Row>
            )}
            {tournees.map((t) => (
              <Table.Row key={t.id}>
                <Table.RowHeaderCell>{t.driver}</Table.RowHeaderCell>
                <Table.Cell>{t.zone ?? <Text color="gray">—</Text>}</Table.Cell>
                <Table.Cell>{t.day}</Table.Cell>
                <Table.Cell align="right">{t.stops.length}</Table.Cell>
                <Table.Cell><Badge color={(STATUS_COLOR[t.status] as any) || 'gray'}>{t.status}</Badge></Table.Cell>
                {canWrite && (
                  <Table.Cell>
                    {t.status !== 'CLOTUREE'
                      ? <ActionButton path={`v1/tournees/${t.id}/advance`} color="indigo">Avancer</ActionButton>
                      : <Text color="gray" size="1">—</Text>}
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Box>
  );
}
