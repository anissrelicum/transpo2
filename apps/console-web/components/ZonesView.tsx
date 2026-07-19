'use client';
import * as React from 'react';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, TextField, Select,
  Avatar, Popover, Inset, Spinner,
} from '@radix-ui/themes';
import { PlusIcon, Cross2Icon, CheckIcon, GlobeIcon, Pencil1Icon, TrashIcon } from '@radix-ui/react-icons';
import { CITY_COORDS } from '@transpo/domain';
import type { Zone } from '@transpo/api-client';
import { Map, type MapPolygon } from './Map';
import { PageHeader } from './ui';

const PALETTE = ['indigo', 'cyan', 'amber', 'grass', 'crimson', 'violet'];
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const boxAround = (lat: number, lng: number): [number, number][] => { const d = 0.02; return [[lat + d, lng - d], [lat + d, lng + d], [lat - d, lng + d], [lat - d, lng - d]]; };

type Commune = { name: string; iso: string };
type Province = { province: string; communes: Commune[] };
type RegionNode = { region: string; provinces: Province[] };
type Draft = { nameFr: string; nameAr: string; color: string; region: string; province: string; commune: string; polygon: [number, number][]; center: [number, number] | null };

export function ZonesView({ zones: initial, drivers, canWrite }: { zones: Zone[]; drivers: string[]; canWrite: boolean }) {
  const [zones, setZones] = React.useState<Zone[]>(initial);
  const [selId, setSelId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [geo, setGeo] = React.useState<RegionNode[] | null>(null);
  const [drawing, setDrawing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const zone = zones.find((z) => z.id === selId) ?? null;

  React.useEffect(() => { setZones(initial); }, [initial]);
  React.useEffect(() => { fetch('/api/proxy/v1/geo/regions').then((r) => r.ok ? r.json() : null).then(setGeo).catch(() => {}); }, []);

  const toDraft = (z: Zone | null): Draft => ({
    nameFr: z?.nameFr ?? '', nameAr: z?.nameAr ?? '', color: z?.color ?? 'indigo',
    region: z?.region ?? '', province: z?.province ?? '', commune: z?.commune ?? '',
    polygon: (z?.polygon as [number, number][]) ?? (z?.centerLat != null ? boxAround(z.centerLat, z.centerLng!) : []),
    center: z?.centerLat != null ? [z.centerLat, z.centerLng!] : null,
  });
  const [draft, setDraft] = React.useState<Draft>(toDraft(initial[0] ?? null));
  React.useEffect(() => { setDraft(toDraft(zone)); setDrawing(false); /* eslint-disable-next-line */ }, [selId, zones]);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  // Cascade géo
  const regionNode = geo?.find((r) => r.region === draft.region) ?? null;
  const provinceNode = regionNode?.provinces.find((p) => p.province === draft.province) ?? null;
  const onRegion = (region: string) => set({ region, province: '', commune: '' });
  const onProvince = (province: string) => set({ province, commune: '' });
  async function onCommune(iso: string, name: string) {
    set({ commune: name, nameFr: draft.nameFr || name });
    const shape = await fetch(`/api/proxy/v1/geo/commune/${encodeURIComponent(iso)}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    if (shape) set({ commune: name, nameFr: draft.nameFr || name, polygon: shape.polygon, center: shape.center });
  }

  async function req(url: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(url, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); return null; }
    return res.json().catch(() => ({}));
  }
  async function createZone() {
    const n = zones.length;
    const z = await req('/api/proxy/v1/dispatch/zones', 'POST', { nameFr: 'Nouvelle zone', color: PALETTE[n % PALETTE.length], centerLat: 33.5731, centerLng: -7.5898, polygon: boxAround(33.5731, -7.5898) });
    if (z) { setZones((zs) => [...zs, z]); setSelId(z.id); }
  }
  async function saveZone() {
    if (!zone) return;
    const body: Record<string, unknown> = { nameFr: draft.nameFr, nameAr: draft.nameAr, color: draft.color, region: draft.region, province: draft.province, commune: draft.commune, polygon: draft.polygon };
    if (draft.center) { body.centerLat = draft.center[0]; body.centerLng = draft.center[1]; }
    const z = await req(`/api/proxy/v1/dispatch/zones/${zone.id}`, 'PATCH', body);
    if (z) setZones((zs) => zs.map((x) => (x.id === z.id ? z : x)));
    setDrawing(false);
  }
  async function deleteZone() {
    if (!zone || !confirm(`Supprimer la zone « ${zone.nameFr} » ?`)) return;
    const r = await req(`/api/proxy/v1/dispatch/zones/${zone.id}`, 'DELETE');
    if (r) { const rest = zones.filter((z) => z.id !== zone.id); setZones(rest); setSelId(rest[0]?.id ?? null); }
  }
  async function patchDrivers(next: string[]) {
    if (!zone) return;
    const z = await req(`/api/proxy/v1/dispatch/zones/${zone.id}`, 'PATCH', { drivers: next });
    if (z) setZones((zs) => zs.map((x) => (x.id === z.id ? z : x)));
  }

  const available = drivers.filter((d) => !zone || !zone.drivers.includes(d));
  const polygons: MapPolygon[] = zones.filter((z) => z.id !== selId && Array.isArray(z.polygon) && z.polygon!.length >= 3)
    .map((z) => ({ id: z.id, latlngs: z.polygon as [number, number][], color: z.color, selected: false, onClick: () => setSelId(z.id) }));
  if (draft.polygon.length >= 3) polygons.push({ id: 'draft', latlngs: draft.polygon, color: draft.color, selected: true });

  const geoAll = zones.filter((z) => z.centerLat != null);
  const center: [number, number] = draft.center ?? (geoAll.length ? [geoAll[0].centerLat!, geoAll[0].centerLng!] : (CITY_COORDS['Casablanca'] as [number, number]));
  const onMapClick = (lat: number, lng: number) => { if (drawing) set({ polygon: [...draft.polygon, [lat, lng]] }); };

  return (
    <Box style={{ maxWidth: 1200, margin: '0 auto' }}>
      <PageHeader
        title="Zones" subtitle="Découpage géographique et affectation des livreurs"
        actions={canWrite ? <Button onClick={createZone} disabled={busy}><PlusIcon /> Nouvelle zone</Button> : undefined}
      />

      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        <Box>
          <Text as="div" size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Zones définies · {zones.length}</Text>
          <Flex direction="column" gap="2">
            {zones.map((z) => (
              <Card key={z.id} variant={z.id === selId ? 'surface' : 'ghost'} style={{ cursor: 'pointer', border: z.id === selId ? '1px solid var(--indigo-7)' : '1px solid var(--gray-a3)' }} onClick={() => setSelId(z.id)}>
                <Flex align="center" justify="between">
                  <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                    <Box style={{ width: 12, height: 12, borderRadius: 3, background: `var(--${z.color}-9)`, flex: '0 0 12px' }} />
                    <Box style={{ minWidth: 0 }}>
                      <Text as="div" size="2" weight="medium">{z.nameFr}</Text>
                      <Text as="div" size="1" color="gray">{z.commune || z.province || '—'}</Text>
                    </Box>
                  </Flex>
                  <Flex>{z.drivers.length ? z.drivers.map((d, i) => <Box key={d} style={{ marginInlineStart: i ? -8 : 0 }}><Avatar size="1" radius="full" fallback={initials(d)} color={z.color as any} style={{ boxShadow: '0 0 0 2px var(--color-panel-solid)' }} /></Box>) : <Badge color="gray" variant="soft" radius="full">0</Badge>}</Flex>
                </Flex>
              </Card>
            ))}
            {zones.length === 0 && <Text size="2" color="gray">Aucune zone. Créez-en une.</Text>}
          </Flex>
        </Box>

        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="1" mb="4">
            <Inset side="all">
              <Box style={{ position: 'relative', height: 300 }}>
                <Map center={center} zoom={11} polygons={polygons} onMapClick={canWrite ? onMapClick : undefined} />
                {canWrite && zone && (
                  <Flex align="center" gap="2" style={{ position: 'absolute', top: 12, insetInlineStart: 12, zIndex: 400 }}>
                    <Button size="1" variant={drawing ? 'solid' : 'soft'} color={drawing ? 'indigo' : 'gray'} onClick={() => setDrawing((d) => !d)}><Pencil1Icon /> Dessiner un polygone</Button>
                    {drawing && draft.polygon.length > 0 && <Button size="1" variant="soft" color="gray" onClick={() => set({ polygon: [] })}>Effacer</Button>}
                  </Flex>
                )}
                {drawing && <Card size="1" style={{ position: 'absolute', bottom: 12, insetInlineEnd: 12, zIndex: 400 }}><Text size="1" color="gray">Cliquez sur la carte pour ajouter des sommets.</Text></Card>}
              </Box>
            </Inset>
          </Card>

          {zone ? (
            <Card size="3">
              <Flex align="center" justify="between" mb="4">
                <Flex align="center" gap="2"><Box style={{ width: 12, height: 12, borderRadius: 3, background: `var(--${draft.color}-9)` }} /><Heading size="4">Éditeur de zone</Heading></Flex>
                {canWrite && <Button variant="soft" color="red" size="1" onClick={deleteZone} disabled={busy}><TrashIcon /> Supprimer la zone</Button>}
              </Flex>
              <Grid columns={{ initial: '1', sm: '2' }} gap="4">
                <Fld label="Nom (français)"><TextField.Root value={draft.nameFr} disabled={!canWrite} onChange={(e) => set({ nameFr: e.target.value })} size="2" /></Fld>
                <Fld label="Nom (arabe)"><TextField.Root value={draft.nameAr} disabled={!canWrite} dir="rtl" onChange={(e) => set({ nameAr: e.target.value })} size="2" /></Fld>
                <Fld label={`Région${geo ? '' : ' (chargement…)'}`}>
                  <Cascade value={draft.region} placeholder="Choisir une région" disabled={!canWrite || !geo} options={(geo ?? []).map((r) => r.region)} onChange={onRegion} />
                </Fld>
                <Fld label="Province / préfecture">
                  <Cascade value={draft.province} placeholder="Choisir une province" disabled={!canWrite || !regionNode} options={(regionNode?.provinces ?? []).map((p) => p.province)} onChange={onProvince} />
                </Fld>
                <Fld label="Commune">
                  <Cascade value={draft.commune} placeholder="Choisir une commune" disabled={!canWrite || !provinceNode}
                    options={(provinceNode?.communes ?? []).map((c) => c.name)}
                    onChange={(name) => { const c = provinceNode?.communes.find((x) => x.name === name); if (c) onCommune(c.iso, c.name); }} />
                </Fld>
                <Fld label="Couleur"><Cascade value={draft.color} disabled={!canWrite} options={PALETTE} onChange={(v) => set({ color: v })} /></Fld>
              </Grid>

              <Box mt="4">
                <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>Livreurs affectés · {zone.drivers.length}</Text>
                <Flex gap="1" wrap="wrap" align="center">
                  {zone.drivers.map((d) => (
                    <Badge key={d} color={zone.color as any} variant="soft" radius="full">{d}{canWrite && <Cross2Icon width="11" style={{ cursor: 'pointer', marginInlineStart: 4 }} onClick={() => patchDrivers(zone.drivers.filter((x) => x !== d))} />}</Badge>
                  ))}
                  {canWrite && (
                    <Popover.Root>
                      <Popover.Trigger><Button size="1" variant="soft" color="gray" disabled={busy || !available.length}><PlusIcon /> Ajouter</Button></Popover.Trigger>
                      <Popover.Content width="260px">
                        <Text as="div" size="1" color="gray" mb="2">Choisir un livreur pour cette zone</Text>
                        <Flex direction="column" gap="1">
                          {available.map((d) => (
                            <Flex key={d} align="center" gap="2" p="1" style={{ borderRadius: 'var(--radius-2)', cursor: 'pointer' }} onClick={() => patchDrivers([...zone.drivers, d])}>
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

              {canWrite && <Flex justify="end" mt="4" align="center" gap="2">{busy && <Spinner />}<Button color="green" onClick={saveZone} disabled={busy}><CheckIcon /> Enregistrer</Button></Flex>}
            </Card>
          ) : (
            <Card size="3"><Flex direction="column" align="center" gap="3" py="9"><GlobeIcon width="22" /><Text size="2" color="gray">Créez une zone pour commencer.</Text></Flex></Card>
          )}
        </Box>
      </Grid>
    </Box>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <Box><Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>{label}</Text>{children}</Box>;
}
function Cascade({ value, options, onChange, disabled, placeholder }: { value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean; placeholder?: string }) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange} disabled={disabled} size="2">
      <Select.Trigger style={{ width: '100%' }} placeholder={placeholder} />
      <Select.Content>
        {options.length === 0 && <Select.Item value="__none" disabled>—</Select.Item>}
        {options.map((o) => <Select.Item key={o} value={o}>{o}</Select.Item>)}
      </Select.Content>
    </Select.Root>
  );
}
