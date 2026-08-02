'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Select, TextField, DropdownMenu,
} from '@radix-ui/themes';
import {
  PlusIcon, DotsHorizontalIcon, MagnifyingGlassIcon, HomeIcon, CheckCircledIcon,
  LockClosedIcon, ExclamationTriangleIcon, RocketIcon,
} from '@radix-ui/react-icons';
import type { Tenant, SaasPlanRow } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const SLUG_RE = /^[a-z0-9]+$/;
const STATUS_COLOR: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { ACTIF: 'green', ESSAI: 'amber', SUSPENDU: 'red' };
const STATUS_LABEL: Record<string, string> = { ACTIF: 'Actif', ESSAI: 'Essai', SUSPENDU: 'Suspendu' };

function money(dh: number): string {
  return `${dh.toLocaleString('fr-FR')} DH`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function SaasTenantsView({ tenants, plans }: { tenants: Tenant[]; plans: SaasPlanRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');

  const actifs = tenants.filter((t) => t.status === 'ACTIF').length;
  const essais = tenants.filter((t) => t.status === 'ESSAI').length;
  const suspendus = tenants.filter((t) => t.status === 'SUSPENDU');
  // Revenu récurrent : seuls les tenants actifs sont facturés.
  const mrr = tenants
    .filter((t) => t.status === 'ACTIF')
    .reduce((a, t) => a + (plans.find((p) => p.code === t.plan)?.monthlyDH ?? 0), 0);

  const rows = tenants.filter((t) => {
    if (status !== 'all' && t.status !== status) return false;
    if (q && !`${t.slug} ${t.name} ${t.city ?? ''}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/saas/${path}`, {
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
        title="Organisations"
        subtitle={`${tenants.length} tenants · ${actifs} actifs · ${essais} en essai`}
        actions={<ProvisionDialog plans={plans} onCreate={(b) => call('tenants', 'POST', b)} busy={busy} />}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Organisations" value={String(tenants.length)} delta="tous statuts" deltaColor="gray" icon={<HomeIcon width="15" />} accent="indigo" />
        <KPI label="Actives" value={String(actifs)} delta="facturées" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En essai" value={String(essais)} delta="à convertir" deltaColor="amber" icon={<RocketIcon width="15" />} accent="amber" />
        <KPI label="Revenu mensuel" value={money(mrr)} delta="tenants actifs" deltaColor="gray" icon={<LockClosedIcon width="15" />} accent="cyan" />
      </Grid>

      {suspendus.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{suspendus.length} organisation(s) suspendue(s)</strong> — le paywall bloque la connexion de tous leurs
            utilisateurs : {suspendus.map((t) => t.slug).join(', ')}.
          </Callout.Text>
        </Callout.Root>
      )}

      <Flex gap="3" mb="3" wrap="wrap">
        <TextField.Root placeholder="Rechercher (slug, nom, ville)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 280 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={status} onValueChange={setStatus}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Tous statuts</Select.Item>
            {Object.keys(STATUS_LABEL).map((s) => <Select.Item key={s} value={s}>{STATUS_LABEL[s]}</Select.Item>)}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Organisation</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Abonnement</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Créée le</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((t) => {
              const plan = plans.find((p) => p.code === t.plan);
              return (
                <Table.Row key={t.slug} align="center">
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{
                        width: 30, height: 30, borderRadius: 'var(--radius-2)', flex: '0 0 30px',
                        background: 'var(--indigo-a3)', color: 'var(--indigo-11)', fontSize: 11, fontWeight: 600,
                      }}>{t.slug.slice(0, 2).toUpperCase()}</Flex>
                      <Box>
                        <Text as="div" size="2" weight="medium">{t.name}</Text>
                        <Text as="div" size="1" color="gray">{t.slug}{t.city ? ` · ${t.city}` : ''}</Text>
                      </Box>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell><Badge variant="soft" color="gray">{t.plan}</Badge></Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Text as="div" size="2">{plan ? money(plan.monthlyDH) : '—'}<Text size="1" color="gray"> /mois</Text></Text>
                      <Text as="div" size="1" color="gray">
                        {plan?.maxOrdersMonth != null ? `${plan.maxOrdersMonth.toLocaleString('fr-FR')} cmd/mois` : 'sans quota'}
                      </Text>
                    </Box>
                  </Table.Cell>
                  <Table.Cell><Badge color={STATUS_COLOR[t.status] || 'gray'} variant="soft">{STATUS_LABEL[t.status] || t.status}</Badge></Table.Cell>
                  <Table.Cell><Text size="1" color="gray">{when(t.createdAt)}</Text></Table.Cell>
                  <Table.Cell>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <PlanItem tenant={t} plans={plans} onChange={(plan) => call(`tenants/${t.slug}/plan`, 'POST', { plan })} />
                        <DropdownMenu.Separator />
                        {t.status !== 'ACTIF' && (
                          <DropdownMenu.Item onSelect={() => call(`tenants/${t.slug}/status`, 'POST', { status: 'ACTIF' })}>Activer</DropdownMenu.Item>
                        )}
                        {t.status !== 'ESSAI' && (
                          <DropdownMenu.Item onSelect={() => call(`tenants/${t.slug}/status`, 'POST', { status: 'ESSAI' })}>Repasser en essai</DropdownMenu.Item>
                        )}
                        {t.status !== 'SUSPENDU' && (
                          <SuspendItem tenant={t} onSuspend={() => call(`tenants/${t.slug}/status`, 'POST', { status: 'SUSPENDU' })} />
                        )}
                      </DropdownMenu.Content>
                    </DropdownMenu.Root>
                  </Table.Cell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{tenants.length ? 'Aucune organisation ne correspond au filtre.' : 'Aucune organisation.'}</Text></Box>
        )}
      </Card>
    </>
  );
}

function PlanItem({ tenant, plans, onChange }: {
  tenant: Tenant; plans: SaasPlanRow[]; onChange: (plan: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [plan, setPlan] = React.useState(tenant.plan);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setPlan(tenant.plan); setOpen(true); }}>
          Changer de plan
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="400px">
        <Dialog.Title>Changer le plan</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{tenant.name} — plan actuel : {tenant.plan}.</Dialog.Description>
        <Select.Root value={plan} onValueChange={setPlan}>
          <Select.Trigger style={{ width: '100%' }} />
          <Select.Content>
            {plans.map((p) => (
              <Select.Item key={p.code} value={p.code}>{p.label} — {money(p.monthlyDH)}/mois</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={plan === tenant.plan} onClick={() => { onChange(plan); setOpen(false); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function SuspendItem({ tenant, onSuspend }: { tenant: Tenant; onSuspend: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><LockClosedIcon /> Suspendre</DropdownMenu.Item>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="400px">
        <AlertDialog.Title>Suspendre {tenant.name} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Le paywall bloquera la connexion de <strong>tous les utilisateurs</strong> de cette organisation,
          y compris ses administrateurs. Les données sont conservées.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onSuspend}>Suspendre</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function ProvisionDialog({ plans, onCreate, busy }: {
  plans: SaasPlanRow[]; onCreate: (b: any) => Promise<boolean>; busy: boolean;
}) {
  const empty = { slug: '', name: '', city: 'Casablanca', plan: plans[0]?.code ?? 'Essai' };
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(empty);

  const slugOk = SLUG_RE.test(f.slug.trim());
  const valid = slugOk && f.name.trim().length > 1;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Provisionner</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Provisionner une organisation</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Crée le schéma dédié, ses tables et la ligne plateforme. Le slug devient le sous-domaine
          d’accès (<code>slug.transpo.wedo.technology</code>) et n’est plus modifiable.
        </Dialog.Description>
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Slug</Text>
            <TextField.Root
              value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })}
              placeholder="rabatexpress" color={f.slug && !slugOk ? 'red' : undefined}
            />
            {f.slug && !slugOk && <Text size="1" color="red">Minuscules et chiffres uniquement, sans tiret ni espace.</Text>}
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Nom commercial</Text>
            <TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Rabat Express" />
          </Box>
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Ville</Text>
              <TextField.Root value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </Box>
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Plan</Text>
              <Select.Root value={f.plan} onValueChange={(v) => setF({ ...f, plan: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{plans.map((p) => <Select.Item key={p.code} value={p.code}>{p.label}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
          </Grid>
          <Text size="1" color="gray">
            Un plan « Essai » crée l’organisation au statut Essai ; tout autre plan la crée active.
          </Text>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              const ok = await onCreate({ slug: f.slug.trim(), name: f.name.trim(), city: f.city.trim() || undefined, plan: f.plan });
              if (ok) { setOpen(false); setF(empty); }
            }}
          >Provisionner</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
