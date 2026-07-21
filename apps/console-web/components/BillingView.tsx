'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, Avatar, Table, Callout, Separator,
  Dialog, Select, TextField, TextArea, Code, SegmentedControl, DropdownMenu, Tooltip,
} from '@radix-ui/themes';
import {
  FileTextIcon, TokensIcon, CheckCircledIcon, ExclamationTriangleIcon, DownloadIcon,
  PlusIcon, ChevronDownIcon, PaperPlaneIcon, EyeOpenIcon, PersonIcon, InfoCircledIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import type { Invoice, BillingMode } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const STATUS_LABEL: Record<string, string> = { BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PAYEE: 'Payée', LITIGE: 'En litige' };
const badgeColor = (c: string) => (['gray', 'blue', 'green', 'red', 'amber', 'indigo'].includes(c) ? c : 'gray') as any;

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return <Flex justify="between"><Text size="2" color="gray">{label}</Text><Text size="2" color={muted ? 'gray' : undefined}>{value}</Text></Flex>;
}

export function BillingView({ invoices, modes }: { invoices: Invoice[]; modes: BillingMode[] }) {
  const router = useRouter();
  const [selId, setSelId] = React.useState<string | null>(invoices[0]?.id ?? null);
  const [busy, setBusy] = React.useState(false);
  const sel = invoices.find((i) => i.id === selId) ?? invoices[0] ?? null;

  const billed = invoices.reduce((a, i) => a + i.netHt, 0);
  const codCollected = invoices.reduce((a, i) => a + i.codCollected, 0);
  const commission = invoices.reduce((a, i) => a + i.commission, 0);
  const disputes = invoices.filter((i) => i.status === 'LITIGE');
  const disputeAmount = disputes.reduce((a, i) => a + i.netHt, 0);

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
    const head = ['Facture', 'Marchand', 'Periode', 'Commandes', 'Montant livraisons', 'COD collecte', 'Commission', 'Net HT', 'TVA', 'TTC', 'Statut'];
    const lines = invoices.map((i) => [i.ref, i.merchant, i.period, i.orders, i.deliveries, i.codCollected, i.commission, i.netHt, i.tva, i.ttc, STATUS_LABEL[i.status]].join(';'));
    const url = URL.createObjectURL(new Blob([[head.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'factures.csv'; a.click(); URL.revokeObjectURL(url);
  }

  function openPdf(inv: Invoice) {
    const html = `<!doctype html><meta charset="utf-8"><title>${inv.ref}</title>
      <body style="font-family:system-ui;max-width:640px;margin:40px auto;color:#111">
      <h1 style="margin:0">Facture ${inv.ref}</h1>
      <p style="color:#666">${inv.merchant} · ${inv.orders} commandes · période ${inv.period}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:24px">
        <tr><td style="padding:8px 0">Montant livraisons</td><td style="text-align:right">${money(inv.deliveries)}</td></tr>
        <tr><td style="padding:8px 0;color:#666">COD collecté (reversé)</td><td style="text-align:right;color:#666">${money(inv.codCollected)}</td></tr>
        <tr><td style="padding:8px 0">Commission (15 %)</td><td style="text-align:right">−${money(inv.commission)}</td></tr>
        <tr style="border-top:1px solid #ddd"><td style="padding:8px 0"><b>Net HT</b></td><td style="text-align:right"><b>${money(inv.netHt)}</b></td></tr>
        <tr><td style="padding:8px 0;color:#666">TVA 20 %</td><td style="text-align:right;color:#666">${money(inv.tva)}</td></tr>
        <tr style="border-top:2px solid #111"><td style="padding:12px 0;font-size:18px"><b>Total TTC</b></td><td style="text-align:right;font-size:18px"><b>${money(inv.ttc)}</b></td></tr>
      </table>
      <p style="margin-top:32px;color:#888;font-size:13px">Transpo · Facturation du service de livraison · Statut : ${STATUS_LABEL[inv.status]}</p>
      <script>print()</script></body>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <>
      <PageHeader
        title="Factures"
        subtitle="Facturation du service de livraison · commission 15 % + TVA 20 %"
        actions={
          <Flex gap="2">
            <Button variant="soft" color="gray" onClick={exportCsv}><DownloadIcon /> Export CSV</Button>
            <Button disabled={busy} onClick={() => post('invoices/generate', { period: '2026-07' })}><PlusIcon /> Générer les factures</Button>
          </Flex>
        }
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Facturé (net HT)" value={money(billed)} icon={<FileTextIcon width="15" />} accent="indigo" />
        <KPI label="COD collecté" value={money(codCollected)} icon={<TokensIcon width="15" />} accent="amber" />
        <KPI label="Commission" value={money(commission)} delta="15 %" deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En litige" value={String(disputes.length)} delta={money(disputeAmount)} deltaColor="red" icon={<ExclamationTriangleIcon width="15" />} accent="red" />
      </Grid>

      {modes.length > 0 && <MerchantBillingCard modes={modes} onSet={(m, mode) => post('invoices/billing-modes', { merchant: m, mode })} busy={busy} />}

      <Grid columns={{ initial: '1', md: sel ? '5' : '1' }} gap="4">
        <Box style={{ gridColumn: sel ? 'span 3' : 'auto' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Facture</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Marchand</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell align="right">Net HT</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
              </Table.Row></Table.Header>
              <Table.Body>
                {invoices.map((inv) => (
                  <Table.Row key={inv.id} align="center" onClick={() => setSelId(inv.id)}
                    style={{ cursor: 'pointer', background: sel?.id === inv.id ? 'var(--indigo-a2)' : undefined }}>
                    <Table.RowHeaderCell><Code variant="ghost" size="2">{inv.ref}</Code></Table.RowHeaderCell>
                    <Table.Cell><Text size="2">{inv.merchant}</Text></Table.Cell>
                    <Table.Cell align="right"><Text size="2" weight="medium">{money(inv.netHt)}</Text></Table.Cell>
                    <Table.Cell><Badge color={badgeColor(inv.color)} variant="soft">{STATUS_LABEL[inv.status]}</Badge></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            {invoices.length === 0 && <Box p="4"><Text size="2" color="gray">Aucune facture. Cliquez « Générer les factures ».</Text></Box>}
          </Card>
        </Box>

        {sel && (
          <Box style={{ gridColumn: 'span 2' }}>
            <Card size="3">
              <Flex justify="between" align="center" mb="1">
                <Heading size="4">{sel.ref}</Heading>
                <Badge color={badgeColor(sel.color)} variant="soft">{STATUS_LABEL[sel.status]}</Badge>
              </Flex>
              <Text as="div" size="1" color="gray" mb="3">{sel.merchant} · {sel.orders} commandes</Text>
              <Flex direction="column" gap="2">
                <Row label="Montant livraisons" value={money(sel.deliveries)} />
                <Row label="COD collecté" value={money(sel.codCollected)} muted />
                <Row label="Commission (15 %)" value={'−' + money(sel.commission)} />
                <Separator size="4" />
                <Flex justify="between"><Text size="2" weight="medium">Net HT</Text><Text size="2" weight="medium">{money(sel.netHt)}</Text></Flex>
                <Row label="TVA 20 %" value={money(sel.tva)} muted />
                <Separator size="4" />
                <Flex justify="between" align="center"><Text size="3" weight="bold">Total TTC</Text><Heading size="5">{money(sel.ttc)}</Heading></Flex>
              </Flex>
              <Separator size="4" my="3" />
              {sel.status === 'LITIGE' ? (
                <Flex direction="column" gap="2">
                  <Callout.Root color="red" size="1">
                    <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
                    <Callout.Text>{sel.disputeNote || `Litige ouvert : écart de reversement contesté${sel.disputeAmount ? ` (${money(sel.disputeAmount)})` : ''}.`}</Callout.Text>
                  </Callout.Root>
                  <Flex gap="2">
                    <Button size="2" variant="soft" style={{ flex: 1 }} onClick={() => openPdf(sel)}><EyeOpenIcon /> Revoir</Button>
                    <ResolveDialog invoice={sel} onResolve={(decision) => post(`invoices/${sel.id}/resolve`, { decision })} busy={busy} />
                  </Flex>
                </Flex>
              ) : (
                <Flex gap="2">
                  <Button size="2" variant="soft" color="gray" style={{ flex: 1 }} onClick={() => openPdf(sel)}><DownloadIcon /> PDF</Button>
                  {sel.status === 'BROUILLON'
                    ? <Button size="2" style={{ flex: 1 }} disabled={busy} onClick={() => post(`invoices/${sel.id}/send`)}><PaperPlaneIcon /> Envoyer</Button>
                    : sel.status === 'ENVOYEE'
                      ? <Flex gap="2" style={{ flex: 1 }}>
                          <Button size="2" color="green" style={{ flex: 1 }} disabled={busy} onClick={() => post(`invoices/${sel.id}/pay`)}>Marquer payée</Button>
                          <DisputeDialog invoice={sel} onDispute={(amount, note) => post(`invoices/${sel.id}/dispute`, { amount, note })} busy={busy} />
                        </Flex>
                      : <Badge color="green" variant="soft" style={{ flex: 1, justifyContent: 'center', padding: '8px' }}><CheckCircledIcon /> Réglée</Badge>}
                </Flex>
              )}
            </Card>
          </Box>
        )}
      </Grid>
    </>
  );
}

function MerchantBillingCard({ modes, onSet, busy }: {
  modes: BillingMode[]; onSet: (merchant: string, mode: string) => void; busy: boolean;
}) {
  return (
    <Card size="2" mb="4">
      <Flex justify="between" align="center" mb="3">
        <Box>
          <Heading size="4">Mode de facturation par marchand</Heading>
          <Text size="1" color="gray">Prépayé = le marchand règle la livraison d’avance · Postpayé = facturé en fin de période.</Text>
        </Box>
        <Badge color="gray" variant="soft"><InfoCircledIcon width="12" /> COD → reversement séparé</Badge>
      </Flex>
      <Flex direction="column" gap="2">
        {modes.map((m) => (
          <Flex key={m.merchant} align="center" justify="between" gap="3" p="2"
            style={{ borderRadius: 'var(--radius-3)', border: '1px solid var(--gray-a3)' }}>
            <Flex align="center" gap="3" style={{ minWidth: 0 }}>
              <Flex align="center" justify="center" style={{ width: 34, height: 34, borderRadius: 'var(--radius-3)', background: 'var(--gray-a3)', color: 'var(--gray-11)', flex: '0 0 34px' }}><PersonIcon /></Flex>
              <Text size="2" weight="medium">{m.merchant}</Text>
            </Flex>
            <SegmentedControl.Root size="1" value={m.mode} onValueChange={(v) => onSet(m.merchant, v)}>
              <SegmentedControl.Item value="prepaid">Prépayé</SegmentedControl.Item>
              <SegmentedControl.Item value="postpaid">Postpayé</SegmentedControl.Item>
            </SegmentedControl.Root>
          </Flex>
        ))}
      </Flex>
    </Card>
  );
}

function DisputeDialog({ invoice, onDispute, busy }: {
  invoice: Invoice; onDispute: (amount: number, note: string) => void; busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [amount, setAmount] = React.useState('1200');
  const [note, setNote] = React.useState('');
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button size="2" variant="soft" color="amber">Ouvrir litige</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Ouvrir un litige — {invoice.ref}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Le marchand conteste un montant de cette facture.</Dialog.Description>
        <Text as="div" size="2" weight="medium" mb="2">Montant contesté</Text>
        <TextField.Root value={amount} onChange={(e) => setAmount(e.target.value)} type="number">
          <TextField.Slot side="right"><Text size="2" color="gray">DH</Text></TextField.Slot>
        </TextField.Root>
        <Box mt="3"><Text as="div" size="2" weight="medium" mb="2">Motif</Text>
          <TextArea placeholder="Décrivez l’objet du litige…" value={note} onChange={(e) => setNote(e.target.value)} /></Box>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button color="amber" disabled={busy} onClick={() => { onDispute(Number(amount) || 0, note); setOpen(false); }}>Ouvrir le litige</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function ResolveDialog({ invoice, onResolve, busy }: {
  invoice: Invoice; onResolve: (decision: string) => void; busy: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [decision, setDecision] = React.useState('avoir');
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button size="2" color="green" style={{ flex: 1 }}>Traiter le litige</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title>Traiter le litige — {invoice.ref}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Montant contesté : {invoice.disputeAmount ? money(invoice.disputeAmount) : '—'}.
        </Dialog.Description>
        <Text as="div" size="2" weight="medium" mb="2">Décision</Text>
        <Select.Root value={decision} onValueChange={setDecision} size="2">
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="avoir">Émettre un avoir</Select.Item>
            <Select.Item value="reject">Rejeter la contestation</Select.Item>
          </Select.Content>
        </Select.Root>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button color="green" disabled={busy} onClick={() => { onResolve(decision); setOpen(false); }}>Valider</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
