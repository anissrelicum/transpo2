import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { PriceConfig } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { PricingView } from '../../../components/PricingView';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  let config: PriceConfig;
  try {
    config = await serverClient().getPricingConfig();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PricingView config={config} />
    </Box>
  );
}
