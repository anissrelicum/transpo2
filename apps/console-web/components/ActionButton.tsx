'use client';
import * as React from 'react';
import { useSafeRefresh } from '../lib/safe-refresh';
import { Button } from '@radix-ui/themes';

// Bouton d'action générique : POST authentifié via le proxy, puis rafraîchit la page.
export function ActionButton({
  path, body, children, color, variant = 'soft', size = '1', confirm,
}: {
  path: string;                 // ex. "v1/fraud/cases/<id>/investigate"
  body?: unknown;
  children: React.ReactNode;
  color?: React.ComponentProps<typeof Button>['color'];
  variant?: 'solid' | 'soft' | 'outline' | 'ghost';
  size?: '1' | '2' | '3';
  confirm?: string;
}) {
  const refresh = useSafeRefresh();
  const [busy, setBusy] = React.useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(true);
    const res = await fetch(`/api/proxy/${path}`, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) refresh();
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  return (
    <Button size={size} variant={variant} color={color} disabled={busy} onClick={run}>
      {children}
    </Button>
  );
}
