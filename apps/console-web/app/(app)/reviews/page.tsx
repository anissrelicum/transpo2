import * as React from 'react';
import { Flex, Text, Badge } from '@radix-ui/themes';
import { StarFilledIcon } from '@radix-ui/react-icons';
import type { Order } from '@transpo/domain';
import { load, PageTitle, DataTable, Box, Card, Heading, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

function Stars({ n }: { n: number }) {
  return (
    <Flex gap="1" style={{ color: 'var(--amber-9)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <StarFilledIcon key={i} style={{ opacity: i < n ? 1 : 0.2 }} />
      ))}
    </Flex>
  );
}

export default async function ReviewsPage() {
  const orders = await load((c) => c.getOrders());
  const rated = orders.filter((o) => o.rating != null);
  const avg = rated.length ? Math.round((rated.reduce((s, o) => s + (o.rating || 0), 0) / rated.length) * 10) / 10 : 0;

  return (
    <Box style={wrap}>
      <PageTitle title="Avis clients" subtitle="Notes laissées par les clients après livraison." />
      <Card size="2" style={{ maxWidth: 260, marginBottom: 16 }}>
        <Text size="1" color="gray" weight="medium">Note moyenne</Text>
        <Flex align="center" gap="2" mt="1">
          <Heading size="7">{avg || '—'}</Heading>
          {rated.length > 0 && <Stars n={Math.round(avg)} />}
        </Flex>
        <Text size="1" color="gray">{rated.length} avis</Text>
      </Card>
      <DataTable<Order>
        columns={[
          { key: 'ref', label: 'Commande' },
          { key: 'merchant', label: 'Marchand', render: (o) => o.merchant ?? '—' },
          { key: 'rating', label: 'Note', render: (o) => <Stars n={o.rating || 0} /> },
          { key: 'ratingComment', label: 'Commentaire', render: (o) => o.ratingComment
            ? <Text size="2">{o.ratingComment}</Text> : <Text size="1" color="gray">—</Text> },
        ]}
        rows={rated}
        empty="Aucun avis pour le moment."
      />
    </Box>
  );
}
