import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { Reversement } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { ReversementView } from '../../../components/ReversementView';

export const dynamic = 'force-dynamic';

export default async function PayoutPage() {
  let rows: Reversement[] = [];
  try {
    rows = await serverClient().getReversements();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <ReversementView rows={rows} />
    </Box>
  );
}
