'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { DotsHorizontalIcon } from '@radix-ui/react-icons';

// Statuts terminaux : plus d'action possible.
const TERMINAL = ['LIVREE', 'ANNULEE', 'RETOUR', 'ECHOUEE', 'RENDU'];

export function OrderActions({ ref_, status, driver, drivers }: {
  ref_: string; status: string; driver: string | null; drivers: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function act(action: string, body?: any) {
    setBusy(true);
    const res = await fetch(`/api/orders/${encodeURIComponent(ref_)}/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  const terminal = TERMINAL.includes(status);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={busy}>
        <IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger disabled={terminal}>Assigner un livreur</DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            {drivers.length === 0 && <DropdownMenu.Item disabled>Aucun livreur</DropdownMenu.Item>}
            {drivers.map((d) => (
              <DropdownMenu.Item key={d} onSelect={() => act('assign', { driver: d })}>
                {d === driver ? `✓ ${d}` : d}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
        <DropdownMenu.Item disabled={terminal || status === 'LIVRAISON'} onSelect={() => act('advance')}>
          Faire progresser le statut
        </DropdownMenu.Item>
        <DropdownMenu.Separator />
        <DropdownMenu.Item color="red" disabled={terminal} onSelect={() => act('cancel')}>
          Annuler la commande
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
