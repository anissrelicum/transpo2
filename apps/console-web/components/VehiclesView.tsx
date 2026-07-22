'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Select, TextField, Checkbox, DropdownMenu,
} from '@radix-ui/themes';
import {
  PlusIcon, ExclamationTriangleIcon, CubeIcon, DotFilledIcon, DotsHorizontalIcon,
  Pencil1Icon, TrashIcon, ReloadIcon,
} from '@radix-ui/react-icons';
import type { Vehicle } from '@transpo/api-client';
import { PageHeader } from './ui';

const CITIES = ['Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fès', 'Agadir', 'Kénitra', 'Mohammedia'];
const STATE_COLOR: Record<string, 'green' | 'amber' | 'gray'> = { ACTIF: 'green', MAINTENANCE: 'amber', 'HORS SERVICE': 'gray' };
const STATE_LABEL: Record<string, string> = { ACTIF: 'Actif', MAINTENANCE: 'Maintenance', 'HORS SERVICE': 'Hors service' };
const PLATE_RE = /^[0-9]{1,5}-[A-Za-z؀-ۿ]{1,2}-[0-9]{1,3}$/;

function dueBadge(due: string | null): { color: 'red' | 'amber' | 'green' | 'gray'; txt: string } {
  if (!due) return { color: 'gray', txt: 'Non renseigné' };
  const days = Math.round((new Date(due).getTime() - Date.now()) / 86400000);
  if (days < 0) return { color: 'red', txt: `Expirée (${-days} j)` };
  if (days <= 30) return { color: 'amber', txt: `Dans ${days} j` };
  return { color: 'green', txt: new Date(due).toLocaleDateString('fr-FR', { month: '2-digit', year: 'numeric' }) };
}

