'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, TextField, Code, Dialog, Table, Separator, ScrollArea,
} from '@radix-ui/themes';
import {
  ArchiveIcon, LayersIcon, StackIcon, ArrowRightIcon, MagnifyingGlassIcon, CheckIcon, SewingPinFilledIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { Order } from '@transpo/domain';
import { PageHeader, KPI } from './ui';

const COLS = [
  { key: 'arrive', title: 'Arrivés — à scanner', color: 'blue', icon: <ArchiveIcon /> },
  { key: 'trier', title: 'Scannés — à trier', color: 'amber', icon: <LayersIcon /> },
  { key: 'quai', title: 'Sur quai — par destination', color: 'green', icon: <StackIcon /> },
] as const;

export function HubView({ parcels, canWrite }: { parcels: Order[]; canWrite: boolean }) {
  const router = useRouter();
  const [scan, setScan] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const byPhase = (k: string) => parcels.filter((p) => p.hubPhase === k);
  const quai = byPhase('quai');
  const quaiByDest = quai.reduce<Record<string, Order[]>>((m, p) => { (m[p.toCity] = m[p.toCity] || []).push(p); return m; }, {});
  const destinations = Object.keys(quaiByDest);

  async function post(url: string, body?: any) {
    setBusy(true);
    const res = await fetch(url, { method: 'POST', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (res.ok) { router.refresh(); return true; }
    const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); return false;
  }
  async function doScan() { if (scan.length !== 8) return; const ok = await post('/api/proxy/v1/hub/scan', { code: scan }); if (ok) setScan(''); }
  const move = (ref: string, phase: string) => post(`/api/proxy/v1/hub/${encodeURIComponent(ref)}/phase`, { phase });

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader title="Tri en hub" subtitle={`Hub Casablanca · ${parcels.length} colis en cours de traitement`} />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Colis dans le hub" value={String(parcels.length)} icon={<ArchiveIcon width="15" />} accent="indigo" />
        <KPI label="À scanner" value={String(byPhase('arrive').length)} delta="entrée hub" deltaColor="cyan" icon={<MagnifyingGlassIcon width="15" />} accent="cyan" />
        <KPI label="Sur quai" value={String(quai.length)} delta="prêts au transfert" deltaColor="green" icon={<StackIcon width="15" />} accent="green" />
        <KPI label="Destinations" value={String(destinations.length)} delta={destinations.join(', ') || '—'} deltaColor="gray" icon={<ArrowRightIcon width="15" />} accent="amber" />
      </Grid>

      {canWrite && (
        <Card size="2" mb="4">
          <Flex align="center" gap="3" wrap="wrap">
            <Flex align="center" justify="center" style={{ width: 40, height: 40, borderRadius: 'var(--radius-3)', background: 'var(--indigo-a3)', color: 'var(--indigo-11)', flex: '0 0 40px' }}><MagnifyingGlassIcon /></Flex>
            <Box style={{ flex: 1, minWidth: 220 }}>
              <TextField.Root size="3" radius="large" placeholder="Scanner ou saisir un code colis (8 car.)…" value={scan} onChange={(e) => setScan(e.target.value.toUpperCase().slice(0, 8))} onKeyDown={(e) => e.key === 'Enter' && doScan()}>
                <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
                {scan.length === 8 && <TextField.Slot side="right"><Badge color="green"><CheckIcon width="12" /> Prêt</Badge></TextField.Slot>}
              </TextField.Root>
            </Box>
            <Button size="3" disabled={scan.length !== 8 || busy} onClick={doScan}><CheckIcon /> Enregistrer l’entrée</Button>
          </Flex>
        </Card>
      )}

      <Grid columns={{ initial: '1', md: '3' }} gap="3" style={{ alignItems: 'start' }}>
        {COLS.map((c) => (
          <Box key={c.key} style={{ background: 'var(--gray-a2)', borderRadius: 'var(--radius-4)', padding: 'var(--space-3)' }}>
            <Flex align="center" justify="between" mb="3">
              <Flex align="center" gap="2"><Box style={{ color: `var(--${c.color}-11)` }}>{c.icon}</Box><Text size="2" weight="bold">{c.title}</Text></Flex>
              <Badge color={c.color} variant="soft" radius="full">{byPhase(c.key).length}</Badge>
            </Flex>

            {c.key === 'quai' ? (
              <Flex direction="column" gap="3">
                {destinations.length === 0 && <Text size="1" color="gray">Aucun colis sur quai.</Text>}
                {destinations.map((dest) => (
                  <Box key={dest}>
                    <Flex align="center" justify="between" mb="2">
                      <Flex align="center" gap="1"><SewingPinFilledIcon color="var(--gray-9)" /><Text size="1" weight="medium" color="gray">{dest} · {quaiByDest[dest].length}</Text></Flex>
                      <ManifestDialog dest={dest} list={quaiByDest[dest]} />
                    </Flex>
                    <Flex direction="column" gap="2">{quaiByDest[dest].map((p) => <ParcelCard key={p.ref} p={p} />)}</Flex>
                  </Box>
                ))}
              </Flex>
            ) : (
              <Flex direction="column" gap="2">
                {byPhase(c.key).length === 0 && <Text size="1" color="gray">Vide.</Text>}
                {byPhase(c.key).map((p) => (
                  <ParcelCard key={p.ref} p={p}
                    action={canWrite ? (c.key === 'arrive' ? { label: 'Marquer scanné', color: 'indigo', onClick: () => move(p.ref, 'trier') } : { label: 'Placer sur quai', color: 'green', onClick: () => move(p.ref, 'quai') }) : undefined}
                    busy={busy} />
                ))}
              </Flex>
            )}
          </Box>
        ))}
      </Grid>
    </Box>
  );
}

function ParcelCard({ p, action, busy }: { p: Order; action?: { label: string; color: 'indigo' | 'green'; onClick: () => void }; busy?: boolean }) {
  return (
    <Card size="1">
      <Flex direction="column" gap="1">
        <Flex align="center" justify="between"><Text size="2" weight="medium">{p.ref}</Text><Badge variant="soft" color="gray" radius="full">{p.toCity}</Badge></Flex>
        <Flex align="center" justify="between"><Code variant="ghost" size="1">{p.code}</Code><Text size="1" color="gray">{p.size}</Text></Flex>
        {p.cod > 0 && <Badge color="amber" variant="soft" radius="full" style={{ alignSelf: 'flex-start' }}>COD · {money(p.cod)}</Badge>}
        {action && <Button size="1" variant="soft" color={action.color} mt="1" disabled={busy} onClick={action.onClick}><CheckIcon /> {action.label}</Button>}
      </Flex>
    </Card>
  );
}

function ManifestDialog({ dest, list }: { dest: string; list: Order[] }) {
  const total = list.reduce((a, p) => a + p.cod, 0);
  return (
    <Dialog.Root>
      <Dialog.Trigger><Button size="1" variant="soft" color="green"><ArrowRightIcon /> Manifeste</Button></Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 520 }}>
        <Dialog.Title>Manifeste de transfert → {dest}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">Regroupe les colis sur quai pour un transfert interurbain.</Dialog.Description>
        <Card size="1" mb="3">
          <ScrollArea style={{ maxHeight: 240 }}>
            <Table.Root size="1" variant="ghost">
              <Table.Header><Table.Row><Table.ColumnHeaderCell>Colis</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell><Table.ColumnHeaderCell align="right">COD</Table.ColumnHeaderCell></Table.Row></Table.Header>
              <Table.Body>
                {list.map((p) => <Table.Row key={p.ref}><Table.RowHeaderCell><Text size="1">{p.ref}</Text></Table.RowHeaderCell><Table.Cell><Code size="1" variant="ghost">{p.code}</Code></Table.Cell><Table.Cell align="right"><Text size="1">{p.cod ? money(p.cod) : '—'}</Text></Table.Cell></Table.Row>)}
              </Table.Body>
            </Table.Root>
          </ScrollArea>
        </Card>
        <Flex justify="between" align="center" mb="4"><Text size="2" color="gray">{list.length} colis · COD embarqué</Text><Text size="3" weight="bold">{money(total)}</Text></Flex>
        <Flex gap="3" justify="end"><Dialog.Close><Button variant="soft" color="gray">Fermer</Button></Dialog.Close><Dialog.Close><Button color="green"><CheckIcon /> Sceller le bordereau</Button></Dialog.Close></Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
