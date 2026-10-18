'use client';
import * as React from 'react';
import { useSafeRefresh } from '../lib/safe-refresh';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Select, TextField, Switch, DropdownMenu, TextField as TF,
} from '@radix-ui/themes';
import {
  PlusIcon, ExclamationTriangleIcon, PersonIcon, DotFilledIcon, DotsHorizontalIcon,
  TrashIcon, ReloadIcon, CubeIcon, MagnifyingGlassIcon, Pencil1Icon,
} from '@radix-ui/react-icons';
import { RowMenu, useFermerMenu } from '../lib/row-menu';
import type { Driver, Vehicle } from '@transpo/api-client';
import type { Lang } from '@transpo/i18n';
import { PageHeader, KPI } from './ui';
import { dispatchT, type DispatchT } from '../lib/dispatch-i18n';

const APP_COLOR = { ACTIF: 'green', SUSPENDU: 'red', AUCUN: 'gray' } as const;

const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir', 'Kénitra', 'Mohammedia'];
const VEHICLE_TYPES = ['Moto', 'Voiture', 'Fourgon', 'Fourgon frigo', 'Camion'];
const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;
// Une échéance ne se renouvelle pas dans le passé : le champ est borné au jour même,
// et l'API refuse de toute façon une date antérieure (OBS-10).
const AUJOURDHUI = new Date().toISOString().slice(0, 10);

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}

function dueBadge(due: string | null): { color: 'red' | 'amber' | 'green' | 'gray'; txt: string } {
  if (!due) return { color: 'gray', txt: 'Non renseigné' };
  const days = Math.round((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { color: 'red', txt: `Expiré (${-days} j)` };
  if (days <= 30) return { color: 'amber', txt: `Dans ${days} j` };
  return { color: 'green', txt: new Date(due).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }) };
}

