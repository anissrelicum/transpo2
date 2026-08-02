'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Select, TextField, Switch, DropdownMenu, TextField as TF,
} from '@radix-ui/themes';
import {
  PlusIcon, ExclamationTriangleIcon, PersonIcon, DotFilledIcon, DotsHorizontalIcon,
  TrashIcon, ReloadIcon, CubeIcon, MagnifyingGlassIcon,
} from '@radix-ui/react-icons';
import type { Driver, Vehicle } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir', 'Kénitra', 'Mohammedia'];
const VEHICLE_TYPES = ['Moto', 'Voiture', 'Fourgon', 'Fourgon frigo', 'Camion'];
const PHONE_RE = /^\+?[0-9\s-]{9,15}$/;

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

export function DriversView({ drivers, vehicles, isAdmin, canDispatch }: {
  drivers: Driver[]; vehicles: Vehicle[]; isAdmin: boolean; canDispatch: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [filter, setFilter] = React.useState('all');

  const blocked = drivers.filter((d) => d.licenseExpired || d.medicalExpired);
  const available = drivers.filter((d) => d.available).length;
  const onDuty = drivers.reduce((a, d) => a + d.stats.active, 0);
  const closed = drivers.reduce((a, d) => a + d.stats.delivered + d.stats.failed, 0);
  const globalRate = closed ? Math.round((drivers.reduce((a, d) => a + d.stats.delivered, 0) / closed) * 100) : null;

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
    if (res.ok) router.refresh();
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
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <AssignVehicleItem driver={d} vehicles={vehicles} onAssign={(vid) => call(`drivers/${d.id}/vehicle`, 'PATCH', { vehicleId: vid })} />
                          <DropdownMenu.Separator />
                          <RenewItem driver={d} field="license" onRenew={(due) => call(`drivers/${d.id}/renew`, 'POST', { field: 'license', due })} />
                          <RenewItem driver={d} field="medical" onRenew={(due) => call(`drivers/${d.id}/renew`, 'POST', { field: 'medical', due })} />
                          <DropdownMenu.Separator />
                          <RemoveItem driver={d} onRemove={() => call(`drivers/${d.id}`, 'DELETE')} />
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
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

function AssignVehicleItem({ driver, vehicles, onAssign }: {
  driver: Driver; vehicles: Vehicle[]; onAssign: (vehicleId: string | null) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [sel, setSel] = React.useState(driver.vehicleId ?? 'none');
  // Un véhicule non actif (maintenance, hors service) n'est pas rattachable.
  const options = vehicles.filter((v) => v.state === 'ACTIF' || v.id === driver.vehicleId);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
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
            {options.map((v) => <Select.Item key={v.id} value={v.id}>{v.plate} — {v.type}{v.city ? ` (${v.city})` : ''}</Select.Item>)}
          </Select.Content>
        </Select.Root>
        {options.length === 0 && <Text as="p" size="1" color="gray" mt="2">Aucun véhicule actif au parc.</Text>}
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button onClick={() => { onAssign(sel === 'none' ? null : sel); setOpen(false); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function RenewItem({ driver, field, onRenew }: { driver: Driver; field: 'license' | 'medical'; onRenew: (due: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [due, setDue] = React.useState('');
  const label = field === 'license' ? 'Renouveler le permis' : 'Renouveler la visite médicale';
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}><ReloadIcon /> {label}</DropdownMenu.Item></Dialog.Trigger>
      <Dialog.Content maxWidth="360px">
        <Dialog.Title>{label}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{driver.name} — nouvelle date d’échéance.</Dialog.Description>
        <TextField.Root type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!due} onClick={() => { onRenew(due); setOpen(false); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function RemoveItem({ driver, onRemove }: { driver: Driver; onRemove: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger><DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><TrashIcon /> Retirer</DropdownMenu.Item></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="380px">
        <AlertDialog.Title>Retirer {driver.name} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Le chauffeur sera retiré de l’effectif. Impossible s’il lui reste des commandes en cours.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onRemove}>Retirer</Button></AlertDialog.Action>
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
