import * as React from 'react';
import { redirect } from 'next/navigation';
import { Card, Flex, Box, Text, Heading, Separator, Badge, Callout, Table } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { MerchantInvoice } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PageHeader } from '../../../components/ui';

export const dynamic = 'force-dynamic';

export default async function MerchantInvoicePage() {
  let invoice: MerchantInvoice;
  try {
    invoice = await serverClient().getMerchantInvoice();
  } catch {
    redirect('/login');
  }

  const period = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
  const vatPct = invoice.netHt > 0 ? Math.round((invoice.tva / invoice.netHt) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Facture"
        subtitle="Décompte dérivé de vos livraisons effectives. Document indicatif, non fiscal."
      />

      <Callout.Root color="blue" mb="4">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          Ce décompte est calculé en continu à partir des commandes <strong>livrées</strong> et du contre-remboursement
          réellement encaissé. Il n’est pas figé : il évolue à chaque nouvelle livraison.
        </Callout.Text>
      </Callout.Root>

      <Card size="4" style={{ maxWidth: 720 }}>
        <Flex justify="between" align="start" mb="4" wrap="wrap" gap="3">
          <Box>
            <Heading size="5">{invoice.merchant}</Heading>
            <Text as="div" size="2" color="gray">Période en cours — {period}</Text>
          </Box>
          <Badge color="indigo" variant="soft" size="2">{invoice.deliveries} livraison(s)</Badge>
        </Flex>

        <Separator size="4" mb="4" />

        <Table.Root size="2" variant="ghost">
          <Table.Body>
            <Table.Row>
              <Table.RowHeaderCell><Text size="2">Contre-remboursement encaissé</Text></Table.RowHeaderCell>
              <Table.Cell align="right"><Text size="2">{money(invoice.codCollected)}</Text></Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeaderCell><Text size="2" color="gray">Commission du transporteur</Text></Table.RowHeaderCell>
              <Table.Cell align="right"><Text size="2" color="amber">− {money(invoice.commission)}</Text></Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeaderCell><Text size="2" weight="medium">Net hors taxes</Text></Table.RowHeaderCell>
              <Table.Cell align="right"><Text size="2" weight="medium">{money(invoice.netHt)}</Text></Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.RowHeaderCell><Text size="2" color="gray">TVA ({vatPct} %)</Text></Table.RowHeaderCell>
              <Table.Cell align="right"><Text size="2">{money(invoice.tva)}</Text></Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>

        <Separator size="4" my="3" />

        <Flex justify="between" align="center">
          <Text size="3" weight="medium">Total TTC</Text>
          <Heading size="6" color="green">{money(invoice.ttc)}</Heading>
        </Flex>
      </Card>
    </>
  );
}
