import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { Invoice, BillingMode } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { BillingView } from '../../../components/BillingView';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
  let invoices: Invoice[] = [];
  let modes: BillingMode[] = [];
  try {
    const c = serverClient();
    [invoices, modes] = await Promise.all([c.getInvoices(), c.getBillingModes()]);
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <BillingView invoices={invoices} modes={modes} />
    </Box>
  );
}
