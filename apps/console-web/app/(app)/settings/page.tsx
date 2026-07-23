import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { CompanySettings, PriceConfig } from '@transpo/api-client';
import { serverClient } from '../../../lib/server';
import { SettingsView } from '../../../components/SettingsView';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  const tenant = cookies().get('tenant')?.value || '—';
  let company: CompanySettings = { legalName: null, ice: null, rc: null, address: null, currency: 'MAD', timezone: 'Africa/Casablanca', defaultLang: 'fr' };
  // Défauts si le rôle n'a pas accès à /v1/pricing/config (MERCHANT/DRIVER) — la carte
  // Commission & TVA se contente alors d'un affichage neutre, non éditable de toute façon.
  let pricing: PriceConfig = { tiers: [], fragileSurcharge: 0, scheduledSurcharge: 0, discountRate: 0, commissionRate: 0.15, vatRate: 0.20 };
  try {
    const c = serverClient();
    company = await c.getCompanySettings();
    try { pricing = await c.getPricingConfig(); } catch { /* rôle sans accès à la tarification */ }
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 900, margin: '0 auto' }}>
      <SettingsView tenant={tenant} company={company} pricing={pricing} isAdmin={isAdmin} />
    </Box>
  );
}
