import * as React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Box, Flex, Grid, Heading, Text, Card, Table, Button } from '@radix-ui/themes';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import type { AnalyticsSummary } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <Card size="2">
      <Flex direction="column" gap="1">
        <Text size="1" color="gray" weight="medium">{label}</Text>
        <Heading size="7" weight="bold" style={accent ? { color: `var(--${accent}-11)` } : undefined}>{value}</Heading>
        {hint && <Text size="1" color="gray">{hint}</Text>}
      </Flex>
    </Card>
  );
}

export default async function DashboardPage() {
  let orders: Order[] = [];
  let summary: AnalyticsSummary | null = null;
  try {
    const c = serverClient();
    [orders, summary] = await Promise.all([c.getOrders(), c.getAnalyticsSummary()]);
  } catch {
    redirect('/login');
  }

  const active = orders.filter((o) => !['LIVREE', 'ANNULEE', 'ECHOUEE', 'RETOUR'].includes(o.status)).length;
  const recent = orders.slice(0, 6);

  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Heading size="6" weight="bold" mb="1">Tableau de bord</Heading>
      <Text as="p" size="2" color="gray" mb="4">Vue d’ensemble de l’activité — données en direct de l’API.</Text>

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3" mb="4">
        <Kpi label="Commandes" value={String(summary?.total ?? orders.length)} hint={`${active} en cours`} />
        <Kpi label="Livrées" value={String(summary?.delivered ?? 0)} accent="green" />
        <Kpi label="Taux de réussite" value={`${summary?.successRate ?? 0} %`} accent="indigo" />
        <Kpi label="COD encaissé" value={money(summary?.codCollected ?? 0)} accent="amber" />
      </Grid>

      <Flex justify="between" align="center" mb="2">
        <Heading size="4">Commandes récentes</Heading>
        <Button asChild size="1" variant="soft"><Link href="/orders">Voir tout →</Link></Button>
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
            {recent.map((o) => (
              <Table.Row key={o.ref}>
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
