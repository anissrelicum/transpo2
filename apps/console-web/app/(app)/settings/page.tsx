import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Box } from '@radix-ui/themes';
import type { CompanySettings, PriceConfig, DispatchSettings } from '@transpo/api-client';
import { AUTO_DISPATCH_DEFAULTS } from '@transpo/domain';
import { serverClient } from '../../../lib/server';
import { SettingsView } from '../../../components/SettingsView';
import { currentLang } from '../../../lib/i18n';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const isAdmin = (cookies().get('role')?.value || '') === 'ADMIN';
  const tenant = cookies().get('tenant')?.value || '—';
  let company: CompanySettings = { legalName: null, ice: null, rc: null, address: null, currency: 'MAD', timezone: 'Africa/Casablanca', defaultLang: 'fr' };
  // Défauts si le rôle n'a pas accès à /v1/pricing/config (MERCHANT/DRIVER) — la carte
  // Commission & TVA se contente alors d'un affichage neutre, non éditable de toute façon.
  let pricing: PriceConfig = { tiers: [], fragileSurcharge: 0, scheduledSurcharge: 0, discountRate: 0, commissionRate: 0.15, vatRate: 0.20 };
  let dispatch: DispatchSettings = { ...AUTO_DISPATCH_DEFAULTS, timezone: 'Africa/Casablanca' };
  try {
    const c = serverClient();
    company = await c.getCompanySettings();
    try { pricing = await c.getPricingConfig(); } catch { /* rôle sans accès à la tarification */ }
    try { dispatch = await c.getDispatchSettings(); } catch { /* défauts affichés */ }
  } catch {
    redirect('/login');
  }
  return (
    <Box style={{ maxWidth: 900, margin: '0 auto' }}>
      <SettingsView tenant={tenant} company={company} pricing={pricing} dispatch={dispatch} isAdmin={isAdmin} lang={currentLang()} />
    </Box>
  );
}
