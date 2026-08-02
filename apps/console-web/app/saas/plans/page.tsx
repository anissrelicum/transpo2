import * as React from 'react';
import { redirect } from 'next/navigation';
import { Card, Flex, Box, Grid, Text, Heading, Badge, Table } from '@radix-ui/themes';
import { CheckIcon } from '@radix-ui/react-icons';
import type { SaasPlanRow, Tenant } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

function money(dh: number): string {
  return `${dh.toLocaleString('fr-FR')} DH`;
}

export default async function SaasPlansPage() {
  let plans: SaasPlanRow[] = [];
  let tenants: Tenant[] = [];
  try {
    const c = serverClient();
    [plans, tenants] = await Promise.all([c.getSaasPlans(), c.listTenants()]);
  } catch {
    redirect('/login?realm=saas');
  }

  // Répartition réelle du parc sur le catalogue.
  const count = (code: string) => tenants.filter((t) => t.plan === code).length;

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Catalogue d’abonnement. Source unique : le domaine — un changement de tarif se fait au code, pas en base."
      />

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3" mb="4">
        {plans.map((p) => (
          <Card key={p.code} size="3">
            <Flex direction="column" gap="2" style={{ height: '100%' }}>
              <Flex align="center" justify="between">
                <Text size="2" weight="medium">{p.label}</Text>
                <Badge variant="soft" color={count(p.code) ? 'indigo' : 'gray'}>{count(p.code)}</Badge>
              </Flex>
              <Flex align="baseline" gap="1">
                <Heading size="7">{p.monthlyDH === 0 ? 'Gratuit' : money(p.monthlyDH)}</Heading>
                {p.monthlyDH > 0 && <Text size="1" color="gray">/mois</Text>}
              </Flex>
              <Box style={{ flex: 1 }}>
                <Flex align="center" gap="2" mt="2">
                  <CheckIcon color="var(--green-11)" />
                  <Text size="2" color="gray">
                    {p.maxOrdersMonth != null
                      ? `${p.maxOrdersMonth.toLocaleString('fr-FR')} commandes/mois`
                      : 'Commandes illimitées'}
                  </Text>
                </Flex>
              </Box>
              <Text size="1" color="gray">
                {count(p.code) === 0 ? 'Aucune organisation' : `${count(p.code)} organisation(s)`}
              </Text>
            </Flex>
          </Card>
        ))}
      </Grid>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Tarif mensuel</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Quota commandes</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Organisations</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Revenu théorique</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {plans.map((p) => (
              <Table.Row key={p.code} align="center">
                <Table.RowHeaderCell><Text size="2" weight="medium">{p.label}</Text></Table.RowHeaderCell>
                <Table.Cell>{money(p.monthlyDH)}</Table.Cell>
                <Table.Cell>{p.maxOrdersMonth != null ? p.maxOrdersMonth.toLocaleString('fr-FR') : 'Illimité'}</Table.Cell>
                <Table.Cell>{count(p.code)}</Table.Cell>
                <Table.Cell align="right">{money(p.monthlyDH * count(p.code))}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Card>
    </>
  );
}
