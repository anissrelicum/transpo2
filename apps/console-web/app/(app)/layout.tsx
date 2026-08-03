import * as React from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { AppShell } from '../../components/AppShell';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Administrateur',
  DISPATCHER: 'Dispatcher',
  COMPTABLE: 'Comptable',
  MERCHANT: 'Marchand',
  DRIVER: 'Livreur',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = cookies();
  if (!jar.get('token')?.value) redirect('/login');
  const raw = jar.get('role')?.value || '';
  // Le marchand a son propre portail : la console transport lui renverrait des 403
  // sur la plupart des écrans (Reversement, Factures, Tarification…).
  if (raw === 'MERCHANT') redirect('/portail');
  const name = jar.get('name')?.value || 'Utilisateur';
  const role = ROLE_LABEL[raw] || 'Utilisateur';
  return <AppShell name={name} role={role}>{children}</AppShell>;
}
