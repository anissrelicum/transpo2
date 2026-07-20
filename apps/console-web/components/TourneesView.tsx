'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, ScrollArea,
  Separator, Callout, Inset, Dialog, Select, TextField,
} from '@radix-ui/themes';
import {
  ReloadIcon, CheckIcon, CheckCircledIcon, MagicWandIcon, ChevronUpIcon, ChevronDownIcon,
  HomeIcon, TargetIcon, LapTimerIcon, ArchiveIcon, ClockIcon, PlusIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import { CITY_COORDS, haversineMeters } from '@transpo/domain';
import type { Order } from '@transpo/domain';
import type { Tournee } from '@transpo/api-client';
import { Map, type MapMarker, type MapPolyline } from './Map';

const HUB: [number, number] = CITY_COORDS['Casablanca'] as [number, number];
const AVG_KMH = 22;
const STATUS_COLOR: Record<string, 'blue' | 'amber' | 'green'> = { PLANIFIEE: 'blue', EN_COURS: 'amber', CLOTUREE: 'green' };
const coordOf = (o: Order): [number, number] => (CITY_COORDS[o.toCity] as [number, number]) ?? HUB;

function routeKm(order: Order[]): number {
  let d = 0; let prev = HUB;
  for (const o of order) { d += haversineMeters(prev[0], prev[1], ...coordOf(o)); prev = coordOf(o); }
  d += haversineMeters(prev[0], prev[1], HUB[0], HUB[1]);
  return Math.round(d / 100) / 10;
}
function nearestNeighbor(orders: Order[]): Order[] {
  const rem = [...orders]; const out: Order[] = []; let cur = HUB;
  while (rem.length) {
    let bi = 0, bd = Infinity;
    rem.forEach((o, i) => { const dd = haversineMeters(cur[0], cur[1], ...coordOf(o)); if (dd < bd) { bd = dd; bi = i; } });
    const n = rem.splice(bi, 1)[0]; out.push(n); cur = coordOf(n);
  }
  return out;
}

export function TourneesView({ tournees: initial, drivers, unassigned, canWrite }: {
  tournees: Tournee[]; drivers: string[]; unassigned: { ref: string; toCity: string }[]; canWrite: boolean;
}) {
  const router = useRouter();
  const [tournees, setTournees] = React.useState<Tournee[]>(initial);
  const [selId, setSelId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [orders, setOrders] = React.useState<Order[]>([]);      // arrêts résolus, dans l'ordre courant
  const [rawOrder, setRawOrder] = React.useState<string[]>([]); // ordre initial (pour réinitialiser)
  const [optimized, setOptimized] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [mapObj, setMapObj] = React.useState<any>(null);
  const sel = tournees.find((t) => t.id === selId) ?? null;

  const loadDetail = React.useCallback(async (id: string) => {
    const d = await fetch(`/api/proxy/v1/tournees/${id}`).then((r) => r.ok ? r.json() : null).catch(() => null);
    if (d) { setOrders(d.orders ?? []); setRawOrder((d.orders ?? []).map((o: Order) => o.ref)); setOptimized(false); }
  }, []);
  React.useEffect(() => { if (selId) loadDetail(selId); }, [selId, loadDetail]);

  async function persistOrder(next: Order[]) {
    setOrders(next);
    if (!sel) return;
    setBusy(true);
    await fetch(`/api/proxy/v1/tournees/${sel.id}/reorder`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stops: next.map((o) => o.ref) }) }).catch(() => {});
    setBusy(false);
  }
  const move = (i: number, dir: number) => { const j = i + dir; if (j < 0 || j >= orders.length) return; const next = [...orders]; [next[i], next[j]] = [next[j], next[i]]; setOptimized(false); persistOrder(next); };
  const optimize = () => { persistOrder(nearestNeighbor(orders)); setOptimized(true); };
  const reset = () => { const byRef = Object.fromEntries(orders.map((o) => [o.ref, o])); persistOrder(rawOrder.map((r) => byRef[r]).filter(Boolean) as Order[]); setOptimized(false); };
  async function advance() { if (!sel) return; setBusy(true); await fetch(`/api/proxy/v1/tournees/${sel.id}/advance`, { method: 'POST' }).catch(() => {}); setBusy(false); const list = await fetch('/api/proxy/v1/tournees').then((r) => r.json()).catch(() => tournees); setTournees(list); }

  const dist = routeKm(orders);
  const rawDist = routeKm(rawOrder.map((r) => orders.find((o) => o.ref === r)).filter(Boolean) as Order[]);
  const durMin = Math.round((dist / AVG_KMH) * 60 + orders.length * 4);
  const codTotal = orders.reduce((a, o) => a + o.cod, 0);
  const gain = Math.round((rawDist - dist) * 10) / 10;

  const markers: MapMarker[] = [
    { id: 'hub', kind: 'driver', ini: 'H', lat: HUB[0], lng: HUB[1], label: 'Hub Casa Centre', sub: 'Départ & retour', color: 'gray' },
    ...orders.map((o, i) => ({ id: o.ref, kind: 'stop' as const, ini: String(i + 1), lat: coordOf(o)[0], lng: coordOf(o)[1], label: `Arrêt ${i + 1} · ${o.ref}`, sub: `${o.merchant ?? ''} · ${o.toCity}`, color: 'indigo' })),
  ];
  const polylines: MapPolyline[] = orders.length ? [{ id: 'route', latlngs: [HUB, ...orders.map(coordOf), HUB], color: 'indigo', dashArray: optimized ? undefined : '8 6' }] : [];
  const center: [number, number] = orders.length ? [orders.reduce((s, o) => s + coordOf(o)[0], HUB[0]) / (orders.length + 1), orders.reduce((s, o) => s + coordOf(o)[1], HUB[1]) / (orders.length + 1)] : HUB;

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <Flex align="end" justify="between" gap="4" wrap="wrap" mb="4">
        <Box>
          <Heading size="6" weight="bold">Planificateur de tournées</Heading>
          <Text as="p" size="2" color="gray" mt="1">{sel ? `Tournée du ${sel.day} · ${sel.driver}` : 'Aucune tournée'}</Text>
        </Box>
        <Flex gap="2" align="center">
          {tournees.length > 1 && (
            <Select.Root value={selId ?? undefined} onValueChange={setSelId} size="2">
              <Select.Trigger variant="soft" color="gray" />
              <Select.Content>{tournees.map((t) => <Select.Item key={t.id} value={t.id}>{t.driver} · {t.day}</Select.Item>)}</Select.Content>
            </Select.Root>
          )}
          {canWrite && <NewTourneeButton drivers={drivers} unassigned={unassigned} onCreated={(t) => { setTournees((ts) => [...ts, t]); setSelId(t.id); }} />}
          {canWrite && sel && <Button variant="soft" color="gray" onClick={reset} disabled={busy}><ReloadIcon /> Réinitialiser</Button>}
          {canWrite && sel && sel.status !== 'CLOTUREE' && <Button color="green" onClick={advance} disabled={busy}><CheckIcon /> {sel.status === 'PLANIFIEE' ? 'Valider la tournée' : 'Clôturer'}</Button>}
        </Flex>
      </Flex>

      {!sel ? (
        <Card size="3"><Flex direction="column" align="center" gap="3" py="9"><ArchiveIcon width="22" /><Text size="2" color="gray">Aucune tournée planifiée. Créez-en une.</Text></Flex></Card>
      ) : (
        <Grid columns={{ initial: '1', lg: '5' }} gap="4">
          <Box style={{ gridColumn: 'span 3' }}>
            <Card size="1" style={{ height: 560, overflow: 'hidden' }}>
              <Inset side="all" style={{ height: '100%' }}>
                <Box style={{ position: 'relative', height: '100%' }}>
                  <Map center={center} zoom={9} markers={markers} polylines={polylines} onMap={setMapObj} />
                  <Card size="2" style={{ position: 'absolute', top: 12, insetInlineStart: 12, insetInlineEnd: 12, zIndex: 400 }}>
                    <Flex align="center" justify="between" gap="3" wrap="wrap">
                      <Flex gap="4" wrap="wrap">
                        <Metric icon={<TargetIcon />} label="Distance" value={`${dist.toFixed(1)} km`} />
                        <Metric icon={<LapTimerIcon />} label="Durée est." value={`${Math.floor(durMin / 60)}h${String(durMin % 60).padStart(2, '0')}`} />
                        <Metric icon={<ArchiveIcon />} label="Arrêts" value={String(orders.length)} />
                      </Flex>
                      {canWrite && (optimized
                        ? <Badge color="green" variant="soft" size="2"><CheckCircledIcon /> Optimisée{gain > 0 ? ` · −${gain} km` : ''}</Badge>
                        : <Button size="2" onClick={optimize} disabled={busy || orders.length < 2}><MagicWandIcon /> Optimiser l’ordre</Button>)}
                    </Flex>
                  </Card>
                  <Card size="1" style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, zIndex: 400 }}>
                    <Flex direction="column" gap="1">
                      <Flex align="center" gap="2"><Dot c="gray" /><Text size="1">Hub (départ/retour)</Text></Flex>
                      <Flex align="center" gap="2"><Dot c="indigo" /><Text size="1">Arrêt de livraison</Text></Flex>
                    </Flex>
                  </Card>
                </Box>
              </Inset>
            </Card>
          </Box>

          <Box style={{ gridColumn: 'span 2' }}>
            <Card size="2" style={{ height: 560, display: 'flex', flexDirection: 'column' }}>
              <Flex align="center" justify="between" mb="2">
                <Flex align="center" gap="2"><Text size="2" weight="bold">Ordre des arrêts</Text><Badge color="indigo" radius="full">{orders.length}</Badge></Flex>
                <Badge color={STATUS_COLOR[sel.status] ?? 'gray'} variant="soft" size="1">{sel.status}</Badge>
              </Flex>
              {optimized && gain > 0 && (
                <Callout.Root color="green" size="1" mb="2"><Callout.Icon><MagicWandIcon /></Callout.Icon><Callout.Text>Ordre optimisé : <strong>−{gain} km</strong> vs l’ordre initial.</Callout.Text></Callout.Root>
              )}
              <ScrollArea style={{ flex: 1 }}>
                <Flex direction="column" gap="2" pr="2">
                  <HubRow label="Départ" />
                  {orders.map((o, i) => (
                    <Card key={o.ref} size="1">
                      <Flex align="center" gap="2">
                        <Flex align="center" justify="center" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--indigo-9)', color: 'white', flex: '0 0 28px' }}><Text size="2" weight="bold">{i + 1}</Text></Flex>
                        <Box style={{ flex: 1, minWidth: 0 }}>
                          <Flex align="center" gap="2"><Badge color="indigo" variant="soft" size="1">Livraison</Badge><Text size="1" color="gray">{o.ref}</Text></Flex>
                          <Text as="div" size="2" weight="medium">{o.merchant ?? '—'}</Text>
                          <Flex align="center" gap="2" wrap="wrap"><Text size="1" color="gray">{o.fromCity} → {o.toCity}</Text></Flex>
                          {o.cod > 0 && <Box mt="1"><Badge color="amber" variant="soft" radius="full" size="1"><ClockIcon width="10" /> COD · {money(o.cod)}</Badge></Box>}
                        </Box>
                        {canWrite && (
                          <Flex direction="column" gap="1">
                            <IconButton size="1" variant="soft" color="gray" disabled={i === 0 || busy} onClick={() => move(i, -1)}><ChevronUpIcon /></IconButton>
                            <IconButton size="1" variant="soft" color="gray" disabled={i === orders.length - 1 || busy} onClick={() => move(i, 1)}><ChevronDownIcon /></IconButton>
                          </Flex>
                        )}
                      </Flex>
                    </Card>
                  ))}
                  <HubRow label="Retour" />
                </Flex>
              </ScrollArea>
              <Separator size="4" my="2" />
              <Flex align="center" justify="between"><Text size="2" color="gray">COD total à collecter</Text><Badge color="amber" variant="soft" radius="full">{money(codTotal)}</Badge></Flex>
            </Card>
          </Box>
        </Grid>
      )}
    </Box>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Flex align="center" gap="2"><Box style={{ color: 'var(--gray-9)' }}>{icon}</Box><Box><Text as="div" size="1" color="gray" style={{ lineHeight: 1 }}>{label}</Text><Text as="div" size="3" weight="bold">{value}</Text></Box></Flex>;
}
function Dot({ c }: { c: string }) { return <Box style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${c}-9)` }} />; }
function HubRow({ label }: { label: string }) {
  return (
    <Flex align="center" gap="3" p="2" style={{ borderRadius: 'var(--radius-3)', background: 'var(--gray-a2)' }}>
      <Flex align="center" justify="center" style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gray-a4)', color: 'var(--gray-11)', flex: '0 0 28px' }}><HomeIcon width="15" /></Flex>
      <Box><Text as="div" size="1" color="gray">{label}</Text><Text as="div" size="2" weight="medium">Hub Casa Centre</Text></Box>
    </Flex>
  );
}

function NewTourneeButton({ drivers, unassigned, onCreated }: { drivers: string[]; unassigned: { ref: string; toCity: string }[]; onCreated: (t: Tournee) => void }) {
  const [open, setOpen] = React.useState(false);
  const [driver, setDriver] = React.useState(drivers[0] ?? '');
  const [day, setDay] = React.useState('2026-07-20');
  const [picked, setPicked] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const toggle = (r: string) => setPicked((p) => p.includes(r) ? p.filter((x) => x !== r) : [...p, r]);
  async function create() {
    if (!driver || picked.length === 0) return;
    setBusy(true);
    const res = await fetch('/api/proxy/v1/tournees', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ driver, day, zone: '', stops: picked }) });
    setBusy(false);
    if (res.ok) { const t = await res.json(); onCreated(t); setOpen(false); setPicked([]); }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Création impossible'); }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Nouvelle tournée</Button></Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 480 }}>
        <Dialog.Title>Nouvelle tournée</Dialog.Title>
        <Flex direction="column" gap="3" mt="2">
          <Box><Text as="label" size="2" weight="medium">Livreur</Text>
            <Select.Root value={driver} onValueChange={setDriver} size="2"><Select.Trigger style={{ width: '100%' }} /><Select.Content>{drivers.map((d) => <Select.Item key={d} value={d}>{d}</Select.Item>)}</Select.Content></Select.Root>
          </Box>
          <Box><Text as="label" size="2" weight="medium">Jour</Text><TextField.Root value={day} onChange={(e) => setDay(e.target.value)} placeholder="AAAA-MM-JJ" size="2" /></Box>
          <Box>
            <Text as="label" size="2" weight="medium">Commandes à inclure ({picked.length})</Text>
            <ScrollArea style={{ maxHeight: 200, marginTop: 6 }}>
              <Flex direction="column" gap="1">
                {unassigned.length === 0 && <Text size="1" color="gray">Aucune commande non affectée.</Text>}
                {unassigned.map((o) => (
                  <Flex key={o.ref} align="center" justify="between" p="1" onClick={() => toggle(o.ref)} style={{ cursor: 'pointer', borderRadius: 'var(--radius-2)', background: picked.includes(o.ref) ? 'var(--indigo-a3)' : undefined }}>
                    <Text size="2">{o.ref} · {o.toCity}</Text>{picked.includes(o.ref) && <CheckIcon />}
                  </Flex>
                ))}
              </Flex>
            </ScrollArea>
          </Box>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button onClick={create} disabled={busy || !driver || picked.length === 0}>Créer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
