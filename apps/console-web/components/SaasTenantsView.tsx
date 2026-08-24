'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Select, TextField, DropdownMenu,
} from '@radix-ui/themes';
import {
  PlusIcon, DotsHorizontalIcon, MagnifyingGlassIcon, HomeIcon, CheckCircledIcon,
  LockClosedIcon, ExclamationTriangleIcon, RocketIcon, UpdateIcon, CrossCircledIcon,
  CopyIcon, CheckIcon, InfoCircledIcon,
} from '@radix-ui/react-icons';
import type { Tenant, SaasPlanRow, SubscriptionStatus } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';
import { priceLabel, quotaLabel } from '../lib/plans';

const SLUG_RE = /^[a-z0-9]+$/;

// Statut d'ABONNEMENT — c'est lui qui pilote. `tenants.status` n'en est que la projection.
const SUB_COLOR: Record<SubscriptionStatus, 'green' | 'amber' | 'orange' | 'red' | 'gray'> = {
  ESSAI: 'amber', ACTIF: 'green', IMPAYE: 'orange', SUSPENDU: 'red', RESILIE: 'gray',
};
const SUB_LABEL: Record<SubscriptionStatus, string> = {
  ESSAI: 'Essai', ACTIF: 'Actif', IMPAYE: 'Impayé', SUSPENDU: 'Suspendu', RESILIE: 'Résilié',
};

function money(dh: number): string {
  return `${dh.toLocaleString('fr-FR')} DH`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Jours restants avant une date, borné à 0. */
function daysUntil(iso: string): number {
  const ms = Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86400000));
}

