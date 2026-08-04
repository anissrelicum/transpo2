import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Key } from '@transpo/i18n';
import { AppShell } from '../../components/AppShell';
import { i18n } from '../../lib/i18n';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = cookies();
  if (!jar.get('token')?.value) redirect('/login');
  const raw = jar.get('role')?.value || '';
  // Le marchand a son propre portail : la console transport lui renverrait des 403
  // sur la plupart des écrans (Reversement, Factures, Tarification…).
  if (raw === 'MERCHANT') redirect('/portail');
  const { lang, tr } = i18n();
  const name = jar.get('name')?.value || 'Utilisateur';
  const roleKey = (raw ? `roles.${raw}` : 'roles.UNKNOWN') as Key;
  return <AppShell name={name} role={tr(roleKey)} lang={lang}>{children}</AppShell>;
}
