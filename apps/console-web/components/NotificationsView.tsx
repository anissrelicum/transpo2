'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Badge, Button, IconButton, Table, Callout, Dialog,
  Select, TextField, DropdownMenu, Separator,
} from '@radix-ui/themes';
import {
  PaperPlaneIcon, ExclamationTriangleIcon, DotsHorizontalIcon, ReloadIcon,
  MagnifyingGlassIcon, CheckCircledIcon, LapTimerIcon, CrossCircledIcon, LockOpen1Icon,
} from '@radix-ui/react-icons';
import { renderTemplate, templateVars } from '@transpo/domain';
import type { NotificationRow, NotifTemplate } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const CHANNELS = ['SMS', 'WHATSAPP', 'PUSH', 'EMAIL'];
const STATUS_COLOR: Record<string, 'green' | 'blue' | 'red' | 'gray'> = { SENT: 'green', QUEUED: 'blue', BLOCKED: 'red' };
const STATUS_LABEL: Record<string, string> = { SENT: 'Envoyée', QUEUED: 'En file', BLOCKED: 'Bloquée' };

function when(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function NotificationsView({ notifications, templates, canWrite }: {
  notifications: NotificationRow[]; templates: NotifTemplate[]; canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('all');
  const [channel, setChannel] = React.useState('all');

  const sent = notifications.filter((n) => n.status === 'SENT').length;
  const queued = notifications.filter((n) => n.status === 'QUEUED').length;
  const blocked = notifications.filter((n) => n.status === 'BLOCKED');
  const rate = notifications.length ? Math.round((sent / notifications.length) * 100) : null;

  const rows = notifications.filter((n) => {
    if (status !== 'all' && n.status !== status) return false;
    if (channel !== 'all' && n.channel !== channel) return false;
    if (q && !`${n.event} ${n.recipient} ${n.body}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/notifications${path}`, {
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
        title="Centre de notifications"
        subtitle={`${notifications.length} envois tracés · ${blocked.length} bloqué(s)`}
        actions={canWrite ? <SendDialog templates={templates} onSend={(b) => call('/send', 'POST', b)} busy={busy} /> : undefined}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Envois tracés" value={String(notifications.length)} delta="tous canaux" deltaColor="gray" icon={<PaperPlaneIcon width="15" />} accent="indigo" />
        <KPI label="Délivrées" value={String(sent)} delta={rate != null ? `${rate} % du total` : '—'} deltaColor="green" icon={<CheckCircledIcon width="15" />} accent="green" />
        <KPI label="En file" value={String(queued)} delta="à traiter" deltaColor="gray" icon={<LapTimerIcon width="15" />} accent="cyan" />
        <KPI label="Bloquées" value={String(blocked.length)} delta="consentement / modèle" deltaColor={blocked.length ? 'red' : 'gray'} icon={<CrossCircledIcon width="15" />} accent={blocked.length ? 'red' : 'gray'} />
      </Grid>

      {blocked.length > 0 && (
        <Callout.Root color="red" mb="4">
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text>
            <strong>{blocked.length} notification(s) bloquée(s)</strong> — le plus souvent un opt-in marketing manquant (loi 09-08).
            Enregistrez le consentement du destinataire, puis rejouez l’envoi.
          </Callout.Text>
        </Callout.Root>
      )}

      <Flex gap="3" mb="3" wrap="wrap">
        <TextField.Root placeholder="Rechercher (événement, destinataire, texte)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 300 }}>
          <TextField.Slot><MagnifyingGlassIcon /></TextField.Slot>
        </TextField.Root>
        <Select.Root value={status} onValueChange={setStatus}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Tous statuts</Select.Item>
            {Object.keys(STATUS_LABEL).map((s) => <Select.Item key={s} value={s}>{STATUS_LABEL[s]}</Select.Item>)}
          </Select.Content>
        </Select.Root>
        <Select.Root value={channel} onValueChange={setChannel}>
          <Select.Trigger />
          <Select.Content>
            <Select.Item value="all">Tous canaux</Select.Item>
            {CHANNELS.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}
          </Select.Content>
        </Select.Root>
        {canWrite && <ConsentDialog onSave={(b) => call('/consent', 'POST', b)} busy={busy} />}
      </Flex>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Événement</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Destinataire</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Message</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Date</Table.ColumnHeaderCell>
            {canWrite && <Table.ColumnHeaderCell />}
          </Table.Row></Table.Header>
          <Table.Body>
            {rows.map((n) => (
              <Table.Row key={n.id} align="center">
                <Table.RowHeaderCell>
                  <Box>
                    <Text as="div" size="2" weight="medium">{n.event}</Text>
                    <Badge variant="soft" color="gray" size="1">{n.channel}</Badge>
                  </Box>
                </Table.RowHeaderCell>
                <Table.Cell><Text size="2">{n.recipient}</Text></Table.Cell>
                <Table.Cell style={{ maxWidth: 380 }}>
                  <Text as="div" size="2" style={n.lang === 'ar' ? { direction: 'rtl' } : undefined}>{n.body}</Text>
                  {n.reason && <Text as="div" size="1" color="red">{n.reason}</Text>}
                </Table.Cell>
                <Table.Cell><Badge color={STATUS_COLOR[n.status] || 'gray'} variant="soft">{STATUS_LABEL[n.status] || n.status}</Badge></Table.Cell>
                <Table.Cell><Text size="1" color="gray">{when(n.createdAt)}</Text></Table.Cell>
                {canWrite && (
                  <Table.Cell>
                    {n.status !== 'SENT' && (
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <DropdownMenu.Item onSelect={() => call(`/${n.id}/retry`, 'POST')}><ReloadIcon /> Rejouer l’envoi</DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    )}
                  </Table.Cell>
                )}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        {rows.length === 0 && (
          <Box p="4"><Text size="2" color="gray">{notifications.length ? 'Aucune notification ne correspond au filtre.' : 'Aucune notification envoyée.'}</Text></Box>
        )}
      </Card>
    </>
  );
}

function ConsentDialog({ onSave, busy }: { onSave: (b: any) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ subject: '', channel: 'SMS', optedIn: true });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button variant="soft" color="gray"><LockOpen1Icon /> Consentement</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Consentement marketing</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Opt-in / opt-out par destinataire et par canal (loi 09-08). Sans opt-in, les envois marketing restent bloqués.
        </Dialog.Description>
        <Flex direction="column" gap="3">
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Destinataire</Text>
            <TextField.Root value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="+212600000000" />
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Canal</Text>
            <Select.Root value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}>
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>{CHANNELS.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
            </Select.Root>
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Décision</Text>
            <Select.Root value={f.optedIn ? 'in' : 'out'} onValueChange={(v) => setF({ ...f, optedIn: v === 'in' })}>
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>
                <Select.Item value="in">Consentement accordé</Select.Item>
                <Select.Item value="out">Consentement retiré</Select.Item>
              </Select.Content>
            </Select.Root>
          </Box>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!f.subject.trim() || busy}
            onClick={async () => { if (await onSave({ ...f, subject: f.subject.trim() })) setOpen(false); }}
          >Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function SendDialog({ templates, onSend, busy }: {
  templates: NotifTemplate[]; onSend: (b: any) => Promise<boolean>; busy: boolean;
}) {
  const usable = templates.filter((t) => t.active);
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ event: usable[0]?.event ?? '', channel: 'SMS', recipient: '', lang: 'fr' as 'fr' | 'ar' });
  const [vars, setVars] = React.useState<Record<string, string>>({});

  const tpl = templates.find((t) => t.event === f.event);
  const text = tpl ? (f.lang === 'ar' ? tpl.ar : tpl.fr) : '';
  const needed = tpl ? templateVars(text) : [];
  const valid = !!tpl && f.recipient.trim().length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PaperPlaneIcon /> Envoyer</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="520px">
        <Dialog.Title>Envoyer une notification</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Le message est rendu depuis le modèle du tenant. Un envoi marketing sans opt-in sera tracé comme bloqué.
        </Dialog.Description>

        <Flex direction="column" gap="3">
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Événement</Text>
              <Select.Root value={f.event} onValueChange={(v) => { setF({ ...f, event: v }); setVars({}); }}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{usable.map((t) => <Select.Item key={t.event} value={t.event}>{t.event}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Canal</Text>
              <Select.Root value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content>{CHANNELS.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
              </Select.Root>
            </Box>
          </Grid>
          <Grid columns="2" gap="3">
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Destinataire</Text>
              <TextField.Root value={f.recipient} onChange={(e) => setF({ ...f, recipient: e.target.value })} placeholder="+212600000000" />
            </Box>
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Langue</Text>
              <Select.Root value={f.lang} onValueChange={(v) => setF({ ...f, lang: v as 'fr' | 'ar' })}>
                <Select.Trigger style={{ width: '100%' }} />
                <Select.Content><Select.Item value="fr">Français</Select.Item><Select.Item value="ar">العربية</Select.Item></Select.Content>
              </Select.Root>
            </Box>
          </Grid>

          {needed.length > 0 && (
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Variables du modèle</Text>
              <Grid columns="2" gap="2">
                {needed.map((v) => (
                  <TextField.Root key={v} value={vars[v] ?? ''} placeholder={`{${v}}`}
                    onChange={(e) => setVars({ ...vars, [v]: e.target.value })} />
                ))}
              </Grid>
            </Box>
          )}

          {tpl && (
            <>
              <Separator size="4" />
              <Box>
                <Flex align="center" gap="2" mb="2">
                  <Text size="2" weight="medium">Aperçu</Text>
                  <Badge color={tpl.transactional ? 'green' : 'amber'} variant="soft" size="1">
                    {tpl.transactional ? 'Transactionnel' : 'Marketing — opt-in requis'}
                  </Badge>
                </Flex>
                <Card size="1" variant="surface">
                  <Text as="div" size="2" style={f.lang === 'ar' ? { direction: 'rtl' } : undefined}>
                    {renderTemplate(text, vars)}
                  </Text>
                </Card>
              </Box>
            </>
          )}
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button
            disabled={!valid || busy}
            onClick={async () => {
              const ok = await onSend({ event: f.event, channel: f.channel, recipient: f.recipient.trim(), lang: f.lang, vars });
              if (ok) { setOpen(false); setVars({}); setF({ ...f, recipient: '' }); }
            }}
          >Envoyer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
