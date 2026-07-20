'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Table, Tabs, Callout, Separator,
} from '@radix-ui/themes';
import {
  ExclamationTriangleIcon, UpdateIcon, ResetIcon, ClockIcon, CubeIcon, ChevronRightIcon,
  Cross2Icon, CheckIcon, CheckCircledIcon, InfoCircledIcon, DotFilledIcon, DownloadIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import { PageHeader, KPI } from './ui';

export type Ret = { ref: string; reason: string; attempts: number; status: string; merchant: string | null; city: string; cod: number };
const MAX = 3;
const RET: Record<string, { label: string; color: 'red' | 'amber' | 'violet' | 'orange' | 'green' | 'gray' }> = {
  A_TRAITER: { label: 'À traiter', color: 'red' },
  REPLANIFIE: { label: 'Reprogrammée', color: 'amber' },
  RENDU: { label: 'Rendu au marchand', color: 'green' },
};
function RetBadge({ s }: { s: string }) { const c = RET[s] ?? { label: s, color: 'gray' as const }; return <Badge color={c.color} variant="soft" radius="full">{c.label}</Badge>; }

export function ReturnsView({ returns, canWrite }: { returns: Ret[]; canWrite: boolean }) {
  const router = useRouter();
  const [sel, setSel] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState('actifs');
  const [busy, setBusy] = React.useState(false);

  const aTraiter = returns.filter((r) => r.status === 'A_TRAITER');
  const reprog = returns.filter((r) => r.status === 'REPLANIFIE');
  const rendus = returns.filter((r) => r.status === 'RENDU');
  const codBloque = returns.filter((r) => r.status !== 'RENDU').reduce((a, r) => a + r.cod, 0);
  const list = (tab === 'actifs' ? returns.filter((r) => r.status !== 'RENDU') : rendus);
  const detail = sel ? returns.find((r) => r.ref === sel) ?? null : null;

  async function act(ref: string, action: string) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/returns/${encodeURIComponent(ref)}/${action}`, { method: 'POST' });
    setBusy(false);
    if (res.ok) router.refresh(); else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
  }

  return (
    <Box style={{ maxWidth: 1300, margin: '0 auto' }}>
      <PageHeader title="Gestion des retours" subtitle="Livraisons échouées et flux retour — réintégration, reprogrammation, restitution" />

      <Grid columns={{ initial: '2', md: '5' }} gap="3" mb="4">
        <KPI label="À traiter" value={String(aTraiter.length)} delta="décision requise" deltaColor="red" icon={<ExclamationTriangleIcon width="15" />} accent="red" />
        <KPI label="Reprogrammées" value={String(reprog.length)} delta="nouvelle tentative" deltaColor="amber" icon={<UpdateIcon width="15" />} accent="amber" />
        <KPI label="Rendus" value={String(rendus.length)} icon={<ResetIcon width="15" />} accent="green" />
        <KPI label="Total retours" value={String(returns.length)} icon={<ClockIcon width="15" />} accent="gray" />
        <KPI label="COD bloqué" value={money(codBloque)} delta="non encaissé" deltaColor="amber" icon={<CubeIcon width="15" />} accent="amber" />
      </Grid>

      {aTraiter.length > 0 && (
        <Callout.Root color="red" mb="4"><Callout.Icon><ExclamationTriangleIcon /></Callout.Icon><Callout.Text><strong>{aTraiter.length} retour(s) en attente de décision.</strong> Reprogrammer une tentative ou lancer le retour au marchand.</Callout.Text></Callout.Root>
      )}

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List>
          <Tabs.Trigger value="actifs">Retours actifs</Tabs.Trigger>
          <Tabs.Trigger value="clos">Clôturés</Tabs.Trigger>
        </Tabs.List>
      </Tabs.Root>

      <Grid columns={{ initial: '1', md: sel ? '5' : '1' }} gap="4" mt="3">
        <Box style={{ gridColumn: sel ? 'span 3' : 'auto' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Commande</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Motif</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Tentatives</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">COD</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell></Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {list.length === 0 && <Table.Row><Table.Cell colSpan={6}><Text size="2" color="gray">Aucun retour.</Text></Table.Cell></Table.Row>}
                {list.map((r) => (
                  <Table.Row key={r.ref} align="center" onClick={() => setSel(r.ref)} style={{ cursor: 'pointer', background: sel === r.ref ? 'var(--indigo-a2)' : undefined }}>
                    <Table.RowHeaderCell><Text as="div" size="2" weight="medium">{r.ref}</Text><Text as="div" size="1" color="gray">{r.merchant} · {r.city}</Text></Table.RowHeaderCell>
                    <Table.Cell><Text size="2" color="gray">{r.reason}</Text></Table.Cell>
                    <Table.Cell><Badge color={r.attempts >= MAX ? 'red' : 'gray'} variant="soft" radius="full">{r.attempts}/{MAX}</Badge></Table.Cell>
                    <Table.Cell align="right">{r.cod ? <Badge color="amber" variant="soft" radius="full">{money(r.cod)}</Badge> : <Text size="1" color="gray">—</Text>}</Table.Cell>
                    <Table.Cell><RetBadge s={r.status} /></Table.Cell>
                    <Table.Cell><ChevronRightIcon color="var(--gray-8)" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card>
        </Box>

        {detail && (
          <Box style={{ gridColumn: 'span 2' }}>
            <Card size="3">
              <Flex justify="between" align="center" mb="3">
                <Box><Text as="div" size="2" weight="bold">{detail.ref}</Text><Text as="div" size="1" color="gray">{detail.merchant} · {detail.city}</Text></Box>
                <IconButton size="1" variant="ghost" color="gray" onClick={() => setSel(null)}><Cross2Icon /></IconButton>
              </Flex>
              <Flex gap="2" wrap="wrap" mb="3"><RetBadge s={detail.status} /><Badge color={detail.attempts >= MAX ? 'red' : 'gray'} variant="soft" radius="full">{detail.attempts}/{MAX} tentatives</Badge>{detail.cod > 0 && <Badge color="amber" variant="soft" radius="full">COD bloqué · {money(detail.cod)}</Badge>}</Flex>
              <Card variant="surface" mb="3"><Text as="div" size="1" color="gray" weight="medium" mb="1">Motif de l’échec</Text><Text size="2">{detail.reason}</Text></Card>

              <Box mb="3">
                <Text as="div" size="1" color="gray" weight="medium" mb="2" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>Flux retour</Text>
                {[
                  { s: 'Échec de livraison', at: detail.reason, done: true },
                  { s: 'Retour au hub', at: 'Hub de rattachement', done: detail.status === 'RENDU' || detail.status === 'REPLANIFIE' },
                  { s: 'Restitution marchand', at: detail.merchant ?? '—', done: detail.status === 'RENDU' },
                ].map((st, i, arr) => (
                  <Flex key={i} gap="3">
                    <Flex direction="column" align="center">
                      <Flex align="center" justify="center" style={{ width: 24, height: 24, borderRadius: '50%', background: st.done ? 'var(--violet-9)' : 'var(--gray-a4)', color: st.done ? 'white' : 'var(--gray-9)', flex: '0 0 24px' }}>{st.done ? <CheckIcon width="13" /> : <DotFilledIcon />}</Flex>
                      {i < arr.length - 1 && <Box style={{ width: 2, flex: 1, minHeight: 22, background: st.done && arr[i + 1].done ? 'var(--violet-9)' : 'var(--gray-a4)' }} />}
                    </Flex>
                    <Box pb="3"><Text as="div" size="2" weight={st.done ? 'medium' : 'regular'} color={st.done ? undefined : 'gray'}>{st.s}</Text><Text as="div" size="1" color="gray">{st.at}</Text></Box>
                  </Flex>
                ))}
              </Box>
              <Separator size="4" mb="3" />

              {detail.status === 'RENDU' ? (
                <Callout.Root color="green" size="1"><Callout.Icon><CheckCircledIcon /></Callout.Icon><Callout.Text>Colis restitué au marchand.</Callout.Text></Callout.Root>
              ) : canWrite ? (
                <Flex direction="column" gap="2">
                  {detail.attempts < MAX
                    ? <Button size="3" color="amber" style={{ width: '100%' }} disabled={busy} onClick={() => act(detail.ref, 'reschedule')}><UpdateIcon /> Reprogrammer une tentative ({detail.attempts + 1}/{MAX})</Button>
                    : <Callout.Root color="red" size="1"><Callout.Icon><InfoCircledIcon /></Callout.Icon><Callout.Text>Plafond de tentatives atteint — reprogrammation impossible.</Callout.Text></Callout.Root>}
                  <Button size="3" color="orange" variant="soft" style={{ width: '100%' }} disabled={busy} onClick={() => act(detail.ref, 'return-to-merchant')}><ResetIcon /> Lancer le retour au marchand</Button>
                </Flex>
              ) : <Text size="1" color="gray">Lecture seule.</Text>}
            </Card>
          </Box>
        )}
      </Grid>
    </Box>
  );
}
