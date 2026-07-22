'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, Avatar, Table, Callout, Separator,
  Dialog, Select, TextField,
} from '@radix-ui/themes';
import {
  TokensIcon, CheckCircledIcon, ClockIcon, PersonIcon, DownloadIcon, PaperPlaneIcon, PlusIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { Reversement } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const ini = (n: string) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
const METHOD_LABEL: Record<string, string> = { virement: 'Virement bancaire', especes: 'Espèces', cheque: 'Chèque' };

export function ReversementView({ rows }: { rows: Reversement[] }) {
  const router = useRouter();
  const [selId, setSelId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const sel = selId ? rows.find((r) => r.id === selId) ?? null : null;

  const pending = rows.filter((r) => r.status === 'EN_ATTENTE');
  const paid = rows.filter((r) => r.status === 'VERSE');
  const toPay = pending.reduce((a, r) => a + r.cod, 0);
  const paidAmount = paid.reduce((a, r) => a + r.cod, 0);
  const total = rows.reduce((a, r) => a + r.cod, 0);

  async function post(path: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/${path}`, {
      method: 'POST',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (res.ok) router.refresh();
    else { const d = await res.json().catch(() => null); alert(d?.error ?? 'Action impossible'); }
    return res.ok;
  }

  function exportCsv() {
    const head = ['Marchand', 'Periode', 'Commandes', 'COD a reverser', 'Statut', 'Methode', 'Reference'];
    const lines = rows.map((r) => [r.merchant, r.period, r.orders, r.cod, r.status, r.method ?? '', r.reference ?? ''].join(';'));
    const url = URL.createObjectURL(new Blob([[head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'reversements-cod.csv'; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeader
        title="Reversement COD"
        subtitle="Cash COD encaissé pour le compte des marchands, à leur reverser"
        actions={
          <Flex gap="2">
            <Button variant="soft" color="gray" onClick={exportCsv}><DownloadIcon /> Export CSV</Button>
            <Button disabled={busy} onClick={() => post('cash/reversements/generate', { period: '2026-07' })}><PlusIcon /> Générer</Button>
          </Flex>
        }
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="À reverser" value={money(toPay)} delta={`${pending.length} marchand${pending.length > 1 ? 's' : ''}`} deltaColor="amber" icon={<TokensIcon width="15" />} accent="amber" />
        <KPI label="Reversé" value={money(paidAmount)} delta={`${paid.length} versé${paid.length > 1 ? 's' : ''}`} deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En attente" value={String(pending.length)} icon={<ClockIcon width="15" />} accent="indigo" />
        <KPI label="COD total" value={money(total)} icon={<TokensIcon width="15" />} accent="gray" />
      </Grid>

      {pending.length > 0 && (
        <Callout.Root color="amber" mb="4">
          <Callout.Icon><ClockIcon /></Callout.Icon>
          <Callout.Text><strong>{money(toPay)}</strong> à reverser à {pending.length} marchand(s). Effectuez les virements puis marquez-les comme versés.</Callout.Text>
        </Callout.Root>
      )}

      <Grid columns={{ initial: '1', md: sel ? '5' : '1' }} gap="4">
        <Box style={{ gridColumn: sel ? 'span 3' : 'auto' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Commandes</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">COD à reverser</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {rows.map((r) => (
                  <Table.Row key={r.id} align="center" onClick={() => setSelId(r.id)}
                    style={{ cursor: 'pointer', background: sel?.id === r.id ? 'var(--indigo-a2)' : undefined }}>
                    <Table.RowHeaderCell>
                      <Flex align="center" gap="2">
                        <Avatar size="1" radius="full" fallback={ini(r.merchant)} color="indigo" />
                        <Text size="2" weight="medium">{r.merchant}</Text>
                      </Flex>
                    </Table.RowHeaderCell>
                    <Table.Cell align="right"><Text size="2" color="gray">{r.orders}</Text></Table.Cell>
                    <Table.Cell align="right"><Text size="2" weight="medium">{money(r.cod)}</Text></Table.Cell>
                    <Table.Cell>
                      {r.status === 'VERSE'
                        ? <Badge color="green" variant="soft" radius="full">Versé</Badge>
                        : <Badge color="amber" variant="soft" radius="full">En attente</Badge>}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            {rows.length === 0 && <Box p="4"><Text size="2" color="gray">Aucun reversement. Cliquez « Générer ».</Text></Box>}
          </Card>
        </Box>

        {sel && (
          <Box style={{ gridColumn: 'span 2' }}>
            <Card size="3">
              <Flex justify="between" align="center" mb="3">
                <Flex align="center" gap="2">
                  <Avatar size="2" radius="full" fallback={ini(sel.merchant)} color="indigo" />
                  <Box><Text as="div" size="2" weight="bold">{sel.merchant}</Text>
                    <Text as="div" size="1" color="gray">Période {sel.period} · {sel.orders} commandes</Text></Box>
                </Flex>
                {sel.status === 'VERSE'
                  ? <Badge color="green" variant="soft">Versé</Badge>
                  : <Badge color="amber" variant="soft">En attente</Badge>}
              </Flex>

              <Card variant="surface" mb="3">
                <Flex direction="column" gap="2">
                  <Flex justify="between"><Text size="2" color="gray">COD encaissé</Text><Text size="2" weight="medium">{money(sel.cod)}</Text></Flex>
                  <Separator size="4" />
                  <Flex justify="between" align="center">
                    <Text size="3" weight="bold">Net à reverser</Text>
                    <Heading size="5">{money(sel.cod)}</Heading>
                  </Flex>
                </Flex>
              </Card>

              {sel.status === 'VERSE' ? (
                <Callout.Root color="green" size="1">
                  <Callout.Icon><CheckCircledIcon /></Callout.Icon>
                  <Callout.Text>
                    Reversé par {METHOD_LABEL[sel.method || ''] || sel.method || '—'}
                    {sel.reference ? ` · réf. ${sel.reference}` : ''}
                    {sel.paidAt ? ` · ${new Date(sel.paidAt).toLocaleDateString('fr-FR')}` : ''}.
                  </Callout.Text>
                </Callout.Root>
              ) : (
                <PayDialog reversement={sel} onPay={(method, reference) => post(`cash/reversements/${sel.id}/pay`, { method, reference })} busy={busy} />
              )}
            </Card>
          </Box>
        )}
      </Grid>
    </>
  );
}

function PayDialog({ reversement, onPay, busy }: {
  reversement: Reversement; onPay: (method: string, reference: string) => void; busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [method, setMethod] = React.useState('virement');
  const [reference, setReference] = React.useState('');
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button size="3" color="green" style={{ width: '100%' }}><PaperPlaneIcon /> Marquer comme versé · {money(reversement.cod)}</Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Reverser à {reversement.merchant}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Confirmez le reversement de {money(reversement.cod)} au marchand.</Dialog.Description>
        <Text as="div" size="2" weight="medium" mb="2">Méthode</Text>
        <Select.Root value={method} onValueChange={setMethod} size="2">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="virement">Virement bancaire</Select.Item>
            <Select.Item value="especes">Espèces</Select.Item>
            <Select.Item value="cheque">Chèque</Select.Item>
          </Select.Content>
        </Select.Root>
        <Box mt="3"><Text as="div" size="2" weight="medium" mb="2">Référence de paiement (optionnel)</Text>
          <TextField.Root placeholder="ex. VIR-2026-07-0042" value={reference} onChange={(e) => setReference(e.target.value)} /></Box>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button color="green" disabled={busy} onClick={() => { onPay(method, reference); setOpen(false); }}>Confirmer le reversement</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
