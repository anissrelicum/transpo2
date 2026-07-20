import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { Order } from '@transpo/domain';
import type { ReturnRow } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { ReturnsView, type Ret } from '../../../components/ReturnsView';

export const dynamic = 'force-dynamic';

export default async function ReturnsPage() {
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(cookies().get('role')?.value || '');
  let returns: ReturnRow[] = [];
  let orders: Order[] = [];
  try {
    const c = serverClient();
    [returns, orders] = await Promise.all([c.getReturns(), c.getOrders()]);
  } catch {
    redirect('/login');
  }

  // Enrichissement retour ← commande (marchand / ville de destination / COD).
  const byRef = new Map(orders.map((o) => [o.ref, o]));
  const enriched: Ret[] = returns.map((r) => {
    const o = byRef.get(r.ref);
    return { ref: r.ref, reason: r.reason, attempts: r.attempts, status: r.status, merchant: o?.merchant ?? null, city: o?.toCity ?? '—', cod: o?.cod ?? 0 };
  });

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <ReturnsView returns={enriched} canWrite={canWrite} />
    </Box>
  );
}
