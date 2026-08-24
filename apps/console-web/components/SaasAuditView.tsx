'use client';
import * as React from 'react';
import {
  Card, Flex, Box, Text, Badge, Table, Select, TextField,
} from '@radix-ui/themes';
import { MagnifyingGlassIcon } from '@radix-ui/react-icons';
import type { AuditEntry, Tenant } from '@transpo/api-client';
import { PageHeader } from './ui';

// Couleur du badge par famille d'action (préfixe avant le point).
const FAMILY_COLOR: Record<string, 'amber' | 'indigo' | 'cyan' | 'green' | 'red' | 'gray'> = {
  tenant: 'amber', subscription: 'indigo', plan: 'cyan', user: 'green', privacy: 'red',
};

function when(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function detailText(detail: unknown): string | null {
  if (detail === null || detail === undefined) return null;
  const s = JSON.stringify(detail);
  return s === '{}' || s === 'null' ? null : s;
}

export function SaasAuditView({ entries, tenants }: { entries: AuditEntry[]; tenants: Tenant[] }) {
  const [q, setQ] = React.useState('');
  const [tenant, setTenant] = React.useState('all');
  const [action, setAction] = React.useState('all');

  const actions = React.useMemo(
    () => [...new Set(entries.map((e) => e.action))].sort(),
    [entries],
  );
  const tenantOptions = React.useMemo(
    () => [...new Set([...tenants.map((t) => t.slug), ...entries.flatMap((e) => (e.tenant ? [e.tenant] : []))])].sort(),
    [tenants, entries],
  );

  const rows = entries.filter((e) => {
    if (tenant !== 'all' && e.tenant !== tenant) return false;
    if (action !== 'all' && e.action !== action) return false;
    if (q) {
      const hay = `${e.actor} ${e.target ?? ''} ${e.action} ${detailText(e.detail) ?? ''}`.toLowerCase();
      if (!hay.includes(q.toLowerCase())) return false;
    }
    return true;
  });

  return (
    <>
      <PageHeader
        title="Journal d'audit"
        subtitle={`${rows.length} événement(s) · ${entries.length} chargés (max 500)`}
      />

      <Flex gap="3" mb="3" wrap="wrap">
        <TextField.Root placeholder="Rechercher (acteur, cible, détail)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={tenant} onValueChange={setTenant}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Tous tenants</Select.Item>
            {tenantOptions.map((t) => <Select.Item key={t} value={t}>{t}</Select.Item>)}
          </Select.Content>
        </Select.Root>
        <Select.Root value={action} onValueChange={setAction}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Toutes actions</Select.Item>
            {actions.map((a) => <Select.Item key={a} value={a}>{a}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="1" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Quand</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Acteur</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Tenant</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Cible</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Détail</Table.ColumnHeaderCell>
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((e) => {
              const family = e.action.split('.')[0];
              const detail = detailText(e.detail);
              return (
                <Table.Row key={e.id} align="center">
                  <Table.Cell><Text size="1" color="gray" style={{ whiteSpace: 'nowrap' }}>{when(e.at)}</Text></Table.Cell>
                  <Table.Cell>
                    <Text as="div" size="2">{e.actor}</Text>
                    <Text as="div" size="1" color="gray">{e.actorRole}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {e.tenant
                      ? <Badge variant="soft" color="gray">{e.tenant}</Badge>
                      : <Text size="1" color="gray">plateforme</Text>}
                  </Table.Cell>
                  <Table.Cell>
                    <Badge variant="soft" color={FAMILY_COLOR[family] ?? 'gray'}>{e.action}</Badge>
                  </Table.Cell>
                  <Table.Cell><Text size="1">{e.target ?? '—'}</Text></Table.Cell>
                  <Table.Cell>
                    {detail
                      ? <Text size="1" color="gray" style={{ fontFamily: 'var(--code-font-family, monospace)', wordBreak: 'break-all' }}>{detail}</Text>
                      : <Text size="1" color="gray">—</Text>}
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{entries.length ? 'Aucun événement ne correspond au filtre.' : 'Journal vide.'}</Text></Box>
        )}
      </Card>
    </>
  );
}
