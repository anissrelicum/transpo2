'use client';
import * as React from 'react';
import { useSafeRefresh } from '../lib/safe-refresh';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Table, Dialog, AlertDialog,
  Select, TextField, TextArea, DropdownMenu, Switch, Callout, Separator,
} from '@radix-ui/themes';
import {
  PlusIcon, DotsHorizontalIcon, TrashIcon, ArchiveIcon, ResetIcon,
  ExclamationTriangleIcon, LayersIcon, CounterClockwiseClockIcon,
} from '@radix-ui/react-icons';
import type { SaasPlanRow, PlanVersionHistoryRow, PlanTierRow, PlanBillingMode, TierMode } from '@transpo/api-client';
import { validateTiers, computeBilling, dhToCentimes } from '@transpo/domain';
import { PageHeader } from './ui';
import { dh, priceLabel, quotaLabel } from '../lib/plans';

const CODE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const today = () => new Date().toISOString().slice(0, 10);
const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Palier en cours de saisie : le prix est saisi en DH, converti en centimes à l'envoi. */
type DraftTier = { fromQty: number; toQty: number | null; unitDh: string };

const toTiers = (d: DraftTier[]): PlanTierRow[] =>
  d.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, unitCentimes: dhToCentimes(Number(t.unitDh) || 0) }));

