import * as React from 'react';
import { redirect } from 'next/navigation';
import { Box } from '@radix-ui/themes';
import type { CashSession } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { CashView } from '../../../components/CashView';

export const dynamic = 'force-dynamic';

export default async function CashPage() {
  let sessions: CashSession[] = [];
  try {
    sessions = await serverClient().getCashSessions();
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <CashView sessions={sessions} />
    </Box>
  );
}
