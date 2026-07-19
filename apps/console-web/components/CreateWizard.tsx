'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Card, Flex, Box, Grid, Text, Heading, Button, TextField, TextArea, Select,
  SegmentedControl, Switch, Separator, Callout, Badge, Spinner,
} from '@radix-ui/themes';
import {
  HomeIcon, SewingPinFilledIcon, CubeIcon, CheckIcon, ChevronLeftIcon,
  ChevronRightIcon, ArrowLeftIcon, DownloadIcon, InfoCircledIcon,
} from '@radix-ui/react-icons';
import { money } from '@transpo/ui-web';
import { CITIES_WITH_COORDS, cityDistanceKm, PARCEL_SIZES, PROOF_LEVELS } from '@transpo/domain';
import type { QuoteResult } from '@transpo/api-client';
import { PageHeader } from './ui';

const VEHICLES = ['Moto', 'Voiture', 'Fourgon', 'Fourgon frigorifique'];
const APPLIED_LABEL: Record<string, string> = { grille: 'Grille standard', remise: 'Remise contractuelle', fixe_marchand: 'Prix marchand' };
const STEPS = [
  { n: 1, label: 'Point de retrait', icon: HomeIcon },
  { n: 2, label: 'Point de livraison', icon: SewingPinFilledIcon },
  { n: 3, label: 'Colis & options', icon: CubeIcon },
];

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <Box>
      <Flex gap="1" align="center" mb="1">
        <Text as="label" size="2" weight="medium">{label}</Text>
        {required && <Text size="2" color="red">*</Text>}
      </Flex>
      {children}
      {hint && <Text as="p" size="1" color="gray" mt="1">{hint}</Text>}
    </Box>
  );
}
function PriceRow({ label, value }: { label: string; value: string }) {
  return <Flex justify="between" align="center"><Text size="2" color="gray">{label}</Text><Text size="2" weight="medium">{value}</Text></Flex>;
}

function AddressForm({ which, city, onCity }: { which: 'retrait' | 'livraison'; city: string; onCity: (v: string) => void }) {
  const isRet = which === 'retrait';
  return (
    <Flex direction="column" gap="4">
      <Heading size="4">{isRet ? 'Point de retrait' : 'Point de livraison'}</Heading>
      <Grid columns={{ initial: '1', sm: '2' }} gap="4">
        <Field label="Contact" required><TextField.Root placeholder="Nom du contact" size="2" /></Field>
        <Field label="Téléphone" required><TextField.Root placeholder="+212 6 00 00 00 00" size="2" /></Field>
      </Grid>
      <Field label="Adresse" required><TextField.Root placeholder="N°, rue, quartier" size="2" /></Field>
      <Field label="Ville" required>
        <Select.Root value={city} onValueChange={onCity} size="2">
          <Select.Trigger style={{ width: '100%' }} />
          <Select.Content>{CITIES_WITH_COORDS.map((c) => <Select.Item key={c} value={c}>{c}</Select.Item>)}</Select.Content>
        </Select.Root>
      </Field>
      <Field label="Notes pour le livreur"><TextArea placeholder="Instructions d’accès, étage, code…" size="2" /></Field>
    </Flex>
  );
}

