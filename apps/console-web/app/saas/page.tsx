import * as React from 'react';
import { redirect } from 'next/navigation';
import type { Tenant, SaasPlanRow } from '@transpo/api-client';
import { serverClient } from '../../lib/server';
import { SaasTenantsView } from '../../components/SaasTenantsView';

export const dynamic = 'force-dynamic';

export default async function SaasTenantsPage() {
  let tenants: Tenant[] = [];
  let plans: SaasPlanRow[] = [];
  try {
    const c = serverClient();
    [tenants, plans] = await Promise.all([c.listTenants(), c.getSaasPlans()]);
  } catch {
    redirect('/login?realm=saas');
  }
  return <SaasTenantsView tenants={tenants} plans={plans} />;
}
