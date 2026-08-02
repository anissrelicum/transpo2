'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Text, Badge, Button, IconButton, Table, Callout, Dialog, AlertDialog,
  Switch, TextField, TextArea, DropdownMenu, Separator,
} from '@radix-ui/themes';
import {
  PlusIcon, Pencil1Icon, DotsHorizontalIcon, ResetIcon, InfoCircledIcon, ChatBubbleIcon,
} from '@radix-ui/react-icons';
import { templateVars, renderTemplate } from '@transpo/domain';
import type { NotifTemplate } from '@transpo/api-client';
import { PageHeader } from './ui';

const EVENT_RE = /^[a-z][a-z0-9]*(\.[a-z0-9]+)*$/;
// Valeurs d'exemple pour l'aperçu ; toute variable inconnue reste visible telle quelle.
const SAMPLE: Record<string, string> = { code: 'TRACK123', x: 'Boutique Zellige', ref: 'CMD-20260712-013' };

export function TemplatesView({ templates, isAdmin }: { templates: NotifTemplate[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  const marketing = templates.filter((t) => !t.transactional).length;
  const inactive = templates.filter((t) => !t.active).length;
  const customized = templates.filter((t) => t.customized).length;

  async function call(path: string, method: string, body?: unknown) {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/notifications/${path}`, {
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
        title="Modèles de notification"
        subtitle={`${templates.length} modèles · ${customized} personnalisé(s) · ${marketing} marketing`}
        actions={isAdmin ? <EditDialog onSave={(ev, b) => call(`templates/${encodeURIComponent(ev)}`, 'PUT', b)} busy={busy} /> : undefined}
      />

      <Callout.Root color="blue" mb="4">
        <Callout.Icon><InfoCircledIcon /></Callout.Icon>
        <Callout.Text>
          Les modèles <strong>transactionnels</strong> partent sans consentement préalable ; les modèles{' '}
          <strong>marketing</strong> exigent un opt-in du destinataire pour le canal (loi 09-08).
          Un modèle désactivé bloque tout envoi de l’événement.
          {inactive > 0 && <> <strong>{inactive} modèle(s) désactivé(s)</strong> actuellement.</>}
        </Callout.Text>
      </Callout.Root>

      <Card size="1">
        <Table.Root size="2" variant="ghost">
          <Table.Header><Table.Row>
            <Table.ColumnHeaderCell>Événement</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Français</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>العربية</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Variables</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Type</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Actif</Table.ColumnHeaderCell>
            {isAdmin && <Table.ColumnHeaderCell />}
          </Table.Row></Table.Header>
          <Table.Body>
            {templates.map((t) => {
              const vars = [...new Set([...templateVars(t.fr), ...templateVars(t.ar)])];
              return (
                <Table.Row key={t.event} align="center">
                  <Table.RowHeaderCell>
                    <Flex align="center" gap="2">
                      <Flex align="center" justify="center" style={{
                        width: 28, height: 28, borderRadius: 'var(--radius-2)', flex: '0 0 28px',
                        background: 'var(--gray-a3)', color: 'var(--gray-11)',
                      }}><ChatBubbleIcon width="14" /></Flex>
                      <Box>
                        <Text as="div" size="2" weight="medium">{t.event}</Text>
                        {t.customized && <Text as="div" size="1" color="indigo">Personnalisé</Text>}
                      </Box>
                    </Flex>
                  </Table.RowHeaderCell>
                  <Table.Cell><Text size="2">{t.fr}</Text></Table.Cell>
                  <Table.Cell><Text size="2" style={{ direction: 'rtl', display: 'block' }}>{t.ar}</Text></Table.Cell>
                  <Table.Cell>
                    <Flex gap="1" wrap="wrap">
                      {vars.length
                        ? vars.map((v) => <Badge key={v} variant="soft" color="gray" size="1">{`{${v}}`}</Badge>)
                        : <Text size="1" color="gray">—</Text>}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={t.transactional ? 'green' : 'amber'} variant="soft">
                      {t.transactional ? 'Transactionnel' : 'Marketing'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Switch
                      checked={t.active}
                      disabled={!isAdmin || busy}
                      onCheckedChange={(v) => call(`templates/${encodeURIComponent(t.event)}`, 'PUT', { active: v })}
                    />
                  </Table.Cell>
                  {isAdmin && (
                    <Table.Cell>
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                        <DropdownMenu.Content>
                          <EditDialog template={t} onSave={(ev, b) => call(`templates/${encodeURIComponent(ev)}`, 'PUT', b)} busy={busy} asItem />
                          <DropdownMenu.Separator />
                          <ResetItem template={t} onReset={() => call(`templates/${encodeURIComponent(t.event)}/reset`, 'POST')} />
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </Table.Cell>
                  )}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Root>
        {templates.length === 0 && <Box p="4"><Text size="2" color="gray">Aucun modèle.</Text></Box>}
      </Card>
    </>
  );
}

function ResetItem({ template, onReset }: { template: NotifTemplate; onReset: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger>
        <DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><ResetIcon /> Rétablir l’original</DropdownMenu.Item>
      </AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="400px">
        <AlertDialog.Title>Rétablir « {template.event} » ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Les textes FR/AR reviennent à leur valeur d’origine et le modèle est réactivé.
          Un événement ajouté par le tenant, absent du catalogue, est supprimé.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onReset}>Rétablir</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

/** Édite un modèle existant, ou en crée un quand `template` est absent. */
function EditDialog({ template, onSave, busy, asItem }: {
  template?: NotifTemplate;
  onSave: (event: string, body: any) => Promise<boolean>;
  busy: boolean;
  asItem?: boolean;
}) {
  const creating = !template;
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({
    event: template?.event ?? '',
    fr: template?.fr ?? '',
    ar: template?.ar ?? '',
    transactional: template?.transactional ?? true,
  });

  function reset() {
    setF({
      event: template?.event ?? '', fr: template?.fr ?? '', ar: template?.ar ?? '',
      transactional: template?.transactional ?? true,
    });
  }

  const eventOk = !creating || EVENT_RE.test(f.event.trim());
  const valid = eventOk && f.fr.trim().length > 0 && f.ar.trim().length > 0;
  const vars = [...new Set([...templateVars(f.fr), ...templateVars(f.ar)])];

  async function submit() {
    const ok = await onSave(creating ? f.event.trim() : template!.event, {
      fr: f.fr.trim(), ar: f.ar.trim(), transactional: f.transactional,
    });
    if (ok) { setOpen(false); if (creating) setF({ event: '', fr: '', ar: '', transactional: true }); }
  }

  const trigger = asItem
    ? <DropdownMenu.Item onSelect={(e) => { e.preventDefault(); reset(); setOpen(true); }}><Pencil1Icon /> Modifier</DropdownMenu.Item>
    : <Button><PlusIcon /> Nouveau modèle</Button>;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) reset(); }}>
      <Dialog.Trigger>{trigger}</Dialog.Trigger>
      <Dialog.Content maxWidth="620px">
        <Dialog.Title>{creating ? 'Nouveau modèle' : `Modifier « ${template!.event} »`}</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Les deux langues sont obligatoires. Utilisez des variables entre accolades, ex. <code>{'{code}'}</code>.
        </Dialog.Description>

        <Flex direction="column" gap="3">
          {creating && (
            <Box>
              <Text as="div" size="2" weight="medium" mb="1">Identifiant d’événement</Text>
              <TextField.Root
                value={f.event} onChange={(e) => setF({ ...f, event: e.target.value })}
                placeholder="order.scheduled" color={f.event && !eventOk ? 'red' : undefined}
              />
              {f.event && !eventOk && <Text size="1" color="red">Minuscules et points, ex. order.created</Text>}
            </Box>
          )}

          <Box>
            <Text as="div" size="2" weight="medium" mb="1">Français</Text>
            <TextArea value={f.fr} onChange={(e) => setF({ ...f, fr: e.target.value })} rows={2} placeholder="Votre colis {code} est enregistré." />
          </Box>
          <Box>
            <Text as="div" size="2" weight="medium" mb="1">العربية</Text>
            <TextArea value={f.ar} onChange={(e) => setF({ ...f, ar: e.target.value })} rows={2} style={{ direction: 'rtl' }} placeholder="تم تسجيل طردكم {code}." />
          </Box>

          <Flex align="center" justify="between">
            <Box>
              <Text as="div" size="2" weight="medium">Transactionnel</Text>
              <Text as="div" size="1" color="gray">Sans opt-in requis. Désactivez pour un message marketing.</Text>
            </Box>
            <Switch checked={f.transactional} onCheckedChange={(v) => setF({ ...f, transactional: v })} />
          </Flex>

          <Separator size="4" />
          <Box>
            <Flex align="center" gap="2" mb="2">
              <Text size="2" weight="medium">Aperçu</Text>
              {vars.map((v) => <Badge key={v} variant="soft" color="gray" size="1">{`{${v}}`}</Badge>)}
            </Flex>
            <Card size="1" variant="surface">
              <Text as="div" size="2">{f.fr ? renderTemplate(f.fr, SAMPLE) : <Text color="gray">—</Text>}</Text>
              <Text as="div" size="2" mt="1" style={{ direction: 'rtl' }}>{f.ar ? renderTemplate(f.ar, SAMPLE) : '—'}</Text>
            </Card>
          </Box>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!valid || busy} onClick={submit}>{creating ? 'Créer' : 'Enregistrer'}</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
