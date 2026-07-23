'use client';
import * as React from 'react';
import Link from 'next/link';
import {
  Card, Flex, Box, Grid, Text, Heading, Button, IconButton, Badge, Separator,
  Tabs, Code, Callout, Tooltip,
} from '@radix-ui/themes';
import {
  ArrowLeftIcon, ChevronRightIcon, CopyIcon, CheckIcon, ClockIcon, HomeIcon,
  SewingPinFilledIcon, CubeIcon, DownloadIcon, InfoCircledIcon, ImageIcon, DotFilledIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import { LIFECYCLE, STATUS_META } from '@transpo/domain';
import type { Order, OrderStatus } from '@transpo/domain';
import { OrderActions } from './OrderActions';

const r2 = (n: number) => Math.round(n * 100) / 100;

function InfoBlock({ icon, title, lines }: { icon: React.ReactNode; title: string; lines: React.ReactNode[] }) {
  return (
    <Box>
      <Flex align="center" gap="2" mb="2"><Box style={{ color: 'var(--indigo-11)' }}>{icon}</Box><Text size="2" weight="bold">{title}</Text></Flex>
      <Flex direction="column" gap="1">{lines.map((l, i) => <Text key={i} as="div" size="2" color={i === 0 ? undefined : 'gray'}>{l}</Text>)}</Flex>
    </Box>
  );
}

export function OrderDetailClient({ order, drivers, canWrite, commissionRate, vatRate }: { order: Order; drivers: string[]; canWrite: boolean; commissionRate: number; vatRate: number }) {
  const [copied, setCopied] = React.useState(false);
  const idx = LIFECYCLE.indexOf(order.status as OrderStatus);
  const copy = () => { navigator.clipboard?.writeText(order.code); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  // Facturation dérivée du COD, aux taux commission/TVA configurés par le tenant (Paramètres).
  const codCollected = order.codPaid ? order.cod : 0;
  const commission = r2(codCollected * commissionRate);
  const netHt = r2(codCollected - commission);
  const tva = r2(netHt * vatRate);
  const ttc = r2(netHt + tva);

  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Flex align="center" gap="2" mb="3">
        <Button asChild variant="ghost" color="gray" size="2"><Link href="/orders"><ArrowLeftIcon /> Commandes</Link></Button>
        <ChevronRightIcon color="var(--gray-8)" />
        <Text size="2" color="gray">{order.ref}</Text>
      </Flex>

      <Flex justify="between" align="start" gap="4" wrap="wrap" mb="4">
        <Box>
          <Flex align="center" gap="3" mb="1">
            <Heading size="7" style={{ whiteSpace: 'nowrap' }}>{order.ref}</Heading>
            <StatusBadge status={order.status} />
          </Flex>
          <Flex align="center" gap="2">
            <Text size="2" color="gray">Code de suivi</Text>
            <Code variant="soft" size="2">{order.code}</Code>
            <Tooltip content={copied ? 'Copié !' : 'Copier le code'}>
              <IconButton size="1" variant="ghost" color={copied ? 'green' : 'gray'} onClick={copy}>{copied ? <CheckIcon /> : <CopyIcon />}</IconButton>
            </Tooltip>
          </Flex>
        </Box>
        {canWrite && <OrderActions ref_={order.ref} status={order.status} driver={order.driver} drivers={drivers} cod={order.cod} codPaid={order.codPaid} />}
      </Flex>

      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        {/* Timeline cycle de vie */}
        <Card size="3">
          <Heading size="4" mb="4">Cycle de vie</Heading>
          <Flex direction="column">
            {LIFECYCLE.map((s, i) => {
              const done = i < idx, cur = i === idx;
              return (
                <Flex key={s} gap="3">
                  <Flex direction="column" align="center">
                    <Flex align="center" justify="center" style={{ width: 24, height: 24, borderRadius: '50%', background: done ? 'var(--green-9)' : cur ? 'var(--indigo-9)' : 'var(--gray-a4)', color: done || cur ? 'white' : 'var(--gray-9)', flex: '0 0 24px' }}>
                      {done ? <CheckIcon width="13" /> : cur ? <DotFilledIcon /> : <Text size="1">{i + 1}</Text>}
                    </Flex>
                    {i < LIFECYCLE.length - 1 && <Box style={{ width: 2, flex: 1, minHeight: 26, background: i < idx ? 'var(--green-9)' : 'var(--gray-a4)' }} />}
                  </Flex>
                  <Box pb="3">
                    <Text as="div" size="2" weight={cur ? 'bold' : 'medium'} color={done || cur ? undefined : 'gray'}>{STATUS_META[s].fr}</Text>
                    <Text as="div" size="1" color="gray">{done || cur ? 'Franchi' : 'En attente'}</Text>
                  </Box>
                </Flex>
              );
            })}
          </Flex>
          {['ECHOUEE', 'RETOUR', 'ANNULEE'].includes(order.status) && (
            <Callout.Root color="red" size="1" mt="2"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>{STATUS_META[order.status as OrderStatus].fr}</Callout.Text></Callout.Root>
          )}
        </Card>

        {/* Onglets */}
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3">
            <Tabs.Root defaultValue="details">
              <Tabs.List>
                <Tabs.Trigger value="details">Détails</Tabs.Trigger>
                <Tabs.Trigger value="proof">Preuve de livraison</Tabs.Trigger>
                <Tabs.Trigger value="history">Historique</Tabs.Trigger>
                <Tabs.Trigger value="billing">Facturation</Tabs.Trigger>
              </Tabs.List>

              <Box pt="4">
                <Tabs.Content value="details">
                  <Grid columns={{ initial: '1', sm: '2' }} gap="4">
                    <InfoBlock icon={<HomeIcon />} title="Retrait" lines={[order.merchant ?? '—', order.fromCity]} />
                    <InfoBlock icon={<SewingPinFilledIcon />} title="Livraison" lines={[order.driver ?? 'À affecter', order.toCity]} />
                    <InfoBlock icon={<CubeIcon />} title="Colis" lines={[`Taille : ${order.size}`, `Preuve : ${order.proofLevel}`]} />
                    <InfoBlock icon={<DownloadIcon />} title="Encaissement (COD)" lines={[<CodChip key="c" amount={order.cod} paid={order.codPaid} />, order.codPaid ? 'À reverser au marchand' : 'En attente d’encaissement']} />
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="proof">
                  <Callout.Root color="gray" variant="surface" size="1" mb="3"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Preuve requise : <strong>{order.proofLevel}</strong>. {order.status === 'LIVREE' ? 'Livraison confirmée.' : 'En attente de la livraison.'}</Callout.Text></Callout.Root>
                  <Grid columns={{ initial: '2', sm: '4' }} gap="2">
                    {[0, 1, 2, 3].map((i) => (
                      <Box key={i} style={{ aspectRatio: '1', borderRadius: 'var(--radius-3)', border: order.status === 'LIVREE' && i < 2 ? 'none' : '1px dashed var(--gray-a6)', background: order.status === 'LIVREE' && i < 2 ? 'var(--indigo-a3)' : 'var(--gray-a2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-9)' }}>
                        <ImageIcon width="20" height="20" color={order.status === 'LIVREE' && i < 2 ? 'var(--indigo-10)' : undefined} />
                      </Box>
                    ))}
                  </Grid>
                </Tabs.Content>

                <Tabs.Content value="history">
                  <Flex direction="column">
                    {LIFECYCLE.slice(0, idx + 1).reverse().map((s, i, arr) => (
                      <Flex key={s} gap="3" py="2" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                        <Box style={{ width: 24, flex: '0 0 24px' }}><Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)', marginTop: 6 }} /></Box>
                        <Box><Text as="div" size="2">Statut → {STATUS_META[s].fr}</Text><Text as="div" size="1" color="gray">Étape du cycle de vie</Text></Box>
                      </Flex>
                    ))}
                    {idx < 0 && <Text size="2" color="gray">Aucun historique.</Text>}
                  </Flex>
                </Tabs.Content>

                <Tabs.Content value="billing">
                  <Flex direction="column" gap="2">
                    <Flex justify="between"><Text size="2" color="gray">COD encaissé</Text><Text size="2" weight="medium">{money(codCollected)}</Text></Flex>
                    <Flex justify="between"><Text size="2" color="gray">Commission ({Math.round(commissionRate * 100)} %)</Text><Text size="2" weight="medium">−{money(commission)}</Text></Flex>
                    <Separator size="4" />
                    <Flex justify="between"><Text size="2" weight="medium">Net à reverser HT</Text><Text size="2" weight="medium">{money(netHt)}</Text></Flex>
                    <Flex justify="between"><Text size="2" color="gray">TVA {Math.round(vatRate * 100)} %</Text><Text size="2" weight="medium">{money(tva)}</Text></Flex>
                    <Separator size="4" />
                    <Flex justify="between" align="center"><Text size="3" weight="bold">Total TTC</Text><Heading size="5">{money(ttc)}</Heading></Flex>
                    {codCollected === 0 && <Callout.Root color="gray" variant="surface" size="1" mt="2"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Aucun COD encaissé pour cette commande.</Callout.Text></Callout.Root>}
                  </Flex>
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
}