export function SaasPlansView({ plans }: { plans: SaasPlanRow[] }) {
  const refresh = useSafeRefresh();
  const [busy, setBusy] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);

  async function call(path: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/saas/${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) refresh();
    else { const d = await res.json().catch(() => null); alert(d?.message ?? d?.error ?? 'Action impossible'); }
    return res.ok;
  }

  const visible = plans.filter((p) => showArchived || !p.archived);
  const sansTarif = plans.filter((p) => !p.archived && !p.current);

  return (
    <>
      <PageHeader
        title="Plans"
        subtitle="Catalogue d’abonnement. Le prix vit dans une version datée : re-tarifer ne touche pas les abonnés en place."
        actions={<PlanDialog onSave={(b) => call('plans', 'POST', b)} busy={busy} />}
      />

      {sansTarif.length > 0 && (
        <Callout.Root color="amber" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{sansTarif.length} plan(s) sans tarif</strong> — {sansTarif.map((p) => p.labelFr).join(', ')}.
            Un plan n’est souscriptible qu’avec une version de tarif active.
          </Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3" mb="4">
        {visible.map((p) => (
          <Card key={p.code} size="3">
            <Flex direction="column" gap="2" style={{ height: '100%' }}>
              <Flex align="center" justify="between">
                <Text size="2" weight="medium">{p.labelFr}</Text>
                <Flex gap="1">
                  {p.archived && <Badge color="gray" variant="soft">Archivé</Badge>}
                  <Badge variant="soft" color={p.subscribers ? 'indigo' : 'gray'}>{p.subscribers}</Badge>
                </Flex>
              </Flex>
              <Text size="1" color="gray" dir="rtl" style={{ textAlign: 'left' }}>{p.labelAr}</Text>
              <Heading size="6">{priceLabel(p.current)}</Heading>
              <Box style={{ flex: 1 }}>
                <Text size="2" color="gray">{quotaLabel(p.current)}</Text>
              </Box>
              <Text size="1" color="gray">
                {p.current ? `Tarif v${p.current.version} · depuis le ${p.current.effectiveFrom}` : 'Aucune version de tarif'}
              </Text>
              {/* Un tarif publié à effet futur s'ANNONCE : il était jusqu'ici présenté comme
                  le prix courant, alors que personne ne le payait encore. */}
              {p.next && (
                <Text size="1" color="amber">
                  À partir du {p.next.effectiveFrom} · {priceLabel(p.next)} (v{p.next.version})
                </Text>
              )}
            </Flex>
          </Card>
        ))}
      </Grid>

      <Flex align="center" gap="2" mb="3">
        <Switch checked={showArchived} onCheckedChange={setShowArchived} />
        <Text size="2" color="gray">Afficher les plans archivés</Text>
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Plan</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Mode</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Tarif courant</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Inclus</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Abonnés</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row></Table.Header>
          <Table.Body>
            {visible.map((p) => (
              <Table.Row key={p.code} align="center">
                <Table.RowHeaderCell>
                  <Text as="div" size="2" weight="medium">{p.labelFr}</Text>
                  <Text as="div" size="1" color="gray">{p.code}</Text>
                </Table.RowHeaderCell>
                <Table.Cell>
                  {p.current
                    ? <Badge variant="soft" color={p.current.billingMode === 'USAGE' ? 'cyan' : 'indigo'}>
                        {p.current.billingMode === 'USAGE' ? 'À l’usage' : 'Forfait'}
                      </Badge>
                    : <Text size="1" color="gray">—</Text>}
                </Table.Cell>
                <Table.Cell>{priceLabel(p.current)}</Table.Cell>
                <Table.Cell><Text size="2" color="gray">{quotaLabel(p.current)}</Text></Table.Cell>
                <Table.Cell>{p.subscribers}</Table.Cell>
                <Table.Cell>
                  <DropdownMenu.Root modal={false}>
                    <DropdownMenu.Trigger>
                      <IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content>
                      <VersionDialog plan={p} onSave={(b) => call(`plans/${p.code}/versions`, 'POST', b)} busy={busy} />
                      <VersionsHistoryDialog plan={p} />
                      <DropdownMenu.Separator />
                      <PlanDialog plan={p} onSave={(b) => call(`plans/${p.code}`, 'PATCH', b)} busy={busy} />
                      {p.archived
                        ? <DropdownMenu.Item onSelect={() => call(`plans/${p.code}/restore`, 'POST', {})}>
                            <ResetIcon /> Restaurer
                          </DropdownMenu.Item>
                        : <ArchiveItem plan={p} onArchive={() => call(`plans/${p.code}/archive`, 'POST', {})} />}
                    </DropdownMenu.Content>
                  </DropdownMenu.Root>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {visible.length === 0 && (
          <Box p="4"><Text size="2" color="gray">Aucun plan au catalogue. Créez-en un.</Text></Box>
        )}
      </Card>
    </>
  );
}

/* ------------------------- Identité du plan (création / édition) ------------------------- */

function PlanDialog({ plan, onSave, busy }: {
  plan?: SaasPlanRow; onSave: (b: any) => Promise<boolean>; busy: boolean;
}) {
  const editing = !!plan;
  const empty = { code: '', labelFr: '', labelAr: '', description: '' };
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState(empty);

  React.useEffect(() => {
    if (open) {
      setF(plan
        ? { code: plan.code, labelFr: plan.labelFr, labelAr: plan.labelAr, description: plan.description ?? '' }
        : empty);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const codeOk = editing || CODE_RE.test(f.code);
  const valid = codeOk && f.labelFr.trim().length > 1 && f.labelAr.trim().length > 0;

  const trigger = editing
    ? <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}>Modifier le plan</DropdownMenu.Item>
    : <Button><PlusIcon /> Nouveau plan</Button>;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{editing ? `Modifier ${plan!.labelFr}` : 'Nouveau plan'}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Identité commerciale du plan. Le <strong>tarif se définit à part</strong>, dans une version datée —
          c’est ce qui permet de changer les prix sans toucher aux abonnés existants.
        </Dialog.Description>
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Libellé (français)</Text>
            <TextField.Root
              value={f.labelFr} placeholder="Pay as you go"
              onChange={(e) => setF((s) => ({
                ...s, labelFr: e.target.value,
                code: editing || s.code === slugify(s.labelFr) ? slugify(e.target.value) : s.code,
              }))}
            />
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Libellé (arabe)</Text>
            <TextField.Root value={f.labelAr} dir="rtl" placeholder="الدفع حسب الاستعمال"
              onChange={(e) => setF({ ...f, labelAr: e.target.value })} />
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Code</Text>
            <TextField.Root
              value={f.code} disabled={editing} placeholder="pay-as-you-go"
              color={f.code && !codeOk ? 'red' : undefined}
              onChange={(e) => setF({ ...f, code: e.target.value.toLowerCase() })}
            />
            <Text size="1" color="gray">
              {editing ? 'Le code est définitif.' : 'Minuscules, chiffres et tirets. Définitif après création.'}
            </Text>
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Description</Text>
            <TextArea value={f.description} rows={2} onChange={(e) => setF({ ...f, description: e.target.value })} />
          </Box>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              const body = editing
                ? { labelFr: f.labelFr.trim(), labelAr: f.labelAr.trim(), description: f.description.trim() }
                : { code: f.code, labelFr: f.labelFr.trim(), labelAr: f.labelAr.trim(), description: f.description.trim() };
              if (await onSave(body)) setOpen(false);
            }}
          >{editing ? 'Enregistrer' : 'Créer le plan'}</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/* ------------------------------ Nouvelle version de tarif ------------------------------ */

function VersionDialog({ plan, onSave, busy }: {
  plan: SaasPlanRow; onSave: (b: any) => Promise<boolean>; busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<PlanBillingMode>('FORFAIT');
  const [from, setFrom] = React.useState(today());
  // Forfait
  const [monthlyDh, setMonthlyDh] = React.useState('0');
  const [quota, setQuota] = React.useState('');
  const [overageDh, setOverageDh] = React.useState('');
  // Usage
  const [tierMode, setTierMode] = React.useState<TierMode>('VOLUME');
  const [minDh, setMinDh] = React.useState('0');
  const [baseDh, setBaseDh] = React.useState('0');
  const [tiers, setTiers] = React.useState<DraftTier[]>([{ fromQty: 1, toQty: null, unitDh: '5' }]);

  React.useEffect(() => {
    if (!open) return;
    const c = plan.current;
    setFrom(today());
    setMode(c?.billingMode ?? 'FORFAIT');
    setMonthlyDh(String((c?.monthlyCentimes ?? 0) / 100));
    setQuota(c?.includedOrders != null ? String(c.includedOrders) : '');
    setOverageDh(c?.overageCentimes != null ? String(c.overageCentimes / 100) : '');
    setTierMode(c?.tierMode ?? 'VOLUME');
    setMinDh(String((c?.minCentimes ?? 0) / 100));
    setBaseDh(String((c?.baseCentimes ?? 0) / 100));
    setTiers(c?.tiers.length
      ? c.tiers.map((t) => ({ fromQty: t.fromQty, toQty: t.toQty, unitDh: String(t.unitCentimes / 100) }))
      : [{ fromQty: 1, toQty: null, unitDh: '5' }]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const tierError = mode === 'USAGE' ? validateTiers(toTiers(tiers)) : null;
  const dateOk = !plan.current || from > plan.current.effectiveFrom;
  const valid = !tierError && dateOk && !busy;

  const body = mode === 'FORFAIT'
    ? {
        billingMode: 'FORFAIT', effectiveFrom: from,
        monthlyCentimes: dhToCentimes(Number(monthlyDh) || 0),
        includedOrders: quota.trim() === '' ? null : Number(quota),
        overageCentimes: overageDh.trim() === '' ? null : dhToCentimes(Number(overageDh)),
      }
    : {
        billingMode: 'USAGE', effectiveFrom: from, tierMode,
        minCentimes: dhToCentimes(Number(minDh) || 0),
        baseCentimes: dhToCentimes(Number(baseDh) || 0),
        tiers: toTiers(tiers),
      };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          <LayersIcon /> Nouvelle version de tarif
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="640px">
        <Dialog.Title>Nouveau tarif — {plan.labelFr}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          {plan.current
            ? <>La version v{plan.current.version} sera close la veille de la date d’effet. Les {plan.subscribers} abonné(s)
               actuels <strong>gardent leur prix</strong> : seule une nouvelle souscription utilisera ce tarif.</>
            : <>Premier tarif de ce plan — il le rend souscriptible.</>}
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Mode de facturation</Text>
              <Select.Root value={mode} onValueChange={(v) => setMode(v as PlanBillingMode)}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>
                  <Select.Item value="FORFAIT">Forfait mensuel</Select.Item>
                  <Select.Item value="USAGE">À l’usage (pay as you go)</Select.Item>
                </Select.Content>
              </Select.Root>
            </Box>
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Date d’effet</Text>
              <TextField.Root type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                color={dateOk ? undefined : 'red'} />
              {!dateOk && (
                <Text size="1" color="red">Doit être postérieure au {plan.current!.effectiveFrom} (v{plan.current!.version}).</Text>
              )}
            </Box>
          </Grid>

          <Separator size="4" />

          {mode === 'FORFAIT' ? (
            <Grid columns="3" gap="3">
              <Box>
                <Text as="div" size="2" weight="medium" mb="1">Montant mensuel (DH)</Text>
                <TextField.Root type="number" min="0" step="0.01" value={monthlyDh} onChange={(e) => setMonthlyDh(e.target.value)} />
              </Box>
              <Box>
                <Text as="div" size="2" weight="medium" mb="1">Commandes incluses</Text>
                <TextField.Root type="number" min="0" value={quota} placeholder="illimité" onChange={(e) => setQuota(e.target.value)} />
              </Box>
              <Box>
                <Text as="div" size="2" weight="medium" mb="1">Dépassement (DH/cmd)</Text>
                <TextField.Root type="number" min="0" step="0.01" value={overageDh} placeholder="non facturé"
                  disabled={quota.trim() === ''} onChange={(e) => setOverageDh(e.target.value)} />
              </Box>
            </Grid>
          ) : (
            <>
              <Grid columns="3" gap="3">
                <Box>
                  <Text as="div" size="2" weight="medium" mb="1">Lecture des paliers</Text>
                  <Select.Root value={tierMode} onValueChange={(v) => setTierMode(v as TierMode)}>
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      <Select.Item value="VOLUME">Rétroactif (tout au palier atteint)</Select.Item>
                      <Select.Item value="GRADUE">Par tranche (comme l’impôt)</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </Box>
                <Box>
                  <Text as="div" size="2" weight="medium" mb="1">Facture plancher (DH)</Text>
                  <TextField.Root type="number" min="0" step="0.01" value={minDh} onChange={(e) => setMinDh(e.target.value)} />
                </Box>
                <Box>
                  <Text as="div" size="2" weight="medium" mb="1">Part fixe (DH)</Text>
                  <TextField.Root type="number" min="0" step="0.01" value={baseDh} onChange={(e) => setBaseDh(e.target.value)} />
                </Box>
              </Grid>
              <TierEditor tiers={tiers} onChange={setTiers} error={tierError} />
              <Simulator
                tiers={tiers} tierMode={tierMode}
                minDh={minDh} baseDh={baseDh} disabled={!!tierError}
              />
            </>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!valid} onClick={async () => { if (await onSave(body)) setOpen(false); }}>
            Publier le tarif
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

/* --------------------------------- Éditeur de paliers --------------------------------- */

function TierEditor({ tiers, onChange, error }: {
  tiers: DraftTier[]; onChange: (t: DraftTier[]) => void; error: string | null;
}) {
  /** Fixer une borne haute recale automatiquement le palier suivant : la grille reste contiguë. */
  function setTo(i: number, raw: string) {
    const to = raw.trim() === '' ? null : Number(raw);
    const next = tiers.map((t, k) => (k === i ? { ...t, toQty: to } : t));
    if (to != null && next[i + 1]) next[i + 1] = { ...next[i + 1], fromQty: to + 1 };
    onChange(next);
  }

  function add() {
    const last = tiers[tiers.length - 1];
    const bound = last.toQty ?? last.fromQty + 99;
    onChange([
      ...tiers.slice(0, -1),
      { ...last, toQty: bound },
      { fromQty: bound + 1, toQty: null, unitDh: last.unitDh },
    ]);
  }

  function remove(i: number) {
    const next = tiers.filter((_, k) => k !== i);
    if (!next.length) return;
    next[0] = { ...next[0], fromQty: 1 };
    for (let k = 1; k < next.length; k++) {
      const prev = next[k - 1];
      if (prev.toQty != null) next[k] = { ...next[k], fromQty: prev.toQty + 1 };
    }
    next[next.length - 1] = { ...next[next.length - 1], toQty: null };
    onChange(next);
  }

  return (
    <Box>
      <Flex align="center" justify="between" mb="2">
        <Text size="2" weight="medium">Paliers de volume</Text>
        <Button size="1" variant="soft" onClick={add}><PlusIcon /> Ajouter un palier</Button>
      </Flex>
      <Table.Root size="1" variant="surface">
        <Table.Header><Table.Row>
          <Table.ColumnHeaderCell>De (cmd)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>À (cmd)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Prix unitaire (DH)</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell />
        </Table.Row></Table.Header>
        <Table.Body>
          {tiers.map((t, i) => (
            <Table.Row key={i} align="center">
              <Table.Cell><Text size="2" color="gray">{t.fromQty}</Text></Table.Cell>
              <Table.Cell>
                {i === tiers.length - 1
                  ? <Text size="2" color="gray">et au-delà</Text>
                  : <TextField.Root size="1" type="number" min={t.fromQty} value={t.toQty ?? ''}
                      onChange={(e) => setTo(i, e.target.value)} />}
              </Table.Cell>
              <Table.Cell>
                <TextField.Root
                  size="1" type="number" min="0" step="0.01" value={t.unitDh}
                  onChange={(e) => onChange(tiers.map((x, k) => (k === i ? { ...x, unitDh: e.target.value } : x)))}
                />
              </Table.Cell>
              <Table.Cell>
                {tiers.length > 1 && (
                  <IconButton size="1" variant="ghost" color="red" onClick={() => remove(i)}><TrashIcon /></IconButton>
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      {error && (
        <Callout.Root color="red" size="1" mt="2">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
    </Box>
  );
}

/* ------------------------------------ Simulateur ------------------------------------ */

/** Rend tangible l'écart VOLUME / GRADUE avant de publier le tarif. */
function Simulator({ tiers, tierMode, minDh, baseDh, disabled }: {
  tiers: DraftTier[]; tierMode: TierMode; minDh: string; baseDh: string; disabled: boolean;
}) {
  const [volume, setVolume] = React.useState('600');
  if (disabled) return null;

  const pricing = {
    billingMode: 'USAGE' as const, monthlyCentimes: 0, includedOrders: null, overageCentimes: null,
    baseCentimes: dhToCentimes(Number(baseDh) || 0), tierMode,
    minCentimes: dhToCentimes(Number(minDh) || 0), tiers: toTiers(tiers),
  };
  const n = Math.max(0, Number(volume) || 0);
  const mine = computeBilling(pricing, n, 'Simulation');
  const other = computeBilling({ ...pricing, tierMode: tierMode === 'VOLUME' ? 'GRADUE' : 'VOLUME' }, n, 'Simulation');

  return (
    <Card size="1" variant="surface">
      <Flex align="center" gap="3" wrap="wrap">
        <Text size="2" weight="medium">Simulateur</Text>
        <TextField.Root size="1" type="number" min="0" value={volume} style={{ width: 110 }}
          onChange={(e) => setVolume(e.target.value)} />
        <Text size="2" color="gray">commandes/mois →</Text>
        <Heading size="4">{dh(mine.subtotalCentimes)}</Heading>
        <Text size="1" color="gray">
          (en {tierMode === 'VOLUME' ? 'par tranche' : 'rétroactif'} : {dh(other.subtotalCentimes)})
        </Text>
      </Flex>
    </Card>
  );
}

/* --------------------------------- Historique / archivage --------------------------------- */

function VersionsHistoryDialog({ plan }: { plan: SaasPlanRow }) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<PlanVersionHistoryRow[] | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setRows(null);
    fetch(`/api/proxy/v1/saas/plans/${plan.code}/versions`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [open, plan.code]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}>
          <CounterClockwiseClockIcon /> Historique des tarifs
        </DropdownMenu.Item>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="620px">
        <Dialog.Title>Historique des tarifs — {plan.labelFr}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">
          Chaque version garde ses abonnés : c’est la garantie du prix gelé.
        </Dialog.Description>
        {rows === null ? (
          <Text size="2" color="gray">Chargement…</Text>
        ) : rows.length === 0 ? (
          <Text size="2" color="gray">Aucune version de tarif.</Text>
        ) : (
          <Table.Root size="1" variant="surface">
            <Table.Header><Table.Row>
              <Table.ColumnHeaderCell>Version</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Mode</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Tarif</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Période</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Abonnés</Table.ColumnHeaderCell>
            </Table.Row></Table.Header>
            <Table.Body>
              {rows.map((v) => (
                <Table.Row key={v.id} align="center">
                  <Table.Cell>
                    v{v.version} {v.effectiveTo === null && <Badge color="green" variant="soft">courante</Badge>}
                  </Table.Cell>
                  <Table.Cell>{v.billingMode === 'USAGE' ? 'À l’usage' : 'Forfait'}</Table.Cell>
                  <Table.Cell>{priceLabel(v)}</Table.Cell>
                  <Table.Cell><Text size="1" color="gray">{v.effectiveFrom} → {v.effectiveTo ?? '…'}</Text></Table.Cell>
                  <Table.Cell>{v.subscribers}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Fermer</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ArchiveItem({ plan, onArchive }: { plan: SaasPlanRow; onArchive: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><ArchiveIcon /> Archiver</DropdownMenu.Item>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="420px">
        <AlertDialog.Title>Archiver {plan.labelFr} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Le plan disparaît du catalogue souscriptible. {plan.subscribers > 0
            ? <><strong>{plan.subscribers} organisation(s) y sont abonnées</strong> — l’archivage sera refusé tant qu’elles n’ont pas changé de plan.</>
            : 'Aucun abonné : l’archivage est sans effet de bord.'}
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onArchive}>Archiver</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}
