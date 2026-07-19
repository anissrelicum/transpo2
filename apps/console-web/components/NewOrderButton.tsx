'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, Button, Flex, Box, Text, TextField, Select, Switch, Callout,
} from '@radix-ui/themes';
import { PlusIcon } from '@radix-ui/react-icons';

const CITIES = ['Casablanca', 'Rabat', 'Salé', 'Marrakech', 'Tanger', 'Fès', 'Mohammedia', 'Kénitra'];
const SIZES = ['Petit', 'Moyen', 'Grand', 'Très grand'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Text as="label" size="2" weight="medium" mb="1" style={{ display: 'block' }}>{label}</Text>
      {children}
    </Box>
  );
}

export function NewOrderButton() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [f, setF] = React.useState({ merchant: '', fromCity: 'Casablanca', toCity: 'Rabat', cod: '', size: 'Moyen', scheduled: false });

  const set = (k: string, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function submit() {
    setLoading(true); setError(null);
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        merchant: f.merchant || undefined,
        fromCity: f.fromCity, toCity: f.toCity,
        cod: f.cod ? Number(f.cod) : 0,
        size: f.size, scheduled: f.scheduled,
      }),
    });
    setLoading(false);
    if (res.ok) {
      setOpen(false);
      setF({ merchant: '', fromCity: 'Casablanca', toCity: 'Rabat', cod: '', size: 'Moyen', scheduled: false });
      router.refresh(); // recharge la liste (Server Component)
    } else {
      const d = await res.json().catch(() => null);
      setError(d?.error ?? 'Création impossible');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>
        <Button><PlusIcon /> Nouvelle commande</Button>
      </Dialog.Trigger>
      <Dialog.Content style={{ maxWidth: 460 }}>
        <Dialog.Title>Nouvelle commande</Dialog.Title>
        <Dialog.Description size="2" color="gray" mb="4">
          Crée une commande dans votre organisation.
        </Dialog.Description>

        <Flex direction="column" gap="3">
          {error && (
            <Callout.Root color="red" role="alert" size="1"><Callout.Text>{error}</Callout.Text></Callout.Root>
          )}
          <Field label="Marchand (optionnel)">
            <TextField.Root placeholder="Boutique Zellige" value={f.merchant} onChange={(e) => set('merchant', e.target.value)} />
          </Field>
          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Field label="Ville de départ">
                <Select.Root value={f.fromCity} onValueChange={(v) => set('fromCity', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>{CITIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
                </Select.Root>
              </Field>
            </Box>
            <Box style={{ flex: 1 }}>
              <Field label="Ville d’arrivée">
                <Select.Root value={f.toCity} onValueChange={(v) => set('toCity', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>{CITIES.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
                </Select.Root>
              </Field>
            </Box>
          </Flex>
          <Flex gap="3">
            <Box style={{ flex: 1 }}>
              <Field label="COD (DH)">
                <TextField.Root type="number" inputMode="numeric" placeholder="0" value={f.cod} onChange={(e) => set('cod', e.target.value)} />
              </Field>
            </Box>
            <Box style={{ flex: 1 }}>
              <Field label="Taille">
                <Select.Root value={f.size} onValueChange={(v) => set('size', v)}>
                  <Select.Trigger style={{ width: '100%' }} />
                  <Select.Content>{SIZES.map((s) => <Select.Item key={s} value={s}>{s}</Select.Item>)}</Select.Content>
                </Select.Root>
              </Field>
            </Box>
          </Flex>
          <Text as="label" size="2">
            <Flex gap="2" align="center">
              <Switch checked={f.scheduled} onCheckedChange={(v) => set('scheduled', v)} /> Commande programmée
            </Flex>
          </Text>
        </Flex>

        <Flex gap="3" mt="4" justify="end">
          <Dialog.Close><Button variant="soft" color="gray">Annuler</Button></Dialog.Close>
          <Button onClick={submit} disabled={loading}>{loading ? 'Création…' : 'Créer'}</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
