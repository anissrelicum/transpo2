'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, TextField, Select,
  Avatar, Popover, Inset, Separator,
} from '@radix-ui/themes';
import { PlusIcon, Cross2Icon, CheckIcon, GlobeIcon } from '@radix-ui/react-icons';
import { CITY_COORDS } from '@transpo/domain';
import type { Zone } from '@transpo/api-client';
import { Map, type MapCircle } from './Map';

const PALETTE = ['indigo', 'cyan', 'amber', 'grass', 'crimson', 'violet'];
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

export function ZonesView({ zones: initial, drivers, canWrite }: { zones: Zone[]; drivers: string[]; canWrite: boolean }) {
  const router = useRouter();
  const [zones, setZones] = React.useState<Zone[]>(initial);
  const [selId, setSelId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const zone = zones.find((z) => z.id === selId) ?? null;

  React.useEffect(() => { setZones(initial); }, [initial]);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/dispatch/zones/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false);
    if (res.ok) { const z = await res.json(); setZones((zs) => zs.map((x) => (x.id === id ? z : x))); }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Mise à jour impossible'); }
  }
  async function createZone() {
    setBusy(true);
    const res = await fetch('/api/proxy/v1/dispatch/zones', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nameFr: 'Nouvelle zone', color: PALETTE[zones.length % PALETTE.length], commune: '', centerLat: 33.5731, centerLng: -7.5898 }) });
    setBusy(false);
    if (res.ok) { const z = await res.json(); setZones((zs) => [...zs, z]); setSelId(z.id); }
  }
  const setField = (patchBody: Record<string, unknown>) => zone && patch(zone.id, patchBody);
  const addDriver = (name: string) => zone && !zone.drivers.includes(name) && patch(zone.id, { drivers: [...zone.drivers, name] });
  const removeDriver = (name: string) => zone && patch(zone.id, { drivers: zone.drivers.filter((d) => d !== name) });

  const circles: MapCircle[] = zones.filter((z) => z.centerLat != null && z.centerLng != null)
    .map((z) => ({ id: z.id, lat: z.centerLat!, lng: z.centerLng!, radiusM: 3500, color: z.color, label: z.nameFr, selected: z.id === selId }));
  const geo = zones.filter((z) => z.centerLat != null);
  const center: [number, number] = zone?.centerLat != null
    ? [zone.centerLat, zone.centerLng!]
    : geo.length ? [geo[0].centerLat!, geo[0].centerLng!] : (CITY_COORDS['Casablanca'] as [number, number]);
  const available = drivers.filter((d) => !zone || !zone.drivers.includes(d));

  return (
    <Grid columns={{ initial: '1', md: '3' }} gap="4">
      {/* Liste */}
      <Box>
        <Flex align="center" justify="between" mb="2">
          <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Zones · {zones.length}</Text>
          {canWrite && <Button size="1" onClick={createZone} disabled={busy}><PlusIcon /> Nouvelle</Button>}
        </Flex>
        <Flex direction="column" gap="2">
          {zones.map((z) => (
            <Card key={z.id} variant={z.id === selId ? 'surface' : 'ghost'} style={{ cursor: 'pointer', border: z.id === selId ? '1px solid var(--indigo-7)' : '1px solid var(--gray-a3)' }} onClick={() => setSelId(z.id)}>
              <Flex align="center" justify="between">
                <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                  <Box style={{ width: 12, height: 12, borderRadius: 3, background: `var(--${z.color}-9)`, flex: '0 0 12px' }} />
                  <Box style={{ minWidth: 0 }}>
                    <Text as="div" size="2" weight="medium">{z.nameFr}</Text>
                    <Text as="div" size="1" color="gray">{z.commune || '—'}</Text>
                  </Box>
                </Flex>
                <Flex>{z.drivers.length ? z.drivers.map((d, i) => <Box key={d} style={{ marginInlineStart: i ? -8 : 0 }}><Avatar size="1" radius="full" fallback={initials(d)} color={z.color as any} style={{ boxShadow: '0 0 0 2px var(--color-panel-solid)' }} /></Box>) : <Badge color="gray" variant="soft" radius="full">0</Badge>}</Flex>
              </Flex>
            </Card>
          ))}
          {zones.length === 0 && <Text size="2" color="gray">Aucune zone.</Text>}
        </Flex>
      </Box>

      {/* Carte + éditeur */}
      <Box style={{ gridColumn: 'span 2' }}>
        <Card size="1" mb="4">
          <Inset side="all"><Box style={{ position: 'relative', height: 300 }}><Map center={center} zoom={11} circles={circles} /></Box></Inset>
        </Card>

        {zone ? (
          <Card size="3">
            <Flex align="center" gap="2" mb="4"><Box style={{ width: 12, height: 12, borderRadius: 3, background: `var(--${zone.color}-9)` }} /><Heading size="4">Éditeur de zone</Heading></Flex>
            <Grid columns={{ initial: '1', sm: '2' }} gap="4">
              <Box>
                <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Nom (français)</Text>
                <TextField.Root defaultValue={zone.nameFr} disabled={!canWrite} onBlur={(e) => e.target.value !== zone.nameFr && setField({ nameFr: e.target.value })} size="2" />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Nom (arabe)</Text>
                <TextField.Root defaultValue={zone.nameAr ?? ''} disabled={!canWrite} dir="rtl" onBlur={(e) => e.target.value !== (zone.nameAr ?? '') && setField({ nameAr: e.target.value })} size="2" />
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Couleur</Text>
                <Select.Root value={zone.color} disabled={!canWrite} onValueChange={(v) => setField({ color: v })} size="2">
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>{PALETTE.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
                </Select.Root>
              </Box>
              <Box>
                <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Commune</Text>
                <TextField.Root defaultValue={zone.commune ?? ''} disabled={!canWrite} onBlur={(e) => e.target.value !== (zone.commune ?? '') && setField({ commune: e.target.value })} size="2" />
              </Box>
            </Grid>

            <Box mt="4">
              <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Livreurs affectés · {zone.drivers.length}</Text>
              <Flex gap="1" wrap="wrap" align="center">
                {zone.drivers.map((d) => (
                  <Badge key={d} color={zone.color as any} variant="soft" radius="full">
                    {d}{canWrite && <Cross2Icon width="11" style={{ cursor: 'pointer', marginInlineStart: 4 }} onClick={() => removeDriver(d)} />}
                  </Badge>
                ))}
                {canWrite && (
                  <Popover.Root>
                    <Popover.Trigger><Button size="1" variant="soft" color="gray" disabled={busy || !available.length}><PlusIcon /> Ajouter</Button></Popover.Trigger>
                    <Popover.Content width="260px">
                      <Text as="div" size="1" color="gray" mb="2">Choisir un livreur pour cette zone</Text>
                      <Flex direction="column" gap="1">
                        {available.map((d) => (
                          <Flex key={d} align="center" gap="2" p="1" style={{ borderRadius: 'var(--radius-2)', cursor: 'pointer' }} onClick={() => addDriver(d)}>
                            <Avatar size="1" radius="full" fallback={initials(d)} color={zone.color as any} /><Text size="2" weight="medium">{d}</Text>
                          </Flex>
                        ))}
                        {!available.length && <Text size="1" color="gray">Tous les livreurs sont affectés.</Text>}
                      </Flex>
                    </Popover.Content>
                  </Popover.Root>
                )}
              </Flex>
            </Box>
          </Card>
        ) : (
          <Card size="3"><Flex direction="column" align="center" gap="3" py="9"><GlobeIcon width="22" /><Text size="2" color="gray">Créez une zone pour commencer.</Text></Flex></Card>
        )}
      </Box>
    </Grid>
  );
}
