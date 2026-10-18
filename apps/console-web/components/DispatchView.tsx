'use client';
import * as React from 'react';
import Link from 'next/link';
import { useSafeRefresh } from '../lib/safe-refresh';
import {
  Card, Flex, Box, Text, Badge, Button, IconButton, ScrollArea, Avatar,
  Dialog, Tooltip, Inset, Tabs, Callout,
} from '@radix-ui/themes';
import {
  PlusIcon, MinusIcon, ReloadIcon, PersonIcon, CheckIcon, LightningBoltIcon, InfoCircledIcon,
  ExclamationTriangleIcon, TimerIcon,
} from '@radix-ui/react-icons';
import { StatusBadge, money } from '@transpo/ui-web';
import { CITY_COORDS } from '@transpo/domain';
import type { Order } from '@transpo/domain';
import type { Lang } from '@transpo/i18n';
import type {
  Zone, FleetLive, Suggestion, DispatchExceptionRow, PendingOffer, DispatchOutcome,
} from '@transpo/api-client';
import { Map, type MapMarker, type MapCircle } from './Map';
import {
  dispatchT, exceptionLabel, EXCEPTION_COLOR, countdown, type DispatchT,
} from '../lib/dispatch-i18n';

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const PARTS = [
  { key: 'zone' as const, label: 'partZone' as const, max: 40, color: 'indigo' },
  { key: 'dispo' as const, label: 'partDispo' as const, max: 30, color: 'cyan' },
  { key: 'charge' as const, label: 'partCharge' as const, max: 30, color: 'amber' },
];

export type DispatchTab = 'exceptions' | 'queue' | 'offers';

function ScoreBar({ parts, dt }: { parts: Suggestion['parts']; dt: DispatchT }) {
  return (
    <Box>
      <Flex style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--gray-a3)' }}>
        {PARTS.map((p) => parts[p.key] > 0 && <Box key={p.key} style={{ width: `${parts[p.key]}%`, background: `var(--${p.color}-9)` }} />)}
      </Flex>
      <Flex gap="3" mt="1" wrap="wrap">
        {PARTS.map((p) => (
          <Flex key={p.key} align="center" gap="1">
            <Box style={{ width: 8, height: 8, borderRadius: 2, background: `var(--${p.color}-9)` }} />
            <Text size="1" color="gray">{dt(p.label)} {parts[p.key]}<Text color="gray" style={{ opacity: 0.6 }}>/{p.max}</Text></Text>
          </Flex>
        ))}
      </Flex>
    </Box>
  );
}

/** Horloge locale recalée sur l'heure du serveur (le compte à rebours ne dépend pas de l'horloge du poste). */
function useServerClock(serverNow: string | null): number {
  const offset = React.useMemo(() => (serverNow ? new Date(serverNow).getTime() - Date.now() : 0), [serverNow]);
  const [now, setNow] = React.useState(() => Date.now() + offset);
  React.useEffect(() => {
    setNow(Date.now() + offset);
    const id = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(id);
  }, [offset]);
  return now;
}

const depuis = (iso: string | null, lang: Lang) =>
  iso ? new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