export function SaasTenantsView({ tenants, plans }: { tenants: Tenant[]; plans: SaasPlanRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  // Mot de passe temporaire du 1er admin, affiché une seule fois après provisionnement (AN-01).
  const [revealed, setRevealed] = React.useState<{ label: string; password: string } | null>(null);

  const by = (s: SubscriptionStatus) => tenants.filter((t) => t.subStatus === s);
  const actifs = by('ACTIF').length;
  const essais = by('ESSAI').length;
  const impayes = by('IMPAYE');
  // L'accès réel, c'est `tenants.status` — la projection. Se fier au statut d'abonnement
  // manquerait les tenants résiliés, qui n'ont plus d'abonnement courant du tout.
  const coupes = tenants.filter((t) => t.status === 'SUSPENDU');

  // Revenu récurrent : seuls les abonnements actifs au forfait sont un montant garanti.
  const planOf = (t: Tenant) => plans.find((p) => p.code === t.planCode);
  const mrr = by('ACTIF').reduce((a, t) => {
    const v = planOf(t)?.current;
    return a + (v?.billingMode === 'FORFAIT' ? v.monthlyCentimes / 100 : 0);
  }, 0);
  const usageTenants = by('ACTIF').filter((t) => planOf(t)?.current?.billingMode === 'USAGE').length;

  const rows = tenants.filter((t) => {
    if (status !== 'all' && t.subStatus !== status) return false;
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
    if (res.ok) { router.refresh(); return res.json().catch(() => ({})); }
    const d = await res.json().catch(() => null);
    alert(d?.message ?? d?.error ?? 'Action impossible');
    return null;
  }

  async function runCycle() {
    setBusy(true);
    const res = await fetch('/api/proxy/v1/saas/cycle/run', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    const d = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) { alert(d?.message ?? 'Cycle impossible'); return; }
    alert(
      `Cycle du ${d.day}\n\n` +
      `${d.trialsExpired} essai(s) expiré(s)\n${d.suspended} suspension(s)\n` +
      `${d.renewed} reconduction(s)\n${d.projected} statut(s) tenant réaligné(s)`,
    );
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Organisations"
        subtitle={`${tenants.length} tenants · ${actifs} actifs · ${essais} en essai`}
        actions={
          <Flex gap="2">
            <Button variant="soft" color="gray" disabled={busy} onClick={runCycle}>
              <UpdateIcon /> Lancer le cycle
            </Button>
            <ProvisionDialog
              plans={plans} onCreate={(b) => call('tenants', 'POST', b)} busy={busy}
              onProvisioned={(a) => setRevealed({ label: `${a.name} (${a.email})`, password: a.tempPassword })}
            />
          </Flex>
        }
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Organisations" value={String(tenants.length)} delta="tous statuts" deltaColor="gray" icon={<HomeIcon width="15" />} accent="indigo" />
        <KPI label="Actives" value={String(actifs)} delta="facturées" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En essai" value={String(essais)} delta="à convertir" deltaColor="amber" icon={<RocketIcon width="15" />} accent="amber" />
        <KPI
          label="Revenu mensuel" value={money(mrr)}
          delta={usageTenants ? `hors ${usageTenants} à l’usage` : 'forfaits actifs'}
          deltaColor="gray" icon={<LockClosedIcon width="15" />} accent="cyan"
        />
      </Grid>

      {impayes.length > 0 && (
        <Callout.Root color="orange" mb="3">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{impayes.length} abonnement(s) impayé(s)</strong> — l’accès reste ouvert, la suspension
            est automatique à la fin du délai de grâce : {impayes.map((t) => t.slug).join(', ')}.
          </Callout.Text>
        </Callout.Root>
      )}

      {coupes.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><LockClosedIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{coupes.length} organisation(s) sans accès</strong> — le paywall bloque la connexion de
            tous leurs utilisateurs, administrateurs compris : {coupes.map((t) => t.slug).join(', ')}.
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
            {(Object.keys(SUB_LABEL) as SubscriptionStatus[]).map((s) => (
              <Select.Item key={s} value={s}>{SUB_LABEL[s]}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Organisation</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Tarif</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Abonnement</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Créée le</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((t) => {
              const plan = planOf(t);
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
                  <Table.Cell>
                    <Badge variant="soft" color="gray">{t.plan}</Badge>
                    {t.nextPlanLabel && (
                      <Text as="div" size="1" color="gray">→ {t.nextPlanLabel} à l’échéance</Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Box>
                      <Text as="div" size="2">{plan ? priceLabel(plan.current) : '—'}</Text>
                      <Text as="div" size="1" color="gray">
                        {plan ? quotaLabel(plan.current) : t.subStatus ? 'hors catalogue' : 'sans contrat'}
                      </Text>
                    </Box>
                  </Table.Cell>
                  <Table.Cell><SubscriptionCell tenant={t} /></Table.Cell>
                  <Table.Cell><Text size="1" color="gray">{when(t.createdAt)}</Text></Table.Cell>
                  <Table.Cell>
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                      <DropdownMenu.Content>
                        <SubscribeDialog
                          tenant={t} plans={plans}
                          onSave={(b) => call(`tenants/${t.slug}/subscription`, 'POST', b)}
                        />
                        <DropdownMenu.Separator />
                        {(t.subStatus === 'SUSPENDU' || t.subStatus === 'IMPAYE') && (
                          <DropdownMenu.Item onSelect={() => call(`tenants/${t.slug}/subscription/reactivate`, 'POST', {})}>
                            <CheckCircledIcon /> Réactiver
                          </DropdownMenu.Item>
                        )}
                        {t.subStatus && t.subStatus !== 'SUSPENDU' && t.subStatus !== 'RESILIE' && (
                          <ReasonItem
                            label="Suspendre" color="red" icon={<LockClosedIcon />}
                            title={`Suspendre ${t.name} ?`}
                            body="Le paywall bloquera la connexion de tous les utilisateurs de cette organisation, administrateurs compris. Les données sont conservées."
                            onConfirm={(reason) => call(`tenants/${t.slug}/subscription/suspend`, 'POST', { reason })}
                          />
                        )}
                        {t.subStatus && t.subStatus !== 'RESILIE' && (
                          <ReasonItem
                            label="Résilier" color="red" icon={<CrossCircledIcon />}
                            title={`Résilier l’abonnement de ${t.name} ?`}
                            body="L’abonnement est clos définitivement et l’accès coupé. Un nouvel abonnement pourra être souscrit ensuite, mais l’historique de celui-ci est figé."
                            onConfirm={(reason) => call(`tenants/${t.slug}/subscription/cancel`, 'POST', { reason })}
                          />
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
      <RevealPassword revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

/** Mot de passe temporaire du 1er admin, affiché une seule fois (même pattern que l'invitation /users). */
function RevealPassword({ revealed, onClose }: { revealed: { label: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (revealed) setCopied(false); }, [revealed]);
  return (
    <Dialog.Root open={!!revealed} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Content maxWidth="380px">
        <Dialog.Title>Compte administrateur créé</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{revealed?.label}</Dialog.Description>
        <Callout.Root color="amber" size="1" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Ce mot de passe ne sera plus affiché — communiquez-le à l'administrateur maintenant.</Callout.Text>
        </Callout.Root>
        <Flex align="center" gap="2" p="3" style={{ borderRadius: 'var(--radius-3)', background: 'var(--gray-a3)' }}>
          <Text size="4" weight="bold" style={{ fontFamily: 'var(--code-font-family)', flex: 1, wordBreak: 'break-all' }}>{revealed?.password}</Text>
          <IconButton
            size="1" variant="soft" color={copied ? 'green' : 'gray'}
            onClick={() => { if (revealed) { navigator.clipboard.writeText(revealed.password); setCopied(true); } }}
          >{copied ? <CheckIcon /> : <CopyIcon />}</IconButton>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button>Fermer</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** Statut d'abonnement + l'échéance qui compte selon l'état. */
function SubscriptionCell({ tenant: t }: { tenant: Tenant }) {
  if (!t.subStatus) return <Text size="1" color="gray">Aucun abonnement</Text>;
  const detail =
    t.subStatus === 'ESSAI' && t.trialEndsAt ? `${daysUntil(t.trialEndsAt)} j restants`
    : t.subStatus === 'ACTIF' && t.renewsAt ? `échéance ${t.renewsAt}`
    : t.subStatus === 'IMPAYE' && t.pastDueSince ? `impayé depuis ${t.pastDueSince}`
    : t.statusReason ?? null;
  return (
    <Box>
      <Badge color={SUB_COLOR[t.subStatus]} variant="soft">{SUB_LABEL[t.subStatus]}</Badge>
      {detail && <Text as="div" size="1" color="gray" mt="1">{detail}</Text>}
    </Box>
  );
}

/** Souscrire ou changer de plan. L'effet dépend de l'état courant — le dialogue le dit. */
function SubscribeDialog({ tenant, plans, onSave }: {
  tenant: Tenant; plans: SaasPlanRow[]; onSave: (b: any) => Promise<boolean>;
}) {
  const available = plans.filter((p) => !p.archived && p.current);
  const [open, setOpen] = React.useState(false);
  const [code, setCode] = React.useState(tenant.planCode ?? available[0]?.code ?? '');
  const [immediate, setImmediate] = React.useState(false);

  React.useEffect(() => {
    if (open) { setCode(tenant.planCode ?? available[0]?.code ?? ''); setImmediate(false); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = tenant.subStatus === 'ACTIF';
  const unchanged = isActive && code === tenant.planCode && !immediate;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          {tenant.subStatus === 'ESSAI' ? 'Convertir l’essai' : 'Souscrire / changer de plan'}
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>{tenant.name}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          {tenant.subStatus === 'ESSAI'
            ? 'L’essai se transforme en abonnement actif dès aujourd’hui, sur la période en cours.'
            : isActive
              ? <>Le changement prend effet <strong>à la prochaine échéance</strong> ({tenant.renewsAt}) — le mois en cours reste facturé au plan actuel.</>
              : 'L’abonnement est régularisé et repart sur la période en cours.'}
        </Dialog.Description>

        <Select.Root value={code} onValueChange={setCode}>
          <Select.Trigger style={{ width: '100%' }} />
          <Select.Content>
            {available.map((p) => (
              <Select.Item key={p.code} value={p.code}>{p.labelFr} — {priceLabel(p.current)}</Select.Item>
            ))}
          </Select.Content>
        </Select.Root>

        {isActive && (
          <Flex align="center" gap="2" mt="3" asChild>
            <label>
              <input type="checkbox" checked={immediate} onChange={(e) => setImmediate(e.target.checked)} />
              <Text size="2" color="gray">Appliquer immédiatement (sans proration du mois en cours)</Text>
            </label>
          </Flex>
        )}

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!code || unchanged}
            onClick={async () => { if (await onSave({ planCode: code, immediate })) setOpen(false); }}
          >Valider</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/** Action destructive exigeant un motif — il est conservé sur l'abonnement et tracé. */
function ReasonItem({ label, color, icon, title, body, onConfirm }: {
  label: string; color: 'red'; icon: React.ReactNode; title: string; body: string;
  onConfirm: (reason: string) => Promise<boolean>;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setReason(''); }}>
      <AlertDialog.Trigger>
        <DropdownMenu.Item color={color} onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          {icon} {label}
        </DropdownMenu.Item>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="440px">
        <AlertDialog.Title>{title}</AlertDialog.Title>
        <AlertDialog.Description size="2">{body}</AlertDialog.Description>
        <Box mt="3">
          <Text as="div" size="2" weight="medium" mb="1">Motif</Text>
          <TextField.Root value={reason} placeholder="Impayé relancé trois fois…" onChange={(e) => setReason(e.target.value)} />
        </Box>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <Button color={color} disabled={!reason.trim()} onClick={async () => { if (await onConfirm(reason.trim())) setOpen(false); }}>
            {label}
          </Button>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function ProvisionDialog({ plans, onCreate, busy, onProvisioned }: {
  plans: SaasPlanRow[]; onCreate: (b: any) => Promise<any>; busy: boolean;
  onProvisioned: (admin: { email: string; name: string; tempPassword: string }) => void;
}) {
  const available = plans.filter((p) => !p.archived && p.current);
  const empty = { slug: '', name: '', city: 'Casablanca', planCode: available[0]?.code ?? 'essai', adminEmail: '', adminName: '' };
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(empty);

  const slugOk = SLUG_RE.test(f.slug.trim());
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.adminEmail.trim());
  const valid = slugOk && f.name.trim().length > 1 && emailOk && f.adminName.trim().length > 1;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Provisionner</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="460px">
        <Dialog.Title>Provisionner une organisation</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Crée le schéma dédié, ses tables et la ligne plateforme. Le slug devient le sous-domaine
          d’accès (<code>slug.transpo.wedo.technology</code>) et n’est plus modifiable. Le compte
          administrateur est créé dans la même opération, avec un mot de passe temporaire affiché une seule fois.
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
              <Text as="div" size="2" weight="medium" mb="1">Plan visé</Text>
              <Select.Root value={f.planCode} onValueChange={(v) => setF({ ...f, planCode: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  {available.map((p) => <Select.Item key={p.code} value={p.code}>{p.labelFr}</Select.Item>)}
                </Select.Content>
              </Select.Root>
            </Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Nom de l'administrateur</Text>
              <TextField.Root value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} placeholder="Youssef Tazi" />
            </Box>
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Email de l'administrateur</Text>
              <TextField.Root
                value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })}
                placeholder="admin@rabatexpress.ma" color={f.adminEmail && !emailOk ? 'red' : undefined}
              />
              {f.adminEmail && !emailOk && <Text size="1" color="red">Email invalide.</Text>}
            </Box>
          </Grid>
          <Text size="1" color="gray">
            L’organisation démarre toujours par un <strong>essai de 14 jours</strong> sur le plan choisi.
            À son terme, sans souscription, elle passe en impayé puis est suspendue.
          </Text>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              const res = await onCreate({
                slug: f.slug.trim(), name: f.name.trim(), city: f.city.trim() || undefined,
                planCode: f.planCode, adminEmail: f.adminEmail.trim(), adminName: f.adminName.trim(),
              });
              if (res) {
                setOpen(false); setF(empty);
                if (res.admin) onProvisioned(res.admin);
              }
            }}
          >Provisionner</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
