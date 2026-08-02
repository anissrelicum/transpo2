import * as React from 'react';
import { redirect } from 'next/navigation';
import { Card, Flex, Box, Grid, Text, Badge, Table, Callout, Progress } from '@radix-ui/themes';
import { ExclamationTriangleIcon, ArchiveIcon, CheckCircledIcon, BarChartIcon } from '@radix-ui/react-icons';
import type { SaasBillingRow } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader, KPI } from '../../../components/ui';

export const dynamic = 'force-dynamic';

function money(dh: number): string {
  return `${dh.toLocaleString('fr-FR')} DH`;
}

const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { ACTIF: 'green', ESSAI: 'amber', SUSPENDU: 'red' };

export default async function SaasBillingPage() {
  let rows: SaasBillingRow[] = [];
  try {
    rows = await serverClient().getSaasBilling();
  } catch {
    redirect('/login?realm=saas');
  }

  // Seules les organisations actives sont facturées ; l'usage est compté partout.
  const billed = rows.filter((r) => r.status === 'ACTIF');
  const mrr = billed.reduce((a, r) => a + r.monthlyDH, 0);
  const orders = rows.reduce((a, r) => a + r.orders, 0);
  const over = rows.filter((r) => r.overQuota);

  return (
    <>
      <PageHeader
        title="Facturation plateforme"
        subtitle="Montant mensuel par organisation et consommation réelle face au quota du plan."
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Revenu mensuel" value={money(mrr)} delta={`${billed.length} organisation(s) facturée(s)`} deltaColor="green" icon={<BarChartIcon width="15" />} accent="green" />
        <KPI label="Organisations" value={String(rows.length)} delta="dont essais et suspendues" deltaColor="gray" icon={<CheckCircledIcon width="15" />} accent="indigo" />
        <KPI label="Commandes" value={orders.toLocaleString('fr-FR')} delta="cumul plateforme" deltaColor="gray" icon={<ArchiveIcon width="15" />} accent="cyan" />
        <KPI label="Dépassements" value={String(over.length)} delta="au-delà du quota" deltaColor={over.length ? 'red' : 'gray'} icon={<ExclamationTriangleIcon width="15" />} accent={over.length ? 'red' : 'gray'} />
      </Grid>

      {over.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{over.length} organisation(s)</strong> dépassent le quota de leur plan : {over.map((r) => r.slug).join(', ')}.
            Un passage au palier supérieur est à proposer.
          </Callout.Text>
        </Callout.Root>
      )}

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Organisation</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Consommation</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Montant mensuel</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((r) => {
              const pct = r.quota != null ? Math.min(100, Math.round((r.orders / r.quota) * 100)) : null;
              return (
                <Table.Row key={r.slug} align="center">
                  <Table.RowHeaderCell>
                    <Text as="div" size="2" weight="medium">{r.name}</Text>
                    <Text as="div" size="1" color="gray">{r.slug}</Text>
                  </Table.RowHeaderCell>
                  <Table.Cell><Badge variant="soft" color="gray">{r.plan}</Badge></Table.Cell>
                  <Table.Cell><Badge color={STATUS_COLOR[r.status] || 'gray'} variant="soft">{r.status}</Badge></Table.Cell>
                  <Table.Cell style={{ minWidth: 200 }}>
                    <Flex align="center" gap="2">
                      <Box style={{ flex: 1, maxWidth: 120 }}>
                        {pct != null
                          ? <Progress value={pct} color={r.overQuota ? 'red' : pct >= 80 ? 'amber' : 'green'} />
                          : <Text size="1" color="gray">sans quota</Text>}
                      </Box>
                      <Text size="1" color={r.overQuota ? 'red' : 'gray'}>
                        {r.orders.toLocaleString('fr-FR')}{r.quota != null ? ` / ${r.quota.toLocaleString('fr-FR')}` : ''}
                      </Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Text size="2" color={r.status === 'ACTIF' ? undefined : 'gray'}>
                      {r.status === 'ACTIF' ? money(r.monthlyDH) : '—'}
                    </Text>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && <Box p="4"><Text size="2" color="gray">Aucune organisation.</Text></Box>}
      </Card>
    </>
  );
}
