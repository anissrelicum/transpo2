import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box, Flex, Heading, Text, Table, Card } from '@radix-ui/themes';
import { StatusBadge, CodChip } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../lib/server';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  if (!cookies().get('token')?.value) redirect('/login');

  let orders: Order[] = [];
  try {
    orders = await serverClient().getOrders();
  } catch {
    redirect('/login'); // token invalide/expiré
  }

  return (
    <Box p="5" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Flex justify="between" align="center" mb="4">
        <Box>
          <Heading size="6">Commandes</Heading>
          <Text size="2" color="gray" data-testid="orders-count">{orders.length} commande(s)</Text>
        </Box>
      </Flex>

      <Card size="1">
        <Table.Root variant="ghost">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Référence</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Trajet</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">COD</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {orders.map((o) => (
              <Table.Row key={o.ref} data-testid="order-row">
                <Table.RowHeaderCell>{o.ref}</Table.RowHeaderCell>
                <Table.Cell>{o.merchant}</Table.Cell>
                <Table.Cell><Text color="gray">{o.fromCity} → {o.toCity}</Text></Table.Cell>
                <Table.Cell><StatusBadge status={o.status} /></Table.Cell>
                <Table.Cell align="right"><CodChip amount={o.cod} paid={o.codPaid} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </Box>
  );
}
