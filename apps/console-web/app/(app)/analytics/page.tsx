import * as React from 'react';
import { Box, Flex, Grid, Heading, Text, Card, Badge, Progress, Callout } from '@radix-ui/themes';
import { CheckCircledIcon, CrossCircledIcon, ArchiveIcon, DownloadIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { StatusBadge, money } from '@transpo/ui-web';
import { STATUS_META } from '@transpo/domain';
import type { Order, OrderStatus } from '@transpo/domain';
import type { AnalyticsSummary, ReturnRow } from '@transpo/api-client';
import { load } from '../../../lib/page';
import { serverClient } from '../../../lib/server';
import { PageHeader, KPI } from '../../../components/ui';
import { AnalyticsTables, type CityRow, type DriverRow, type MerchantRow } from '../../../components/AnalyticsTables';

export const dynamic = 'force-dynamic';

const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);
const FAIL_COLORS = ['amber', 'orange', 'red', 'gray', 'violet'] as const;

export default async function AnalyticsPage() {
  const [summary, orders] = await load((c) => Promise.all([c.getAnalyticsSummary(), c.getOrders()]));
  let returns: ReturnRow[] = [];
  try { returns = await serverClient().getReturns(); } catch { /* rôle sans accès */ }

  // Motifs d'échec réels (depuis les retours).
  const reasonCounts = new Map<string, number>();
  for (const r of returns) reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + 1);
  const totalReasons = [...reasonCounts.values()].reduce((a, b) => a + b, 0);
  const failReasons = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n], i) => ({ reason, pct: pct(n, totalReasons), color: FAIL_COLORS[i % FAIL_COLORS.length] }));

  // Agrégats par ville (destination), livreur, marchand — dérivés des commandes.
  const isDelivered = (o: Order) => o.status === 'LIVREE';
  const isClosed = (o: Order) => ['LIVREE', 'ECHOUEE', 'RETOUR', 'ANNULEE', 'RENDU'].includes(o.status);

  const cityMap = new Map<string, { volume: number; delivered: number; closed: number }>();
  for (const o of orders) {
    const e = cityMap.get(o.toCity) ?? { volume: 0, delivered: 0, closed: 0 };
    e.volume += 1; if (isDelivered(o)) e.delivered += 1; if (isClosed(o)) e.closed += 1;
    cityMap.set(o.toCity, e);
  }
  const byCity: CityRow[] = [...cityMap.entries()]
    .map(([city, v]) => ({ city, volume: v.volume, success: pct(v.delivered, v.closed || v.volume) }))
    .sort((a, b) => b.volume - a.volume);

  const drvMap = new Map<string, { deliveries: number; total: number; closed: number }>();
  for (const o of orders) {
    if (!o.driver) continue;
    const e = drvMap.get(o.driver) ?? { deliveries: 0, total: 0, closed: 0 };
    e.total += 1; if (isDelivered(o)) e.deliveries += 1; if (isClosed(o)) e.closed += 1;
    drvMap.set(o.driver, e);
  }
  const byDriver: DriverRow[] = [...drvMap.entries()]
    .map(([driver, v]) => ({ driver, deliveries: v.deliveries, total: v.total, success: pct(v.deliveries, v.closed || v.total) }))
    .sort((a, b) => b.deliveries - a.deliveries);

  const mrcMap = new Map<string, { deliveries: number; closed: number; total: number; revenue: number }>();
  for (const o of orders) {
    if (!o.merchant) continue;
    const e = mrcMap.get(o.merchant) ?? { deliveries: 0, closed: 0, total: 0, revenue: 0 };
    e.total += 1; if (isDelivered(o)) e.deliveries += 1; if (isClosed(o)) e.closed += 1;
    if (o.codPaid) e.revenue += o.cod;
    mrcMap.set(o.merchant, e);
  }
  const byMerchant: MerchantRow[] = [...mrcMap.entries()]
    .map(([merchant, v]) => ({ merchant, deliveries: v.deliveries, success: pct(v.deliveries, v.closed || v.total), revenue: v.revenue }))
    .sort((a, b) => b.deliveries - a.deliveries);

  // Répartition par statut (réel).
  const statusEntries = (Object.entries(summary.byStatus) as [OrderStatus, number][]).sort((a, b) => b[1] - a[1]);
  const maxStatus = Math.max(1, ...statusEntries.map(([, n]) => n));

  const lowCities = byCity.filter((c) => c.volume >= 1 && c.success < 90);

  return (
    <Box style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Analytics & SLA"
        subtitle="Performance opérationnelle — données en direct de l’API"
        actions={<Badge color="gray" variant="soft"><DownloadIcon /> Toutes périodes</Badge>}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Taux de réussite" value={`${summary.successRate} %`} delta="livrées / clôturées" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="Livrées" value={String(summary.delivered)} delta="cumul" deltaColor="gray" icon={<ArchiveIcon width="15" />} accent="indigo" />
        <KPI label="Échecs" value={String(summary.failed)} delta="échouées + retours" deltaColor="red" icon={<CrossCircledIcon width="15" />} accent="red" />
        <KPI label="COD encaissé" value={money(summary.codCollected)} delta="reversable" deltaColor="amber" icon={<DownloadIcon width="15" />} accent="amber" />
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="4" mb="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3" style={{ height: '100%' }}>
            <Heading size="4" mb="1">Répartition par statut</Heading>
            <Text size="1" color="gray" mb="4" as="div">{summary.total} commande(s) au total</Text>
            <Flex direction="column" gap="3">
              {statusEntries.map(([status, n]) => (
                <Flex key={status} align="center" gap="3">
                  <Box style={{ width: 170 }}><StatusBadge status={status} /></Box>
                  <Box style={{ flex: 1, background: 'var(--gray-a3)', borderRadius: 'var(--radius-2)', height: 10 }}>
                    <Box style={{ width: `${(n / maxStatus) * 100}%`, background: `var(--${STATUS_META[status].color}-9)`, borderRadius: 'var(--radius-2)', height: 10 }} />
                  </Box>
                  <Text size="2" weight="medium" style={{ width: 32, textAlign: 'right' }}>{n}</Text>
                </Flex>
              ))}
            </Flex>
          </Card>
        </Box>

        <Card size="3">
          <Heading size="4" mb="1">Motifs d’échec</Heading>
          <Text size="1" color="gray" mb="3" as="div">{totalReasons} retour(s) enregistré(s)</Text>
          <Flex direction="column" gap="3">
            {failReasons.length === 0 && <Text size="2" color="gray">Aucun échec sur la période.</Text>}
            {failReasons.map((f) => (
              <Box key={f.reason}>
                <Flex justify="between" mb="1"><Text size="2">{f.reason}</Text><Text size="2" weight="medium" color="gray">{f.pct} %</Text></Flex>
                <Progress value={f.pct} color={f.color} />
              </Box>
            ))}
          </Flex>
        </Card>
      </Grid>

      {lowCities.length > 0 && (
        <Callout.Root color="amber" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text><strong>{lowCities.length} ville(s) sous l’objectif SLA de 90 %</strong> : {lowCities.map((c) => `${c.city} (${c.success} %)`).join(', ')}.</Callout.Text>
        </Callout.Root>
      )}

      <AnalyticsTables byCity={byCity} byDriver={byDriver} byMerchant={byMerchant} />
    </Box>
  );
}
