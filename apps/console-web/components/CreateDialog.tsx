'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, Button, Flex, Box, Text, TextField, Select, Switch, Callout } from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';

export type FieldDef = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'switch' | 'csv';
  options?: string[];
  placeholder?: string;
  default?: any;
};

// Dialog de création générique : construit un corps depuis un schéma de champs,
// POST authentifié via le proxy, puis rafraîchit la page.
export function CreateDialog({
  title, trigger, path, fields, varsMap,
}: {
  title: string;
  trigger?: string;
  path: string;                       // ex. "v1/dispatch/zones"
  fields: FieldDef[];
  // Regroupe certains champs sous un objet `vars` (ex. notifications) : { varKey: fieldName }.
  // Objet sérialisable (pas de fonction) — requis pour un composant client sous Server Component.
  varsMap?: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const init = () => Object.fromEntries(fields.map((f) => [
    f.name,
    f.default ?? (f.type === 'switch' ? false : f.type === 'select' ? (f.options?.[0] ?? '') : ''),
  ]));
  const [v, setV] = React.useState<Record<string, any>>(init);
  const set = (k: string, val: any) => setV((s) => ({ ...s, [k]: val }));

  async function submit() {
    setLoading(true); setError(null);
    const body: Record<string, any> = {};
    for (const f of fields) {
      const raw = v[f.name];
      if (f.type === 'number') body[f.name] = raw === '' ? undefined : Number(raw);
      else if (f.type === 'switch') body[f.name] = !!raw;
      else if (f.type === 'csv') body[f.name] = String(raw || '').split(',').map((x) => x.trim()).filter(Boolean);
      else body[f.name] = raw === '' ? undefined : raw;
    }
    let finalBody = body;
    if (varsMap) {
      const vars: Record<string, string> = {};
      for (const [varKey, fieldName] of Object.entries(varsMap)) vars[varKey] = String(body[fieldName] ?? '');
      const rest = { ...body };
      for (const fieldName of Object.values(varsMap)) delete rest[fieldName];
      finalBody = { ...rest, vars };
    }
    const res = await fetch(`/api/proxy/${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(finalBody),
    });
    setLoading(false);
    if (res.ok) { setOpen(false); setV(init()); router.refresh(); }
    else { const d = await res.json().catch(() => null); setError(d?.error ?? 'Création impossible'); }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger><Button><PlusIcon /> {trigger ?? title}</Button></Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 460 }}>
        <Dialog.Title>{title}</Dialog.Title>
        <Flex direction="column" gap="3" mt="2">
          {error && <Callout.Root color="red" size="1" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
          {fields.map((f) => (
            <Box key={f.name}>
              <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>{f.label}</Text>
              {f.type === 'select' ? (
                <Select.Root value={v[f.name] || f.options?.[0]} onValueChange={(val) => set(f.name, val)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>{(f.options ?? []).map((o) => <Select.Item key={o} value={o}>{o}</Select.Item>)}</Select.Content>
                </Select.Root>
              ) : f.type === 'switch' ? (
                <Switch checked={!!v[f.name]} onCheckedChange={(val) => set(f.name, val)} />
              ) : (
                <TextField.Root
                  type={f.type === 'number' ? 'number' : 'text'}
                  placeholder={f.placeholder}
                  value={v[f.name]}
                  onChange={(e) => set(f.name, e.target.value)}
                />
              )}
            </Box>
          ))}
        </Flex>
        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button onClick={submit} disabled={loading}>{loading ? 'Création…' : 'Créer'}</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
