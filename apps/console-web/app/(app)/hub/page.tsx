import * as React from 'react';
import { Grid, Card, Heading, Text, Badge, Flex } from '@radix-ui/themes';
import type { ReturnRow } from '@transpo/api-client';
import { load, PageTitle, DataTable, Box, wrap } from '../../../lib/page';

export const dynamic = 'force-dynamic';

const LANES = [
  { key: 'A_TRAITER', label: 'À trier', color: 'amber' },
  { key: 'REPROGRAMME', label: 'Reprogrammés', color: 'blue' },
  { key: 'RENDU', label: 'Rendus au marchand', color: 'green' },
];

export default async function HubPage() {
  const returns = await load((c) => c.getReturns());
  return (
    <Box style={wrap}>
      <PageTitle title="Tri en hub" subtitle="Colis en souffrance regroupés par état de traitement." />
      <Grid columns={{ initial: '1', md: '3' }} gap="3">
        {LANES.map((lane) => {
          const items = returns.filter((r) => r.status === lane.key);
          return (
            <Card key={lane.key} size="2">
              <Flex align="center" justify="between" mb="2">
                <Heading size="3">{lane.label}</Heading>
                <Badge color={lane.color as any}>{items.length}</Badge>
              </Flex>
              <Flex direction="column" gap="2">
                {items.length === 0 && <Text size="1" color="gray">Vide.</Text>}
                {items.map((r) => (
                  <Box key={r.ref} style={{ border: '1px solid var(--gray-a4)', borderRadius: 'var(--radius-2)', padding: 8 }}>
                    <Text as="div" size="2" weight="medium">{r.ref}</Text>
                    <Text as="div" size="1" color="gray">{r.reason} · {r.attempts} tent.</Text>
                  </Box>
                ))}
              </Flex>
            </Card>
          );
        })}
      </Grid>
    </Box>
  );
}
