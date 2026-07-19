import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box, Flex, Grid, Heading, Text, Card, Table } from '@radix-ui/themes';
import { StatusBadge, money } from '@transpo/ui-web';
import type { OrderStatus } from '@transpo/domain';
import type { AnalyticsSummary } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';

export const dynamic = 'force-dynamic';

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card size="2">
      <Flex direction="column" gap="1">
        <Text size="1" color="gray" weight="medium">{label}</Text>
        <Heading size="7" weight="bold" style={accent ? { color: `var(--${accent}-11)` } : undefined}>{value}</Heading>
      </Flex>
    </Card>
  );
}

export default async function AnalyticsPage() {
  let s: AnalyticsSummary;
  try {
    s = await serverClient().getAnalyticsSummary();
  } catch {
    redirect('/login');
  }

  const entries = Object.entries(s.byStatus).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <Box style={{ maxWidth: 900, margin: '0 auto' }}>
      <Heading size="6" weight="bold" mb="1">Analytics & SLA</Heading>
      <Text as="p" size="2" color="gray" mb="4">Synthèse opérationnelle dérivée des commandes.</Text>

      <Grid columns={{ initial: '2', sm: '4' }} gap="3" mb="4">
        <Kpi label="Total" value={String(s.total)} />
        <Kpi label="Livrées" value={String(s.delivered)} accent="green" />
        <Kpi label="Taux de réussite" value={`${s.successRate} %`} accent="indigo" />
        <Kpi label="COD encaissé" value={money(s.codCollected)} accent="amber" />
      </Grid>

      <Heading size="4" mb="2">Répartition par statut</Heading>
      <Card size="2">
        <Flex direction="column" gap="3">
          {entries.map(([status, n]) => (
            <Flex key={status} align="center" gap="3">
              <Box style={{ width: 160 }}><StatusBadge status={status as OrderStatus} /></Box>
              <Box style={{ flex: 1, background: 'var(--gray-a3)', borderRadius: 'var(--radius-2)', height: 10 }}>
                <Box style={{ width: `${(n / max) * 100}%`, background: 'var(--indigo-9)', borderRadius: 'var(--radius-2)', height: 10 }} />
              </Box>
              <Text size="2" weight="medium" style={{ width: 32, textAlign: 'right' }}>{n}</Text>
            </Flex>
          ))}
        </Flex>
      </Card>
    </Box>
  );
}
