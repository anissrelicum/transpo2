import * as React from 'react';
import Link from 'next/link';
import { Box, Flex, Grid, Heading, Text, Card, Badge, Button, Callout, Separator, Progress } from '@radix-ui/themes';
import {
  ArchiveIcon, LapTimerIcon, CheckCircledIcon, CrossCircledIcon, DownloadIcon,
  ChevronRightIcon, ExclamationTriangleIcon, ClockIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import type { Vehicle } from '@transpo/api-client';
import { load } from '../../../lib/page';
import { serverClient } from '../../../lib/server';
import { PageHeader, KPI, ActivityChart } from '../../../components/ui';

export const dynamic = 'force-dynamic';

const IN_PROGRESS = ['NOUVELLE', 'ASSIGNEE', 'RETRAIT', 'RECUPEREE', 'LIVRAISON'];

function expired(due: string | null): boolean { return !!due && new Date(due).getTime() < Date.now(); }
function daysUntil(due: string | null): number | null {
  if (!due) return null;
  return Math.ceil((new Date(due).getTime() - Date.now()) / 86400000);
}

export default async function DashboardPage() {
  const orders = await load((c) => c.getOrders());
  // Véhicules réservés ADMIN : optionnels (un DISPATCHER n'y a pas accès).
  let vehicles: Vehicle[] = [];
  try { vehicles = await serverClient().getVehicles(); } catch { /* rôle sans accès flotte */ }

  const enCours = orders.filter((o) => IN_PROGRESS.includes(o.status)).length;
  const nonAffectees = orders.filter((o) => o.status === 'NOUVELLE').length;
  const livrees = orders.filter((o) => o.status === 'LIVREE').length;
  const echouees = orders.filter((o) => o.status === 'ECHOUEE' || o.status === 'RETOUR').length;
  const codEncaisse = orders.filter((o) => o.codPaid).reduce((a, o) => a + o.cod, 0);
  const codAEncaisser = orders.filter((o) => o.cod > 0 && !o.codPaid).reduce((a, o) => a + o.cod, 0);
  const codTotal = codEncaisse + codAEncaisser || 1;

  // Graphe d'activité réel : commandes créées par heure (06→22).
  const HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
  const buckets = HOURS.map((hour) => ({
    hour,
    count: orders.filter((o) => new Date(o.createdAt).getHours() === hour).length,
  }));
  const peak = buckets.reduce((m, b) => (b.count > m.count ? b : m), buckets[0]);

  const urgentes = orders
    .filter((o) => o.status === 'NOUVELLE' || (o.cod >= 1000 && IN_PROGRESS.includes(o.status)))
    .slice(0, 5);

  // Conformité flotte réelle (véhicules).
  const alerts: { color: 'red' | 'orange'; icon: React.ReactNode; text: React.ReactNode }[] = [];
  for (const v of vehicles) {
    if (expired(v.insuranceDue)) {
      const d = Math.abs(daysUntil(v.insuranceDue) || 0);
      alerts.push({ color: 'red', icon: <ExclamationTriangleIcon />, text: <><strong>{v.type} {v.plate}</strong> — assurance expirée depuis {d} j</> });
    } else {
      const d = daysUntil(v.insuranceDue);
      if (d != null && d <= 15) alerts.push({ color: 'orange', icon: <ClockIcon />, text: <><strong>Assurance</strong> — {v.type} {v.plate}, échéance dans {d} j</> });
    }
    const ct = daysUntil(v.ctDue);
    if (v.ctDue && expired(v.ctDue)) alerts.push({ color: 'red', icon: <ExclamationTriangleIcon />, text: <><strong>Contrôle technique</strong> — {v.type} {v.plate}, expiré</> });
    else if (ct != null && ct <= 15) alerts.push({ color: 'orange', icon: <ClockIcon />, text: <><strong>Contrôle technique</strong> — {v.type} {v.plate}, échéance dans {ct} j</> });
  }

  const today = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <Box style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Tableau de bord"
        subtitle={`Vue opérationnelle du ${today}`}
        actions={<Button variant="soft" color="gray"><DownloadIcon /> Exporter</Button>}
      />

      <Grid columns={{ initial: '2', md: '3', lg: '5' }} gap="3" mb="4">
        <KPI label="Commandes" value={String(orders.length)} delta="total en base" deltaColor="gray" icon={<ArchiveIcon width="15" />} accent="indigo" />
        <KPI label="En cours" value={String(enCours)} delta={`${nonAffectees} non affectées`} deltaColor="amber" icon={<LapTimerIcon width="15" />} accent="cyan" />
        <KPI label="Livrées" value={String(livrees)} delta="cumul" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="Échouées" value={String(echouees)} delta="à traiter" deltaColor="red" icon={<CrossCircledIcon width="15" />} accent="red" />
        <KPI label="COD encaissé" value={money(codEncaisse)} delta="reversable" deltaColor="amber" icon={<DownloadIcon width="15" />} accent="amber" />
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3" mb="4">
            <Flex justify="between" align="center" mb="4">
              <Box>
                <Heading size="4">Activité de la journée</Heading>
                <Text size="1" color="gray">Commandes créées par heure</Text>
              </Box>
              {peak.count > 0 && <Badge color="indigo" variant="soft">Pic à {String(peak.hour).padStart(2, '0')}h</Badge>}
            </Flex>
            <ActivityChart buckets={buckets} peakHour={peak.hour} />
          </Card>

          <Card size="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="4">Commandes urgentes</Heading>
              <Button asChild size="1" variant="ghost"><Link href="/orders">Tout voir <ChevronRightIcon /></Link></Button>
            </Flex>
            <Flex direction="column" gap="2">
              {urgentes.length === 0 && <Text size="2" color="gray">Aucune commande urgente.</Text>}
              {urgentes.map((o) => (
                <Link key={o.ref} href={`/orders/${encodeURIComponent(o.ref)}`} style={{ textDecoration: 'none' }}>
                  <Flex align="center" justify="between" gap="3" p="2" style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a4)' }}>
                    <Flex align="center" gap="3" style={{ minWidth: 0 }}>
                      <Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red-9)', flex: '0 0 8px' }} />
                      <Box style={{ minWidth: 0 }}>
                        <Text size="2" weight="medium" as="div">{o.ref}</Text>
                        <Text size="1" color="gray" as="div">{o.merchant} · {o.fromCity} → {o.toCity}</Text>
                      </Box>
                    </Flex>
                    <Flex align="center" gap="3"><CodChip amount={o.cod} paid={o.codPaid} /><StatusBadge status={o.status} /></Flex>
                  </Flex>
                </Link>
              ))}
            </Flex>
          </Card>
        </Box>

        <Box>
          <Card size="3" mb="4">
            <Heading size="4" mb="1">Conformité flotte</Heading>
            <Text size="1" color="gray" mb="3" as="div">Échéances à traiter</Text>
            <Flex direction="column" gap="2">
              {alerts.length === 0 && <Text size="2" color="gray">Aucune échéance en alerte.</Text>}
              {alerts.map((a, i) => (
                <Callout.Root key={i} color={a.color} size="1"><Callout.Icon>{a.icon}</Callout.Icon><Callout.Text>{a.text}</Callout.Text></Callout.Root>
              ))}
            </Flex>
          </Card>

          <Card size="3">
            <Flex justify="between" align="center" mb="3">
              <Heading size="4">COD du jour</Heading>
              <Badge color="amber" variant="soft">à reverser</Badge>
            </Flex>
            <Flex direction="column" gap="3">
              <Box>
                <Flex justify="between" mb="1"><Text size="1" color="gray">Encaissé</Text><Text size="1" weight="medium">{money(codEncaisse)}</Text></Flex>
                <Progress value={Math.round((codEncaisse / codTotal) * 100)} color="green" />
              </Box>
              <Box>
                <Flex justify="between" mb="1"><Text size="1" color="gray">À encaisser</Text><Text size="1" weight="medium">{money(codAEncaisser)}</Text></Flex>
                <Progress value={Math.round((codAEncaisser / codTotal) * 100)} color="amber" />
              </Box>
              <Separator size="4" />
              <Flex justify="between" align="center">
                <Text size="2" color="gray">Reversement marchands</Text>
                <Button asChild size="1" variant="soft"><Link href="/payout">Ouvrir</Link></Button>
              </Flex>
            </Flex>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
}
