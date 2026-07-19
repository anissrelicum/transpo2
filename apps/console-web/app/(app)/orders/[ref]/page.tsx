import * as React from 'react';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Box, Flex, Grid, Heading, Text, Card, Button, Separator, Badge } from '@radix-ui/themes';
import { ArrowLeftIcon, CheckIcon } from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import { LIFECYCLE, STATUS_META } from '@transpo/domain';
import type { Order, OrderStatus } from '@transpo/domain';
import { serverClient } from '../../../../lib/server';
import { OrderActions } from '../../../../components/OrderActions';
import { ApiError } from '@transpo/api-client';

export const dynamic = 'force-dynamic';

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex justify="between" align="center" py="2">
      <Text size="2" color="gray">{label}</Text>
      <Text size="2" weight="medium">{children}</Text>
    </Flex>
  );
}

export default async function OrderDetailPage({ params }: { params: { ref: string } }) {
  const ref = decodeURIComponent(params.ref);
  const role = cookies().get('role')?.value || '';
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(role);

  let order: Order;
  let driverNames: string[] = [];
  try {
    const c = serverClient();
    order = await c.getOrder(ref);
    if (canWrite) driverNames = (await c.getDrivers()).map((d) => d.name);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    redirect('/login');
  }

  const idx = LIFECYCLE.indexOf(order.status as OrderStatus);

  return (
    <Box style={{ maxWidth: 860, margin: '0 auto' }}>
      <Flex align="center" justify="between" mb="4" gap="3" wrap="wrap">
        <Flex align="center" gap="3">
          <Button asChild size="1" variant="soft" color="gray"><Link href="/orders"><ArrowLeftIcon /> Commandes</Link></Button>
          <Heading size="6" weight="bold">{order.ref}</Heading>
          <StatusBadge status={order.status} />
        </Flex>
        {canWrite && <OrderActions ref_={order.ref} status={order.status} driver={order.driver} drivers={driverNames} cod={order.cod} codPaid={order.codPaid} />}
      </Flex>

      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <Card size="3">
          <Heading size="3" mb="2">Détails</Heading>
          <InfoRow label="Code de suivi">{order.code}</InfoRow>
          <Separator size="4" />
          <InfoRow label="Marchand">{order.merchant ?? '—'}</InfoRow>
          <Separator size="4" />
          <InfoRow label="Trajet">{order.fromCity} → {order.toCity}</InfoRow>
          <Separator size="4" />
          <InfoRow label="Livreur">{order.driver ?? '—'}</InfoRow>
          <Separator size="4" />
          <InfoRow label="Taille">{order.size}</InfoRow>
          <Separator size="4" />
          <InfoRow label="COD"><CodChip amount={order.cod} paid={order.codPaid} /></InfoRow>
          {order.rating != null && (<><Separator size="4" /><InfoRow label="Note client"><Badge color="amber">{order.rating} / 5</Badge></InfoRow></>)}
        </Card>

        <Card size="3">
          <Heading size="3" mb="3">Progression</Heading>
          <Flex direction="column" gap="0">
            {LIFECYCLE.map((s, i) => {
              const done = idx >= 0 && i <= idx;
              const current = i === idx;
              return (
                <Flex key={s} align="center" gap="3" py="2">
                  <Flex align="center" justify="center" style={{
                    width: 26, height: 26, borderRadius: '50%', flex: '0 0 26px',
                    background: done ? `var(--${STATUS_META[s].color}-9)` : 'var(--gray-a4)',
                    color: done ? '#fff' : 'var(--gray-9)',
                  }}>
                    {done ? <CheckIcon /> : <Text size="1">{i + 1}</Text>}
                  </Flex>
                  <Text size="2" weight={current ? 'bold' : 'regular'} color={done ? undefined : 'gray'}>
                    {STATUS_META[s].fr}
                  </Text>
                </Flex>
              );
            })}
          </Flex>
          {['ECHOUEE', 'RETOUR', 'ANNULEE'].includes(order.status) && (
            <Badge color="red" mt="2">{STATUS_META[order.status as OrderStatus].fr}</Badge>
          )}
        </Card>
      </Grid>
    </Box>
  );
}