export function CreateWizard({ merchants }: { merchants: string[] }) {
  const router = useRouter();
  const [step, setStep] = React.useState(1);
  const [size, setSize] = React.useState<string>(PARCEL_SIZES[1]);
  const [merchant, setMerchant] = React.useState('');
  const [fromCity, setFromCity] = React.useState(CITIES_WITH_COORDS[0]);
  const [toCity, setToCity] = React.useState(CITIES_WITH_COORDS[1]);
  const [proof, setProof] = React.useState<string>('photo_signature');
  const [fragile, setFragile] = React.useState(false);
  const [scheduled, setScheduled] = React.useState(false);
  const [cod, setCod] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Devis calculé par l'API (moteur réel) — recalculé à chaque changement.
  const distanceKm = cityDistanceKm(fromCity, toCity);
  const [q, setQ] = React.useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    setQuoting(true);
    fetch('/api/proxy/v1/pricing/quote', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ distanceKm, fragile, scheduled }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled) { setQ(data); setQuoting(false); } })
      .catch(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [distanceKm, fragile, scheduled]);

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ merchant: merchant || undefined, fromCity, toCity, cod: Number(cod) || 0, size, proofLevel: proof, scheduled }),
    });
    if (res.ok) { router.push('/orders'); router.refresh(); return; }
    setBusy(false);
    const d = await res.json().catch(() => null);
    setError(d?.error ?? 'Création impossible');
  }

  return (
    <Box style={{ maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        title="Nouvelle commande"
        subtitle="Créer une livraison en trois étapes"
        actions={<Button variant="soft" color="gray" onClick={() => router.push('/orders')}><ArrowLeftIcon /> Retour aux commandes</Button>}
      />

      <Card size="2" mb="4">
        <Flex align="center" gap="0">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <Flex align="center" gap="2" onClick={() => setStep(s.n)} style={{ cursor: 'pointer', flex: '0 0 auto' }}>
                <Flex align="center" justify="center" style={{ width: 30, height: 30, borderRadius: '50%', background: step >= s.n ? 'var(--indigo-9)' : 'var(--gray-a3)', color: step >= s.n ? 'white' : 'var(--gray-11)' }}>
                  {step > s.n ? <CheckIcon /> : <Text size="2" weight="bold">{s.n}</Text>}
                </Flex>
                <Box>
                  <Text as="div" size="1" color="gray">Étape {s.n}</Text>
                  <Text as="div" size="2" weight={step === s.n ? 'bold' : 'regular'} color={step === s.n ? undefined : 'gray'}>{s.label}</Text>
                </Box>
              </Flex>
              {i < STEPS.length - 1 && <Box style={{ flex: 1, height: 2, background: step > s.n ? 'var(--indigo-9)' : 'var(--gray-a4)', margin: '0 var(--space-3)' }} />}
            </React.Fragment>
          ))}
        </Flex>
      </Card>

      <Grid columns={{ initial: '1', md: '3' }} gap="4">
        <Box style={{ gridColumn: 'span 2' }}>
          <Card size="3">
            {error && <Callout.Root color="red" size="1" mb="3" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
            {step === 1 && <AddressForm which="retrait" city={fromCity} onCity={setFromCity} />}
            {step === 2 && <AddressForm which="livraison" city={toCity} onCity={setToCity} />}
            {step === 3 && (
              <Flex direction="column" gap="4">
                <Heading size="4">Colis & options</Heading>
                <Field label="Marchand" hint={merchants.length ? 'Marchands existants proposés' : undefined}>
                  {merchants.length ? (
                    <Select.Root value={merchant || '__none'} onValueChange={(v) => setMerchant(v === '__none' ? '' : v)} size="2">
                      <Select.Trigger data-testid="wizard-merchant" style={{ width: '100%' }} placeholder="Choisir un marchand" />
                      <Select.Content>
                        <Select.Item value="__none">— Aucun —</Select.Item>
                        <Select.Separator />
                        {merchants.map((m) => <Select.Item key={m} value={m}>{m}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  ) : (
                    <TextField.Root data-testid="wizard-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Nom du marchand" size="2" />
                  )}
                </Field>
                <Field label="Taille du colis" required>
                  <SegmentedControl.Root value={size} onValueChange={setSize} size="2">
                    {PARCEL_SIZES.map((s) => <SegmentedControl.Item key={s} value={s}>{s}</SegmentedControl.Item>)}
                  </SegmentedControl.Root>
                </Field>
                <Field label="Description du contenu"><TextArea placeholder="Ex. : coffret de 6 tasses en céramique" size="2" /></Field>
                <Grid columns={{ initial: '1', sm: '2' }} gap="4">
                  <Field label="Type de véhicule requis">
                    <Select.Root defaultValue={VEHICLES[0]} size="2"><Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>{VEHICLES.map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                    </Select.Root>
                  </Field>
                  <Field label="Niveau de preuve exigé" hint="Détermine les champs obligatoires côté livreur">
                    <Select.Root value={proof} onValueChange={setProof} size="2"><Select.Trigger style={{ width: '100%' }} />
                      <Select.Content>{PROOF_LEVELS.map((v) => <Select.Item key={v} value={v}>{v}</Select.Item>)}</Select.Content>
                    </Select.Root>
                  </Field>
                </Grid>
                <Separator size="4" />
                <Flex justify="between" align="center">
                  <Box><Text as="div" size="2" weight="medium">Colis fragile</Text><Text as="div" size="1" color="gray">Manipulation prioritaire</Text></Box>
                  <Switch checked={fragile} onCheckedChange={setFragile} />
                </Flex>
                <Flex justify="between" align="center">
                  <Box><Text as="div" size="2" weight="medium">Livraison programmée</Text><Text as="div" size="1" color="gray">Planifier un créneau plutôt qu’immédiat</Text></Box>
                  <Switch checked={scheduled} onCheckedChange={setScheduled} />
                </Flex>
                <Field label="Montant à encaisser (COD)" hint="Laisser vide si prépayé">
                  <TextField.Root value={cod} onChange={(e) => setCod(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" size="2">
                    <TextField.Slot side="right"><Text size="2" color="gray">DH</Text></TextField.Slot>
                  </TextField.Root>
                </Field>
              </Flex>
            )}

            <Separator size="4" my="4" />
            <Flex justify="between">
              <Button variant="soft" color="gray" disabled={step === 1} onClick={() => setStep(step - 1)}><ChevronLeftIcon /> Précédent</Button>
              {step < 3
                ? <Button onClick={() => setStep(step + 1)}>Continuer <ChevronRightIcon /></Button>
                : <Button color="green" disabled={busy} onClick={submit}><CheckIcon /> {busy ? 'Création…' : 'Créer la commande'}</Button>}
            </Flex>
          </Card>
        </Box>

        {/* Récap prix — calculé par l'API (moteur de tarification réel) */}
        <Box>
          <Card size="3" style={{ position: 'sticky', top: 72 }}>
            <Flex justify="between" align="center" mb="1">
              <Heading size="4">Estimation du prix</Heading>
              {quoting && <Spinner />}
            </Flex>
            <Text as="div" size="1" color="gray" mb="3">{fromCity} → {toCity} · {distanceKm} km</Text>
            {q ? (
              <Flex direction="column" gap="2">
                <Flex justify="between" align="center">
                  <Text size="1" color="gray">Tarification</Text>
                  <Badge color="gray" variant="soft">{APPLIED_LABEL[q.applied] ?? q.applied}</Badge>
                </Flex>
                <PriceRow label={`Base · ${distanceKm} km`} value={money(q.base)} />
                {q.surcharges > 0 && <PriceRow label="Suppléments (fragile/programmé)" value={money(q.surcharges)} />}
                <PriceRow label="HT" value={money(q.ht)} />
                <PriceRow label="TVA 20 %" value={money(q.tva)} />
                <Separator size="4" />
                <Flex justify="between" align="center">
                  <Text size="3" weight="bold">Total TTC</Text>
                  <Heading size="6" style={{ color: 'var(--indigo-11)' }}>{money(q.ttc)}</Heading>
                </Flex>
                {Number(cod) > 0 && (
                  <Callout.Root color="amber" size="1" mt="2">
                    <Callout.Icon><DownloadIcon /></Callout.Icon>
                    <Callout.Text>COD à encaisser à la livraison : <strong>{money(Number(cod))}</strong></Callout.Text>
                  </Callout.Root>
                )}
              </Flex>
            ) : (
              <Text size="2" color="gray">{quoting ? 'Calcul en cours…' : 'Sélectionnez les villes pour estimer.'}</Text>
            )}
            <Callout.Root color="gray" size="1" variant="surface" mt="3">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>Estimation calculée par le moteur de tarification. La grille du marchand s’applique en priorité.</Callout.Text>
            </Callout.Root>
          </Card>
        </Box>
      </Grid>
    </Box>
  );
}
