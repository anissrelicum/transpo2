import * as React from 'react';
import { redirect } from 'next/navigation';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../../lib/server';
import { MerchantOrdersView } from '../../../components/MerchantOrdersView';

export const dynamic = 'force-dynamic';

export default async function MerchantOrdersPage() {
  let orders: Order[] = [];
  try {
    orders = await serverClient().getMerchantOrders();
  } catch {
    redirect('/login');
  }
  return <MerchantOrdersView orders={orders} />;
}
