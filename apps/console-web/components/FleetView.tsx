'use client';
// PC flotte — la flotte en direct sur une grande carte.
//
// Les positions sont relues toutes les 4 s (et chaque marqueur glisse de l'ancienne à la
// nouvelle pendant ce temps : on VOIT les livreurs rouler). Un clic sur un livreur, sur la
// carte ou dans la liste, ouvre sa fiche : ses missions dans l'ordre conseillé, l'itinéraire
// restant tracé sur la carte, sa trace du jour et ses indicateurs (livrées, échecs, COD,
// km parcourus, km par livraison — celui qui zigzague se voit tout de suite).
import * as React from 'react';
import Link from 'next/link';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, ScrollArea, Avatar,
  Separator, Callout, Switch, Tooltip, TextField, SegmentedControl,
} from '@radix-ui/themes';
import {
  PlusIcon, MinusIcon, TargetIcon, GlobeIcon, Cross2Icon, ExclamationTriangleIcon,
  ArrowLeftIcon, MagnifyingGlassIcon, EnterFullScreenIcon, ExitFullScreenIcon, Crosshair2Icon,
} from '@radix-ui/react-icons';
import type { Zone, FleetLive, Driver, FleetDriverDetail } from '@transpo/api-client';
import { money } from '@transpo/domain';
import { Map, type MapMarker, type MapPolygon, type MapPolyline } from './Map';
import { KPI } from './ui';
import { EcheanceBadge } from './EcheanceBadge';

const RELECTURE_MS = 4000;

const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const hhmm = (iso: string) => { try { return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; } };

type Activite = NonNullable<FleetLive['activite']>;
const ACTIVITE: Record<Activite, { label: string; color: string }> = {
  livraison: { label: 'En livraison', color: 'indigo' },
  retrait: { label: 'Vers un retrait', color: 'violet' },
  mission: { label: 'En mission', color: 'cyan' },
  libre: { label: 'Disponible', color: 'green' },
  inactif: { label: 'Sans signal', color: 'gray' },
};
const couleur = (l: FleetLive) => (l.outOfZone ? 'red' : ACTIVITE[l.activite ?? 'libre'].color);

type Filtre = 'tous' | 'hors' | 'route' | 'inactif';