export function DispatchView({
  orders, zones, live, center, exceptions, offers, autoDispatch, canConfigure, initialTab, lang = 'fr',
}: {
  orders: Order[]; zones: Zone[]; live: FleetLive[]; center: [number, number];
  exceptions: DispatchExceptionRow[]; offers: PendingOffer[];
  autoDispatch: boolean; canConfigure: boolean; initialTab: DispatchTab; lang?: Lang;
}) {
  const dt = dispatchT(lang);
  const refresh = useSafeRefresh();
  const [tab, setTab] = React.useState<DispatchTab>(initialTab);
  const [mapObj, setMapObj] = React.useState<any>(null);
  const [target, setTarget] = React.useState<{ ref: string } | null>(null);
  const [suggestions, setSuggestions] = React.useState<Suggestion[] | null>(null);
  const [loadingSug, setLoadingSug] = React.useState(false);
  const [assigning, setAssigning] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<{ color: 'green' | 'amber' | 'red'; text: string } | null>(null);
  const now = useServerClock(offers[0]?.serverNow ?? null);

  // Les propositions expirent côté serveur : la page se rafraîchit seule tant qu'il y en a,
  // et périodiquement sinon (nouvelles exceptions), sans que le dispatcher ait à cliquer.
  React.useEffect(() => {
    const id = setInterval(() => refresh(), offers.length ? 10000 : 30000);
    return () => clearInterval(id);
  }, [offers.length, refresh]);
  React.useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), 5000);
    return () => clearTimeout(id);
  }, [flash]);

  const unassigned = orders.filter((o) => !o.driver && ['NOUVELLE', 'PROGRAMMEE'].includes(o.status));
  const offerByRef = new globalThis.Map(offers.map((f) => [f.ref, f]));

  const markers: MapMarker[] = [
    ...live.map((d) => ({ id: `d-${d.driver}`, lat: d.lat, lng: d.lng, kind: 'driver' as const, label: d.driver, sub: d.outOfZone ? dt('markerOutOfZone') : (d.zone ?? dt('markerOnline')), ini: initials(d.driver), color: d.outOfZone ? 'red' : 'indigo' })),
    ...unassigned.filter((o) => CITY_COORDS[o.toCity]).map((o) => ({ id: `o-${o.ref}`, lat: CITY_COORDS[o.toCity][0], lng: CITY_COORDS[o.toCity][1], kind: 'order' as const, label: o.ref, sub: o.status, color: o.dispatchException ? 'red' : 'blue' })),
  ];
  const circles: MapCircle[] = zones.filter((z) => z.centerLat != null && z.centerLng != null)
    .map((z) => ({ id: z.id, lat: z.centerLat!, lng: z.centerLng!, radiusM: 4000, color: z.color, label: lang === 'ar' && z.nameAr ? z.nameAr : z.nameFr }));

  async function openSuggest(ref: string) {
    setTarget({ ref }); setSuggestions(null); setLoadingSug(true);
    const res = await fetch(`/api/proxy/v1/dispatch/suggest/${encodeURIComponent(ref)}`); // GET
    setLoadingSug(false);
    if (res.ok) { const d = await res.json(); setSuggestions(d.suggestions ?? []); }
  }
  async function assign(driver: string) {
    if (!target) return;
    setAssigning(driver);
    const res = await fetch(`/api/orders/${encodeURIComponent(target.ref)}/assign`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ driver }) });
    setAssigning(null);
    if (res.ok) { setTarget(null); refresh(); }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? dt('assignFailed')); }
  }
  async function retry(ref: string) {
    setRetrying(ref);
    const res = await fetch(`/api/proxy/v1/dispatch/auto/${encodeURIComponent(ref)}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setRetrying(null);
    const d = await res.json().catch(() => null);
    if (!res.ok) { setFlash({ color: 'red', text: `${ref} — ${d?.error ?? dt('retryFailed')}` }); return; }
    const out = d as DispatchOutcome;
    if (out.kind === 'offer') setFlash({ color: 'green', text: `${ref} — ${dt('retryOffer', { driver: out.driver })}` });
    else if (out.kind === 'exception') setFlash({ color: 'amber', text: `${ref} — ${dt('retryException', { reason: exceptionLabel(out.reason, lang).label })}` });
    refresh();
  }

  const empty = (text: string) => <Box p="4"><Text size="2" color="gray">{text}</Text></Box>;

  return (
    <>
      <Callout.Root color={autoDispatch ? 'green' : 'gray'} variant="surface" size="1" mb="3">
        <Callout.Icon>{autoDispatch ? <LightningBoltIcon /> : <InfoCircledIcon />}</Callout.Icon>
        <Callout.Text>
          {autoDispatch ? dt('autoOnBanner') : dt('autoOffBanner')}
          {canConfigure && <> · <Link href="/settings">{dt('enableInSettings')}</Link></>}
        </Callout.Text>
      </Callout.Root>

      <Card size="1" style={{ height: 'calc(100vh - 260px)', minHeight: 460, overflow: 'hidden' }}>
        <Inset side="all" style={{ height: '100%' }}>
          <Flex style={{ height: '100%' }}>
            <Box style={{ position: 'relative', flex: 1, minWidth: 0 }}>
              <Map center={center} zoom={12} markers={markers} circles={circles} onMap={setMapObj} />
              <Flex direction="column" gap="1" style={{ position: 'absolute', top: 12, insetInlineEnd: 12, zIndex: 400 }}>
                <IconButton variant="surface" color="gray" aria-label={dt('zoomIn')} onClick={() => mapObj?.setZoom(mapObj.getZoom() + 1)}><PlusIcon /></IconButton>
                <IconButton variant="surface" color="gray" aria-label={dt('zoomOut')} onClick={() => mapObj?.setZoom(mapObj.getZoom() - 1)}><MinusIcon /></IconButton>
              </Flex>
              <Card size="1" style={{ position: 'absolute', bottom: 12, insetInlineStart: 12, zIndex: 400 }}>
                <Flex direction="column" gap="1">
                  <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--indigo-9)' }} /><Text size="1">{dt('legendDriver')}</Text></Flex>
                  <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', background: 'var(--blue-9)' }} /><Text size="1">{dt('legendOrder')}</Text></Flex>
                </Flex>
              </Card>
            </Box>

            <Box style={{ width: 360, flex: '0 0 360px', borderInlineStart: '1px solid var(--gray-a4)', background: 'var(--color-panel-solid)', display: 'flex', flexDirection: 'column' }}>
              <Tabs.Root value={tab} onValueChange={(v) => setTab(v as DispatchTab)} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Flex align="center" justify="between" style={{ borderBottom: '1px solid var(--gray-a4)', paddingInlineEnd: 'var(--space-2)' }}>
                  <Tabs.List size="1">
                    <Tabs.Trigger value="exceptions">
                      {dt('tabExceptions')}<Badge ml="1" color={exceptions.length ? 'red' : 'gray'} radius="full" size="1">{exceptions.length}</Badge>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="queue">
                      {dt('tabQueue')}<Badge ml="1" color="blue" radius="full" size="1">{unassigned.length}</Badge>
                    </Tabs.Trigger>
                    <Tabs.Trigger value="offers">
                      {dt('tabOffers')}<Badge ml="1" color="indigo" radius="full" size="1">{offers.length}</Badge>
                    </Tabs.Trigger>
                  </Tabs.List>
                  <Tooltip content={dt('refresh')}>
                    <IconButton size="1" variant="ghost" color="gray" aria-label={dt('refresh')} onClick={() => refresh()}><ReloadIcon /></IconButton>
                  </Tooltip>
                </Flex>

                {flash && (
                  <Box p="2"><Callout.Root color={flash.color} size="1"><Callout.Text>{flash.text}</Callout.Text></Callout.Root></Box>
                )}

                <ScrollArea style={{ flex: 1 }}>
                  <Tabs.Content value="exceptions">
                    {exceptions.length === 0 ? empty(dt('noException')) : (
                      <Flex direction="column" gap="2" p="3">
                        {exceptions.map((x) => {
                          const lab = exceptionLabel(x.reason, lang);
                          return (
                            <Card key={x.ref} size="1" data-testid="dispatch-exception">
                              <Flex direction="column" gap="2">
                                <Flex align="center" justify="between" gap="2">
                                  <Text size="2" weight="medium">{x.ref}</Text>
                                  <Badge color={EXCEPTION_COLOR[x.reason]} variant="soft"><ExclamationTriangleIcon /> {lab.label}</Badge>
                                </Flex>
                                <Text size="1" color="gray">{lab.hint}</Text>
                                <Text size="1" color="gray">
                                  {x.merchant ? `${x.merchant} · ` : ''}{x.fromCity} → {x.toCity}
                                  {' · '}{dt('since', { t: depuis(x.since, lang) })}
                                  {x.declined > 0 ? ` · ${dt('declined', { n: x.declined })}` : ''}
                                </Text>
                                <Flex align="center" justify="end" gap="2" wrap="wrap">
                                  <Button size="1" variant="soft" disabled={retrying === x.ref} onClick={() => retry(x.ref)}>
                                    <LightningBoltIcon /> {retrying === x.ref ? dt('retrying') : dt('retry')}
                                  </Button>
                                  <Button size="1" onClick={() => openSuggest(x.ref)}><PersonIcon /> {dt('assign')}</Button>
                                </Flex>
                              </Flex>
                            </Card>
                          );
                        })}
                      </Flex>
                    )}
                  </Tabs.Content>

                  <Tabs.Content value="queue">
                    {unassigned.length === 0 ? empty(dt('noQueue')) : (
                      <Flex direction="column" gap="2" p="3">
                        {unassigned.map((o) => {
                          const f = offerByRef.get(o.ref);
                          return (
                            <Card key={o.ref} size="1">
                              <Flex direction="column" gap="2">
                                <Flex align="center" justify="between"><Text size="2" weight="medium">{o.ref}</Text><StatusBadge status={o.status} lang={lang} /></Flex>
                                <Text size="1" color="gray">{o.merchant ? `${o.merchant} · ` : ''}{o.fromCity} → {o.toCity}</Text>
                                {f && <OfferLine offer={f} now={now} dt={dt} />}
                                {o.dispatchException && (
                                  <Badge color={EXCEPTION_COLOR[o.dispatchException]} variant="soft" style={{ alignSelf: 'flex-start' }}>
                                    {exceptionLabel(o.dispatchException, lang).label}
                                  </Badge>
                                )}
                                <Flex align="center" justify="between">
                                  <Text size="1" color="gray">{o.size} · {o.cod ? money(o.cod) : dt('prepaid')}</Text>
                                  <Button size="1" onClick={() => openSuggest(o.ref)}><PersonIcon /> {dt('assign')}</Button>
                                </Flex>
                              </Flex>
                            </Card>
                          );
                        })}
                      </Flex>
                    )}
                  </Tabs.Content>

                  <Tabs.Content value="offers">
                    {offers.length === 0 ? empty(dt('noOffer')) : (
                      <Flex direction="column" gap="2" p="3">
                        {offers.map((f) => (
                          <Card key={f.id} size="1">
                            <Flex direction="column" gap="1">
                              <Text size="2" weight="medium">{f.ref}</Text>
                              <OfferLine offer={f} now={now} dt={dt} />
                              {f.reason && <Text size="1" color="gray">{f.reason}</Text>}
                            </Flex>
                          </Card>
                        ))}
                      </Flex>
                    )}
                  </Tabs.Content>
                </ScrollArea>
              </Tabs.Root>
            </Box>
          </Flex>
        </Inset>
      </Card>

      {/* Dialogue de suggestion scorée (données réelles /v1/dispatch/suggest) — l'affectation
          manuelle reste toujours possible, automate actif ou non. */}
      <Dialog.Root open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <Dialog.Content style={{ maxWidth: 560 }}>
          <Flex align="center" justify="between" mb="1">
            <Dialog.Title>{dt('dialogTitle')}</Dialog.Title>
            <Badge color="indigo" variant="soft">{dt('dialogScore')}</Badge>
          </Flex>
          <Dialog.Description size="2" color="gray" mb="4">
            {dt('dialogHint', { ref: target?.ref ?? '' })}
          </Dialog.Description>
          {loadingSug && <Text size="2" color="gray">{dt('computing')}</Text>}
          {suggestions && suggestions.length === 0 && <Text size="2" color="gray">{dt('noDriver')}</Text>}
          <Flex direction="column" gap="2">
            {suggestions?.map((s, i) => (
              <Card key={s.driver} variant={i === 0 ? 'surface' : 'ghost'} style={{ border: i === 0 ? '1px solid var(--indigo-7)' : '1px solid var(--gray-a3)' }}>
                <Flex gap="3" align="center">
                  <Avatar size="3" radius="full" fallback={initials(s.driver)} color={i === 0 ? 'indigo' : 'gray'} />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" justify="between" mb="1">
                      <Flex align="center" gap="2"><Text size="2" weight="bold">{s.driver}</Text>{i === 0 && <Badge color="green" variant="soft" radius="full">{dt('recommended')}</Badge>}</Flex>
                      <Text size="4" weight="bold" style={{ color: s.score > 85 ? 'var(--green-11)' : 'var(--amber-11)' }}>{s.score}</Text>
                    </Flex>
                    <Text as="div" size="1" color="gray" mb="2">{s.city} · {s.vehicle}</Text>
                    <ScoreBar parts={s.parts} dt={dt} />
                  </Box>
                  <Button variant={i === 0 ? 'solid' : 'soft'} disabled={!!assigning} onClick={() => assign(s.driver)}>
                    {assigning === s.driver ? '…' : <><CheckIcon /> {dt('choose')}</>}
                  </Button>
                </Flex>
              </Card>
            ))}
          </Flex>
          <Flex justify="end" mt="4"><Dialog.Close><Button variant="soft" color="gray">{dt('close')}</Button></Dialog.Close></Flex>
        </Dialog.Content>
      </Dialog.Root>
    </>
  );
}

function OfferLine({ offer, now, dt }: { offer: PendingOffer; now: number; dt: DispatchT }) {
  const left = new Date(offer.expiresAt).getTime() - now;
  return (
    <Flex align="center" gap="1">
      <TimerIcon color={left > 0 ? 'var(--indigo-9)' : 'var(--amber-9)'} />
      <Text size="1">
        {dt('offeredTo', { driver: offer.driver })} · {left > 0 ? dt('expiresIn', { t: countdown(left) }) : dt('expired')}
      </Text>
    </Flex>
  );
}
