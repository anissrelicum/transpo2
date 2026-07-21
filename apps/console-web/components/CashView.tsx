'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Avatar, Table, Callout,
  Separator, Dialog, RadioGroup, TextArea, Tooltip,
} from '@radix-ui/themes';
import {
  ExclamationTriangleIcon, TokensIcon, ClockIcon, CheckCircledIcon, CheckIcon,
  ChevronRightIcon, Cross2Icon, DownloadIcon, BackpackIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { CashSession } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const STATUS_META: Record<string, { label: string; color: 'green' | 'red' | 'amber' | 'blue' | 'gray' }> = {
  DEPOSE: { label: 'Déposé', color: 'blue' },
  A_DEPOSER: { label: 'À déposer', color: 'amber' },
  ECART: { label: 'Écart', color: 'red' },
  EN_COURS: { label: 'En cours', color: 'gray' },
};
function StatusBadge({ s }: { s: string }) {
  const m = STATUS_META[s] ?? { label: s, color: 'gray' as const };
  return <Badge color={m.color} variant="soft" radius="full">{m.label}</Badge>;
}

const RESOLVE_REASONS = [
  'Monnaie rendue non enregistrée',
  'Client a payé partiellement',
  'Erreur de saisie du montant',
  'Cash manquant — à retenir sur prime',
  'Autre motif',
];

export function CashView({ sessions }: { sessions: CashSession[] }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string | null>(null);
  const detail = sel ? sessions.find((s) => s.id === sel) ?? null : null;

  // KPIs — tout calculé à partir des sessions renvoyées par l'API.
  const inCirculation = sessions.filter((s) => s.status !== 'DEPOSE')
    .reduce((a, s) => a + (s.declared ?? s.theorique), 0);
  const aDeposerRows = sessions.filter((s) => s.status === 'A_DEPOSER');
  const aDeposer = aDeposerRows.reduce((a, s) => a + (s.declared ?? 0), 0);
  const ecartRows = sessions.filter((s) => s.status === 'ECART');
  const ecarts = ecartRows.reduce((a, s) => a + (s.ecart ?? 0), 0);
  const deposeRows = sessions.filter((s) => s.status === 'DEPOSE');
  const depose = deposeRows.reduce((a, s) => a + s.deposited, 0);

  const exportComptable = () => {
    const head = ['Livreur', 'Date', 'Theorique', 'Declare', 'Depose', 'Ecart', 'Livraisons', 'Statut'];
    const lines = sessions.map((s) => [
      s.driver, s.date, s.theorique, s.declared ?? '', s.deposited, s.ecart ?? '', s.deliveries, s.status,
    ].join(';'));
    const csv = [head.join(';'), ...lines].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'reconciliation-cash.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Réconciliation cash"
        subtitle="Rapprochement COD encaissé ↔ déclaré ↔ déposé"
        actions={<Button variant="soft" color="gray" onClick={exportComptable}><DownloadIcon /> Export comptable</Button>}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Cash en circulation" value={money(inCirculation)} icon={<TokensIcon width="15" />} accent="amber" />
        <KPI label="À déposer" value={money(aDeposer)}
          delta={`${aDeposerRows.length} livreur${aDeposerRows.length > 1 ? 's' : ''}`} deltaColor="amber"
          icon={<BackpackIcon width="15" />} accent="amber" />
        <KPI label="Écarts du jour" value={money(ecarts)}
          delta={`${ecartRows.length} session${ecartRows.length > 1 ? 's' : ''}`} deltaColor="red"
          icon={<ExclamationTriangleIcon width="15" />} accent="red" />
        <KPI label="Déposé" value={money(depose)}
          delta={`${deposeRows.length} livreur${deposeRows.length > 1 ? 's' : ''}`} deltaColor="green"
          icon={<CheckCircledIcon width="15" />} accent="green" />
      </Grid>

      {ecartRows.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>Écart de {money(ecarts)}</strong> sur {ecartRows.length === 1 ? 'la session de ' : `${ecartRows.length} sessions (`}
            {ecartRows.map((s) => s.driver).join(', ')}{ecartRows.length === 1 ? '' : ')'} : cash déclaré inférieur au COD théorique. Rapprochement requis avant clôture.
          </Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', md: sel ? '5' : '1' }} gap="4">
        <Box style={{ gridColumn: sel ? 'span 3' : 'auto' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Livreur</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Théorique</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Déclaré</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Écart</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell />
              </Table.Row></Table.Header>
              <Table.Body>
                {sessions.map((s) => (
                  <Table.Row key={s.id} align="center" onClick={() => setSel(s.id)}
                    style={{ cursor: 'pointer', background: sel === s.id ? 'var(--indigo-a2)' : undefined }}>
                    <Table.RowHeaderCell>
                      <Flex align="center" gap="2">
                        <Avatar size="1" radius="full" fallback={s.ini} color="indigo" />
                        <Box><Text as="div" size="2" weight="medium">{s.driver}</Text>
                          <Text as="div" size="1" color="gray">{s.deliveries} livraisons</Text></Box>
                      </Flex>
                    </Table.RowHeaderCell>
                    <Table.Cell align="right"><Text size="2">{money(s.theorique)}</Text></Table.Cell>
                    <Table.Cell align="right">
                      {s.declared == null ? <Text size="1" color="gray">en cours</Text> : <Text size="2">{money(s.declared)}</Text>}
                    </Table.Cell>
                    <Table.Cell align="right">
                      {s.ecart == null ? <Text size="1" color="gray">—</Text>
                        : s.ecart === 0 ? <Text size="2" color="green">0,00 DH</Text>
                          : <Text size="2" weight="bold" color="red">−{money(s.ecart)}</Text>}
                    </Table.Cell>
                    <Table.Cell><StatusBadge s={s.status} /></Table.Cell>
                    <Table.Cell><ChevronRightIcon color="var(--gray-8)" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            {sessions.length === 0 && <Box p="4"><Text size="2" color="gray">Aucune session de caisse aujourd’hui.</Text></Box>}
          </Card>
        </Box>

        {detail && (
          <Box style={{ gridColumn: 'span 2' }}>
            <SessionDetail session={detail} onClose={() => setSel(null)} router={router} />
          </Box>
        )}
      </Grid>
    </>
  );
}

function SessionDetail({ session, onClose, router }: {
  session: CashSession; onClose: () => void; router: ReturnType<typeof useRouter>;
}) {
  const [busy, setBusy] = React.useState(false);
  const ecart = session.ecart;

  async function deposit() {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/cash/sessions/${session.id}/deposit`, { method: 'POST' });
    setBusy(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  return (
    <Card size="3">
      <Flex justify="between" align="center" mb="3">
        <Flex align="center" gap="2">
          <Avatar size="2" radius="full" fallback={session.ini} color="indigo" />
          <Box><Text as="div" size="2" weight="bold">{session.driver}</Text>
            <Text as="div" size="1" color="gray">Session {session.date}</Text></Box>
        </Flex>
        <IconButton size="1" variant="ghost" color="gray" onClick={onClose}><Cross2Icon /></IconButton>
      </Flex>

      <Card variant="surface" mb="3">
        <Flex direction="column" gap="2">
          <Flex justify="between"><Text size="2" color="gray">COD théorique (livré)</Text><Text size="2" weight="medium">{money(session.theorique)}</Text></Flex>
          <Flex justify="between"><Text size="2" color="gray">Cash déclaré</Text><Text size="2" weight="medium">{session.declared == null ? '—' : money(session.declared)}</Text></Flex>
          {session.status === 'DEPOSE' && (
            <Flex justify="between"><Text size="2" color="gray">Déposé en agence</Text><Text size="2" weight="medium">{money(session.deposited)}</Text></Flex>
          )}
          <Separator size="4" />
          <Flex justify="between" align="center">
            <Text size="2" weight="bold">Écart</Text>
            {ecart == null ? <Text size="2" color="gray">—</Text>
              : ecart === 0 ? <Badge color="green" variant="soft"><CheckIcon width="12" /> Équilibré</Badge>
                : <Text size="4" weight="bold" color="red">−{money(ecart)}</Text>}
          </Flex>
        </Flex>
      </Card>

      {ecart != null && ecart !== 0 && session.moves.length > 0 && (
        <Box mb="3">
          <Text as="div" size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>COD encaissés</Text>
          <Flex direction="column" gap="1">
            {session.moves.map((m) => (
              <Flex key={m.ref} align="center" justify="between" p="2" style={{
                borderRadius: 'var(--radius-2)',
                background: m.matched ? 'transparent' : 'var(--red-a2)',
                border: m.matched ? '1px solid var(--gray-a3)' : '1px solid var(--red-a5)',
              }}>
                <Box style={{ minWidth: 0 }}>
                  <Text as="div" size="2">{m.recipient}</Text>
                  <Text as="div" size="1" color="gray">{m.ref}</Text>
                </Box>
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium">{money(m.amount)}</Text>
                  {m.matched ? <CheckCircledIcon color="var(--green-9)" />
                    : <Tooltip content="Non retrouvé dans le cash déclaré"><ExclamationTriangleIcon color="var(--red-9)" /></Tooltip>}
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Box>
      )}

      {session.status === 'ECART'
        ? <ResolveDialog session={session} ecart={ecart ?? 0} router={router} />
        : session.status === 'A_DEPOSER'
          ? <Button size="3" color="green" style={{ width: '100%' }} disabled={busy} onClick={deposit}>
              <BackpackIcon /> Enregistrer le dépôt en agence
            </Button>
          : session.status === 'DEPOSE'
            ? <Callout.Root color="green" size="1">
                <Callout.Icon><CheckCircledIcon /></Callout.Icon>
                <Callout.Text>Session clôturée · {money(session.deposited)} déposés en agence.{session.reason ? ` Écart résolu : ${session.reason.toLowerCase()}.` : ''}</Callout.Text>
              </Callout.Root>
            : <Callout.Root color="gray" variant="surface" size="1">
                <Callout.Icon><ClockIcon /></Callout.Icon>
                <Callout.Text>Tournée en cours — clôture à la fin du shift.</Callout.Text>
              </Callout.Root>}
    </Card>
  );
}

function ResolveDialog({ session, ecart, router }: {
  session: CashSession; ecart: number; router: ReturnType<typeof useRouter>;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState(RESOLVE_REASONS[0]);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/cash/sessions/${session.id}/resolve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason, note: note || undefined }),
    });
    setBusy(false);
    if (res.ok) { setOpen(false); router.refresh(); }
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button size="3" color="red" style={{ width: '100%' }}><ExclamationTriangleIcon /> Résoudre l’écart de {money(ecart)}</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Résoudre l’écart — {session.driver}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Écart de {money(ecart)} entre le COD théorique et le cash déclaré.</Dialog.Description>
        <Text as="div" size="2" weight="medium" mb="2">Motif de l’écart</Text>
        <RadioGroup.Root value={reason} onValueChange={setReason}>
          <Flex direction="column" gap="2">
            {RESOLVE_REASONS.map((r) => (
              <Card key={r} size="1" style={{ border: '1px solid var(--gray-a3)' }}>
                <Flex align="center" gap="3" py="1"><RadioGroup.Item value={r} /><Text size="2">{r}</Text></Flex>
              </Card>
            ))}
          </Flex>
        </RadioGroup.Root>
        <Box mt="3">
          <Text as="div" size="2" weight="medium" mb="2">Note</Text>
          <TextArea placeholder="Précisez le contexte de l’écart…" value={note} onChange={(e) => setNote(e.target.value)} />
        </Box>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button color="red" disabled={busy} onClick={submit}>Valider la résolution</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
