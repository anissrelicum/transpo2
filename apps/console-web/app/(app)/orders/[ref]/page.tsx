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
  try {
    const c = serverClient();
    order = await c.getOrder(ref);
    if (canWrite) driverNames = (await c.getDrivers()).map((d) => d.name);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    redirect('/login');
  }

  return <OrderDetailClient order={order} drivers={driverNames} canWrite={canWrite} />;
}
