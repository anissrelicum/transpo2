import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { serverClient } from '../../../../lib/server';
import { CreateWizard } from '../../../../components/CreateWizard';

export const dynamic = 'force-dynamic';

export default async function NewOrderPage() {
  const role = cookies().get('role')?.value || '';
  if (!['ADMIN', 'DISPATCHER', 'MERCHANT'].includes(role)) redirect('/orders');

  // Marchands réels (dérivés des commandes existantes) pour le sélecteur.
  let merchants: string[] = [];
  try {
    const orders = await serverClient().getOrders();
    merchants = [...new Set(orders.map((o) => o.merchant).filter(Boolean) as string[])].sort();
  } catch { /* liste vide → champ texte libre */ }

  return <CreateWizard merchants={merchants} />;
}
