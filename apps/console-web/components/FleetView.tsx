'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, ScrollArea, Avatar,
  Separator, Callout, Switch, Inset, Tooltip,
} from '@radix-ui/themes';
import {
  PlusIcon, MinusIcon, TargetIcon, GlobeIcon, Cross2Icon, ExclamationTriangleIcon,
  SewingPinFilledIcon, LapTimerIcon, ExitIcon,
} from '@radix-ui/react-icons';
import type { Zone, FleetLive, Driver } from '@transpo/api-client';
import { Map, type MapMarker, type MapPolygon } from './Map';
import { PageHeader, KPI } from './ui';

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const hhmm = (iso: string) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };

export function FleetView({ live, zones, drivers, center }: {
  live: FleetLive[]; zones: Zone[]; drivers: Driver[]; center: [number, number];
}) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string | null>(live[0]?.driver ?? null);
  const [showZones, setShowZones] = React.useState(true);
  const [full, setFull] = React.useState(false);
  const [mapObj, setMapObj] = React.useState<any>(null);

  const vehOf = (name: string) => drivers.find((d) => d.name === name)?.vehicle ?? '—';
  const alerts = live.filter((l) => l.outOfZone);
  const inZone = live.length - alerts.length;
  const lastUpdate = live.length ? live.map((l) => l.at).sort().reverse()[0] : null;

  const markers: MapMarker[] = live.map((l) => ({
    id: l.driver, lat: l.lat, lng: l.lng, kind: 'driver',
    label: l.driver, sub: `${vehOf(l.driver)} · ${l.outOfZone ? 'Hors zone' : (l.zone ?? 'En ligne')}`,
    ini: initials(l.driver), color: l.outOfZone ? 'red' : sel === l.driver ? 'indigo' : 'green',
  }));
  const polygons: MapPolygon[] = showZones ? zones.filter((z) => Array.isArray(z.polygon) && z.polygon!.length >= 3)
    .map((z) => ({ id: z.id, latlngs: z.polygon as [number, number][], color: z.color, label: z.nameFr })) : [];

  const centerOn = (l: FleetLive) => { setSel(l.driver); mapObj?.setView([l.lat, l.lng], 14, { animate: true }); };
  const active = live.find((l) => l.driver === sel) ?? null;

  const mapEl = (h: number | string) => (
    <Box style={{ position: 'relative', height: h }}>
      <Map center={center} zoom={12} markers={markers} polygons={polygons} onMap={setMapObj} />
      <Card size="1" style={{ position: 'absolute', top: 12, insetInlineStart: 12, zIndex: 500 }}>
        <Flex align="center" justify="between" gap="4" mb={showZones && polygons.length ? '2' : '0'}>
          <Text size="1" weight="medium">Géofences</Text>
          <Switch size="1" checked={showZones} onCheckedChange={setShowZones} />
        </Flex>
        {showZones && polygons.map((p) => (
          <Flex key={p.id} align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: 3, background: `var(--${p.color}-9)`, opacity: 0.6 }} /><Text size="1" color="gray">{p.label}</Text></Flex>
        ))}
      </Card>
      <Flex direction="column" gap="1" style={{ position: 'absolute', bottom: 12, insetInlineEnd: 12, zIndex: 500 }}>
        <IconButton variant="soft" color="gray" highContrast onClick={() => mapObj?.setZoom(mapObj.getZoom() + 1)}><PlusIcon /></IconButton>
        <IconButton variant="soft" color="gray" highContrast onClick={() => mapObj?.setZoom(mapObj.getZoom() - 1)}><MinusIcon /></IconButton>
        <Tooltip content="Recentrer sur la flotte"><IconButton variant="soft" color="gray" highContrast onClick={() => mapObj?.setView(center, 12, { animate: true })}><TargetIcon /></IconButton></Tooltip>
      </Flex>
    </Box>
  );

  if (full) {
    return (
      <Box style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--color-background)' }}>
        {mapEl('100%')}
        <Flex align="center" justify="between" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 600, padding: 'var(--space-3)' }}>
          <Card size="2"><Flex align="center" gap="3"><Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)' }} /><Text size="2" weight="bold">PC flotte — direct</Text><Separator orientation="vertical" size="1" /><Text size="1" color="gray">{live.length} livreur(s)</Text></Flex></Card>
          <Button variant="soft" color="gray" onClick={() => setFull(false)}><Cross2Icon /> Quitter le plein écran</Button>
        </Flex>
        <Card size="2" style={{ position: 'absolute', top: 68, insetInlineEnd: 12, zIndex: 600, width: 280 }}>
          <Text size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Livreurs en direct</Text>
          <Flex direction="column" gap="2">
            {live.map((l) => (
              <Flex key={l.driver} align="center" justify="between" gap="2" onClick={() => setSel(l.driver)} style={{ cursor: 'pointer', padding: '6px 8px', borderRadius: 'var(--radius-2)', background: sel === l.driver ? 'var(--indigo-a3)' : l.outOfZone ? 'var(--red-a2)' : 'transparent' }}>
                <Flex align="center" gap="2" style={{ minWidth: 0 }}><Avatar size="1" radius="full" fallback={initials(l.driver)} color={l.outOfZone ? 'red' : 'green'} /><Text size="2" weight="medium">{l.driver}</Text></Flex>
                <Badge color={l.outOfZone ? 'red' : 'green'} variant="soft" radius="full">{l.outOfZone ? 'hors' : 'ok'}</Badge>
              </Flex>
            ))}
          </Flex>
        </Card>
      </Box>
    );
  }

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader
        title="PC de commandement flotte"
        subtitle={`Suivi temps réel et géofencing — ${live.length} livreur(s) suivi(s)`}
        actions={<>
          <Flex align="center" gap="2" style={{ padding: '4px 10px', borderRadius: 'var(--radius-5)', background: 'var(--green-a3)' }}>
            <Box style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green-9)' }} />
            <Text size="1" weight="medium" style={{ color: 'var(--green-11)' }}>Temps réel</Text>
          </Flex>
          <Button asChild variant="soft" color="gray"><Link href="/zones"><GlobeIcon /> Gérer les zones</Link></Button>
          <Button onClick={() => setFull(true)}><TargetIcon /> Plein écran</Button>
        </>}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Livreurs suivis" value={String(live.length)} icon={<SewingPinFilledIcon width="15" />} accent="green" />
        <KPI label="Dans la zone" value={String(inZone)} icon={<TargetIcon width="15" />} accent="indigo" />
        <KPI label="Hors zone" value={String(alerts.length)} delta={alerts.length ? 'alerte active' : undefined} deltaColor="red" icon={<ExclamationTriangleIcon width="15" />} accent="red" />
        <KPI label="Dernière MAJ" value={lastUpdate ? hhmm(lastUpdate) : '—'} icon={<LapTimerIcon width="15" />} accent="cyan" />
      </Grid>

      {alerts.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text><strong>{alerts.map((a) => a.driver).join(', ')}</strong> {alerts.length > 1 ? 'sont sortis' : 'est sorti'} de zone. <Button size="1" variant="soft" color="red" ml="2" onClick={() => centerOn(alerts[0])}>Localiser</Button></Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', lg: '3' }} gap="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="1" style={{ height: 520 }}><Inset side="all" style={{ height: '100%' }}>{mapEl('100%')}</Inset></Card>
        </Box>
        <Card size="2" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 520 }}>
          <Text size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Livreurs en direct</Text>
          <ScrollArea style={{ flex: 1 }}>
            <Flex direction="column" gap="2" pr="2">
              {live.length === 0 && <Text size="2" color="gray">Aucune position reçue.</Text>}
              {live.map((l) => (
                <Card key={l.driver} size="1" onClick={() => setSel(l.driver)} style={{ cursor: 'pointer', border: sel === l.driver ? '1px solid var(--indigo-8)' : '1px solid var(--gray-a3)', background: sel === l.driver ? 'var(--indigo-a2)' : l.outOfZone ? 'var(--red-a2)' : undefined }}>
                  <Flex align="center" justify="between" gap="2">
                    <Flex align="center" gap="2" style={{ minWidth: 0 }}>
                      <Avatar size="2" radius="full" fallback={initials(l.driver)} color={l.outOfZone ? 'red' : 'green'} />
                      <Box style={{ minWidth: 0 }}>
                        <Text as="div" size="2" weight="medium">{l.driver}</Text>
                        <Text as="div" size="1" color="gray">{vehOf(l.driver)} · {hhmm(l.at)}</Text>
                      </Box>
                    </Flex>
                    <Badge color={l.outOfZone ? 'red' : 'green'} variant="soft" radius="full">{l.outOfZone ? 'Hors zone' : 'Dans la zone'}</Badge>
                  </Flex>
                </Card>
              ))}
            </Flex>
          </ScrollArea>
        </Card>
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="4" mt="4" style={{ alignItems: 'start' }}>
        <Box style={{ gridColumn: 'span 2' }}>
          {active && (
            <Card size="3">
              <Flex align="center" justify="between" mb="3">
                <Flex align="center" gap="3">
                  <Avatar size="4" radius="full" fallback={initials(active.driver)} color={active.outOfZone ? 'red' : 'indigo'} />
                  <Box><Heading size="4">{active.driver}</Heading><Text size="1" color="gray">{vehOf(active.driver)} · {active.zone ?? 'Sans zone'}</Text></Box>
                </Flex>
                <Button variant="soft" size="2" onClick={() => centerOn(active)}><SewingPinFilledIcon /> Suivre</Button>
              </Flex>
              <Grid columns={{ initial: '2', sm: '4' }} gap="3">
                <Tele label="État" node={<Badge color={active.outOfZone ? 'red' : 'green'} variant="soft">{active.outOfZone ? 'Hors zone' : 'Dans la zone'}</Badge>} />
                <Tele label="Zone" value={active.zone ?? '—'} />
                <Tele label="Écart zone" value={active.distanceM != null ? `${active.distanceM} m` : '—'} color={active.outOfZone ? 'red' : undefined} />
                <Tele label="Dernière position" value={hhmm(active.at)} />
              </Grid>
              <Separator size="4" my="3" />
              <Flex align="center" gap="2"><SewingPinFilledIcon color="var(--gray-9)" /><Text size="2" color="gray">Coordonnées :</Text><Text size="2" weight="medium">{active.lat.toFixed(4)}, {active.lng.toFixed(4)}</Text></Flex>
            </Card>
          )}
        </Box>
        <Card size="2">
          <Flex align="center" justify="between" mb="2">
            <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Événements géofence</Text>
            <Badge variant="soft" radius="full">live</Badge>
          </Flex>
          <Flex direction="column" gap="0">
            {alerts.length === 0 && <Text size="2" color="gray">Aucune alerte. Tous les livreurs sont dans leur zone.</Text>}
            {alerts.map((a, i) => (
              <Flex key={a.driver} gap="3" py="2" style={{ borderBottom: i < alerts.length - 1 ? '1px solid var(--gray-a3)' : 'none' }}>
                <Flex align="center" justify="center" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--red-a3)', color: 'var(--red-11)', flex: '0 0 28px' }}><ExitIcon /></Flex>
                <Box><Text as="div" size="2"><Text weight="medium">{a.driver}</Text> est sorti de sa zone {a.zone ? `(${a.zone})` : ''}{a.distanceM != null ? ` · ${a.distanceM} m` : ''}</Text><Text as="div" size="1" color="gray">{hhmm(a.at)}</Text></Box>
              </Flex>
            ))}
          </Flex>
        </Card>
      </Grid>
    </Box>
  );
}

function Tele({ label, value, node, color }: { label: string; value?: string; node?: React.ReactNode; color?: string }) {
  return <Box><Text as="div" size="1" color="gray" mb="1">{label}</Text>{node || <Text as="div" size="4" weight="bold" style={color ? { color: `var(--${color}-11)` } : undefined}>{value}</Text>}</Box>;
}
