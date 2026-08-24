import * as React from 'react';
import { redirect } from 'next/navigation';
import type { AuditEntry, Tenant } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { SaasAuditView } from '../../../components/SaasAuditView';

export const dynamic = 'force-dynamic';

export default async function SaasAuditPage() {
  let entries: AuditEntry[] = [];
  let tenants: Tenant[] = [];
  try {
    const api = serverClient();
    // Filtres appliqués côté client (comme la vue Organisations) : une seule
    // réponse de 500 événements max suffit, l'API borne déjà à 500.
    [entries, tenants] = await Promise.all([api.getAudit({ limit: 500 }), api.listTenants()]);
  } catch {
    redirect('/login?realm=saas');
  }
  return <SaasAuditView entries={entries} tenants={tenants} />;
}
