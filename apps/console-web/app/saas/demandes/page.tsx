import * as React from 'react';
import { redirect } from 'next/navigation';
import type { DemoRequest } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { SaasDemandesView } from '../../../components/SaasDemandesView';

export const dynamic = 'force-dynamic';

export default async function SaasDemandesPage() {
  let demandes: DemoRequest[] = [];
  try {
    demandes = await serverClient().listDemoRequests();
  } catch {
    redirect('/login?realm=saas');
  }
  return <SaasDemandesView demandes={demandes} />;
}
