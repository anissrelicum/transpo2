import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { PriceConfig } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PricingView } from '../../../components/PricingView';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  // POST pricing/config est réservé à l'ADMIN : lecture seule pour DISPATCHER/COMPTABLE.
  const canEdit = (cookies().get('role')?.value || '') === 'ADMIN';
  let config: PriceConfig;
  try {
    config = await serverClient().getPricingConfig();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PricingView config={config} canEdit={canEdit} />
    </Box>
  );
}
