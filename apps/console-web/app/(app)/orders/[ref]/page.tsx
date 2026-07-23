import * as React from 'react';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../../../lib/server';
import { ApiError } from '@transpo/api-client';
import { OrderDetailClient } from '../../../../components/OrderDetailClient';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { ref: string } }) {
  const ref = decodeURIComponent(params.ref);
  const role = cookies().get('role')?.value || '';
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(role);

  let order: Order;
  let driverNames: string[] = [];
  let commissionRate = 0.15;
  let vatRate = 0.20;
  try {
    const c = serverClient();
    order = await c.getOrder(ref);
    if (canWrite) driverNames = (await c.getDrivers()).map((d) => d.name);
    // Réservé ADMIN/COMPTABLE/DISPATCHER côté API : un rôle sans accès (MERCHANT/DRIVER)
    // garde les taux par défaut plutôt que de faire échouer la page entière.
    try {
      const cfg = await c.getPricingConfig();
      commissionRate = cfg.commissionRate;
      vatRate = cfg.vatRate;
    } catch { /* garde les défauts */ }
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    redirect('/login');
  }

  return <OrderDetailClient order={order} drivers={driverNames} canWrite={canWrite} commissionRate={commissionRate} vatRate={vatRate} />;
}
