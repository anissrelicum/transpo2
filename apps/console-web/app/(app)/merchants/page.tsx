import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { MerchantRecord } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { MerchantsView } from '../../../components/MerchantsView';

export const dynamic = 'force-dynamic';

export default async function MerchantsPage() {
  // Écriture réservée à l'ADMIN et à la COMPTABLE (l'API le vérifie) ; lecture pour la console.
  const role = cookies().get('role')?.value || '';
  let merchants: MerchantRecord[] = [];
  let companyCommission = 0.15;
  try {
    merchants = await serverClient().listMerchants();
    companyCommission = (await serverClient().getPricingConfig()).commissionRate;
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <MerchantsView merchants={merchants} companyCommission={companyCommission} canEdit={role === 'ADMIN' || role === 'COMPTABLE'} />
    </Box>
  );
}
