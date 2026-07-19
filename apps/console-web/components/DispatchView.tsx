'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Text, Heading, Badge, Button, IconButton, ScrollArea, Avatar,
  Dialog, Separator, Tooltip, Inset,
} from '@radix-ui/themes';
import { PlusIcon, MinusIcon, ReloadIcon, PersonIcon, CheckIcon } from '@radix-ui/react-icons';
import { StatusBadge, CodChip, money } from '@transpo/ui-web';
import { CITY_COORDS } from '@transpo/domain';
import type { Order } from '@transpo/domain';
import type { Zone, FleetLive, Suggestion } from '@transpo/api-client';
import { Map, type MapMarker, type MapCircle } from './Map';

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const PARTS = [
  { key: 'zone' as const, label: 'Zone', max: 40, color: 'indigo' },
  { key: 'dispo' as const, label: 'Dispo', max: 30, color: 'cyan' },
  { key: 'charge' as const, label: 'Charge', max: 30, color: 'amber' },
];

function ScoreBar({ parts }: { parts: Suggestion['parts'] }) {
  return (
    <Box>
      <Flex style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--gray-a3)' }}>
        {PARTS.map((p) => parts[p.key] > 0 && <Box key={p.key} style={{ width: `${parts[p.key]}%`, background: `var(--${p.color}-9)` }} />)}
      </Flex>
      <Flex gap="3" mt="1" wrap="wrap">
        {PARTS.map((p) => (
          <Flex key={p.key} align="center" gap="1">
            <Box style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${p.color}-9)` }} />
            <Text size="1" color="gray">{p.label} {parts[p.key]}<Text color="gray" style={{ opacity: 0.6 }}>/{p.max}</Text></Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

export function DispatchView({ orders, zones, live, center }: {
  orders: Order[]; zones: Zone[]; live: FleetLive[]; center: [number, number];
}) {
  const router = useRouter();
  const [mapObj, setMapObj] = React.useState<any>(null);
  const [target, setTarget] = React.useState<Order | null>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [loadingSug, setLoadingSug] = React.useState(false);
  const [assigning, setAssigning] = React.useState<string | null>(null);

  const unassigned = orders.filter((o) => !o.driver && ['NOUVELLE', 'PROGRAMMEE'].includes(o.status));

  const markers: MapMarker[] = [
    ...live.map((d) => ({ id: `d-${d.driver}`, lat: d.lat, lng: d.lng, kind: 'driver' as const, label: d.driver, sub: d.outOfZone ? 'Hors zone' : (d.zone ?? 'En ligne'), ini: initials(d.driver), color: d.outOfZone ? 'red' : 'indigo' })),
    ...unassigned.filter((o) => CITY_COORDS[o.toCity]).map((o) => ({ id: `o-${o.ref}`, lat: CITY_COORDS[o.toCity][0], lng: CITY_COORDS[o.toCity][1], kind: 'order' as const, label: o.ref, sub: `${o.status} · à affecter`, color: 'blue' })),
  ];
  const circles: MapCircle[] = zones.filter((z) => z.centerLat != null && z.centerLng != null)
    .map((z) => ({ id: z.id, lat: z.centerLat!, lng: z.centerLng!, radiusM: 4000, color: z.color, label: z.nameFr }));

  async function openSuggest(o: Order) {
    setTarget(o); setSuggestions(null); setLoadingSug(true);
    const res = await fetch(`/api/proxy/v1/dispatch/suggest/${encodeURIComponent(o.ref)}`); // GET
    setLoadingSug(false);
    if (res.ok) { const d = await res.json(); setSuggestions(d.suggestions ?? []); }
  }
  async function assign(driver: string) {
    if (!target) return;
    setAssigning(driver);
    const res = await fetch(`/api/orders/${encodeURIComponent(target.ref)}/assign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ driver }) });
    setAssigning(null);
    if (res.ok) { setTarget(null); router.refresh(); }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Affectation impossible'); }
  }

  return (
    <>
      <Card size="1" style={{ height: 'calc(100vh - 210px)', minHeight: 460, overflow: 'hidden' }}>
        <Inset side="all" style={{ height: '100%' }}>
          <Flex style={{ height: '100%' }}>
            <Box style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Map center={center} zoom={12} markers={markers} circles={circles} onMap={setMapObj} />
              <Flex direction="column" gap="1" style={{ position: 'absolute', top: 12, insetInlineEnd: 12, zIndex: 400 }}>
                <IconButton variant="surface" color="gray" onClick={() => mapObj?.setZoom(mapObj.getZoom() + 1)}><PlusIcon /></IconButton>
                <IconButton variant="surface" color="gray" onClick={() => mapObj?.setZoom(mapObj.getZoom() - 1)}><MinusIcon /></IconButton>
              </Flex>
              <Card size="1" style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, zIndex: 400 }}>
                <Flex direction="column" gap="1">
                  <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--indigo-9)' }} /><Text size="1">Livreur en ligne</Text></Flex>
                  <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: 'var(--blue-9)' }} /><Text size="1">Commande à affecter</Text></Flex>
                </Flex>
              </Card>
            </Box>

            <Box style={{ width: 320, flex: '0 0 320px', borderInlineStart: '1px solid var(--gray-a4)', background: 'var(--color-panel-solid)', display: 'flex', flexDirection: 'column' }}>
              <Flex align="center" justify="between" p="3" style={{ borderBottom: '1px solid var(--gray-a4)' }}>
                <Flex align="center" gap="2"><Text size="2" weight="bold">Non affectées</Text><Badge color="blue" radius="full">{unassigned.length}</Badge></Flex>
                <Tooltip content="Actualiser"><IconButton size="1" variant="ghost" color="gray" onClick={() => router.refresh()}><ReloadIcon /></IconButton></Tooltip>
              </Flex>
              <ScrollArea style={{ flex: 1 }}>
                {unassigned.length === 0 ? (
                  <Box p="4"><Text size="2" color="gray">Tout est affecté. Aucune commande en attente.</Text></Box>
                ) : (
                  <Flex direction="column" gap="2" p="3">
                    {unassigned.map((o) => (
                      <Card key={o.ref} size="1">
                        <Flex direction="column" gap="2">
                          <Flex align="center" justify="between"><Text size="2" weight="medium">{o.ref}</Text><StatusBadge status={o.status} /></Flex>
                          <Text size="1" color="gray">{o.merchant} · {o.fromCity} → {o.toCity}</Text>
                          <Flex align="center" justify="between">
                            <Text size="1" color="gray">{o.size} · {o.cod ? money(o.cod) : 'Prépayé'}</Text>
                            <Button size="1" onClick={() => openSuggest(o)}><PersonIcon /> Affecter</Button>
                          </Flex>
                        </Flex>
                      </Card>
                    ))}
                  </Flex>
                )}
              </ScrollArea>
            </Box>
          </Flex>
        </Inset>
      </Card>

      {/* Dialogue de suggestion scorée (données réelles /v1/dispatch/suggest) */}
      <Dialog.Root open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <Dialog.Content style={{ maxWidth: 560 }}>
          <Flex align="center" justify="between" mb="1">
            <Dialog.Title>Assigner un livreur</Dialog.Title>
            <Badge color="indigo" variant="soft">Score /100</Badge>
          </Flex>
          <Dialog.Description size="2" color="gray" mb="4">
            {target?.ref} · zone (40) + disponibilité (30) + faible charge (30).
          </Dialog.Description>
          {loadingSug && <Text size="2" color="gray">Calcul des scores…</Text>}
          {suggestions && suggestions.length === 0 && <Text size="2" color="gray">Aucun livreur disponible.</Text>}
          <Flex direction="column" gap="2">
            {suggestions?.map((s, i) => (
              <Card key={s.driver} variant={i === 0 ? 'surface' : 'ghost'} style={{ border: i === 0 ? '1px solid var(--indigo-7)' : '1px solid var(--gray-a3)' }}>
                <Flex gap="3" align="center">
                  <Avatar size="3" radius="full" fallback={initials(s.driver)} color={i === 0 ? 'indigo' : 'gray'} />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" justify="between" mb="1">
                      <Flex align="center" gap="2"><Text size="2" weight="bold">{s.driver}</Text>{i === 0 && <Badge color="green" variant="soft" radius="full">Recommandé</Badge>}</Flex>
                      <Text size="4" weight="bold" style={{ color: s.score > 85 ? 'var(--green-11)' : 'var(--amber-11)' }}>{s.score}</Text>
                    </Flex>
                    <Text as="div" size="1" color="gray" mb="2">{s.city} · {s.vehicle}</Text>
                    <ScoreBar parts={s.parts} />
                  </Box>
                  <Button variant={i === 0 ? 'solid' : 'soft'} disabled={!!assigning} onClick={() => assign(s.driver)}>
                    {assigning === s.driver ? '…' : <><CheckIcon /> Choisir</>}
                  </Button>
                </Flex>
              </Card>
            ))}
          </Flex>
          <Flex justify="end" mt="4"><Dialog.Close><Button variant="soft" color="gray">Fermer</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}
