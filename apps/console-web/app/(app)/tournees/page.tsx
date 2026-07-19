import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box, Flex, Heading, Text, Card, Table, Badge } from '@radix-ui/themes';
import type { Tournee } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  PLANIFIEE: 'blue', EN_COURS: 'amber', CLOTUREE: 'green',
};

export default async function TourneesPage() {
  let tournees: Tournee[] = [];
  try {
    tournees = await serverClient().getTournees();
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Heading size="6" weight="bold" mb="1">Tournées</Heading>
      <Text as="p" size="2" color="gray" mb="4">Regroupements multi-arrêts par livreur.</Text>

      <Card size="1">
        <Table.Root variant="ghost">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Zone</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Jour</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">Arrêts</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {tournees.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={5}><Text size="2" color="gray">Aucune tournée planifiée.</Text></Table.Cell>
              </Table.Row>
            )}
            {tournees.map((t) => (
              <Table.Row key={t.id}>
                <Table.RowHeaderCell>{t.driver}</Table.RowHeaderCell>
                <Table.Cell>{t.zone ?? <Text color="gray">—</Text>}</Table.Cell>
                <Table.Cell>{t.day}</Table.Cell>
                <Table.Cell align="right">{t.stops.length}</Table.Cell>
                <Table.Cell><Badge color={(STATUS_COLOR[t.status] as any) || 'gray'}>{t.status}</Badge></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Box>
  );
}
