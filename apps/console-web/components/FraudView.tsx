'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Avatar, Table, Callout,
  Progress, Separator, AlertDialog,
} from '@radix-ui/themes';
import {
  ExclamationTriangleIcon, TokensIcon, ClockIcon, CrossCircledIcon, InfoCircledIcon,
  ChevronRightIcon, Cross2Icon, EyeOpenIcon, CheckIcon, CheckCircledIcon, LockClosedIcon, SewingPinFilledIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import { FRAUD_SIGNALS } from '@transpo/domain';
import type { FraudCase, RiskDriver } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const SIGNAL_COLOR: Record<string, 'red' | 'orange' | 'amber'> = {
  non_declare: 'red', ecart_cash: 'red', hors_geo: 'red', echec_sans_preuve: 'orange', absent_eleve: 'orange', depot_tardif: 'amber',
};
const STATUS_META: Record<string, { label: string; color: 'red' | 'amber' | 'green' | 'gray' }> = {
  OUVERT: { label: 'À examiner', color: 'red' }, ENQUETE: { label: 'Sous enquête', color: 'amber' },
  BLANCHI: { label: 'Blanchi', color: 'green' }, CONFIRME: { label: 'Fraude confirmée', color: 'gray' },
};
const scoreColor = (s: number): 'red' | 'orange' | 'amber' | 'gray' => (s >= 75 ? 'red' : s >= 55 ? 'orange' : s >= 40 ? 'amber' : 'gray');
const sigLabel = (k: string) => (FRAUD_SIGNALS as any)[k]?.label ?? k;
const sigPts = (k: string) => (FRAUD_SIGNALS as any)[k]?.pts ?? 0;
const initials = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const hhmm = (iso: string) => { try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function ScoreBubble({ s, size = 34 }: { s: number; size?: number }) {
  return <Box style={{ width: size, height: size, borderRadius: '50%', background: `var(--${scoreColor(s)}-a3)`, color: `var(--${scoreColor(s)}-11)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size > 40 ? 16 : 12, flex: `0 0 ${size}px` }}>{s}</Box>;
}

export function FraudView({ cases, leaderboard, isAdmin }: { cases: FraudCase[]; leaderboard: RiskDriver[]; isAdmin: boolean }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const detail = sel ? cases.find((c) => c.id === sel) ?? null : null;

  const open = cases.filter((c) => c.status === 'OUVERT' || c.status === 'ENQUETE');
  const atRisk = open.reduce((a, c) => a + c.amount, 0);
  const blanchis = cases.filter((c) => c.status === 'BLANCHI').length;

  async function act(id: string, action: string) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/fraud/cases/${id}/${action}`, { method: 'POST' });
    setBusy(false);
    if (res.ok) router.refresh(); else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader title="Détection de fraude COD" subtitle="Signaux automatiques sur les encaissements à la livraison — arbitrage humain requis" />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Alertes ouvertes" value={String(open.length)} delta="arbitrage requis" deltaColor="red" icon={<ExclamationTriangleIcon width="15" />} accent="red" />
        <KPI label="Montant à risque" value={money(atRisk)} delta="COD suspect" deltaColor="amber" icon={<TokensIcon width="15" />} accent="amber" />
        <KPI label="Cas total" value={String(cases.length)} icon={<ClockIcon width="15" />} accent="gray" />
        <KPI label="Blanchis" value={String(blanchis)} delta="clôturés" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
      </Grid>

      <Callout.Root color="gray" variant="surface" mb="4">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>Le score combine des signaux objectifs (géolocalisation, caisse, preuve). <strong>Aucune sanction n’est automatique</strong> — chaque cas exige une revue.</Callout.Text>
      </Callout.Root>

      <Grid columns={{ initial: '1', lg: sel ? '5' : '3' }} gap="4" style={{ alignItems: 'start' }}>
        <Box style={{ gridColumn: sel ? 'span 3' : 'span 2' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Cas</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Signaux</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Montant</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Score</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {cases.length === 0 && <Table.Row><Table.Cell colSpan={5}><Text size="2" color="gray">Aucune alerte de fraude.</Text></Table.Cell></Table.Row>}
                {cases.map((c) => (
                  <Table.Row key={c.id} align="center" onClick={() => setSel(c.id)} style={{ cursor: 'pointer', background: sel === c.id ? 'var(--indigo-a2)' : undefined }}>
                    <Table.RowHeaderCell><Flex align="center" gap="2"><Avatar size="1" radius="full" fallback={initials(c.driver)} color={scoreColor(c.score)} /><Box><Text as="div" size="2" weight="medium">{c.driver}</Text><Text as="div" size="1" color="gray">{hhmm(c.createdAt)}</Text></Box></Flex></Table.RowHeaderCell>
                    <Table.Cell><Flex gap="1" wrap="wrap">{c.signals.slice(0, 2).map((s) => <Badge key={s} size="1" color={SIGNAL_COLOR[s] ?? 'gray'} variant="soft" radius="full">{sigLabel(s)}</Badge>)}{c.signals.length > 2 && <Badge size="1" variant="soft" color="gray" radius="full">+{c.signals.length - 2}</Badge>}</Flex></Table.Cell>
                    <Table.Cell align="right">{c.amount ? <Text size="2" weight="medium">{money(c.amount)}</Text> : <Text size="1" color="gray">—</Text>}</Table.Cell>
                    <Table.Cell><ScoreBubble s={c.score} /></Table.Cell>
                    <Table.Cell><ChevronRightIcon color="var(--gray-8)" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Box>

        {detail ? (
          <Box style={{ gridColumn: 'span 2' }}>
            <Card size="3">
              <Flex justify="between" align="start" mb="3">
                <Flex align="center" gap="3">
                  <ScoreBubble s={detail.score} size={46} />
                  <Box><Text as="div" size="3" weight="bold">{detail.driver}</Text><Text as="div" size="1" color="gray">{hhmm(detail.createdAt)}</Text></Box>
                </Flex>
                <IconButton size="1" variant="ghost" color="gray" onClick={() => setSel(null)}><Cross2Icon /></IconButton>
              </Flex>
              <Flex gap="2" mb="3" wrap="wrap">
                <Badge color={STATUS_META[detail.status]?.color ?? 'gray'} variant="soft" radius="full">{STATUS_META[detail.status]?.label ?? detail.status}</Badge>
                {detail.amount > 0 && <Badge color="amber" variant="soft" radius="full">COD à risque · {money(detail.amount)}</Badge>}
              </Flex>
              <Card variant="surface" mb="3"><Text size="2">{detail.summary}</Text></Card>

              <Text as="div" size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Signaux détectés</Text>
              <Flex direction="column" gap="2" mb="3">
                {detail.signals.map((s) => (
                  <Flex key={s} align="center" justify="between" p="2" style={{ borderRadius: 'var(--radius-2)', border: '1px solid var(--gray-a4)' }}>
                    <Flex align="center" gap="2"><Box style={{ width: 6, height: 6, borderRadius: '50%', background: `var(--${SIGNAL_COLOR[s] ?? 'gray'}-9)` }} /><Text size="2">{sigLabel(s)}</Text></Flex>
                    <Badge color={SIGNAL_COLOR[s] ?? 'gray'} variant="soft" radius="full">+{sigPts(s)}</Badge>
                  </Flex>
                ))}
                <Flex align="center" justify="between" pt="1"><Text size="2" weight="medium">Score de risque</Text><Text size="3" weight="bold" style={{ color: `var(--${scoreColor(detail.score)}-11)` }}>{detail.score}/100</Text></Flex>
              </Flex>

              {detail.signals.includes('hors_geo') && (
                <Callout.Root color="red" size="1" mb="3"><Callout.Icon><SewingPinFilledIcon /></Callout.Icon><Callout.Text>Point de validation hors de la géofence de l’adresse client.</Callout.Text></Callout.Root>
              )}

              <Separator size="4" mb="3" />

              {detail.status === 'BLANCHI' || detail.status === 'CONFIRME' ? (
                <Callout.Root color={detail.status === 'BLANCHI' ? 'green' : 'gray'} size="1"><Callout.Icon>{detail.status === 'BLANCHI' ? <CheckCircledIcon /> : <LockClosedIcon />}</Callout.Icon><Callout.Text>Dossier clôturé — {STATUS_META[detail.status]?.label.toLowerCase()}.</Callout.Text></Callout.Root>
              ) : isAdmin ? (
                <Flex direction="column" gap="2">
                  <Flex gap="2">
                    <Button size="3" style={{ flex: 1 }} disabled={busy} onClick={() => act(detail.id, 'investigate')}><EyeOpenIcon /> Ouvrir une enquête</Button>
                    <Button size="3" variant="soft" color="green" style={{ flex: 1 }} disabled={busy} onClick={() => act(detail.id, 'clear')}><CheckIcon /> Blanchir</Button>
                  </Flex>
                  <AlertDialog.Root>
                    <AlertDialog.Trigger><Button size="3" variant="soft" color="red" style={{ width: '100%' }} disabled={busy}><LockClosedIcon /> Confirmer la fraude</Button></AlertDialog.Trigger>
                    <AlertDialog.Content maxWidth="460px">
                      <AlertDialog.Title>Confirmer la fraude — {detail.driver}</AlertDialog.Title>
                      <AlertDialog.Description size="2">Le dossier sera marqué « fraude confirmée ». Le montant à risque ({money(detail.amount)}) est retenu en attente de régularisation. Action tracée en audit.</AlertDialog.Description>
                      <Flex gap="3" mt="4" justify="end"><AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel><AlertDialog.Action><Button color="red" onClick={() => act(detail.id, 'confirm')}>Confirmer</Button></AlertDialog.Action></Flex>
                    </AlertDialog.Content>
                  </AlertDialog.Root>
                </Flex>
              ) : <Text size="1" color="gray">Arbitrage réservé à l’administrateur.</Text>}
            </Card>
          </Box>
        ) : (
          <Card size="3">
            <Heading size="4" mb="1">Livreurs à risque</Heading>
            <Text size="1" color="gray" mb="3" as="div">Score composite (cas ouverts)</Text>
            <Flex direction="column" gap="3">
              {leaderboard.length === 0 && <Text size="2" color="gray">Aucun livreur à risque.</Text>}
              {leaderboard.map((d) => (
                <Box key={d.driver}>
                  <Flex align="center" justify="between" mb="1">
                    <Flex align="center" gap="2"><Avatar size="1" radius="full" fallback={initials(d.driver)} color={scoreColor(d.risk)} /><Box><Text as="div" size="2" weight="medium">{d.driver}</Text><Text as="div" size="1" color="gray">{d.cases} cas</Text></Box></Flex>
                    <Badge color={scoreColor(d.risk)} variant="soft" radius="full">{d.risk}</Badge>
                  </Flex>
                  <Progress value={d.risk} color={scoreColor(d.risk)} />
                </Box>
              ))}
            </Flex>
          </Card>
        )}
      </Grid>
    </Box>
  );
}