export function DriversView({ drivers, vehicles, isAdmin, canDispatch, defaultCapacity, lang = 'fr' }: {
  drivers: Driver[]; vehicles: Vehicle[]; isAdmin: boolean; canDispatch: boolean;
  /** Capacité journalière par défaut de l'entreprise (affectation automatique). */
  defaultCapacity: number; lang?: Lang;
}) {
  const refresh = useSafeRefresh();
  const dt = dispatchT(lang);
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const blocked = drivers.filter((d) => d.licenseExpired || d.medicalExpired);
  const available = drivers.filter((d) => d.available).length;
  const onDuty = drivers.reduce((a, d) => a + d.stats.active, 0);
  const closed = drivers.reduce((a, d) => a + d.stats.delivered + d.stats.failed, 0);
  const globalRate = closed ? Math.round((drivers.reduce((a, d) => a + d.stats.delivered, 0) / closed) * 100) : null;

  // Qui détient déjà quel véhicule : rien n'interdit d'affecter le même véhicule à deux
  // chauffeurs, mais l'exploitant doit le voir avant de valider, pas le découvrir après.
  const porteurs = new Map<string, string>();
  for (const d of drivers) if (d.vehicleId) porteurs.set(d.vehicleId, d.name);

  const rows = drivers.filter((d) => {
    if (q && !`${d.name} ${d.city ?? ''} ${d.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'available') return d.available;
    if (filter === 'unavailable') return !d.available;
    if (filter === 'blocked') return d.licenseExpired || d.medicalExpired;
    return true;
  });

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/${path}`, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) refresh();
    else { const d = await res.json().catch(() => null); alert(d?.message ?? d?.error ?? 'Action impossible'); }
    return res.ok;
  }

  return (
    <>
      <PageHeader
        title="Chauffeurs"
        subtitle={`${drivers.length} chauffeurs · ${available} disponibles · ${blocked.length} non affectable(s)`}
        actions={isAdmin ? <AddDriverDialog onCreate={(b) => call('drivers', 'POST', b)} busy={busy} /> : undefined}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Effectif" value={String(drivers.length)} delta={`${available} disponibles`} deltaColor="green" icon={<PersonIcon width="15" />} accent="indigo" />
        <KPI label="En tournée" value={String(onDuty)} delta="commandes en cours" deltaColor="gray" icon={<CubeIcon width="15" />} accent="cyan" />
        <KPI label="Taux de réussite" value={globalRate != null ? `${globalRate} %` : '—'} delta="sur livraisons clôturées" deltaColor="gray" icon={<DotFilledIcon width="15" />} accent="green" />
        <KPI label="Conformité" value={String(blocked.length)} delta="permis / visite expirés" deltaColor={blocked.length ? 'red' : 'gray'} icon={<ExclamationTriangleIcon width="15" />} accent={blocked.length ? 'red' : 'gray'} />
      </Grid>

      {blocked.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{blocked.length} chauffeur(s)</strong> au permis ou à la visite médicale expirés — exclus des suggestions de dispatch tant que la situation n’est pas régularisée.
          </Callout.Text>
        </Callout.Root>
      )}

      <Flex gap="3" mb="3" wrap="wrap">
        <TF.Root placeholder="Rechercher un chauffeur…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }}>
          <TF.Slot><MagnifyingGlassIcon /></TF.Slot>
        </TF.Root>
        <Select.Root value={filter} onValueChange={setFilter}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Tous</Select.Item>
            <Select.Item value="available">Disponibles</Select.Item>
            <Select.Item value="unavailable">Indisponibles</Select.Item>
            <Select.Item value="blocked">Non affectables</Select.Item>
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Chauffeur</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Véhicule</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Permis</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Visite médicale</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Performance</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>{dt('capacityCol')}</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Disponibilité</Table.ColumnHeaderCell>
            {isAdmin && <Table.ColumnHeaderCell />}
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((d) => {
              const lic = dueBadge(d.licenseDue);
              const med = dueBadge(d.medicalDue);
              return (
                <Table.Row key={d.id} align="center">
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{
                        width: 30, height: 30, borderRadius: '50%', flex: '0 0 30px',
                        background: d.assignable ? 'var(--indigo-a3)' : 'var(--gray-a3)',
                        color: d.assignable ? 'var(--indigo-11)' : 'var(--gray-11)',
                        fontSize: 11, fontWeight: 600,
                      }}>{initials(d.name)}</Flex>
                      <Box>
                        <Text as="div" size="2" weight="medium">{d.name}</Text>
                        <Text as="div" size="1" color="gray">{[d.city, d.phone].filter(Boolean).join(' · ') || '—'}</Text>
                      </Box>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    {d.vehiclePlate
                      ? <Box><Text as="div" size="2">{d.vehiclePlate}</Text><Text as="div" size="1" color="gray">{d.vehicle}</Text></Box>
                      : <Text size="1" color="gray">{d.vehicle ? `${d.vehicle} (non rattaché)` : '—'}</Text>}
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="1">
                      <DotFilledIcon color={`var(--${lic.color}-9)`} />
                      <Box>
                        <Text as="div" size="1" color={lic.color === 'green' ? 'gray' : lic.color}>{lic.txt}</Text>
                        {d.licenseNo && <Text as="div" size="1" color="gray">{d.licenseNo}</Text>}
                      </Box>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="1">
                      <DotFilledIcon color={`var(--${med.color}-9)`} />
                      <Text size="1" color={med.color === 'green' ? 'gray' : med.color}>{med.txt}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Text as="div" size="2">
                        {d.stats.successRate != null ? `${d.stats.successRate} %` : '—'}
                        {d.stats.active > 0 && <Badge ml="2" color="cyan" variant="soft" size="1">{d.stats.active} en cours</Badge>}
                      </Text>
                      <Text as="div" size="1" color="gray">{d.stats.delivered} livrée(s) · {d.stats.failed} échec(s)</Text>
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Text as="div" size="2">
                        {d.dailyCapacity != null
                          ? <>{d.dailyCapacity} {dt('perDay')}</>
                          : <Text color="gray">{dt('capacityDefault', { n: defaultCapacity })}</Text>}
                      </Text>
                      {d.appAccount && (
                        <Badge size="1" variant="soft" color={APP_COLOR[d.appAccount]} title={d.appAccount === 'ACTIF' ? undefined : dt('appHint')}>
                          {dt(`app${d.appAccount}` as const)}
                        </Badge>
                      )}
                    </Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <Switch
                        checked={d.available}
                        disabled={!canDispatch || busy}
                        onCheckedChange={(v) => call(`drivers/${d.id}/availability`, 'PATCH', { available: v })}
                      />
                      {!d.assignable && d.available && <Badge color="red" variant="soft" size="1">Bloqué</Badge>}
                    </Flex>
                  </Table.Cell>
                  {isAdmin && (
                    <Table.Cell>
                      <RowMenu>
                          <EditDriverItem driver={d} defaultCapacity={defaultCapacity} dt={dt} onSave={(b) => call(`drivers/${d.id}`, 'PATCH', b)} />
                          <AssignVehicleItem driver={d} vehicles={vehicles} porteurs={porteurs} onAssign={(vid) => call(`drivers/${d.id}/vehicle`, 'PATCH', { vehicleId: vid })} />
                          <DropdownMenu.Separator />
                          <RenewItem driver={d} field="license" onRenew={(due) => call(`drivers/${d.id}/renew`, 'POST', { field: 'license', due })} />
                          <RenewItem driver={d} field="medical" onRenew={(due) => call(`drivers/${d.id}/renew`, 'POST', { field: 'medical', due })} />
                          <DropdownMenu.Separator />
                          <RemoveItem
                            driver={d}
                            repreneurs={drivers.filter((x) => x.id !== d.id && x.assignable)}
                            onRemove={(transfertVers) => call(
                              `drivers/${d.id}${transfertVers ? `?transferTo=${transfertVers}` : ''}`, 'DELETE',
                            )}
                          />
                      </RowMenu>
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{drivers.length ? 'Aucun chauffeur ne correspond au filtre.' : 'Aucun chauffeur.'}</Text></Box>
        )}
      </Card>
    </>
  );
}

function AssignVehicleItem({ driver, vehicles, porteurs, onAssign }: {
  driver: Driver; vehicles: Vehicle[]; porteurs: Map<string, string>;
  onAssign: (vehicleId: string | null) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState(driver.vehicleId ?? 'none');
  const fermerMenu = useFermerMenu();
  // Fermeture programmatique : referme le dialogue ET le menu qui l'a ouvert.
  const fermer = () => { setOpen(false); fermerMenu(); };
  // Un véhicule non actif (maintenance, hors service) n'est pas rattachable.
  const options = vehicles.filter((v) => v.state === 'ACTIF' || v.id === driver.vehicleId);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) fermerMenu(); }}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setSel(driver.vehicleId ?? 'none'); setOpen(true); }}>
          <CubeIcon /> Rattacher un véhicule
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>Rattacher un véhicule</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{driver.name} — véhicule du parc affecté au quotidien.</Dialog.Description>
        <Select.Root value={sel} onValueChange={setSel}>
          <Select.Trigger style={{ width: '100%' }} />
          <Select.Content>
            <Select.Item value="none">Aucun</Select.Item>
            {options.map((v) => {
              const porteur = porteurs.get(v.id);
              const occupe = porteur && porteur !== driver.name;
              return (
                <Select.Item key={v.id} value={v.id}>
                  {v.plate} — {v.type}{v.city ? ` (${v.city})` : ''}{occupe ? ` · déjà sur ${porteur}` : ''}
                </Select.Item>
              );
            })}
          </Select.Content>
        </Select.Root>
        {options.length === 0 && <Text as="p" size="1" color="gray" mt="2">Aucun véhicule actif au parc.</Text>}
        {sel !== 'none' && porteurs.get(sel) && porteurs.get(sel) !== driver.name && (
          <Callout.Root color="amber" mt="3" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              Ce véhicule est déjà rattaché à {porteurs.get(sel)}. Les deux chauffeurs le porteront
              sur leur fiche tant que l’un des deux n’est pas détaché.
            </Callout.Text>
          </Callout.Root>
        )}
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          {/* La mutation est attendue AVANT la fermeture : sinon un refus de l'API (véhicule
              non actif, par exemple) fermait quand même le dialogue, sans rien changer. */}
          <Button onClick={async () => { if (await onAssign(sel === 'none' ? null : sel)) fermer(); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function RenewItem({ driver, field, onRenew }: { driver: Driver; field: 'license' | 'medical'; onRenew: (due: string) => Promise<boolean> }) {
  const [open, setOpen] = React.useState(false);
  const fermerMenu = useFermerMenu();
  // Fermeture programmatique : referme le dialogue ET le menu qui l'a ouvert.
  const fermer = () => { setOpen(false); fermerMenu(); };
  const [due, setDue] = React.useState('');
  const label = field === 'license' ? 'Renouveler le permis' : 'Renouveler la visite médicale';
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (!o) fermerMenu(); }}>
      <Dialog.Trigger><DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}><ReloadIcon /> {label}</DropdownMenu.Item></Dialog.Trigger>
      <Dialog.Content maxWidth="360px">
        <Dialog.Title>{label}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{driver.name} — nouvelle date d’échéance.</Dialog.Description>
        <TextField.Root type="date" min={AUJOURDHUI} value={due} onChange={(e) => setDue(e.target.value)} />
        {due !== '' && due < AUJOURDHUI && (
          <Text as="p" size="1" color="red" mt="2">La nouvelle échéance doit être postérieure à aujourd’hui.</Text>
        )}
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!due || due < AUJOURDHUI} onClick={async () => { if (await onRenew(due)) fermer(); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * Édition d'une fiche chauffeur. Sans elle, ville, type de véhicule, téléphone et numéro de
 * permis étaient figés à la création : un détachement de véhicule effaçait le type déclaré
 * sans aucun moyen de le ressaisir (AN-14). Le nom n'est modifiable que tant qu'aucune
 * commande ne référence le chauffeur — l'API tranche et renvoie le motif.
 */
function EditDriverItem({ driver, defaultCapacity, dt, onSave }: {
  driver: Driver; defaultCapacity: number; dt: DispatchT; onSave: (body: unknown) => Promise<boolean>;
}) {
  const vide = {
    name: driver.name,
    city: driver.city ?? '',
    vehicle: driver.vehicle ?? '',
    phone: driver.phone ?? '',
    licenseNo: driver.licenseNo ?? '',
    // Vide = capacité par défaut de l'entreprise (envoyée `null`).
    dailyCapacity: driver.dailyCapacity != null ? String(driver.dailyCapacity) : '',
  };
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(vide);
  const fermerMenu = useFermerMenu();
  // Fermeture programmatique : referme le dialogue ET le menu qui l'a ouvert.
  const fermer = () => { setOpen(false); fermerMenu(); };
  const phoneOk = !f.phone || PHONE_RE.test(f.phone.trim());
  const capTxt = f.dailyCapacity.trim();
  const capOk = capTxt === '' || (/^\d+$/.test(capTxt) && Number(capTxt) >= 1 && Number(capTxt) <= 500);
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setF(vide); else fermerMenu(); }}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setF(vide); setOpen(true); }}>
          <Pencil1Icon /> Modifier la fiche
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Modifier la fiche</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{driver.name} — informations du chauffeur.</Dialog.Description>
        <Flex direction="column" gap="3">
          <Box><Text as="div" size="1" color="gray" mb="1">Nom</Text>
            <TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Box>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="1" color="gray" mb="1">Ville</Text>
              <Select.Root value={f.city || CITIES[0]} onValueChange={(v) => setF({ ...f, city: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{CITIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
              </Select.Root></Box>
            <Box><Text as="div" size="1" color="gray" mb="1">Véhicule déclaré</Text>
              <Select.Root value={f.vehicle || VEHICLE_TYPES[0]} onValueChange={(v) => setF({ ...f, vehicle: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{VEHICLE_TYPES.map((t) => <Select.Item key={t} value={t}>{t}</Select.Item>)}</Select.Content>
              </Select.Root></Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="1" color="gray" mb="1">Téléphone</Text>
              <TextField.Root value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+212600000000" color={!phoneOk ? 'red' : undefined} /></Box>
            <Box><Text as="div" size="1" color="gray" mb="1">N° de permis</Text>
              <TextField.Root value={f.licenseNo} onChange={(e) => setF({ ...f, licenseNo: e.target.value })} placeholder="AB123456" /></Box>
          </Grid>
          {!phoneOk && <Text size="1" color="red">Numéro invalide.</Text>}
          <Box><Text as="div" size="1" color="gray" mb="1">{dt('capacityField')}</Text>
            <TextField.Root
              type="number" min={1} max={500} value={f.dailyCapacity}
              onChange={(e) => setF({ ...f, dailyCapacity: e.target.value })}
              placeholder={dt('capacityPlaceholder', { n: defaultCapacity })}
              color={!capOk ? 'red' : undefined}
            >
              <TextField.Slot side="right"><Text size="1" color="gray">{dt('perDay')}</Text></TextField.Slot>
            </TextField.Root>
            {!capOk && <Text size="1" color="red">{dt('capacityInvalid')}</Text>}
          </Box>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!f.name.trim() || !phoneOk || !capOk}
            onClick={async () => {
              const body = { ...f, name: f.name.trim(), dailyCapacity: capTxt === '' ? null : Number(capTxt) };
              if (await onSave(body)) fermer();
            }}
          >Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/**
 * Retrait d'un chauffeur.
 *
 * Un départ ne se négocie pas avec le planning : si des courses sont en cours, le dialogue
 * demande **à qui les confier** plutôt que de bloquer le retrait. Les courses clôturées ne
 * bougent pas — l'historique dit qui a livré.
 */
function RemoveItem({ driver, repreneurs, onRemove }: {
  driver: Driver; repreneurs: Driver[]; onRemove: (transfertVers?: string) => void;
}) {
  const fermerMenu = useFermerMenu();
  const [ouvert, setOuvert] = React.useState(false);
  const [repreneur, setRepreneur] = React.useState('');
  const enCours = driver.stats.active;
  const transfertRequis = enCours > 0;
  React.useEffect(() => { if (ouvert) setRepreneur(''); }, [ouvert]);
  return (
    <AlertDialog.Root open={ouvert} onOpenChange={(o) => { setOuvert(o); if (!o) fermerMenu(); }}>
      <AlertDialog.Trigger><DropdownMenu.Item color="red" onSelect={(e) => { e.preventDefault(); setOuvert(true); }}><TrashIcon /> Retirer</DropdownMenu.Item></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Retirer {driver.name} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          {transfertRequis
            ? `${enCours} commande(s) sont en cours sur ce chauffeur. Choisissez qui les reprend : elles lui seront transférées avant le retrait.`
            : 'Le chauffeur sera retiré de l’effectif. Ses commandes clôturées restent à son nom dans l’historique.'}
        </AlertDialog.Description>
        {transfertRequis && (
          <Box mt="3">
            <Text as="label" size="2" weight="medium" style={{ display: 'block' }}>
              <Text as="div" size="2" weight="medium" mb="1">Transférer les commandes à</Text>
              <Select.Root value={repreneur || undefined} onValueChange={setRepreneur}>
                <Select.Trigger style={{ width: '100%' }} placeholder="Choisir un chauffeur" />
                <Select.Content>
                  {repreneurs.map((r) => <Select.Item key={r.id} value={r.id}>{r.name}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </Text>
            {repreneurs.length === 0 && (
              <Text as="p" size="1" color="red" mt="2">
                Aucun chauffeur affectable pour reprendre ces commandes.
              </Text>
            )}
          </Box>
        )}
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color="red" disabled={transfertRequis && !repreneur} onClick={() => onRemove(repreneur || undefined)}>
              {transfertRequis ? 'Transférer et retirer' : 'Retirer'}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function AddDriverDialog({ onCreate, busy }: { onCreate: (b: any) => Promise<boolean>; busy: boolean }) {
  const empty = { name: '', city: 'Casablanca', vehicle: 'Moto', phone: '', licenseNo: '', licenseDue: '', medicalDue: '' };
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(empty);
  const phoneOk = !f.phone || PHONE_RE.test(f.phone.trim());
  const valid = f.name.trim().length > 1 && phoneOk;

  async function submit() {
    const ok = await onCreate({
      name: f.name.trim(), city: f.city, vehicle: f.vehicle,
      phone: f.phone.trim() || undefined, licenseNo: f.licenseNo.trim() || undefined,
      licenseDue: f.licenseDue || undefined, medicalDue: f.medicalDue || undefined,
    });
    if (ok) { setOpen(false); setF(empty); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Ajouter un chauffeur</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Ajouter un chauffeur</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Le nom identifie le chauffeur sur les commandes : il doit être unique.</Dialog.Description>
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Nom complet</Text>
            <TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Youssef Benali" />
          </Box>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="2" weight="medium" mb="1">Ville</Text>
              <Select.Root value={f.city} onValueChange={(v) => setF({ ...f, city: v })}><Select.Trigger style={{ width: '100%' }} /><Select.Content>{CITIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content></Select.Root></Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">Type de véhicule</Text>
              <Select.Root value={f.vehicle} onValueChange={(v) => setF({ ...f, vehicle: v })}><Select.Trigger style={{ width: '100%' }} /><Select.Content>{VEHICLE_TYPES.map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content></Select.Root></Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Téléphone</Text>
              <TextField.Root value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+212600000000" color={!phoneOk ? 'red' : undefined} />
              {!phoneOk && <Text size="1" color="red">Numéro invalide.</Text>}
            </Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">N° de permis</Text>
              <TextField.Root value={f.licenseNo} onChange={(e) => setF({ ...f, licenseNo: e.target.value })} placeholder="AB123456" /></Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="2" weight="medium" mb="1">Échéance permis</Text>
              <TextField.Root type="date" value={f.licenseDue} onChange={(e) => setF({ ...f, licenseDue: e.target.value })} /></Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">Échéance visite médicale</Text>
              <TextField.Root type="date" value={f.medicalDue} onChange={(e) => setF({ ...f, medicalDue: e.target.value })} /></Box>
          </Grid>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!valid || busy} onClick={submit}>Ajouter</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
