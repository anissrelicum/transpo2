'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Card, Flex, Box, Grid, Text, Badge, Table, Select, TextField, Heading, Progress, Callout,
} from '@radix-ui/themes';
import {
  StarFilledIcon, MagnifyingGlassIcon, ChatBubbleIcon, PersonIcon, ExclamationTriangleIcon,
} from '@radix-ui/react-icons';
import type { ReviewsSummary, ReviewGroup } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return (
    <Flex gap="1" style={{ color: 'var(--amber-9)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarFilledIcon key={i} width={size} height={size} style={{ opacity: i < n ? 1 : 0.2 }} />
      ))}
    </Flex>
  );
}

function ratingColor(n: number): 'green' | 'amber' | 'red' {
  if (n >= 4) return 'green';
  if (n >= 3) return 'amber';
  return 'red';
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function ReviewsView({ data }: { data: ReviewsSummary }) {
  const [q, setQ] = React.useState('');
  const [note, setNote] = React.useState('all');

  const rows = data.reviews.filter((r) => {
    if (note === 'negative' && r.rating > 2) return false;
    if (note !== 'all' && note !== 'negative' && r.rating !== Number(note)) return false;
    if (q && !`${r.ref} ${r.merchant ?? ''} ${r.driver ?? ''} ${r.comment ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const max = Math.max(1, ...data.distribution.map((d) => d.count));

  return (
    <>
      <PageHeader
        title="Avis clients"
        subtitle={`${data.total} avis · note moyenne ${data.average ?? '—'}/5`}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Note moyenne" value={data.average != null ? `${data.average}/5` : '—'} delta={`${data.total} avis`} deltaColor="gray" icon={<StarFilledIcon width="15" />} accent="amber" />
        <KPI label="Avis négatifs" value={String(data.negatives)} delta="1 ou 2 étoiles" deltaColor={data.negatives ? 'red' : 'gray'} icon={<ExclamationTriangleIcon width="15" />} accent={data.negatives ? 'red' : 'gray'} />
        <KPI label="Commentaires" value={String(data.withComment)} delta="avis commentés" deltaColor="gray" icon={<ChatBubbleIcon width="15" />} accent="indigo" />
        <KPI label="Livreurs notés" value={String(data.byDriver.length)} delta="avec au moins un avis" deltaColor="gray" icon={<PersonIcon width="15" />} accent="cyan" />
      </Grid>

      {data.total === 0 && (
        <Callout.Root color="gray" mb="4">
          <Callout.Icon><StarFilledIcon /></Callout.Icon>
          <Callout.Text>Aucun avis pour le moment. Les clients notent la livraison depuis le suivi public, après passage au statut livré.</Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', lg: '3' }} gap="4" mb="4">
        <Card size="3">
          <Heading size="4" mb="3">Distribution</Heading>
          <Flex direction="column" gap="2">
            {[...data.distribution].reverse().map((d) => (
              <Flex key={d.stars} align="center" gap="3">
                <Flex align="center" gap="1" style={{ width: 58, flex: '0 0 58px' }}>
                  <Text size="2">{d.stars}</Text>
                  <StarFilledIcon width="12" style={{ color: 'var(--amber-9)' }} />
                </Flex>
                <Box style={{ flex: 1 }}>
                  <Progress value={Math.round((d.count / max) * 100)} color={ratingColor(d.stars)} />
                </Box>
                <Text size="1" color="gray" style={{ width: 26, textAlign: 'right' }}>{d.count}</Text>
              </Flex>
            ))}
          </Flex>
        </Card>

        <GroupCard title="Livreurs à surveiller" subtitle="Moyenne la plus basse d’abord" rows={data.byDriver} />
        <GroupCard title="Marchands" subtitle="Moyenne par marchand" rows={data.byMerchant} />
      </Grid>

      <Flex gap="3" mb="3" wrap="wrap">
        <TextField.Root placeholder="Rechercher (commande, marchand, livreur, commentaire)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 320 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={note} onValueChange={setNote}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Toutes les notes</Select.Item>
            <Select.Item value="negative">Négatifs (1–2)</Select.Item>
            {[5, 4, 3, 2, 1].map((n) => <Select.Item key={n} value={String(n)}>{n} étoile{n > 1 ? 's' : ''}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Commande</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Note</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Commentaire</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((r) => (
              <Table.Row key={r.ref} align="center">
                <Table.RowHeaderCell>
                  <Link href={`/orders/${encodeURIComponent(r.ref)}`} style={{ color: 'var(--indigo-11)', textDecoration: 'none' }}>
                    <Text size="2" weight="medium">{r.ref}</Text>
                  </Link>
                  <Text as="div" size="1" color="gray">{r.city}</Text>
                </Table.RowHeaderCell>
                <Table.Cell>
                  <Flex align="center" gap="2">
                    <Stars n={r.rating} />
                    <Badge color={ratingColor(r.rating)} variant="soft" size="1">{r.rating}</Badge>
                  </Flex>
                </Table.Cell>
                <Table.Cell style={{ maxWidth: 340 }}>
                  {r.comment ? <Text size="2">{r.comment}</Text> : <Text size="1" color="gray">—</Text>}
                </Table.Cell>
                <Table.Cell><Text size="2">{r.driver ?? '—'}</Text></Table.Cell>
                <Table.Cell><Text size="2">{r.merchant ?? '—'}</Text></Table.Cell>
                <Table.Cell><Text size="1" color="gray">{when(r.createdAt)}</Text></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{data.total ? 'Aucun avis ne correspond au filtre.' : 'Aucun avis pour le moment.'}</Text></Box>
        )}
      </Card>
    </>
  );
}

function GroupCard({ title, subtitle, rows }: { title: string; subtitle: string; rows: ReviewGroup[] }) {
  return (
    <Card size="3">
      <Heading size="4" mb="1">{title}</Heading>
      <Text as="div" size="1" color="gray" mb="3">{subtitle}</Text>
      <Flex direction="column" gap="2">
        {rows.length === 0 && <Text size="2" color="gray">Aucune donnée.</Text>}
        {rows.slice(0, 5).map((g) => (
          <Flex key={g.name} align="center" justify="between" gap="3">
            <Box style={{ minWidth: 0 }}>
              <Text as="div" size="2" weight="medium">{g.name}</Text>
              <Text as="div" size="1" color="gray">{g.count} avis</Text>
            </Box>
            <Flex align="center" gap="2">
              <Stars n={Math.round(g.avg)} />
              <Badge color={ratingColor(g.avg)} variant="soft">{g.avg}</Badge>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}
