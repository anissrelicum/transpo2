import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box, Flex, Grid, Heading, Text, Card, Table, Badge } from '@radix-ui/themes';
import { money } from '@transpo/ui-web';
import type { FraudCase, RiskDriver } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';

export const dynamic = 'force-dynamic';

const STATUS_COLOR: Record<string, string> = {
  OUVERT: 'red', ENQUETE: 'amber', BLANCHI: 'green', CONFIRME: 'crimson',
};

export default async function FraudPage() {
  let cases: FraudCase[] = [];
  let leaderboard: RiskDriver[] = [];
  try {
    const c = serverClient();
    [cases, leaderboard] = await Promise.all([c.getFraudCases(), c.getFraudLeaderboard()]);
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Heading size="6" weight="bold" mb="1">Fraude COD</Heading>
      <Text as="p" size="2" color="gray" mb="4">Cas de fraude détectés (score calculé) et livreurs à risque.</Text>

      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Heading size="4" mb="2">Cas ({cases.length})</Heading>
          <Card size="1">
            <Table.Root variant="ghost">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Motif</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">Montant</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell align="right">Score</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {cases.map((f) => (
                  <Table.Row key={f.id}>
                    <Table.RowHeaderCell>{f.driver}</Table.RowHeaderCell>
                    <Table.Cell><Text size="1" color="gray">{f.summary}</Text></Table.Cell>
                    <Table.Cell align="right">{money(f.amount)}</Table.Cell>
                    <Table.Cell align="right"><Badge color={f.score >= 60 ? 'red' : 'amber'}>{f.score}</Badge></Table.Cell>
                    <Table.Cell><Badge color={(STATUS_COLOR[f.status] as any) || 'gray'}>{f.status}</Badge></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Box>

        <Box>
          <Heading size="4" mb="2">Livreurs à risque</Heading>
          <Card size="2">
            <Flex direction="column" gap="3">
              {leaderboard.length === 0 && <Text size="2" color="gray">Aucun.</Text>}
              {leaderboard.map((d, i) => (
                <Flex key={d.driver} align="center" justify="between" gap="2">
                  <Flex align="center" gap="2">
                    <Badge color="gray" variant="soft">{i + 1}</Badge>
                    <Text size="2" weight="medium">{d.driver}</Text>
                  </Flex>
                  <Badge color={d.risk >= 60 ? 'red' : 'amber'}>{d.risk}</Badge>
                </Flex>
              ))}
            </Flex>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
}
