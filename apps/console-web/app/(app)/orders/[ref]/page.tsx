import * as React from 'react';
import { redirect, notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Order } from '@transpo/domain';
import { serverClient } from '../../../../lib/server';
import { ApiError, type DeliveryProof } from '@transpo/api-client';
import { OrderDetailClient, type OrderEvent } from '../../../../components/OrderDetailClient';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { ref: string } }) {
  const ref = decodeURIComponent(params.ref);
  const role = cookies().get('role')?.value || '';
  const canWrite = ['ADMIN', 'DISPATCHER'].includes(role);

  let order: Order;
  let driverNames: string[] = [];
  let proof: DeliveryProof | null = null;
  let events: OrderEvent[] = [];
  let commissionRate = 0.15;
  let vatRate = 0.20;
  try {
    const c = serverClient();
    order = await c.getOrder(ref);
    if (canWrite) driverNames = (await c.getDrivers()).map((d) => d.name);
    // Preuve : absente tant que le livreur n'a rien déposé — ne doit pas casser la page.
    try { proof = await c.getOrderProof(ref); } catch { /* preuve indisponible */ }
    // Journal des transitions : les commandes antérieures au journal en sont dépourvues,
    // ce qui ne doit pas empêcher d'afficher la fiche.
    try { events = await c.getOrderEvents(ref); } catch { /* journal indisponible */ }
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

  return <OrderDetailClient order={order} drivers={driverNames} proof={proof} events={events} canWrite={canWrite} commissionRate={commissionRate} vatRate={vatRate} />;
}