export function FleetView({ live: initial, zones, drivers, center }: {
  live: FleetLive[]; zones: Zone[]; drivers: Driver[]; center: [number, number];
}) {
  const [live, setLive] = React.useState<FleetLive[]>(initial);
  // Heure de la dernière relecture : posée côté navigateur seulement (l'heure du serveur
  // différerait au rendu et ferait échouer l'hydratation React).
  const [majA, setMajA] = React.useState<Date | null>(null);
  const [enLigne, setEnLigne] = React.useState(true);
  const [sel, setSel] = React.useState<string | null>(null);
  const [fiche, setFiche] = React.useState<FleetDriverDetail | null>(null);
  const [suivre, setSuivre] = React.useState(false);
  const [showZones, setShowZones] = React.useState(true);
  const [full, setFull] = React.useState(false);
  const [filtre, setFiltre] = React.useState<Filtre>('tous');
  const [cherche, setCherche] = React.useState('');
  const [mapObj, setMapObj] = React.useState<any>(null);

  // Relecture des positions. Une erreur passagère n'efface pas la carte : on garde le
  // dernier état et on le signale (« liaison perdue »).
  React.useEffect(() => {
    let vivant = true;
    const lire = async () => {
      try {
        const r = await fetch('/api/proxy/v1/tracking/live', { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as FleetLive[];
        if (vivant) { setLive(d); setMajA(new Date()); setEnLigne(true); }
      } catch { if (vivant) setEnLigne(false); }
    };
    setMajA(new Date());
    const id = setInterval(lire, RELECTURE_MS);
    return () => { vivant = false; clearInterval(id); };
  }, []);

  // Fiche du livreur sélectionné, relue toutes les 8 s.
  React.useEffect(() => {
    if (!sel) { setFiche(null); return; }
    let vivant = true;
    const lire = async () => {
      const r = await fetch(`/api/proxy/v1/tracking/drivers/${encodeURIComponent(sel)}`, { cache: 'no-store' }).catch(() => null);
      if (r?.ok && vivant) setFiche(await r.json());
    };
    void lire();
    const id = setInterval(lire, RELECTURE_MS * 2);
    return () => { vivant = false; clearInterval(id); };
  }, [sel]);

  const actif = live.find((l) => l.driver === sel) ?? null;

  // Itinéraire restant PAR LES RUES (ADR 0007) : recalculé quand la tournée change ou que le
  // livreur a bougé d'une centaine de mètres. À défaut, la ligne droite reste affichée.
  const [routeRues, setRouteRues] = React.useState<[number, number][] | null>(null);
  const pointsRoute = actif && fiche?.driver === sel
    ? [[actif.lat, actif.lng] as [number, number], ...fiche.arrets.filter((a) => a.lat != null).map((a) => [a.lat!, a.lng!] as [number, number])]
    : [];
  const cleRoute = pointsRoute.map(([la, ln]) => `${la.toFixed(3)},${ln.toFixed(3)}`).join(';');
  React.useEffect(() => {
    if (pointsRoute.length < 2) { setRouteRues(null); return; }
    let vivant = true;
    fetch(`/api/proxy/v1/routing/route?points=${pointsRoute.map(([la, ln]) => `${la.toFixed(5)},${ln.toFixed(5)}`).join(';')}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivant) setRouteRues(d?.source === 'osrm' ? d.geometry : null); })
      .catch(() => { if (vivant) setRouteRues(null); });
    return () => { vivant = false; };
  }, [cleRoute]); // eslint-disable-line react-hooks/exhaustive-deps

  // « Suivre » : la carte reste centrée sur le livreur à chaque relevé.
  React.useEffect(() => {
    if (suivre && actif && mapObj) mapObj.panTo([actif.lat, actif.lng], { animate: true, duration: 1 });
  }, [suivre, actif?.lat, actif?.lng, mapObj]); // eslint-disable-line react-hooks/exhaustive-deps

  const vehOf = (l: FleetLive) => l.vehicle ?? drivers.find((d) => d.name === l.driver)?.vehicle ?? '—';
  const horsZone = live.filter((l) => l.outOfZone);
  const enService = live.filter((l) => l.activite !== 'inactif');
  const enRoute = live.filter((l) => l.activite === 'livraison' || l.activite === 'retrait' || l.activite === 'mission');
  const livreesJour = live.reduce((s, l) => s + (l.livrees ?? 0), 0);
  const codJour = live.reduce((s, l) => s + (l.codJour ?? 0), 0);
  const enRetard = live.reduce((s, l) => s + (l.retards ?? 0), 0);

  const liste = live
    .filter((l) => filtre === 'tous' || (filtre === 'hors' && l.outOfZone) || (filtre === 'inactif' && l.activite === 'inactif')
      || (filtre === 'route' && (l.activite === 'livraison' || l.activite === 'retrait' || l.activite === 'mission')))
    .filter((l) => !cherche || l.driver.toLowerCase().includes(cherche.toLowerCase()))
    .sort((a, b) => Number(b.outOfZone) - Number(a.outOfZone) || a.driver.localeCompare(b.driver));

  const choisir = (nom: string) => {
    setSel(nom); setSuivre(false);
    const l = live.find((x) => x.driver === nom);
    if (l && mapObj) mapObj.setView([l.lat, l.lng], Math.max(mapObj.getZoom(), 14), { animate: true });
  };

  // ------------------------------------------------------------ couches de la carte
  const markers: MapMarker[] = live.map((l) => ({
    id: l.driver, lat: l.lat, lng: l.lng, kind: 'driver', anime: true, selected: l.driver === sel,
    label: l.driver, ini: initials(l.driver), color: couleur(l), onClick: () => choisir(l.driver),
  }));
  const arretsLocalises = (fiche?.driver === sel ? fiche?.arrets ?? [] : []).filter((a) => a.lat != null && a.lng != null);
  arretsLocalises.forEach((a, i) => markers.push({
    id: `arret-${a.ref}`, lat: a.lat!, lng: a.lng!, kind: 'stop', ini: String(i + 1),
    color: a.type === 'retrait' ? 'violet' : 'amber', label: `${i + 1}. ${a.type === 'retrait' ? 'Retrait' : 'Livraison'} · ${a.contact ?? a.ref}`,
    sub: `${a.adresse}${a.cod ? ` · COD ${money(a.cod)}` : ''}`,
  }));

  const polylines: MapPolyline[] = [];
  // Une courte traîne derrière chacun (les ~2 dernières minutes) : on voit d'où il vient
  // sans noyer la carte. Le livreur sélectionné garde ses 15 minutes.
  for (const l of live) {
    const t = l.driver === sel ? l.trail ?? [] : (l.trail ?? []).slice(-30);
    if (t.length > 1) polylines.push({ id: `trail-${l.driver}`, latlngs: t, color: couleur(l), weight: 3, opacity: l.driver === sel ? 0.7 : 0.4 });
  }
  if (fiche && fiche.driver === sel) {
    if (fiche.trace.length > 1) polylines.push({ id: 'trace-jour', latlngs: fiche.trace, color: 'gray', weight: 3, opacity: 0.5, dashArray: '4 6' });
    if (actif && arretsLocalises.length) {
      polylines.push({ id: 'itineraire', latlngs: routeRues ?? [[actif.lat, actif.lng], ...arretsLocalises.map((a) => [a.lat!, a.lng!] as [number, number])], color: 'indigo', weight: 5, opacity: 0.85, ...(routeRues ? {} : { dashArray: '2 10' }) });
    }
  }
  const polygons: MapPolygon[] = showZones ? zones.filter((z) => Array.isArray(z.polygon) && z.polygon!.length >= 3)
    .map((z) => ({ id: z.id, latlngs: z.polygon as [number, number][], color: z.color, label: z.nameFr })) : [];

  const carte = (
    <Box style={{ position: 'relative', height: '100%' }}>
      <Map center={center} zoom={12} markers={markers} polygons={polygons} polylines={polylines} onMap={setMapObj} />
      <Flex direction="column" gap="2" style={{ position: 'absolute', top: 12, insetInlineStart: 12, zIndex: 500 }}>
        <Card size="1">
          <Flex align="center" gap="2">
            <Box style={{ width: 8, height: 8, borderRadius: '50%', background: enLigne ? 'var(--green-9)' : 'var(--red-9)' }} />
            <Text size="1" weight="medium">{enLigne ? `Direct${majA ? ` · ${majA.toLocaleTimeString('fr-FR')}` : ''}` : 'Liaison perdue — nouvel essai…'}</Text>
          </Flex>
        </Card>
        <Card size="1">
          <Flex align="center" justify="between" gap="4"><Text size="1" weight="medium">Zones</Text><Switch size="1" checked={showZones} onCheckedChange={setShowZones} /></Flex>
          <Flex direction="column" gap="1" mt="2">
            {(Object.keys(ACTIVITE) as Activite[]).map((k) => (
              <Flex key={k} align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50%', background: `var(--${ACTIVITE[k].color}-9)` }} /><Text size="1" color="gray">{ACTIVITE[k].label}</Text></Flex>
            ))}
            <Flex align="center" gap="2"><Box style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red-9)' }} /><Text size="1" color="gray">Hors zone</Text></Flex>
          </Flex>
        </Card>
      </Flex>
      <Flex direction="column" gap="1" style={{ position: 'absolute', bottom: 12, insetInlineEnd: 12, zIndex: 500 }}>
        <IconButton variant="soft" color="gray" highContrast aria-label="Zoomer" onClick={() => mapObj?.setZoom(mapObj.getZoom() + 1)}><PlusIcon /></IconButton>
        <IconButton variant="soft" color="gray" highContrast aria-label="Dézoomer" onClick={() => mapObj?.setZoom(mapObj.getZoom() - 1)}><MinusIcon /></IconButton>
        <Tooltip content="Voir toute la flotte">
          <IconButton variant="soft" color="gray" highContrast aria-label="Toute la flotte" onClick={() => {
            setSuivre(false);
            if (live.length && mapObj) mapObj.fitBounds(live.map((l) => [l.lat, l.lng]), { padding: [60, 60], maxZoom: 15 });
          }}><TargetIcon /></IconButton>
        </Tooltip>
        <Tooltip content={full ? 'Quitter le plein écran' : 'Plein écran'}>
          <IconButton variant="soft" color="gray" highContrast aria-label="Plein écran" onClick={() => setFull((v) => !v)}>{full ? <ExitFullScreenIcon /> : <EnterFullScreenIcon />}</IconButton>
        </Tooltip>
      </Flex>
    </Box>
  );

  const panneau = sel && actif ? (
    <FicheLivreur l={actif} fiche={fiche?.driver === sel ? fiche : null} vehicule={vehOf(actif)} suivre={suivre}
      onSuivre={() => setSuivre((v) => !v)} onFermer={() => { setSel(null); setSuivre(false); }} />
  ) : (
    <Flex direction="column" gap="3" style={{ height: '100%', minHeight: 0 }}>
      <Flex align="center" justify="between">
        <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Livreurs ({liste.length})</Text>
        <Button asChild size="1" variant="ghost"><Link href="/zones"><GlobeIcon /> Zones</Link></Button>
      </Flex>
      <TextField.Root size="2" placeholder="Rechercher un livreur" value={cherche} onChange={(e) => setCherche(e.target.value)}>
        <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
      </TextField.Root>
      <SegmentedControl.Root size="1" value={filtre} onValueChange={(v) => setFiltre(v as Filtre)}>
        <SegmentedControl.Item value="tous">Tous</SegmentedControl.Item>
        <SegmentedControl.Item value="route">En route</SegmentedControl.Item>
        <SegmentedControl.Item value="hors">Hors zone</SegmentedControl.Item>
        <SegmentedControl.Item value="inactif">Sans signal</SegmentedControl.Item>
      </SegmentedControl.Root>
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Flex direction="column" gap="2" pr="3">
          {liste.length === 0 && <Text size="2" color="gray">Aucun livreur dans ce filtre.</Text>}
          {liste.map((l) => {
            const a = ACTIVITE[l.activite ?? 'libre'];
            return (
              <Card key={l.driver} size="1" onClick={() => choisir(l.driver)} data-testid={`flotte-${l.driver}`}
                style={{ cursor: 'pointer', background: l.outOfZone ? 'var(--red-a2)' : undefined, border: l.outOfZone ? '1px solid var(--red-6)' : undefined }}>
                <Flex align="center" gap="3">
                  <Avatar size="2" radius="full" fallback={initials(l.driver)} color={couleur(l) as any} />
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Flex align="center" justify="between" gap="2">
                      <Text size="2" weight="medium" truncate>{l.driver}</Text>
                      <Flex gap="1">
                        {l.retards ? <Badge color="red" variant="solid" radius="full">{l.retards} en retard</Badge> : null}
                        {l.outOfZone ? <Badge color="red" variant="solid" radius="full">Hors zone</Badge> : <Badge color={a.color as any} variant="soft" radius="full">{a.label}</Badge>}
                      </Flex>
                    </Flex>
                    <Text as="div" size="1" color="gray" truncate>
                      {vehOf(l)} · {l.speedKmh != null && l.activite !== 'inactif' ? `${l.speedKmh} km/h · ` : ''}{l.missions ?? 0} en cours · {l.livrees ?? 0} livrée(s){l.echecs ? ` · ${l.echecs} échec(s)` : ''}
                    </Text>
                  </Box>
                </Flex>
              </Card>
            );
          })}
        </Flex>
      </ScrollArea>
    </Flex>
  );

  if (full) {
    return (
      <Box style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--color-background)' }}>
        {carte}
        <Card size="2" style={{ position: 'absolute', top: 12, insetInlineEnd: 12, bottom: 12, width: 380, zIndex: 600, display: 'flex', flexDirection: 'column' }}>
          <Flex justify="end" mb="2"><Button size="1" variant="soft" color="gray" onClick={() => setFull(false)}><Cross2Icon /> Quitter le plein écran</Button></Flex>
          <Box style={{ flex: 1, minHeight: 0 }}>{panneau}</Box>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Flex align="center" justify="between" mb="3" wrap="wrap" gap="2">
        <Box>
          <Heading size="6">PC flotte</Heading>
          <Text size="2" color="gray">Vos livreurs en direct : où ils sont, ce qu’ils font, comment se passe leur journée.</Text>
        </Box>
      </Flex>
      <Grid columns={{ initial: '2', md: '6' }} gap="3" mb="3">
        <KPI label="En service" value={`${enService.length} / ${live.length}`} accent="green" />
        <KPI label="En route" value={String(enRoute.length)} accent="indigo" />
        <KPI label="Hors zone" value={String(horsZone.length)} delta={horsZone.length ? 'à vérifier' : undefined} deltaColor="red" icon={<ExclamationTriangleIcon width="15" />} accent="red" />
        <KPI label="Commandes en retard" value={String(enRetard)} delta={enRetard ? 'échéance dépassée' : undefined} deltaColor="red" accent="red" />
        <KPI label="Livrées aujourd’hui" value={String(livreesJour)} accent="cyan" />
        <KPI label="COD encaissé aujourd’hui" value={money(codJour)} accent="amber" />
      </Grid>
      {horsZone.length > 0 && (
        <Callout.Root color="red" mb="3">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            {horsZone.map((h, i) => (
              <React.Fragment key={h.driver}>
                {i > 0 && ', '}
                <Button size="1" variant="ghost" color="red" onClick={() => choisir(h.driver)}><strong>{h.driver}</strong>{h.distanceM ? ` (${h.distanceM >= 1000 ? `${(h.distanceM / 1000).toFixed(1)} km` : `${h.distanceM} m`} hors de ${h.zone ?? 'sa zone'})` : ''}</Button>
              </React.Fragment>
            ))}
            {horsZone.length > 1 ? ' sont sortis de leur zone.' : ' est sorti de sa zone.'}
          </Callout.Text>
        </Callout.Root>
      )}
      <Grid columns={{ initial: '1', lg: '1fr 380px' }} gap="3">
        <Card size="1" style={{ height: 'max(560px, calc(100vh - 290px))', padding: 0, overflow: 'hidden' }}>{carte}</Card>
        <Card size="2" style={{ height: 'max(560px, calc(100vh - 290px))', display: 'flex', flexDirection: 'column' }}>
          <Box style={{ flex: 1, minHeight: 0 }}>{panneau}</Box>
        </Card>
      </Grid>
    </Box>
  );
}

function FicheLivreur({ l, fiche, vehicule, suivre, onSuivre, onFermer }: {
  l: FleetLive; fiche: FleetDriverDetail | null; vehicule: string; suivre: boolean; onSuivre: () => void; onFermer: () => void;
}) {
  const a = ACTIVITE[l.activite ?? 'libre'];
  const ind = fiche?.indicateurs;
  return (
    <Flex direction="column" gap="3" style={{ height: '100%', minHeight: 0 }} data-testid="fiche-livreur">
      <Flex align="center" justify="between">
        <Button size="1" variant="ghost" color="gray" onClick={onFermer}><ArrowLeftIcon /> Tous les livreurs</Button>
        <Button size="1" variant={suivre ? 'solid' : 'soft'} onClick={onSuivre}><Crosshair2Icon /> {suivre ? 'Suivi en cours' : 'Suivre'}</Button>
      </Flex>
      <Flex align="center" gap="3">
        <Avatar size="4" radius="full" fallback={initials(l.driver)} color={couleur(l) as any} />
        <Box style={{ minWidth: 0 }}>
          <Heading size="4" truncate>{l.driver}</Heading>
          <Text as="div" size="1" color="gray">{vehicule}{fiche?.phone ? ` · ${fiche.phone}` : ''} · vu à {hhmm(l.at)}</Text>
          <Flex gap="1" mt="1" wrap="wrap">
            <Badge color={a.color as any} variant="soft" radius="full">{a.label}</Badge>
            {l.outOfZone
              ? <Badge color="red" variant="solid" radius="full">Hors zone{l.distanceM ? ` · ${l.distanceM >= 1000 ? `${(l.distanceM / 1000).toFixed(1)} km` : `${l.distanceM} m`}` : ''}</Badge>
              : l.zone ? <Badge color="gray" variant="soft" radius="full">{l.zone}</Badge> : null}
            {l.speedKmh != null && l.activite !== 'inactif' ? <Badge color="gray" variant="soft" radius="full">{l.speedKmh} km/h</Badge> : null}
          </Flex>
        </Box>
      </Flex>
      <Grid columns="3" gap="2">
        <Mini label="Livrées" value={ind ? String(ind.livrees) : '…'} />
        <Mini label="Échecs" value={ind ? String(ind.echecs) : '…'} color={ind?.echecs ? 'red' : undefined} />
        <Mini label="Réussite" value={ind?.tauxReussite != null ? `${ind.tauxReussite} %` : '—'} />
        <Mini label="COD encaissé" value={ind ? money(ind.codEncaisse) : '…'} />
        <Mini label="Km parcourus" value={ind ? `${ind.kmParcourus.toLocaleString('fr-FR')} km` : '…'} />
        <Mini label="Km / livraison" value={ind?.kmParLivraison != null ? `${ind.kmParLivraison.toLocaleString('fr-FR')} km` : '—'} hint="Distance roulée par colis livré : un écart fort avec les collègues signale un itinéraire mal suivi." />
      </Grid>
      <Separator size="4" />
      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Box pr="3">
          <Flex align="center" justify="between" mb="2">
            <Text size="1" color="gray" weight="medium" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Itinéraire conseillé</Text>
            {ind ? <Text size="1" color="gray">{fiche!.arrets.length} arrêt(s) · {ind.kmRestants.toLocaleString('fr-FR')} km</Text> : null}
          </Flex>
          {!fiche && <Text size="2" color="gray">Chargement…</Text>}
          {fiche && fiche.arrets.length === 0 && <Text size="2" color="gray">Aucune mission en cours.</Text>}
          <Flex direction="column" gap="2">
            {fiche?.arrets.map((s, i) => (
              <Flex key={s.ref} gap="2" align="start">
                <Flex align="center" justify="center" style={{ width: 24, height: 24, flex: '0 0 24px', borderRadius: '50%', background: `var(--${s.type === 'retrait' ? 'violet' : 'amber'}-9)`, color: '#fff', fontSize: 12, fontWeight: 700 }}>{s.lat != null ? i + 1 : '?'}</Flex>
                <Box style={{ minWidth: 0, flex: 1 }}>
                  <Text as="div" size="2" weight="medium" truncate>{s.type === 'retrait' ? 'Retrait' : 'Livraison'} · {s.contact ?? '—'}</Text>
                  <Text as="div" size="1" color="gray" truncate>{s.adresse || 'Adresse non localisée'}</Text>
                  <Flex gap="1" mt="1" wrap="wrap">
                    <Link href={`/orders/${encodeURIComponent(s.ref)}`}><Badge variant="outline" color="gray">{s.ref}</Badge></Link>
                    {s.type === 'livraison' && s.cod > 0 && !s.codPaid ? <Badge color="amber" variant="soft">COD {money(s.cod)}</Badge> : null}
                    {s.lat == null ? <Badge color="gray" variant="soft">sans GPS</Badge> : null}
                    <EcheanceBadge o={{ status: s.status, delayMode: s.delayMode, delayMinutes: s.delayMinutes, delayHeure: s.delayHeure, dueAt: s.dueAt, pickupDueAt: s.pickupDueAt }} />
                  </Flex>
                </Box>
              </Flex>
            ))}
          </Flex>
          {fiche && fiche.faites.length > 0 && (
            <>
              <Text as="div" size="1" color="gray" weight="medium" mt="4" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Terminées aujourd’hui</Text>
              <Flex direction="column" gap="1">
                {fiche.faites.map((f) => (
                  <Flex key={`${f.ref}-${f.at}`} align="center" justify="between" gap="2">
                    <Text size="1" truncate style={{ minWidth: 0 }}>{hhmm(f.at)} · {f.contact ?? f.ref}</Text>
                    {f.status === 'LIVREE'
                      ? <Badge color="green" variant="soft">{f.cod ? money(f.cod) : 'Livrée'}</Badge>
                      : <Badge color="red" variant="soft">Échec</Badge>}
                  </Flex>
                ))}
              </Flex>
            </>
          )}
        </Box>
      </ScrollArea>
    </Flex>
  );
}

function Mini({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  const corps = (
    <Box p="2" style={{ background: 'var(--gray-a2)', borderRadius: 'var(--radius-3)' }}>
      <Text as="div" size="1" color="gray">{label}</Text>
      <Text as="div" size="3" weight="bold" style={color ? { color: `var(--${color}-11)` } : undefined}>{value}</Text>
    </Box>
  );
  return hint ? <Tooltip content={hint}>{corps}</Tooltip> : corps;
}
