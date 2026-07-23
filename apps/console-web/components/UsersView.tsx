'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Badge, Button, IconButton, Table, Dialog, AlertDialog,
  Select, TextField, DropdownMenu, Avatar, Separator, Callout,
} from '@radix-ui/themes';
import {
  PersonIcon, PlusIcon, DotsHorizontalIcon, ReloadIcon, LockClosedIcon, CheckIcon,
  CopyIcon, InfoCircledIcon,
} from '@radix-ui/react-icons';
import type { ConsoleUser, ConsoleRole } from '@transpo/api-client';
import { PageHeader, KPI } from './ui';

const ROLES: ConsoleRole[] = ['ADMIN', 'DISPATCHER', 'COMPTABLE'];
const ROLE_LABEL: Record<ConsoleRole, string> = { ADMIN: 'Administrateur', DISPATCHER: 'Dispatcher', COMPTABLE: 'Comptable' };
const ROLE_COLOR: Record<ConsoleRole, 'indigo' | 'cyan' | 'amber'> = { ADMIN: 'indigo', DISPATCHER: 'cyan', COMPTABLE: 'amber' };
const ROLE_PERMISSIONS: Record<ConsoleRole, string> = {
  ADMIN: 'Accès complet à tous les modules de la console.',
  DISPATCHER: 'Commandes, Dispatch, Chauffeurs (lecture seule).',
  COMPTABLE: 'Facturation, Tarification (lecture seule).',
};

function initials(name: string) {
  return name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
}

