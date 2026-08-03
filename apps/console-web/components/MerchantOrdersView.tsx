'use client';
import * as React from 'react';
import { Card, Flex, Box, Text, Table, Select, TextField } from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { StatusBadge, CodChip } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import { PageHeader } from './ui';

const OPEN = ['NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function MerchantOrdersView({ orders }: { orders: Order[] }) {
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const rows = orders.filter((o) => {
    if (filter === 'open' && !OPEN.includes(o.status)) return false;
    if (filter === 'delivered' && o.status !== 'LIVREE') return false;
    if (filter === 'problem' && !['ECHOUEE', 'RETOUR', 'RENDU', 'ANNULEE'].includes(o.status)) return false;
    if (q && !`${o.ref} ${o.code} ${o.fromCity} ${o.toCity}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Mes commandes"
        subtitle={`${orders.length} commande(s) confiées au transporteur`}
      />

      <Flex gap="3" mb="3" wrap="wrap">
        <TextField.Root placeholder="Rechercher (référence, code, ville)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 300 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={filter} onValueChange={setFilter}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Toutes</Select.Item>
            <Select.Item value="open">En cours</Select.Item>
            <Select.Item value="delivered">Livrées</Select.Item>
            <Select.Item value="problem">Incidents</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Commande</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Trajet</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Contre-remboursement</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Créée le</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((o) => (
              <Table.Row key={o.ref} align="center">
                <Table.RowHeaderCell>
                  <Text as="div" size="2" weight="medium">{o.ref}</Text>
                  <Text as="div" size="1" color="gray">code de suivi : {o.code}</Text>
                </Table.RowHeaderCell>
                <Table.Cell><Text size="2">{o.fromCity} → {o.toCity}</Text></Table.Cell>
                <Table.Cell><CodChip amount={o.cod} paid={o.codPaid} /></Table.Cell>
                <Table.Cell><StatusBadge status={o.status} /></Table.Cell>
                <Table.Cell><Text size="1" color="gray">{when(o.createdAt)}</Text></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{orders.length ? 'Aucune commande ne correspond au filtre.' : 'Aucune commande.'}</Text></Box>
        )}
      </Card>
    </>
  );
}
