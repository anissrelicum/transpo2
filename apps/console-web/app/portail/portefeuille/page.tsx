import * as React from 'react';
import { redirect } from 'next/navigation';
import { Card, Flex, Box, Grid, Text, Heading, Separator, Callout, Table } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import type { MerchantWallet } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function MerchantWalletPage() {
  let wallet: MerchantWallet;
  let orders: Order[] = [];
  try {
    const c = serverClient();
    [wallet, orders] = await Promise.all([c.getMerchantWallet(), c.getMerchantOrders()]);
  } catch {
    redirect('/login');
  }

  // Détail du solde : uniquement les commandes dont le COD a réellement été encaissé.
  const collected = orders.filter((o) => o.codPaid && o.cod > 0);
  const pending = orders.filter((o) => !o.codPaid && o.cod > 0);
  const pendingTotal = pending.reduce((s, o) => s + o.cod, 0);
  const pct = Math.round(wallet.commissionRate * 100);

  return (
    <>
      <PageHeader
        title="Portefeuille"
        subtitle="Contre-remboursements encaissés pour votre compte, nets de commission."
      />

      <Grid columns={{ initial: '1', md: '3' }} gap="4" mb="4">
        <Card size="3">
          <Text as="div" size="1" color="gray" weight="medium">COD encaissé</Text>
          <Heading size="7" mt="1">{money(wallet.codCollected)}</Heading>
          <Text as="div" size="1" color="gray" mt="1">{collected.length} commande(s)</Text>
        </Card>
        <Card size="3">
          <Text as="div" size="1" color="gray" weight="medium">Commission ({pct} %)</Text>
          <Heading size="7" mt="1" color="amber">− {money(wallet.commission)}</Heading>
          <Text as="div" size="1" color="gray" mt="1">retenue du transporteur</Text>
        </Card>
        <Card size="3" style={{ borderColor: 'var(--green-a6)' }}>
          <Text as="div" size="1" color="gray" weight="medium">Net à reverser</Text>
          <Heading size="7" mt="1" color="green">{money(wallet.net)}</Heading>
          <Text as="div" size="1" color="gray" mt="1">solde en votre faveur</Text>
        </Card>
      </Grid>

      {pending.length > 0 && (
        <Callout.Root color="blue" mb="4">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{money(pendingTotal)}</strong> de contre-remboursement sur {pending.length} commande(s) restent à
            encaisser auprès des destinataires. Ce montant n’entre au portefeuille qu’une fois collecté.
          </Callout.Text>
        </Callout.Root>
      )}

      <Card size="3" mb="4">
        <Heading size="4" mb="3">Calcul du solde</Heading>
        <Flex direction="column" gap="2">
          <Flex justify="between"><Text size="2" color="gray">COD encaissé</Text><Text size="2">{money(wallet.codCollected)}</Text></Flex>
          <Flex justify="between"><Text size="2" color="gray">Commission ({pct} %)</Text><Text size="2" color="amber">− {money(wallet.commission)}</Text></Flex>
          <Separator size="4" />
          <Flex justify="between"><Text size="2" weight="medium">Net à reverser</Text><Text size="2" weight="bold" color="green">{money(wallet.net)}</Text></Flex>
        </Flex>
      </Card>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Commande</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Trajet</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Encaissée le</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">Montant COD</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {collected.map((o) => (
              <Table.Row key={o.ref} align="center">
                <Table.RowHeaderCell><Text size="2" weight="medium">{o.ref}</Text></Table.RowHeaderCell>
                <Table.Cell><Text size="2">{o.fromCity} → {o.toCity}</Text></Table.Cell>
                <Table.Cell><Text size="1" color="gray">{when(o.createdAt)}</Text></Table.Cell>
                <Table.Cell align="right"><Text size="2">{money(o.cod)}</Text></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {collected.length === 0 && (
          <Box p="4"><Text size="2" color="gray">Aucun contre-remboursement encaissé pour le moment.</Text></Box>
        )}
      </Card>
    </>
  );
}
