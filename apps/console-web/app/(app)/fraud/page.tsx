import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { FraudCase, RiskDriver } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { FraudView } from '../../../components/FraudView';

export const dynamic = 'force-dynamic';

export default async function FraudPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  let cases: FraudCase[] = [];
  let leaderboard: RiskDriver[] = [];
  try {
    const c = serverClient();
    [cases, leaderboard] = await Promise.all([c.getFraudCases(), c.getFraudLeaderboard()]);
  } catch {
    redirect('/login');
  }

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <FraudView cases={cases} leaderboard={leaderboard} isAdmin={isAdmin} />
    </Box>
  );
}