export function VehiclesView({ vehicles, isAdmin }: { vehicles: Vehicle[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const active = vehicles.filter((v) => v.state === 'ACTIF').length;
  const alerts = vehicles.filter((v) => v.insuranceExpired || v.ctExpired).length;

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/${path}`, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
    return res.ok;
  }

  return (
    <>
      <PageHeader
        title="Véhicules"
        subtitle={`${vehicles.length} véhicules · ${active} actifs · ${alerts} alerte(s) d’échéance`}
        actions={isAdmin ? <AddVehicleDialog onCreate={(b) => call('vehicles', 'POST', b)} busy={busy} /> : undefined}
      />

      {alerts > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text><strong>{alerts} véhicule(s)</strong> avec assurance ou contrôle technique expiré — non affectables tant que la situation n’est pas régularisée.</Callout.Text>
        </Callout.Root>
      )}

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Véhicule</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Capacité</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Équipements</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>État</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Assurance</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Contrôle tech.</Table.ColumnHeaderCell>
            {isAdmin && <Table.ColumnHeaderCell />}
          </Table.Row></Table.Header>
          <Table.Body>
            {vehicles.map((v) => {
              const ins = dueBadge(v.insuranceDue);
              const ct = dueBadge(v.ctDue);
              const frigo = v.equipment.includes('Frigo');
              return (
                <Table.Row key={v.id} align="center">
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: 'var(--radius-2)', background: 'var(--gray-a3)', color: 'var(--gray-11)' }}><CubeIcon width="16" /></Flex>
                      <Box><Text as="div" size="2" weight="medium">{v.plate}</Text><Text as="div" size="1" color="gray">{v.type}{v.city ? ` · ${v.city}` : ''}</Text></Box>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell>
                    <Box><Text as="div" size="2">{v.capacity || '—'}</Text>
                      {frigo && <Flex align="center" gap="1"><DotFilledIcon width="11" color="var(--cyan-11)" /><Text size="1" color="gray">−18 à +4 °C</Text></Flex>}</Box>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex gap="1" wrap="wrap">
                      {v.equipment.length ? v.equipment.map((e) => <Badge key={e} variant="soft" color={e === 'Frigo' ? 'cyan' : 'gray'} size="1">{e}</Badge>) : <Text size="1" color="gray">—</Text>}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell><Badge color={STATE_COLOR[v.state] || 'gray'} variant="soft">{STATE_LABEL[v.state] || v.state}</Badge></Table.Cell>
                  <Table.Cell><Flex align="center" gap="1"><DotFilledIcon color={`var(--${ins.color}-9)`} /><Text size="1" color={ins.color === 'green' ? 'gray' : ins.color}>{ins.txt}</Text></Flex></Table.Cell>
                  <Table.Cell><Flex align="center" gap="1"><DotFilledIcon color={`var(--${ct.color}-9)`} /><Text size="1" color={ct.color === 'green' ? 'gray' : ct.color}>{ct.txt}</Text></Flex></Table.Cell>
                  {isAdmin && (
                    <Table.Cell>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          {v.state !== 'ACTIF' && <DropdownMenu.Item onSelect={() => call(`vehicles/${v.id}/state`, 'PATCH', { state: 'ACTIF' })}>Réactiver</DropdownMenu.Item>}
                          {v.state !== 'MAINTENANCE' && <DropdownMenu.Item onSelect={() => call(`vehicles/${v.id}/state`, 'PATCH', { state: 'MAINTENANCE' })}>Mettre en maintenance</DropdownMenu.Item>}
                          {v.state !== 'HORS SERVICE' && <DropdownMenu.Item onSelect={() => call(`vehicles/${v.id}/state`, 'PATCH', { state: 'HORS SERVICE' })}>Hors service</DropdownMenu.Item>}
                          <DropdownMenu.Separator />
                          <RenewItem vehicle={v} field="insurance" onRenew={(due) => call(`vehicles/${v.id}/renew`, 'POST', { field: 'insurance', due })} />
                          <RenewItem vehicle={v} field="ct" onRenew={(due) => call(`vehicles/${v.id}/renew`, 'POST', { field: 'ct', due })} />
                          <DropdownMenu.Separator />
                          <RemoveItem vehicle={v} onRemove={() => call(`vehicles/${v.id}`, 'DELETE')} />
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {vehicles.length === 0 && <Box p="4"><Text size="2" color="gray">Aucun véhicule.</Text></Box>}
      </Card>
    </>
  );
}

function RenewItem({ vehicle, field, onRenew }: { vehicle: Vehicle; field: 'insurance' | 'ct'; onRenew: (due: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [due, setDue] = React.useState('');
  const label = field === 'insurance' ? 'Renouveler l’assurance' : 'Renouveler le contrôle technique';
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}><ReloadIcon /> {label}</DropdownMenu.Item></Dialog.Trigger>
      <Dialog.Content maxWidth="360px">
        <Dialog.Title>{label}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{vehicle.plate} — nouvelle date d’échéance.</Dialog.Description>
        <TextField.Root type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!due} onClick={() => { onRenew(due); setOpen(false); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function RemoveItem({ vehicle, onRemove }: { vehicle: Vehicle; onRemove: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger><DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><TrashIcon /> Retirer</DropdownMenu.Item></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="360px">
        <AlertDialog.Title>Retirer {vehicle.plate} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">Le véhicule sera retiré du parc. Cette action est définitive.</AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onRemove}>Retirer</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function AddVehicleDialog({ onCreate, busy }: { onCreate: (b: any) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ plate: '', type: 'Fourgon', city: 'Casablanca', state: 'ACTIF', capacity: '', insuranceDue: '', ctDue: '', hayon: false, frigo: false });
  const valid = PLATE_RE.test(f.plate.trim());
  async function submit() {
    const equipment = [...(f.hayon ? ['Hayon'] : []), ...(f.frigo ? ['Frigo'] : [])];
    const ok = await onCreate({
      plate: f.plate.trim(), type: f.type, city: f.city, state: f.state,
      capacity: f.capacity || undefined, insuranceDue: f.insuranceDue || undefined, ctDue: f.ctDue || undefined, equipment,
    });
    if (ok) { setOpen(false); setF({ plate: '', type: 'Fourgon', city: 'Casablanca', state: 'ACTIF', capacity: '', insuranceDue: '', ctDue: '', hayon: false, frigo: false }); }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Ajouter un véhicule</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Ajouter un véhicule</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Immatriculation au format marocain (ex. 1234-A-56).</Dialog.Description>
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Immatriculation</Text>
            <TextField.Root value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="1234-A-56" color={f.plate && !valid ? 'red' : undefined} />
            {f.plate && !valid && <Text size="1" color="red">Format attendu : NNNN-L-NN</Text>}
          </Box>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="2" weight="medium" mb="1">Type</Text>
              <Select.Root value={f.type} onValueChange={(v) => setF({ ...f, type: v })}><Select.Trigger style={{ width: '100%' }} /><Select.Content>{['Moto', 'Voiture', 'Fourgon', 'Fourgon frigo', 'Camion'].map((x) => <Select.Item key={x} value={x}>{x}</Select.Item>)}</Select.Content></Select.Root></Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">Ville</Text>
              <Select.Root value={f.city} onValueChange={(v) => setF({ ...f, city: v })}><Select.Trigger style={{ width: '100%' }} /><Select.Content>{CITIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content></Select.Root></Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="2" weight="medium" mb="1">État</Text>
              <Select.Root value={f.state} onValueChange={(v) => setF({ ...f, state: v })}><Select.Trigger style={{ width: '100%' }} /><Select.Content>{['ACTIF', 'MAINTENANCE', 'HORS SERVICE'].map((s) => <Select.Item key={s} value={s}>{STATE_LABEL[s]}</Select.Item>)}</Select.Content></Select.Root></Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">Capacité</Text>
              <TextField.Root value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} placeholder="ex. 1,2 t" /></Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box><Text as="div" size="2" weight="medium" mb="1">Échéance assurance</Text>
              <TextField.Root type="date" value={f.insuranceDue} onChange={(e) => setF({ ...f, insuranceDue: e.target.value })} /></Box>
            <Box><Text as="div" size="2" weight="medium" mb="1">Échéance contrôle tech.</Text>
              <TextField.Root type="date" value={f.ctDue} onChange={(e) => setF({ ...f, ctDue: e.target.value })} /></Box>
          </Grid>
          <Flex gap="4">
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.hayon} onCheckedChange={(v) => setF({ ...f, hayon: !!v })} /> Hayon</Flex></Text>
            <Text as="label" size="2"><Flex gap="2" align="center"><Checkbox checked={f.frigo} onCheckedChange={(v) => setF({ ...f, frigo: !!v })} /> Frigorifique</Flex></Text>
          </Flex>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!valid || busy} onClick={submit}>Ajouter</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
