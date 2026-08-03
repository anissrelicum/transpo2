import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, Flex, Box, Grid, Text, Heading, Button, Callout, Progress, Separator } from '@radix-ui/themes';
import {
  ArchiveIcon, CheckCircledIcon, LapTimerIcon, ChevronRightIcon, InfoCircledIcon, DownloadIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import type { MerchantDashboard } from '@transpo/api-client';
import { serverClient } from '../../lib/server';
import { PageHeader, KPI } from '../../components/ui';

export const dynamic = 'force-dynamic';

export default async function MerchantHomePage() {
  let kpi: MerchantDashboard;
  let orders: Order[] = [];
  try {
    const c = serverClient();
    [kpi, orders] = await Promise.all([c.getMerchantDashboard(), c.getMerchantOrders()]);
  } catch {
    redirect('/login');
  }

  const recent = orders.slice(0, 6);
  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Vos expéditions au ${today}`}
        actions={<Button asChild variant="soft"><Link href="/portail/commandes">Voir mes commandes <ChevronRightIcon /></Link></Button>}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Commandes" value={String(kpi.total)} delta="depuis l’origine" deltaColor="gray" icon={<ArchiveIcon width="15" />} accent="indigo" />
        <KPI label="Livrées" value={String(kpi.delivered)} delta={`${kpi.successRate} % de réussite`} deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En cours" value={String(kpi.inTransit)} delta="chez le transporteur" deltaColor="cyan" icon={<LapTimerIcon width="15" />} accent="cyan" />
        <KPI label="COD à encaisser" value={money(kpi.codPending)} delta="pas encore collecté" deltaColor="amber" icon={<DownloadIcon width="15" />} accent="amber" />
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="4">Dernières commandes</Heading>
              <Button asChild size="1" variant="ghost"><Link href="/portail/commandes">Tout voir <ChevronRightIcon /></Link></Button>
            </Flex>
            <Flex direction="column" gap="2">
              {recent.length === 0 && <Text size="2" color="gray">Aucune commande pour le moment.</Text>}
              {recent.map((o) => (
                <Flex key={o.ref} align="center" justify="between" gap="3" p="2"
                  style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a4)' }}>
                  <Box style={{ minWidth: 0 }}>
                    <Text size="2" weight="medium" as="div">{o.ref}</Text>
                    <Text size="1" color="gray" as="div">{o.fromCity} → {o.toCity}</Text>
                  </Box>
                  <Flex align="center" gap="3">
                    <CodChip amount={o.cod} paid={o.codPaid} />
                    <StatusBadge status={o.status} />
                  </Flex>
                </Flex>
              ))}
            </Flex>
          </Card>
        </Box>

        <Box>
          <Card size="3" mb="4">
            <Heading size="4" mb="1">Taux de réussite</Heading>
            <Text as="div" size="1" color="gray" mb="3">Livrées sur commandes clôturées</Text>
            <Heading size="8" mb="2">{kpi.successRate} %</Heading>
            <Progress value={Math.round(kpi.successRate)} color={kpi.successRate >= 90 ? 'green' : kpi.successRate >= 70 ? 'amber' : 'red'} />
            <Separator size="4" my="3" />
            <Flex justify="between">
              <Text size="2" color="gray">Annulées</Text>
              <Text size="2" weight="medium">{kpi.cancelled}</Text>
            </Flex>
          </Card>

          <Callout.Root color="blue">
            <Callout.Icon><InfoCircledIcon /></Callout.Icon>
            <Callout.Text>
              Le COD encaissé vous est reversé net de commission. Le détail figure dans votre{' '}
              <Link href="/portail/portefeuille" style={{ color: 'var(--indigo-11)' }}>portefeuille</Link>.
            </Callout.Text>
          </Callout.Root>
        </Box>
      </Grid>
    </>
  );
}
