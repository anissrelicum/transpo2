import * as React from 'react';
import { redirect } from 'next/navigation';
import type { SaasPlanRow } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { SaasPlansView } from '../../../components/SaasPlansView';

export const dynamic = 'force-dynamic';

export default async function SaasPlansPage() {
  let plans: SaasPlanRow[] = [];
  try {
    // `archived` inclus : la vue propose une bascule pour les afficher.
    plans = await serverClient().getSaasPlans(true);
  } catch {
    redirect('/login?realm=saas');
  }
  return <SaasPlansView plans={plans} />;
}
