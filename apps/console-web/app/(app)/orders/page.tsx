import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Box, Flex, Heading, Text, Table, Card, Badge, Button } from '@radix-ui/themes';
import { StatusBadge, CodChip } from '@transpo/ui-web';
import type { Order, OrderStatus } from '@transpo/domain';
import { serverClient } from '../../../lib/server';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 10;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string; q?: string };
}) {
  let all: Order[] = [];
  try {
    all = await serverClient().getOrders();
  } catch {
    redirect('/login'); // token invalide/expiré
  }

  // Recherche texte (topbar) + filtre statut + pagination — tout côté serveur.
  const q = (searchParams.q || '').trim().toLowerCase();
  const active = searchParams.status;
  let filtered = all;
  if (q) {
    filtered = filtered.filter((o) =>
      `${o.ref} ${o.code} ${o.merchant ?? ''} ${o.driver ?? ''}`.toLowerCase().includes(q));
  }
  if (active) filtered = filtered.filter((o) => o.status === active);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const statuses = [...new Set(all.map((o) => o.status))] as OrderStatus[];
  const keep = (extra: Record<string, string>) => ({
    pathname: '/orders',
    query: { ...(q ? { q } : {}), ...extra },
  });

  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Flex justify="between" align="end" mb="4" gap="4" wrap="wrap">
        <Box>
          <Heading size="6" weight="bold">Commandes</Heading>
          <Text as="p" size="2" color="gray" mt="1" data-testid="orders-count">
            {filtered.length} commande(s){q ? ` · « ${q} »` : ''}
          </Text>
        </Box>
      </Flex>

      {/* Filtres par statut */}
      <Flex gap="2" mb="3" wrap="wrap" data-testid="status-filters">
        <Link href={keep({})} data-testid="filter-all">
          <Badge size="2" variant={active ? 'soft' : 'solid'} color="gray" style={{ cursor: 'pointer' }}>Tous</Badge>
        </Link>
        {statuses.map((s) => (
          <Link key={s} href={keep({ status: s })} data-testid={`filter-${s}`}>
            <Badge size="2" variant={active === s ? 'solid' : 'soft'} style={{ cursor: 'pointer' }}>{s}</Badge>
          </Link>
        ))}
      </Flex>

      <Card size="1">
        <Table.Root variant="ghost">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Référence</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Trajet</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell align="right">COD</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((o) => (
              <Table.Row key={o.ref} data-testid="order-row">
                <Table.RowHeaderCell>{o.ref}</Table.RowHeaderCell>
                <Table.Cell>{o.merchant}</Table.Cell>
                <Table.Cell><Text color="gray">{o.fromCity} → {o.toCity}</Text></Table.Cell>
                <Table.Cell>{o.driver ?? <Text color="gray">—</Text>}</Table.Cell>
                <Table.Cell><StatusBadge status={o.status} /></Table.Cell>
                <Table.Cell align="right"><CodChip amount={o.cod} paid={o.codPaid} /></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>

      {/* Pagination */}
      <Flex justify="between" align="center" mt="3" data-testid="pagination">
        <Button asChild size="1" variant="soft" disabled={page <= 1}>
          <Link href={keep({ ...(active ? { status: active } : {}), page: String(page - 1) })}>← Précédent</Link>
        </Button>
        <Text size="2" color="gray" data-testid="page-indicator">Page {page} / {pageCount}</Text>
        <Button asChild size="1" variant="soft" disabled={page >= pageCount}>
          <Link href={keep({ ...(active ? { status: active } : {}), page: String(page + 1) })}>Suivant →</Link>
        </Button>
      </Flex>
    </Box>
  );
}