export function UsersView({ users, isAdmin }: { users: ConsoleUser[]; isAdmin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [revealed, setRevealed] = React.useState<{ label: string; password: string } | null>(null);
  const active = users.filter((u) => u.active).length;
  const admins = users.filter((u) => u.role === 'ADMIN' && u.active).length;

  async function call(path: string, method: string, body?: unknown): Promise<any> {
    setBusy(true);
    const res = await fetch(`/api/proxy/v1/${path}`, {
      method, headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    const data = await res.json().catch(() => null);
    if (res.ok) { router.refresh(); return data; }
    alert(data?.error ?? 'Action impossible');
    return null;
  }

  async function invite(input: { email: string; name: string; role: ConsoleRole }) {
    const res = await call('users', 'POST', input);
    if (res) setRevealed({ label: `${res.name} (${res.email})`, password: res.tempPassword });
    return !!res;
  }

  async function resetPassword(u: ConsoleUser) {
    const res = await call(`users/${u.id}/reset-password`, 'POST');
    if (res) setRevealed({ label: u.name, password: res.tempPassword });
  }

  return (
    <>
      <PageHeader
        title="Utilisateurs & rôles"
        subtitle={`${users.length} utilisateur(s) · ${active} actif(s) · ${admins} administrateur(s)`}
        actions={isAdmin ? <InviteUserDialog onInvite={invite} busy={busy} /> : undefined}
      />

      <Grid columns={{ initial: '2', md: '4' }} gap="3" mb="4">
        <KPI label="Utilisateurs" value={String(users.length)} icon={<PersonIcon width="15" />} accent="indigo" />
        <KPI label="Actifs" value={String(active)} icon={<CheckIcon width="15" />} accent="green" />
        <KPI label="Administrateurs" value={String(admins)} icon={<LockClosedIcon width="15" />} accent="amber" />
        <KPI label="Inactifs" value={String(users.length - active)} icon={<InfoCircledIcon width="15" />} accent="gray" />
      </Grid>

      <Grid columns={{ initial: '1', lg: '3' }} gap="4" style={{ alignItems: 'start' }}>
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="1">
            <Table.Root size="2" variant="ghost">
              <Table.Header><Table.Row>
                <Table.ColumnHeaderCell>Utilisateur</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Rôle</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Statut</Table.ColumnHeaderCell>
                {isAdmin && <Table.ColumnHeaderCell />}
              </Table.Row></Table.Header>
              <Table.Body>
                {users.map((u) => (
                  <Table.Row key={u.id} align="center">
                    <Table.RowHeaderCell>
                      <Flex align="center" gap="2">
                        <Avatar size="2" radius="full" fallback={initials(u.name)} color={ROLE_COLOR[u.role]} />
                        <Box><Text as="div" size="2" weight="medium">{u.name}</Text><Text as="div" size="1" color="gray">{u.email}</Text></Box>
                      </Flex>
                    </Table.RowHeaderCell>
                    <Table.Cell><Badge color={ROLE_COLOR[u.role]} variant="soft">{ROLE_LABEL[u.role]}</Badge></Table.Cell>
                    <Table.Cell><Badge color={u.active ? 'green' : 'gray'} variant="soft">{u.active ? 'Actif' : 'Désactivé'}</Badge></Table.Cell>
                    {isAdmin && (
                      <Table.Cell>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger><IconButton size="1" variant="ghost" color="gray"><DotsHorizontalIcon /></IconButton></DropdownMenu.Trigger>
                          <DropdownMenu.Content>
                            <ChangeRoleItem user={u} onChange={(role) => call(`users/${u.id}/role`, 'PATCH', { role })} />
                            <DropdownMenu.Item onSelect={() => resetPassword(u)}><ReloadIcon /> Réinitialiser le mot de passe</DropdownMenu.Item>
                            <DropdownMenu.Separator />
                            {u.active ? (
                              <DeactivateItem user={u} onConfirm={() => call(`users/${u.id}/active`, 'PATCH', { active: false })} />
                            ) : (
                              <DropdownMenu.Item onSelect={() => call(`users/${u.id}/active`, 'PATCH', { active: true })}><CheckIcon /> Réactiver</DropdownMenu.Item>
                            )}
                          </DropdownMenu.Content>
                        </DropdownMenu.Root>
                      </Table.Cell>
                    )}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
            {users.length === 0 && <Box p="4"><Text size="2" color="gray">Aucun utilisateur.</Text></Box>}
          </Card>
        </Box>

        <Card size="3">
          <Heading size="4" mb="1">Permissions par rôle</Heading>
          <Text size="1" color="gray" mb="3">Vérifiées côté serveur — l'affichage ci-dessous est informatif.</Text>
          <Flex direction="column" gap="3">
            {ROLES.map((r, i) => (
              <React.Fragment key={r}>
                {i > 0 && <Separator size="4" />}
                <Box>
                  <Badge color={ROLE_COLOR[r]} variant="soft" mb="1">{ROLE_LABEL[r]}</Badge>
                  <Text as="div" size="2" color="gray">{ROLE_PERMISSIONS[r]}</Text>
                </Box>
              </React.Fragment>
            ))}
          </Flex>
        </Card>
      </Grid>

      <RevealPasswordDialog revealed={revealed} onClose={() => setRevealed(null)} />
    </>
  );
}

function ChangeRoleItem({ user, onChange }: { user: ConsoleUser; onChange: (role: ConsoleRole) => void }) {
  const [open, setOpen] = React.useState(false);
  const [role, setRole] = React.useState<ConsoleRole>(user.role);
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) setRole(user.role); }}>
      <Dialog.Trigger><DropdownMenu.Item onSelect={(e) => { e.preventDefault(); setOpen(true); }}><PersonIcon /> Changer de rôle</DropdownMenu.Item></Dialog.Trigger>
      <Dialog.Content maxWidth="360px">
        <Dialog.Title>Changer de rôle</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{user.name}</Dialog.Description>
        <Select.Root value={role} onValueChange={(v) => setRole(v as ConsoleRole)}>
          <Select.Trigger style={{ width: '100%' }} />
          <Select.Content>{ROLES.map((r) => <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>)}</Select.Content>
        </Select.Root>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={role === user.role} onClick={() => { onChange(role); setOpen(false); }}>Enregistrer</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function DeactivateItem({ user, onConfirm }: { user: ConsoleUser; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger><DropdownMenu.Item color="red" onSelect={(e) => e.preventDefault()}><LockClosedIcon /> Désactiver</DropdownMenu.Item></AlertDialog.Trigger>
      <AlertDialog.Content maxWidth="380px">
        <AlertDialog.Title>Désactiver {user.name} ?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          L'utilisateur ne pourra plus se connecter. Si c'est le dernier administrateur actif du tenant, l'action sera refusée.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Annuler</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={onConfirm}>Désactiver</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
}

function InviteUserDialog({ onInvite, busy }: { onInvite: (b: { email: string; name: string; role: ConsoleRole }) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ email: '', name: '', role: 'DISPATCHER' as ConsoleRole });
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()) && f.name.trim().length > 0;
  async function submit() {
    const ok = await onInvite({ email: f.email.trim(), name: f.name.trim(), role: f.role });
    if (ok) { setOpen(false); setF({ email: '', name: '', role: 'DISPATCHER' }); }
  }
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> Inviter</Button></Dialog.Trigger>
      <Dialog.Content maxWidth="420px">
        <Dialog.Title>Inviter un utilisateur</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">Un mot de passe temporaire sera généré — à communiquer à l'utilisateur.</Dialog.Description>
        <Flex direction="column" gap="3">
          <Box><Text as="div" size="2" weight="medium" mb="1">Nom</Text>
            <TextField.Root value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Nom complet" /></Box>
          <Box><Text as="div" size="2" weight="medium" mb="1">Email</Text>
            <TextField.Root type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="prenom.nom@tenant.ma" /></Box>
          <Box><Text as="div" size="2" weight="medium" mb="1">Rôle</Text>
            <Select.Root value={f.role} onValueChange={(v) => setF({ ...f, role: v as ConsoleRole })}>
              <Select.Trigger style={{ width: '100%' }} />
              <Select.Content>{ROLES.map((r) => <Select.Item key={r} value={r}>{ROLE_LABEL[r]}</Select.Item>)}</Select.Content>
            </Select.Root></Box>
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button disabled={!valid || busy} onClick={submit}>Inviter</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function RevealPasswordDialog({ revealed, onClose }: { revealed: { label: string; password: string } | null; onClose: () => void }) {
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => { if (revealed) setCopied(false); }, [revealed]);
  return (
    <Dialog.Root open={!!revealed} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Content maxWidth="380px">
        <Dialog.Title>Mot de passe temporaire</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="3">{revealed?.label}</Dialog.Description>
        <Callout.Root color="amber" size="1" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>Ce mot de passe ne sera plus affiché — communiquez-le à l'utilisateur maintenant.</Callout.Text>
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
